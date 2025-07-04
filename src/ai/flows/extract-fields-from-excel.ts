
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

// The prompt now does NOT define an output schema, so we get the raw text back.
const prompt = ai.definePrompt({
  name: 'extractFieldsFromExcelPrompt',
  input: {schema: ExtractFieldsFromExcelInputSchema},
  prompt: `You are an expert at analyzing Excel spreadsheets and extracting form field definitions.

I will give you the structured contents of an Excel sheet as a JSON string of cell-value pairs.

Your task is to analyze the layout and identify all the human-readable labels for fields that need to be filled out. For each label, you must determine the correct cell location where the corresponding data should be entered. This is often an empty cell to the right of or below the label.

Return ONLY a JSON array of objects. Each object must have exactly two keys:
- "fieldName": the human-readable name or label of a field in the spreadsheet (e.g., "Company Name", "Address", "E-Mail").
- "cellLocation": the Excel cell location (e.g., "B2", "F6") where the value for that field should be entered.

⚠️ Important Rules:
- Do NOT include any explanation, preamble, or commentary.
- Do NOT respond with markdown, quotes, or code blocks.
- Respond ONLY with a valid JSON array.
- If the form contains a table for multiple items (e.g., a list of contacts), identify the labels for the columns (e.g., "Name of the Person", "Designation") and associate them with the first data entry row (e.g., C18, D18).

Example Response:
[
  { "fieldName": "Name of the Firm", "cellLocation": "E4" },
  { "fieldName": "Address", "cellLocation": "E6" },
  { "fieldName": "E-Mail", "cellLocation": "S10" }
]

Here is the structured content:
{{{excelContent}}}
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

/**
 * Cleans the raw text response from an AI model to extract a JSON string.
 * It handles cases where the JSON is wrapped in markdown code blocks.
 */
function cleanAndExtractJson(rawText: string): string {
  // Try to find a JSON block wrapped in markdown
  const markdownMatch = rawText.match(/```(json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[2]) {
    return markdownMatch[2].trim();
  }

  // Fallback to finding the first '[' and last ']'
  const jsonStartIndex = rawText.indexOf('[');
  const jsonEndIndex = rawText.lastIndexOf(']');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
    return rawText.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  return rawText;
}


const extractFieldsFromExcelFlow = ai.defineFlow(
  {
    name: 'extractFieldsFromExcelFlow',
    inputSchema: ExtractFieldsFromExcelInputSchema,
    outputSchema: ExtractFieldsFromExcelOutputSchema, // We still want the flow to have a typed output
  },
  async input => {
    // We call the prompt which now returns a raw text response because we removed the output schema from the prompt definition
    const response = await prompt(input);
    
    if (!response || typeof response.text !== 'string') {
        throw new Error("AI service returned a null or empty response for field extraction. This could be due to an API error or content safety violation.");
    }

    const rawText = response.text;

    if (!rawText || rawText.trim() === '') {
      throw new Error("AI returned an empty string when trying to extract fields.");
    }

    const cleanedJsonString = cleanAndExtractJson(rawText);
    
    try {
      const parsedJson = JSON.parse(cleanedJsonString);
      if (Array.isArray(parsedJson)) {
        return parsedJson;
      } else {
        throw new Error(`Parsed JSON from field extraction is not an array. Parsed data: ${JSON.stringify(parsedJson, null, 2)}`);
      }
    } catch (e) {
      throw new Error(
        `Failed to parse JSON from AI field extraction response. \n---CLEANED TEXT (attempted to parse)---\n${cleanedJsonString}\n\n---RAW RESPONSE FROM AI---\n${rawText}`
      );
    }
  }
);
