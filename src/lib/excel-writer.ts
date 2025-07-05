
import ExcelJS from "exceljs";

export interface FillInstruction {
  targetCell: string;
  value: string;
}

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
    if (instruction.value !== undefined && instruction.value !== null && instruction.targetCell) {
      try {
        const cell = worksheet.getCell(instruction.targetCell);
        
        cell.value = instruction.value;
        
        cell.font = { ...cell.font, color: { argb: 'FF3F51B5' }, bold: true };

      } catch (e) {
        console.warn(`Could not write to cell ${instruction.targetCell}:`, e);
      }
    }
  });

  const newBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(newBuffer);
}

export async function createMasterDataExcel(
  data: Record<string, string>
): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Data");

    worksheet.columns = [
        { header: 'Field Name', key: 'fieldName', width: 30 },
        { header: 'Value', key: 'value', width: 50 },
    ];

    Object.entries(data).forEach(([key, value]) => {
        worksheet.addRow({ fieldName: key, value: value });
    });

    const newBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(newBuffer);
}
