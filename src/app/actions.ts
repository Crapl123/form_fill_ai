
"use server";

import { extractFieldsFromExcel, type ExtractFieldsFromExcelOutput } from "@/ai/flows/extract-fields-from-excel";
import { matchFieldsWithSheetData } from "@/ai/flows/match-fields-with-google-sheet-data";
import { fillExcelData } from "@/lib/excel-writer";
import ExcelJS from "exceljs";

interface FormState {
  status: "idle" | "success" | "error" | "processing" | "awaiting-input";
  message: string;
  fileData: string | null;
  fileName: string;
  mimeType: string;
  missingFields?: string[];
  mappedData?: Record<string, string>;
  vendorFormBuffer?: string;
  extractedFields?: ExtractFieldsFromExcelOutput;
}

// Centralized error state creation with logging
function createErrorState(message: string, error?: unknown): FormState {
    console.error("Creating error state:", message);
    if (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Underlying error:", errorMessage);
        // Return a more detailed message for debugging purposes
        message = `${message} - Details: ${errorMessage}`;
    }
    return {
        status: "error",
        message,
        fileData: null,
        fileName: "",
        mimeType: "",
    };
}

// Main logic for the initial form submission (Step 3)
async function handleInitialUpload(prevState: FormState, formData: FormData): Promise<FormState> {
    // --- 1. File Reading & Validation ---
    let file: File;
    let fileBuffer: Buffer;
    try {
        file = formData.get("file") as File;
        if (!file || file.size === 0) {
          return createErrorState("Please upload a valid vendor form.");
        }
        if (file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
           return createErrorState("Invalid file type. Please upload an .xlsx file.");
        }
        
        fileBuffer = Buffer.from(await file.arrayBuffer());
        console.log(`Successfully read uploaded file: ${file.name}, size: ${fileBuffer.length} bytes.`);
        if (fileBuffer.length === 0) {
            return createErrorState("The uploaded file appears to be empty.");
        }
    } catch(e) {
        return createErrorState("Could not read the uploaded form file.", e);
    }

    // --- 2. Master Data Parsing ---
    let masterData: Record<string, string>;
    try {
        const masterDataJSON = formData.get("masterData") as string | null;
        if (!masterDataJSON) {
          return createErrorState("Master data is missing. Please go back to Step 1.");
        }
        masterData = JSON.parse(masterDataJSON);
        if (typeof masterData !== 'object' || masterData === null || Object.keys(masterData).length === 0) {
            return createErrorState("Master data is invalid or empty. Please re-upload and parse it in Step 1.");
        }
        console.log(`Successfully parsed master data with ${Object.keys(masterData).length} entries.`);
    } catch (e) {
        return createErrorState("Failed to parse master data. Please check the data from Step 1.", e);
    }

    // --- 3. AI Field Extraction ---
    let extractedFields: ExtractFieldsFromExcelOutput;
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("No worksheet found in the Excel file.");
        }
        
        let excelContent = "";
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            excelContent += `Cell: ${cell.address}, Value: '${cell.text ?? ''}'\n`;
          });
        });

        if (!excelContent.trim()) {
            return createErrorState("The first sheet of the Excel file appears to have no content to analyze.");
        }

        console.log("Sending Excel text content to AI for field extraction...");
        extractedFields = await extractFieldsFromExcel({ excelContent });
        
        if (!extractedFields || !Array.isArray(extractedFields) || extractedFields.length === 0) {
            return createErrorState("AI could not detect any fields in the form. Please check the file and ensure it is a proper form.");
        }
        console.log(`AI successfully extracted ${extractedFields.length} fields.`);
    } catch (e) {
        return createErrorState("Failed to extract fields from Excel using AI.", e);
    }

    // --- 4. AI Data Matching ---
    let mappedData: Record<string, string>;
    try {
        console.log("Sending extracted fields to AI for data matching...");
        mappedData = await matchFieldsWithSheetData({
          formFields: extractedFields.map((f) => f.fieldName),
          sheetData: masterData,
        });
        if (!mappedData) {
            return createErrorState("AI failed to map fields. The mapping service returned an empty response.");
        }
        console.log(`AI successfully mapped ${Object.keys(mappedData).length} fields.`);
    } catch(e) {
        return createErrorState("An error occurred during AI data matching.", e);
    }
    
    // --- 5. Handle Missing Fields ---
    const missingFields = Object.entries(mappedData)
      .filter(([_, value]) => value === "" || value === null || value === undefined)
      .map(([key, _]) => key);

    if (missingFields.length > 0) {
      console.log(`Found ${missingFields.length} fields missing from master data. Awaiting user input.`);
      return {
        status: "awaiting-input",
        message: "Some data was not found in your master sheet. Please provide the values for the following fields.",
        fileData: null,
        fileName: file.name,
        mimeType: file.type,
        missingFields,
        mappedData,
        vendorFormBuffer: fileBuffer.toString('base64'),
        extractedFields,
      };
    }
    
    // --- 6. Excel Writing & Validation ---
    let filledExcelBuffer: Buffer;
    try {
        console.log("All fields mapped. Writing data to new Excel file...");
        filledExcelBuffer = await fillExcelData(fileBuffer, extractedFields, mappedData);
        // CRITICAL CHECK: Ensure the buffer is valid before proceeding.
        if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
            return createErrorState("The Excel writer failed to generate a valid file. The output was empty or invalid.");
        }
        console.log(`Successfully created filled Excel file, size: ${filledExcelBuffer.length} bytes.`);
    } catch (e) {
        return createErrorState("Failed to write data to the new Excel file.", e);
    }

    // --- 7. Success State Creation ---
    console.log("Process complete. Returning success state with file data.");
    return {
      status: "success",
      message: "File processed successfully!",
      fileData: filledExcelBuffer.toString("base64"), // This is now safe to call.
      fileName: `filled-${file.name}`,
      mimeType: file.type,
      missingFields: undefined,
      mappedData: undefined,
      vendorFormBuffer: undefined,
      extractedFields: undefined,
    };
}

