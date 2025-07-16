
"use server";

import { correctFilledForm } from "@/ai/flows/correct-filled-form";
import { extractFieldsFromExcel } from "@/ai/flows/extract-fields-from-excel";
import { fillSupplierForm } from "@/ai/flows/fill-supplier-form";
import { mapDataToPdfFields } from "@/ai/flows/map-data-to-pdf-fields";
import { createMasterDataExcel, fillExcelData, FillInstruction } from "@/lib/excel-writer";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

/**
 * Retries a function if it fails with a specific "model overloaded" error.
 * Uses exponential backoff for delays.
 * @param fn The async function to retry.
 * @param retries The maximum number of retries.
 * @param delay The initial delay in milliseconds.
 * @returns The result of the function if successful.
 */
async function retryOnOverload<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Only retry for specific, transient overload errors.
      if (errorMessage.includes('The model is overloaded') && i < retries - 1) {
        console.log(`Model overloaded. Attempt ${i + 1} of ${retries}. Retrying in ${delay * (i + 1)}ms...`);
        await new Promise(res => setTimeout(res, delay * (i + 1))); // Use exponential backoff
      } else {
        // For other errors, or on the last retry, fail immediately.
        throw lastError;
      }
    }
  }
  throw lastError; // This should be unreachable due to the loop condition, but is good practice.
}


interface FilledField {
  cell: string;
  value: string;
  labelGuessed?: string;
}

interface MissingField {
    labelGuessed: string;
    targetCell: string;
}

export interface FormState {
  status: "idle" | "success" | "error" | "processing" | "preview";
  message: string;
  fileData: string | null;
  fileName: string;
  mimeType: string;
  debugInfo?: string;
  previewData?: FilledField[];
  missingFields?: MissingField[];
  updatedMasterData?: string | null;
  updatedMasterDataFileName?: string;
  updatedMasterDataJSON?: Record<string, string> | null;
}

function createErrorState(error: unknown): FormState {
    console.error("Creating error state from raw error:", error);
    
    let message = "An unexpected error occurred on the server. Please check the logs for more details.";
    let debugInfo: string;

    if (error instanceof Error) {
        message = error.message; // Start with the original message
        debugInfo = error.stack || error.message;

        // Add more specific, user-friendly messages for common AI/API issues
        if (message.includes('API key not found') || message.includes('No model found')) {
            message = 'The AI service failed. Please ensure your GOOGLE_API_KEY is set correctly in your .env file.';
        } else if (message.includes('The model is overloaded')) {
            message = 'The AI model is temporarily overloaded. Please try again in a few moments.';
        } else if (message.includes('permission-denied') || message.includes('permission denied')) {
            message = 'A permission error occurred. This can happen if your API key is invalid or your Firestore security rules are not configured correctly.';
        } else if (message.includes('Unsupported file type')) {
            message = 'The uploaded file type is not supported by the processing function.';
        }

    } else if (typeof error === 'string') {
        message = error;
        debugInfo = error;
    } else {
        try {
            debugInfo = `A non-Error object was thrown: ${JSON.stringify(error, null, 2)}`;
        } catch (e) {
            debugInfo = 'A complex, non-serializable error object was thrown and could not be stringified.';
        }
    }
    
    return {
        status: "error",
        message: message, 
        fileData: null,
        fileName: "",
        mimeType: "",
        debugInfo: debugInfo,
    };
}


