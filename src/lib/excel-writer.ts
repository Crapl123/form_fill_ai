import ExcelJS from "exceljs";
import { type ExtractFieldsFromExcelOutput } from "@/ai/flows/extract-fields-from-excel";

/**
 * Fills an Excel file with data based on field mappings.
 * @param originalBuffer - The buffer of the original Excel file.
 * @param fields - An array of objects with fieldName and cellLocation.
 * @param data - A record mapping field names to their values.
 * @returns A buffer of the new, filled Excel file.
 */
export async function fillExcelData(
  originalBuffer: Buffer,
  fields: ExtractFieldsFromExcelOutput,
  data: Record<string, string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBuffer);

  // Assuming we're working with the first sheet.
  // A more robust solution might need to identify the correct sheet.
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheets found in the Excel file.");
  }

  fields.forEach((field) => {
    const valueToFill = data[field.fieldName];
    if (valueToFill !== undefined) {
      try {
        const cell = worksheet.getCell(field.cellLocation);
        cell.value = valueToFill;
        // Optional: Add some basic styling to show it was auto-filled
        cell.font = { ...cell.font, color: { argb: 'FF3F51B5' }, bold: true };
      } catch (e) {
        console.warn(`Could not write to cell ${field.cellLocation}:`, e);
      }
    }
  });

  const newBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(newBuffer);
}
