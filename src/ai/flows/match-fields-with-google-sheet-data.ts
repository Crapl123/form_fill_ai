'use server';
/**
 * @fileOverview Matches extracted form fields with data from a Google Sheet using AI.
 *
 * - matchFieldsWithSheetData - A function that initiates the field matching process.
 * - MatchFieldsWithSheetDataInput - The input type for the matchFieldsWithSheetData function.
 * - MatchFieldsWithSheetDataOutput - The return type for the matchFieldsWithSheetData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchFieldsWithSheetDataInputSchema = z.object({
  formFields: z.array(z.string()).describe('The extracted fields from the uploaded form.'),
  sheetData: z.record(z.string(), z.string()).describe('The vendor master data from the Google Sheet.'),
});
export type MatchFieldsWithSheetDataInput = z.infer<typeof MatchFieldsWithSheetDataInputSchema>;

// The output that the rest of the application expects.
const MatchFieldsWithSheetDataOutputSchema = z.record(z.string(), z.string()).describe(
  'A map of form fields to corresponding values from the Google Sheet data.'
);
export type MatchFieldsWithSheetDataOutput = z.infer<typeof MatchFieldsWithSheetDataOutputSchema>;

export async function matchFieldsWithSheetData(
  input: MatchFieldsWithSheetDataInput
): Promise<MatchFieldsWithSheetDataOutput> {
  return matchFieldsWithSheetDataFlow(input);
}

// A new, more structured schema for the AI prompt's output to satisfy the API requirements.
const AIOutputSchema = z.array(
  z.object({
    formField: z.string().describe('The exact name of the field from the input form fields list.'),
    sheetValue: z.string().describe('The most relevant value from the Google Sheet data for this field. If no suitable match is found, return an empty string.'),
  })
);


const prompt = ai.definePrompt({
  name: 'matchFieldsWithSheetDataPrompt',
  input: {schema: MatchFieldsWithSheetDataInputSchema},
  // Use the new, structured schema for the AI output.
  output: {schema: AIOutputSchema},
  prompt: `You are an expert data mapper. You will be provided with a list of form fields and a record of vendor master data from a Google Sheet.

Your task is to create a mapping for every single form field provided. For each field, find the most appropriate value from the Google Sheet data.

Form Fields:
{{#each formFields}}- {{{this}}}\n{{/each}}

Google Sheet Data:
{{#each sheetData}}- Key: {{{@key}}}, Value: {{{this}}}\n{{/each}}

Return a JSON array of objects. Each object must have two keys: "formField" and "sheetValue".
Every field from the "Form Fields" list must have a corresponding object in the output array.
If you cannot find a suitable match in the Google Sheet data for a given form field, the value for "sheetValue" must be an empty string.`,
});

const matchFieldsWithSheetDataFlow = ai.defineFlow(
  {
    name: 'matchFieldsWithSheetDataFlow',
    inputSchema: MatchFieldsWithSheetDataInputSchema,
    // The flow's public output schema remains the same for the consumer.
    outputSchema: MatchFieldsWithSheetDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    
    // The AI might return null if it fails completely.
    if (!output) {
      // In case of a total failure, create an empty mapping for all fields.
      const emptyMap: Record<string, string> = {};
      input.formFields.forEach(field => {
        emptyMap[field] = "";
      });
      return emptyMap;
    }
    
    // Transform the AI's array-of-objects output into the record/map format the application expects.
    const mappedData = output.reduce((acc, item) => {
      acc[item.formField] = item.sheetValue;
      return acc;
    }, {} as Record<string, string>);

    // Ensure that every original form field is present in the final map, even if the AI missed one.
    input.formFields.forEach(field => {
        if (!(field in mappedData)) {
            mappedData[field] = "";
        }
    });

    return mappedData;
  }
);
