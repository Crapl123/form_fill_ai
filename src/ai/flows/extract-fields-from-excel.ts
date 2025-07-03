'use server';
/**
 * @fileOverview AI-powered Excel field extraction flow.
 *
 * - extractFieldsFromExcel - Extracts form field names and their cell locations from an Excel file's text content.
 * - ExtractFieldsFromExcelInput - The input type for the extractFieldsFromExcel function.
 * - ExtractFieldsFromExcelOutput - The return type for the extractFieldsFromExcel function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractFieldsFromExcelInputSchema = z.object({
  excelContent: z
    .string()
    .describe(
      "The textual content of an Excel sheet, with each cell's value and address."
    ),
});
export type ExtractFieldsFromExcelInput = z.infer<typeof ExtractFieldsFromExcelInputSchema>;

const ExtractFieldsFromExcelOutputSchema = z.array(
  z.object({
    fieldName: z.string().describe('The name of the form field.'),
    cellLocation: z.string().describe('The cell location of the field (e.g., A1, B2).'),
  })
);
export type ExtractFieldsFromExcelOutput = z.infer<typeof ExtractFieldsFromExcelOutputSchema>;

export async function extractFieldsFromExcel(input: ExtractFieldsFromExcelInput): Promise<ExtractFieldsFromExcelOutput> {
  return extractFieldsFromExcelFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractFieldsFromExcelPrompt',
  input: {schema: ExtractFieldsFromExcelInputSchema},
  output: {schema: ExtractFieldsFromExcelOutputSchema},
  prompt: `You are an expert in analyzing Excel forms and extracting field information.

You will be provided with the textual content of an Excel sheet, listing each cell's address and its value.
Your task is to identify and extract the form field names and their corresponding cell locations where a user would input data.
A form field is usually a label next to an empty cell. The cellLocation you return should be for the empty cell where data is meant to be entered.

Analyze the Excel content and return a JSON array where each object contains the fieldName and cellLocation.

Here's the Excel content:
{{{excelContent}}}

Example output:
[
  {
    "fieldName": "Vendor Name",
    "cellLocation": "B2"
  },
  {
    "fieldName": "GST Number",
    "cellLocation": "D5"
  }
]

Ensure the cellLocation accurately reflects the cell or merged cell where the data for the field is expected.
`,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const extractFieldsFromExcelFlow = ai.defineFlow(
  {
    name: 'extractFieldsFromExcelFlow',
    inputSchema: ExtractFieldsFromExcelInputSchema,
    outputSchema: ExtractFieldsFromExcelOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