async function handleExcelProcessing(fileBuffer: Buffer, masterData: Record<string, string>): Promise<{ filledBuffer: Buffer; previewData: FilledField[], missingFields: MissingField[] }> {
    const vendorData = Object.entries(masterData).map(([fieldName, value]) => ({ fieldName, value }));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("No worksheet found in the Excel file.");
    }
    
    const supplierFormCells: { cell: string; value: string }[] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.type !== ExcelJS.ValueType.Merge || (cell.type === ExcelJS.ValueType.Merge && cell.value !== null)) { 
            supplierFormCells.push({ cell: cell.address, value: cell.text ?? '' });
        }
      });
    });

    if (supplierFormCells.length === 0) {
        throw new Error("The first sheet of the Excel file appears to have no content to analyze.");
    }
    
    const formStructure = await retryOnOverload(() => extractFieldsFromExcel({
        excelContent: JSON.stringify(supplierFormCells)
    }));

    if (!formStructure || formStructure.length === 0) {
        throw new Error(
            "The AI could not identify any field labels in the supplier form. Please ensure the form is not blank and has clear labels for the fields you want to fill."
        );
    }
    
    const aiResponse = await retryOnOverload(() => fillSupplierForm({
        vendorData,
        formStructure,
    }));

    if (!aiResponse || (!aiResponse.fieldsToFill?.length && !aiResponse.fieldsToQuery?.length)) {
        throw new Error(
            "The AI failed to map any data to the identified form fields."
        );
    }
    
    const { fieldsToFill, fieldsToQuery } = aiResponse;

    const filledExcelBuffer = await fillExcelData(fileBuffer, fieldsToFill);
    if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
        throw new Error("The Excel writer failed to generate a valid file. The output was empty or invalid.");
    }

    const previewData = fieldsToFill.map(instr => ({
      cell: instr.targetCell,
      value: instr.value,
      labelGuessed: instr.labelGuessed,
    }));

    return { filledBuffer: filledExcelBuffer, previewData, missingFields: fieldsToQuery };
}

async function handlePdfProcessing(
  fileBuffer: Buffer,
  masterData: Record<string, string>
): Promise<{
  filledBuffer: Buffer;
  previewData: FilledField[];
  missingFields: MissingField[];
}> {
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  if (fields.length > 0) {
    // This is a standard, fillable PDF
    const pdfFieldNames = fields.map((field) => field.getName());
    const vendorData = Object.entries(masterData).map(([fieldName, value]) => ({
      fieldName,
      value,
    }));

    const fillInstructions = await retryOnOverload(() => mapDataToPdfFields({
      vendorData,
      pdfFieldNames,
    }));

    if (!fillInstructions || fillInstructions.length === 0) {
      throw new Error(
        "This is a fillable PDF, but the AI could not map any data to its fields. Please check the PDF's field names."
      );
    }

    const previewData = fillInstructions.map((instr) => ({
      cell: instr.pdfFieldName,
      value: instr.value,
    }));

    for (const instruction of fillInstructions) {
      try {
        const field = form.getField(instruction.pdfFieldName);
        field.setText(instruction.value);
      } catch (e) {
        console.warn(
          `Could not fill PDF field '${instruction.pdfFieldName}':`,
          e
        );
      }
    }

    const pdfBytes = await pdfDoc.save();
    const filledBuffer = Buffer.from(pdfBytes);
    return { filledBuffer, previewData, missingFields: [] };
  } else {
    // This is a flat, non-fillable PDF.
    // The library previously used for this (`pdf-parse`) is unstable and can cause server crashes.
    // This feature is temporarily disabled to ensure application stability.
    throw new Error(
      "Processing for non-fillable (flat) PDFs is temporarily disabled. Please use a fillable PDF form or an Excel document."
    );
  }
}

export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
    try {
        const file = formData.get("file") as File;
        if (!file || file.size === 0) {
            // This is a user error, so a simple message is fine.
            return { ...prevState, status: "error", message: "Please upload a valid supplier form." };
        }
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        if (fileBuffer.length === 0) {
            return { ...prevState, status: "error", message: "The uploaded file appears to be empty." };
        }

        const masterDataJSON = formData.get("masterData") as string | null;
        if (!masterDataJSON) {
          return { ...prevState, status: "error", message: "Master data is missing. Please go back to Step 1." };
        }
        const masterDataRecord = JSON.parse(masterDataJSON) as Record<string, string>;
        if (typeof masterDataRecord !== 'object' || masterDataRecord === null || Object.keys(masterDataRecord).length === 0) {
            return { ...prevState, status: "error", message: "Master data is invalid or empty. Please re-upload and parse it in Step 1." };
        }
        
        let filledFileBuffer: Buffer;
        let previewData: FilledField[];
        let missingFields: MissingField[];
        
        if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            const result = await handleExcelProcessing(fileBuffer, masterDataRecord);
            filledFileBuffer = result.filledBuffer;
            previewData = result.previewData;
            missingFields = result.missingFields;
        } else if (file.type === "application/pdf") {
            const result = await handlePdfProcessing(fileBuffer, masterDataRecord);
            filledFileBuffer = result.filledBuffer;
            previewData = result.previewData;
            missingFields = result.missingFields;
        } else {
            return { ...prevState, status: "error", message: "Invalid file type. Please upload an .xlsx or .pdf file." };
        }
        
        return {
          status: "preview",
          message: "Preview your auto-filled form. You can make corrections before downloading.",
          fileData: filledFileBuffer.toString("base64"),
          fileName: `filled-${file.name}`,
          mimeType: file.type,
          previewData: previewData,
          missingFields: missingFields
        };

    } catch (error) {
        // Specifically catch the "flat PDF" error and return a friendly message
        if (error instanceof Error && error.message.includes("Processing for non-fillable (flat) PDFs is temporarily disabled")) {
            return {
                status: "error",
                message: error.message,
                fileData: null,
                fileName: "",
                mimeType: "",
            };
        }
        return createErrorState(error);
    }
}

