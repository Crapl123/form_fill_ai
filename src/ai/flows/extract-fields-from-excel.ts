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
  prompt: `You are an expert system designed for extracting structured data from Excel forms.

You will be given the textual content of an Excel sheet, where each line represents a cell with its address (e.g., A1) and its text value.

Your task is to identify labels that are next to or above empty cells intended for data entry. These are the form fields.
- The 'fieldName' should be the text of the label.
- The 'cellLocation' must be the address of the corresponding empty cell where the data should be entered, NOT the cell of the label itself.

Carefully analyze the provided Excel content. Return a JSON array of objects, where each object contains a 'fieldName' and its 'cellLocation'.

IMPORTANT:
- If you cannot find any form fields, you MUST return an empty array: [].
- Do not invent fields. Only extract what is clearly a form label next to an input area.
- The output MUST be a valid JSON array as specified in the output schema.

Here is the Excel content:
{{{excelContent}}}

Example of a successful output for a simple form:
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
    // Ensure we always return an array, even if the AI fails to produce output.
    if (!output || !Array.isArray(output)) {
      console.warn("AI extraction returned null or invalid format. Defaulting to empty array.");
      return [];
    }
    return output;
  }
);
