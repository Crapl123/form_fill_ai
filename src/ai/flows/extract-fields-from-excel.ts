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
  prompt: `You are an expert at analyzing Excel spreadsheets and extracting form field definitions.

I will give you the structured contents of an Excel sheet.

Your task is to return ONLY a JSON array of objects. Each object must have exactly two keys:
- "fieldName": the human-readable name or label of a field in the spreadsheet
- "cellLocation": the Excel cell location (e.g., "B2") where that value is expected to be filled

⚠️ Important:
- Do NOT include any explanation, preamble, or commentary.
- Do NOT respond with markdown, quotes, or code blocks.
- Respond ONLY with a valid JSON array. If no fields are found, return an empty array [].

Here is the structured content:
{{{excelContent}}}

Example of a valid response:
[
  { "fieldName": "Company Name", "cellLocation": "B2" },
  { "fieldName": "Email", "cellLocation": "B3" }
]
`,
  config: {
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
