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
  // Log the exact input being sent to the AI for debugging.
  console.log("Sending the following structured content to AI for field extraction:\n---\n", input.excelContent, "\n---");
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
    console.log("Found and extracted JSON from markdown block.");
    return markdownMatch[2].trim();
  }

  // Fallback to finding the first '[' and last ']'
  const jsonStartIndex = rawText.indexOf('[');
  const jsonEndIndex = rawText.lastIndexOf(']');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
    console.log("Found JSON by slicing from first '[' to last ']'.");
    return rawText.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  // Return the raw text if no JSON array is found, to let the parser fail informatively
  console.log("No JSON structure found, returning raw text for parsing attempt.");
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

    // Log the raw response as requested for debugging
    console.log("Raw response from Gemini for field extraction:", rawText);

    if (!rawText || rawText.trim() === '') {
      console.error("AI returned an empty or whitespace response.");
      return []; // Return empty array on empty response
    }

    const cleanedJsonString = cleanAndExtractJson(rawText);
    
    try {
      // Attempt to parse the cleaned JSON string
      const parsedJson = JSON.parse(cleanedJsonString);
      // Further validation to ensure it's an array
      if (Array.isArray(parsedJson)) {
        return parsedJson;
      } else {
        console.error("Parsed JSON is not an array:", parsedJson);
        return [];
      }
    } catch (e) {
      console.error("Failed to parse JSON from AI response:", e, "Cleaned response was:", cleanedJsonString);
      // On parsing failure, return an empty array so the app doesn't crash.
      // The error will be handled upstream in `actions.ts`.
      return [];
    }
  }
);