// Logic for handling the submission of manually-entered missing data
async function handleSecondaryUpload(prevState: FormState, formData: FormData): Promise<FormState> {
     // --- 1. State Validation ---
     if (!prevState.vendorFormBuffer || !prevState.extractedFields || !prevState.mappedData || !prevState.missingFields) {
        return createErrorState('Session state lost. Please start over from Step 1.');
      }
      
      let vendorFormBuffer: Buffer;
      const extractedFields = prevState.extractedFields;
      let updatedMappedData = { ...prevState.mappedData };

      try {
        vendorFormBuffer = Buffer.from(prevState.vendorFormBuffer, 'base64');
        console.log("Restored original vendor form buffer for secondary upload.");
      } catch (e) {
        return createErrorState("Failed to restore the original form from session state.", e);
      }
      
      // --- 2. Update Data with Manual Input ---
      let allFieldsFilled = true;
      prevState.missingFields.forEach(field => {
        const value = formData.get(field) as string;
        if (value && value.trim() !== '') {
          updatedMappedData[field] = value;
        } else {
          allFieldsFilled = false;
        }
      });
      
      if(!allFieldsFilled) {
          return { ...prevState, status: 'awaiting-input', message: 'Please fill all the missing fields before submitting.' };
      }
      console.log("All missing fields have been filled manually by the user.");

      // --- 3. Excel Writing & Validation ---
      let filledExcelBuffer: Buffer;
      try {
        console.log("Writing manually entered data to new Excel file...");
        filledExcelBuffer = await fillExcelData(vendorFormBuffer, extractedFields, updatedMappedData);
         if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
            return createErrorState("The Excel writer failed to generate a valid file after filling missing data.");
        }
        console.log(`Successfully created final filled Excel file, size: ${filledExcelBuffer.length} bytes.`);
      } catch (e) {
        return createErrorState("Failed to write the additional user-provided data to the Excel file.", e);
      }
      
      // --- 4. Success State Creation ---
      console.log("Secondary upload process complete. Returning success state.");
      return {
        status: "success",
        message: "File processed successfully with your additional data!",
        fileData: filledExcelBuffer.toString("base64"), // Safe to call.
        fileName: `filled-${prevState.fileName}`,
        mimeType: prevState.mimeType,
        missingFields: undefined,
        mappedData: undefined,
        vendorFormBuffer: undefined,
        extractedFields: undefined,
      };
}

// Main server action entry point
export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  console.log("--- processForm action started ---");
  try {
    const isSecondStep = formData.get("is-second-step") === "true";
    if (isSecondStep) {
      console.log("Handling secondary upload (manual data entry).");
      return await handleSecondaryUpload(prevState, formData);
    } else {
      console.log("Handling initial upload.");
      return await handleInitialUpload(prevState, formData);
    }
  } catch (error) {
    // This is a final, critical-level catch-all.
    return createErrorState("A critical and unexpected error occurred in the main processing pipeline.", error);
  }
}