export async function applyCorrections(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
    try {
        const correctionRequest = formData.get("correctionRequest") as string;
        const previousFileData = formData.get("fileData") as string;
        const fileName = formData.get("fileName") as string;
        const mimeType = formData.get("mimeType") as string;
        const masterDataJSON = formData.get("masterData") as string;
        const missingFieldsJSON = formData.get("missingFields") as string;

        if (!previousFileData) {
            return { ...prevState, status: "error", message: "Could not find the previous file data. Please start over." };
        }
        
        if (mimeType === 'application/pdf') {
             return {
                status: "success",
                message: "PDF corrections and filling missing fields are not yet supported. Your file is ready for download.",
                fileData: previousFileData,
                fileName: fileName,
                mimeType: mimeType,
            };
        }

        const fileBuffer = Buffer.from(previousFileData, "base64");
        const masterData = JSON.parse(masterDataJSON || '{}') as Record<string, string>;
        const missingFields = JSON.parse(missingFieldsJSON || '[]') as MissingField[];
        const masterDataWithAdditions = { ...masterData };

        const missingDataInstructions: FillInstruction[] = [];
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('missing_') && typeof value === 'string' && value.trim() !== '') {
                const targetCell = key.replace('missing_', '');
                missingDataInstructions.push({
                    targetCell: targetCell,
                    value: value
                });
                
                const missingField = missingFields.find(f => f.targetCell === targetCell);
                if (missingField) {
                    masterDataWithAdditions[missingField.labelGuessed] = value;
                }
            }
        }
        
        let correctionInstructions: FillInstruction[] = [];
        if (correctionRequest && correctionRequest.trim() !== '') {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
              throw new Error("No worksheet found in the Excel file to correct.");
            }
            const currentSheetData: { cell: string; value: string }[] = [];
            worksheet.eachRow({ includeEmpty: true }, (row) => {
                row.eachCell({ includeEmpty: true }, (cell) => {
                    if (cell.type !== ExcelJS.ValueType.Merge) { 
                        currentSheetData.push({ cell: cell.address, value: cell.text ?? '' });
                    }
                });
            });

            correctionInstructions = await retryOnOverload(() => correctFilledForm({
                userFeedback: correctionRequest,
                currentSheetData,
            }));

            if (!correctionInstructions) {
                 console.warn("AI returned null for correction request.");
                 correctionInstructions = [];
            }
        }
        
        const allInstructions = [...missingDataInstructions, ...correctionInstructions];

        if (allInstructions.length === 0) {
            return {
                status: "success",
                message: "No changes were made. Your initial filled file is ready.",
                fileData: fileBuffer.toString("base64"),
                fileName: fileName,
                mimeType: mimeType,
            };
        }
        
        const finalBuffer = await fillExcelData(fileBuffer, allInstructions);
        const updatedMasterDataBuffer = await createMasterDataExcel(masterDataWithAdditions);

        return {
            status: "success",
            message: "Corrections applied! Your files are ready for download.",
            fileData: finalBuffer.toString("base64"),
            fileName: `corrected-${fileName}`,
            mimeType: mimeType,
            updatedMasterData: updatedMasterDataBuffer.toString("base64"),
            updatedMasterDataFileName: 'updated-master-data.xlsx',
            updatedMasterDataJSON: masterDataWithAdditions
        };

    } catch (error) {
        return createErrorState(error);
    }
}
