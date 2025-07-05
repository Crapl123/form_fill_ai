
"use server";

import { correctFilledForm } from "@/ai/flows/correct-filled-form";
import { extractFieldsFromExcel } from "@/ai/flows/extract-fields-from-excel";
import { fillSupplierForm } from "@/ai/flows/fill-supplier-form";
import { mapDataToPdfFields } from "@/ai/flows/map-data-to-pdf-fields";
import { createMasterDataExcel, fillExcelData, FillInstruction } from "@/lib/excel-writer";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { reconstructPdfWithData } from "@/ai/flows/reconstruct-pdf-with-data";


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

function createErrorState(message: string, error?: unknown): FormState {
    console.error("Error state created. Message:", message, "Raw error object:", error);
    
    let errorDetails: string;
    
    if (error instanceof Error) {
        errorDetails = error.stack ? `${error.message}\n\nStack Trace:\n${error.stack}` : error.message;
    } else if (typeof error === 'string') {
        errorDetails = error;
    } else {
        try {
            errorDetails = `A non-Error object was thrown: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`;
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
    
    const formStructure = await extractFieldsFromExcel({
        excelContent: JSON.stringify(supplierFormCells)
    });

    if (!formStructure || formStructure.length === 0) {
        throw new Error(
            "The AI could not identify any field labels in the supplier form. Please ensure the form is not blank and has clear labels for the fields you want to fill."
        );
    }
    
    const aiResponse = await fillSupplierForm({
        vendorData,
        formStructure,
    });

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

    const fillInstructions = await mapDataToPdfFields({
      vendorData,
      pdfFieldNames,
    });

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
    // This is a flat, non-fillable PDF. We will try to reconstruct it.
    const pdf = require("pdf-parse");
    const data = await pdf(fileBuffer);

    if (!data || !data.text) {
      throw new Error(
        "Could not extract any text from the PDF. The file may be an image-only PDF."
      );
    }

    const reconstructedText = await reconstructPdfWithData({
      masterData,
      pdfTextContent: data.text,
    });

    const newPdfDoc = await PDFDocument.create();
    const page = newPdfDoc.addPage();
    page.drawText(reconstructedText, {
      x: 50,
      y: page.getHeight() - 50,
      size: 10,
    });

    const pdfBytes = await newPdfDoc.save();
    const filledBuffer = Buffer.from(pdfBytes);

    const previewData = Object.entries(masterData).map(([key, value]) => ({
      cell: `(Reconstructed)`,
      value,
      labelGuessed: key,
    }));

    return { filledBuffer, previewData, missingFields: [] };
  }
}

export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
    try {
        const file = formData.get("file") as File;
        if (!file || file.size === 0) {
          return createErrorState("Please upload a valid supplier form.");
        }
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        if (fileBuffer.length === 0) {
            return createErrorState("The uploaded file appears to be empty.");
        }

        const masterDataJSON = formData.get("masterData") as string | null;
        if (!masterDataJSON) {
          return createErrorState("Master data is missing. Please go back to Step 1.");
        }
        const masterDataRecord = JSON.parse(masterDataJSON) as Record<string, string>;
        if (typeof masterDataRecord !== 'object' || masterDataRecord === null || Object.keys(masterDataRecord).length === 0) {
            return createErrorState("Master data is invalid or empty. Please re-upload and parse it in Step 1.");
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
            return createErrorState("Invalid file type. Please upload an .xlsx or .pdf file.");
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
        return createErrorState("A critical error occurred during the initial form filling process.", error);
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
            return createErrorState("Could not find the previous file data. Please start over.");
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

            correctionInstructions = await correctFilledForm({
                userFeedback: correctionRequest,
                currentSheetData,
            });

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
        return createErrorState("An error occurred while applying corrections.", error);
    }
}
