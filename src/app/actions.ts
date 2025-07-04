
"use server";

import { fillSupplierForm } from "@/ai/flows/fill-supplier-form";
import { mapDataToPdfFields } from "@/ai/flows/map-data-to-pdf-fields";
import { fillExcelData } from "@/lib/excel-writer";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";

interface FormState {
  status: "idle" | "success" | "error" | "processing";
  message: string;
  fileData: string | null;
  fileName: string;
  mimeType: string;
  debugInfo?: string;
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

async function handleExcelProcessing(fileBuffer: Buffer, masterData: Record<string, string>): Promise<Buffer> {
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
        if (cell.type !== 1) { 
            supplierFormCells.push({ cell: cell.address, value: cell.text ?? '' });
        }
      });
    });

    if (supplierFormCells.length === 0) {
        throw new Error("The first sheet of the Excel file appears to have no content to analyze.");
    }

    const fillInstructions = await fillSupplierForm({
        vendorData,
        supplierFormCells
    });

    if (!fillInstructions || fillInstructions.length === 0) {
        throw new Error(
            "The AI could not confidently map any fields from your master data to the supplier form. Please ensure the form has clear labels that correspond to your master data."
        );
    }

    const filledExcelBuffer = await fillExcelData(fileBuffer, fillInstructions);
    if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
        throw new Error("The Excel writer failed to generate a valid file. The output was empty or invalid.");
    }

    return filledExcelBuffer;
}


async function handlePdfProcessing(fileBuffer: Buffer, masterData: Record<string, string>): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length === 0) {
        throw new Error("The uploaded PDF is not a fillable form. Only standard PDF forms with fillable fields are currently supported.");
    }

    const pdfFieldNames = fields.map(field => field.getName());
    const vendorData = Object.entries(masterData).map(([fieldName, value]) => ({ fieldName, value }));

    const fillInstructions = await mapDataToPdfFields({
        vendorData,
        pdfFieldNames,
    });
    
    if (!fillInstructions || fillInstructions.length === 0) {
        throw new Error(
            "The AI could not confidently map any fields from your master data to the PDF form fields. Please ensure the PDF has clearly named fields."
        );
    }

    for (const instruction of fillInstructions) {
        try {
            const field = form.getField(instruction.pdfFieldName);
            // NOTE: This currently only supports text fields. Checkboxes, radio buttons, etc. would require more complex logic.
            field.setText(instruction.value);
        } catch (e) {
            console.warn(`Could not fill PDF field '${instruction.pdfFieldName}' with value '${instruction.value}':`, e);
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}


// Main logic for the form submission
export async function processForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
    try {
        // --- 1. File Reading & Validation ---
        const file = formData.get("file") as File;
        if (!file || file.size === 0) {
          return createErrorState("Please upload a valid supplier form.");
        }
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        if (fileBuffer.length === 0) {
            return createErrorState("The uploaded file appears to be empty.");
        }

        // --- 2. Master Data Parsing ---
        const masterDataJSON = formData.get("masterData") as string | null;
        if (!masterDataJSON) {
          return createErrorState("Master data is missing. Please go back to Step 1.");
        }
        const masterDataRecord = JSON.parse(masterDataJSON) as Record<string, string>;
        if (typeof masterDataRecord !== 'object' || masterDataRecord === null || Object.keys(masterDataRecord).length === 0) {
            return createErrorState("Master data is invalid or empty. Please re-upload and parse it in Step 1.");
        }
        
        let filledFileBuffer: Buffer;
        
        // --- 3. Route to correct processor based on file type ---
        if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            filledFileBuffer = await handleExcelProcessing(fileBuffer, masterDataRecord);
        } else if (file.type === "application/pdf") {
            filledFileBuffer = await handlePdfProcessing(fileBuffer, masterDataRecord);
        } else {
            return createErrorState("Invalid file type. Please upload an .xlsx or .pdf file.");
        }
        
        // --- 4. Success State Creation ---
        return {
          status: "success",
          message: "File processed successfully!",
          fileData: filledFileBuffer.toString("base64"),
          fileName: `filled-${file.name}`,
          mimeType: file.type,
        };

    } catch (error) {
        return createErrorState("A critical error occurred during the form filling process.", error);
    }
}
