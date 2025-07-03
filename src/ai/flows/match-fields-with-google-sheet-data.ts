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

const MatchFieldsWithSheetDataOutputSchema = z.record(z.string(), z.string()).describe(
  'A map of form fields to corresponding values from the Google Sheet data.'
);
export type MatchFieldsWithSheetDataOutput = z.infer<typeof MatchFieldsWithSheetDataOutputSchema>;

export async function matchFieldsWithSheetData(
  input: MatchFieldsWithSheetDataInput
): Promise<MatchFieldsWithSheetDataOutput> {
  return matchFieldsWithSheetDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchFieldsWithSheetDataPrompt',
  input: {schema: MatchFieldsWithSheetDataInputSchema},
  output: {schema: MatchFieldsWithSheetDataOutputSchema},
  prompt: `You are an expert data mapper. You will be provided with a list of form fields and a record of vendor master data from a Google Sheet.

  Your goal is to map each form field to the most appropriate value from the Google Sheet data.

  Form Fields:
  {{#each formFields}}- {{{this}}}\n{{/each}}

  Google Sheet Data:
  {{#each sheetData}}- Key: {{{@key}}}, Value: {{{this}}}\n{{/each}}

  Return a JSON object where each key is a form field and each value is the corresponding value from the Google Sheet data.  If you cannot find a suitable match in the Google Sheet data, then return an empty string.`,
});

const matchFieldsWithSheetDataFlow = ai.defineFlow(
  {
    name: 'matchFieldsWithSheetDataFlow',
    inputSchema: MatchFieldsWithSheetDataInputSchema,
    outputSchema: MatchFieldsWithSheetDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure we always return an object, even if the AI fails to produce output.
    return output || {};
  }
);
