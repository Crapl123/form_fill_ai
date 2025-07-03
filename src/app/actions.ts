"use server";

import { extractFieldsFromExcel } from "@/ai/flows/extract-fields-from-excel";
import { matchFieldsWithSheetData } from "@/ai/flows/match-fields-with-google-sheet-data";
import { fillExcelData } from "@/lib/excel-writer";
import ExcelJS from "exceljs";

interface FormState {
  status: "idle" | "success" | "error" | "processing";
  message: string;
  fileData: string | null;
  fileName: string;
  mimeType: string;
}

export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const file = formData.get("file") as File;
  const masterDataJSON = formData.get("masterData") as string | null;

  if (!file || file.size === 0) {
    return { ...prevState, status: "error", message: "Please upload a valid vendor form." };
  }
  
  if (!masterDataJSON) {
    return { ...prevState, status: "error", message: "Master data is missing. Please go back to Step 1." };
  }

  // Validate file type
  if (file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
     return { ...prevState, status: "error", message: "Invalid file type. Please upload an .xlsx file." };
  }

  try {
    const masterData = JSON.parse(masterDataJSON);
    if (typeof masterData !== 'object' || masterData === null || Object.keys(masterData).length === 0) {
        return { ...prevState, status: "error", message: "Master data is invalid or empty. Please re-upload and parse it." };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Parse Excel and convert to text for the AI
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("No worksheet found in the file.");
    }
    
    let excelContent = "";
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        excelContent += `Cell: ${cell.address}, Value: '${cell.text}'\n`;
      });
    });

    // Step 1: Extract fields from Excel using AI
    const extractedFields = await extractFieldsFromExcel({
      excelContent: excelContent,
    });

    if (!extractedFields || extractedFields.length === 0) {
      return { ...prevState, status: "error", message: "AI could not detect any fields in the form. Please check the file." };
    }

    // Step 2: Match fields with master data using AI
    const mappedData = await matchFieldsWithSheetData({
      formFields: extractedFields.map((f) => f.fieldName),
      sheetData: masterData,
    });
    
    // Step 3: Write the mapped data back to the Excel file
    const filledExcelBuffer = await fillExcelData(fileBuffer, extractedFields, mappedData);

    const filledFileName = `filled-${file.name}`;

    return {
      status: "success",
      message: "File processed successfully!",
      fileData: filledExcelBuffer.toString("base64"),
      fileName: filledFileName,
      mimeType: file.type,
    };
  } catch (error) {
    console.error("Error processing form:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { ...prevState, status: "error", message: `Failed to process form. ${errorMessage}` };
  }
}
