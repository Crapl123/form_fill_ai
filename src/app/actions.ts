"use server";

import { extractFieldsFromExcel } from "@/ai/flows/extract-fields-from-excel";
import { matchFieldsWithSheetData } from "@/ai/flows/match-fields-with-google-sheet-data";
import { vendorMasterData } from "@/lib/data";
import { fillExcelData } from "@/lib/excel-writer";

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

  if (!file || file.size === 0) {
    return { ...prevState, status: "error", message: "Please upload a valid file." };
  }

  // Validate file type
  if (file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
     return { ...prevState, status: "error", message: "Invalid file type. Please upload an .xlsx file." };
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${fileBuffer.toString("base64")}`;

    // Step 1: Extract fields from Excel using AI
    const extractedFields = await extractFieldsFromExcel({
      excelDataUri: dataUri,
    });

    if (!extractedFields || extractedFields.length === 0) {
      return { ...prevState, status: "error", message: "AI could not detect any fields in the form. Please check the file." };
    }

    // Step 2: Match fields with Google Sheet data using AI
    const mappedData = await matchFieldsWithSheetData({
      formFields: extractedFields.map((f) => f.fieldName),
      sheetData: vendorMasterData,
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
