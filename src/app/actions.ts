
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
  debugInfo?: string;
}

// Centralized and robust error state creation with detailed logging
function createErrorState(message: string, error?: unknown): FormState {
    console.error("Error state created. Message:", message, "Raw error object:", error);
    
    let errorDetails: string;
    
    if (error instanceof Error) {
        // Include stack trace for more context in debugging
        errorDetails = error.stack ? `${error.message}\n\nStack Trace:\n${error.stack}` : error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    } else {
        try {
            errorDetails = `A non-Error object was thrown: ${JSON.stringify(error, null, 2)}`;
        } catch (e) {
            errorDetails = 'A complex, non-serializable error object was thrown. The server logs may have more details.';
        }
    }
    
    return {
        status: "error",
        message: message, 
        fileData: null,
        fileName: "",
        mimeType: "",
        debugInfo: errorDetails,
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

        const aiResult = await extractFieldsFromExcel({ excelContent });
        
        if (!aiResult || !Array.isArray(aiResult)) {
            return createErrorState(
                "The AI could not extract any usable data from your Excel file. Please ensure it is properly formatted and try again.",
                `AI returned an invalid format. Expected an array, but got: ${JSON.stringify(aiResult, null, 2)}`
            );
        }
        
        extractedFields = aiResult;

        if (extractedFields.length === 0) {
            return createErrorState(
                "The AI could not detect any fields in the form. Please check the file and ensure it is a proper form.",
                "The AI returned an empty array, indicating no fields were found."
            );
        }
    } catch (e) {
        return createErrorState("An error occurred during AI field extraction.", e);
    }

    // --- 4. AI Data Matching ---
    let mappedData: Record<string, string>;
    try {
        mappedData = await matchFieldsWithSheetData({
          formFields: extractedFields.map((f) => f.fieldName),
          sheetData: masterData,
        });
        if (!mappedData) {
            return createErrorState("AI failed to map fields. The mapping service returned an empty response.");
        }
    } catch(e) {
        return createErrorState("An error occurred during AI data matching.", e);
    }
    
    // --- 5. Handle Missing Fields ---
    const missingFields = Object.entries(mappedData)
      .filter(([_, value]) => value === "" || value === null || value === undefined)
      .map(([key, _]) => key);

    if (missingFields.length > 0) {
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
        filledExcelBuffer = await fillExcelData(fileBuffer, extractedFields, mappedData);
        if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
            return createErrorState("The Excel writer failed to generate a valid file. The output was empty or invalid.");
        }
    } catch (e) {
        return createErrorState("Failed to write data to the new Excel file.", e);
    }

    // --- 7. Success State Creation ---
    return {
      status: "success",
      message: "File processed successfully!",
      fileData: filledExcelBuffer.toString("base64"),
      fileName: `filled-${file.name}`,
      mimeType: file.type,
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

      // --- 3. Excel Writing & Validation ---
      let filledExcelBuffer: Buffer;
      try {
        filledExcelBuffer = await fillExcelData(vendorFormBuffer, extractedFields, updatedMappedData);
         if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
            return createErrorState("The Excel writer failed to generate a valid file after filling missing data.");
        }
      } catch (e) {
        return createErrorState("Failed to write the additional user-provided data to the Excel file.", e);
      }
      
      // --- 4. Success State Creation ---
      return {
        status: "success",
        message: "File processed successfully with your additional data!",
        fileData: filledExcelBuffer.toString("base64"),
        fileName: `filled-${prevState.fileName}`,
        mimeType: prevState.mimeType,
      };
}

// Main server action entry point
export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const isSecondStep = formData.get("is-second-step") === "true";
    if (isSecondStep) {
      return await handleSecondaryUpload(prevState, formData);
    } else {
      return await handleInitialUpload(prevState, formData);
    }
  } catch (error) {
    // This is a final, critical-level catch-all.
    return createErrorState("A critical and unexpected error occurred in the main processing pipeline.", error);
  }
}
