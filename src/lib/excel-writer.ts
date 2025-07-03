import ExcelJS from "exceljs";

// Define the structure for the fill instructions
export interface FillInstruction {
  targetCell: string;
  value: string;
}

/**
 * Fills an Excel file with data based on a list of cell-value instructions.
 * @param originalBuffer - The buffer of the original Excel file.
 * @param instructions - An array of objects with targetCell and value.
 * @returns A buffer of the new, filled Excel file.
 */
export async function fillExcelData(
  originalBuffer: Buffer,
  instructions: FillInstruction[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheets found in the Excel file.");
  }

  instructions.forEach((instruction) => {
    // Only write if there's a value and a target cell.
    if (instruction.value !== undefined && instruction.value !== null && instruction.targetCell) {
      try {
        const cell = worksheet.getCell(instruction.targetCell);
        
        // Additional safety check: only write to empty cells, as requested in the prompt.
        // This is a safeguard in case the AI makes a mistake.
        const cellHasValue = cell.value !== null && cell.value?.toString().trim() !== '';
        if (!cellHasValue) {
            cell.value = instruction.value;
            // Optional: Add some basic styling to show it was auto-filled
            cell.font = { ...cell.font, color: { argb: 'FF3F51B5' }, bold: true };
        } else {
            console.warn(`AI tried to overwrite a non-empty cell (${instruction.targetCell}). Skipping.`);
        }

      } catch (e) {
        console.warn(`Could not write to cell ${instruction.targetCell}:`, e);
      }
    }
  });

  const newBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(newBuffer);
}
