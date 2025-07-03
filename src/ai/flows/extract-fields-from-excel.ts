
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
  console.log("\n\n--- AI DEBUG START ---");
  console.log(">>> [INPUT TO GEMINI] Sending the following structured content for field extraction:");
  console.log(input.excelContent);
  console.log("---");
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
    console.log(">>> [CLEANING] Found and extracted JSON from markdown block.");
    return markdownMatch[2].trim();
  }

  // Fallback to finding the first '[' and last ']'
  const jsonStartIndex = rawText.indexOf('[');
  const jsonEndIndex = rawText.lastIndexOf(']');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
    console.log(">>> [CLEANING] Found JSON by slicing from first '[' to last ']'.");
    return rawText.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  console.log(">>> [CLEANING] No JSON structure found, returning raw text for parsing attempt.");
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

    console.log("<<< [RAW RESPONSE FROM GEMINI]:");
    console.log(rawText);

    if (!rawText || rawText.trim() === '') {
      console.error("<<< [ERROR] AI returned an empty or whitespace response.");
      console.log("--- AI DEBUG END ---\n\n");
      return []; // Return empty array on empty response
    }

    const cleanedJsonString = cleanAndExtractJson(rawText);
    
    try {
      // Attempt to parse the cleaned JSON string
      const parsedJson = JSON.parse(cleanedJsonString);
      // Further validation to ensure it's an array
      if (Array.isArray(parsedJson)) {
        console.log(">>> [SUCCESS] Successfully parsed JSON.");
        console.log("--- AI DEBUG END ---\n\n");
        return parsedJson;
      } else {
        console.error("<<< [ERROR] Parsed JSON is not an array:", parsedJson);
        console.log("--- AI DEBUG END ---\n\n");
        return [];
      }
    } catch (e) {
      console.error("<<< [ERROR] Failed to parse JSON from AI response:", e);
      console.error("<<< Cleaned response was:", cleanedJsonString);
      console.log("--- AI DEBUG END ---\n\n");
      // On parsing failure, return an empty array so the app doesn't crash.
      return [];
    }
  }
);
