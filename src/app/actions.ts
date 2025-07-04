
"use server";

import { fillSupplierForm } from "@/ai/flows/fill-supplier-form";
import { fillExcelData } from "@/lib/excel-writer";
import ExcelJS from "exceljs";

interface FormState {
  status: "idle" | "success" | "error" | "processing";
  message: string;
  fileData: string | null;
  fileName: string;
  mimeType: string;
  debugInfo?: string;
}

// Centralized and robust error state creation with detailed logging
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
        if (file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
           return createErrorState("Invalid file type. Please upload an .xlsx file.");
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

        // --- 3. Pre-process inputs for AI ---
        // Flatten vendor data
        const vendorData = Object.entries(masterDataRecord).map(([fieldName, value]) => ({ fieldName, value }));

        // Flatten supplier form
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("No worksheet found in the Excel file.");
        }
        
        const supplierFormCells: { cell: string; value: string }[] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            // ExcelJS.ValueType.Merge is 1. We only want to process the master cell of a merge, or regular cells.
            // Slave cells of a merge will be skipped, preventing them from cluttering the prompt input.
            if (cell.type !== 1) { 
                supplierFormCells.push({ cell: cell.address, value: cell.text ?? '' });
            }
          });
        });

        if (supplierFormCells.length === 0) {
            return createErrorState("The first sheet of the Excel file appears to have no content to analyze.");
        }

        // --- 4. Call AI to get fill instructions ---
        const fillInstructions = await fillSupplierForm({
            vendorData,
            supplierFormCells
        });

        if (!fillInstructions || fillInstructions.length === 0) {
            return createErrorState(
                "The AI could not confidently map any fields from your master data to the supplier form. Please ensure the form has clear labels that correspond to your master data.",
                `AI returned no fill instructions. This may be due to a lack of matching fields or a content safety filter. AI response: ${JSON.stringify(fillInstructions)}`
            );
        }

        // --- 5. Excel Writing & Validation ---
        const filledExcelBuffer = await fillExcelData(fileBuffer, fillInstructions);
        if (!filledExcelBuffer || !(filledExcelBuffer instanceof Buffer) || filledExcelBuffer.length === 0) {
            return createErrorState("The Excel writer failed to generate a valid file. The output was empty or invalid.");
        }

        // --- 6. Success State Creation ---
        return {
          status: "success",
          message: "File processed successfully!",
          fileData: filledExcelBuffer.toString("base64"),
          fileName: `filled-${file.name}`,
          mimeType: file.type,
        };

    } catch (error) {
        return createErrorState("A critical error occurred during the form filling process.", error);
    }
}
