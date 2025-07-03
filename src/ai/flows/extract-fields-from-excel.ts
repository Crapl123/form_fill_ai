
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

I will give you the structured contents of an Excel sheet.

Your task is to return ONLY a JSON array of objects. Each object must have exactly two keys:
- "fieldName": the human-readable name or label of a field in the spreadsheet
- "cellLocation": the Excel cell location (e.g., "B2") where that value is expected or filled

⚠️ Important:
- Do NOT include any explanation, preamble, or commentary.
- Do NOT respond with markdown, quotes, or code blocks.
- Respond ONLY with a JSON array, exactly like this:
[
  { "fieldName": "Company Name", "cellLocation": "B2" },
  { "fieldName": "Email", "cellLocation": "B3" }
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
    const rawText = response.text;

    if (!rawText || rawText.trim() === '') {
      throw new Error("AI returned an empty or whitespace response.");
    }

    const cleanedJsonString = cleanAndExtractJson(rawText);
    
    try {
      // Attempt to parse the cleaned JSON string
      const parsedJson = JSON.parse(cleanedJsonString);
      // Further validation to ensure it's an array
      if (Array.isArray(parsedJson)) {
        return parsedJson;
      } else {
        throw new Error(`Parsed JSON is not an array. Parsed data: ${JSON.stringify(parsedJson, null, 2)}`);
      }
    } catch (e) {
      // Throw a new, more descriptive error that includes the problematic text
      throw new Error(
        `Failed to parse JSON from AI response. \n---CLEANED TEXT (attempted to parse)---\n${cleanedJsonString}\n\n---RAW RESPONSE FROM AI---\n${rawText}`
      );
    }
  }
);
