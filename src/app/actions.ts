
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

async function handleInitialUpload(prevState: FormState, formData: FormData): Promise<FormState> {
    const file = formData.get("file") as File;
    const masterDataJSON = formData.get("masterData") as string | null;

    if (!file || file.size === 0) {
      return { ...prevState, status: "error", message: "Please upload a valid vendor form." };
    }
    
    if (file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
       return { ...prevState, status: "error", message: "Invalid file type. Please upload an .xlsx file." };
    }
    
    if (!masterDataJSON) {
      return { ...prevState, status: "error", message: "Master data is missing. Please go back to Step 1." };
    }
    
    let masterData: Record<string, string>;
    try {
        masterData = JSON.parse(masterDataJSON);
        if (typeof masterData !== 'object' || masterData === null || Object.keys(masterData).length === 0) {
            return { ...prevState, status: "error", message: "Master data is invalid or empty. Please re-upload and parse it in Step 1." };
        }
    } catch (e) {
        return { ...prevState, status: "error", message: "Failed to parse master data. Please check it in Step 1." };
    }

    let fileBuffer;
    try {
        fileBuffer = Buffer.from(await file.arrayBuffer());
    } catch(e) {
        return { ...prevState, status: "error", message: "Could not read the uploaded form file." };
    }

    let extractedFields;
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("No worksheet found in the file.");
        }
        
        let excelContent = "";
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            excelContent += `Cell: ${cell.address}, Value: '${cell.text ?? ''}'\n`;
          });
        });

        extractedFields = await extractFieldsFromExcel({
          excelContent: excelContent,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        return { ...prevState, status: "error", message: `Failed to extract fields from Excel: ${message}` };
    }


    if (!extractedFields || !Array.isArray(extractedFields) || extractedFields.length === 0) {
      return { ...prevState, status: "error", message: "AI could not detect any fields in the form. Please check the file." };
    }

    let mappedData;
    try {
        mappedData = await matchFieldsWithSheetData({
          formFields: extractedFields.map((f) => f.fieldName),
          sheetData: masterData,
        });
    } catch(e) {
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        return { ...prevState, status: "error", message: `Failed to map fields with AI: ${message}` };
    }
    
    if (!mappedData) {
      return { ...prevState, status: "error", message: "AI failed to map fields from your master data. Please check the files." };
    }
    
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
        missingFields: missingFields,
        mappedData: mappedData,
        vendorFormBuffer: fileBuffer.toString('base64'),
        extractedFields: extractedFields,
      };
    }
    
    let filledExcelBuffer;
    try {
        filledExcelBuffer = await fillExcelData(fileBuffer, extractedFields, mappedData);
    } catch (e) {
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        return { ...prevState, status: "error", message: `Failed to write data to Excel file: ${message}` };
    }

    if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer)) {
        return { ...prevState, status: "error", message: "The Excel writer failed to generate a valid file buffer." };
    }

    const filledFileName = `filled-${file.name}`;

    return {
      status: "success",
      message: "File processed successfully!",
      fileData: filledExcelBuffer.toString("base64"),
      fileName: filledFileName,
      mimeType: file.type,
    };
}

async function handleSecondaryUpload(prevState: FormState, formData: FormData): Promise<FormState> {
     if (!prevState.vendorFormBuffer || !prevState.extractedFields || !prevState.mappedData || !prevState.missingFields) {
        return { ...prevState, status: 'error', message: 'Session state lost. Please start over.' };
      }
      
      const vendorFormBuffer = Buffer.from(prevState.vendorFormBuffer, 'base64');
      const extractedFields = prevState.extractedFields;
      let updatedMappedData = { ...prevState.mappedData };

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

      let filledExcelBuffer;
      try {
        filledExcelBuffer = await fillExcelData(vendorFormBuffer, extractedFields, updatedMappedData);
      } catch (e) {
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        return { ...prevState, status: "error", message: `Failed to write additional data to Excel file: ${message}` };
      }
      
      if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer)) {
        return { ...prevState, status: "error", message: "The Excel writer failed to generate a valid file buffer after filling missing data." };
      }

      return {
        status: "success",
        message: "File processed successfully with your additional data!",
        fileData: filledExcelBuffer.toString("base64"),
        fileName: `filled-${prevState.fileName}`,
        mimeType: prevState.mimeType,
        missingFields: undefined,
        mappedData: undefined,
        vendorFormBuffer: undefined,
        extractedFields: undefined,
      };
}

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
    console.error("Critical error in processForm:", error);
    const errorMessage = error instanceof Error ? error.message : "A critical unknown error occurred.";
    return {
        status: "error",
        message: `A critical error occurred: ${errorMessage}. Please try again from the beginning.`,
        fileData: null,
        fileName: "",
        mimeType: "",
    };
  }
}
