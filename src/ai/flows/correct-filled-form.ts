
'use server';
/**
 * @fileOverview An AI flow that corrects a filled form based on user feedback.
 *
 * - correctFilledForm - Takes a filled Excel sheet and user's text feedback, and returns instructions for changes.
 * - CorrectFilledFormInput - The input type for the function.
 * - CorrectFilledFormOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CellValueSchema = z.object({
  cell: z.string().describe('The cell address (e.g., A1, B2).'),
  value: z.string().describe('The current text content of the cell.'),
});

const CorrectFilledFormInputSchema = z.object({
  userFeedback: z.string().describe("The user's natural language instructions for what to change."),
  currentSheetData: z.array(CellValueSchema).describe("A flattened structure of the currently filled supplier form."),
});
export type CorrectFilledFormInput = z.infer<typeof CorrectFilledFormInputSchema>;

const CorrectFilledFormOutputSchema = z.array(
  z.object({
    targetCell: z.string().describe('The cell in the supplier form that should be changed.'),
    value: z.string().describe('The new value to write into the target cell.'),
  })
);
export type CorrectFilledFormOutput = z.infer<typeof CorrectFilledFormOutputSchema>;


export async function correctFilledForm(input: CorrectFilledFormInput): Promise<CorrectFilledFormOutput> {
  return correctFilledFormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'correctFilledFormPrompt',
  input: { schema: CorrectFilledFormInputSchema },
  output: { schema: CorrectFilledFormOutputSchema },
  prompt: `You are an AI assistant that corrects an Excel sheet based on user feedback.

You will be given the user's plain text request and the current data from the sheet as a list of cell/value pairs.

Your task is to interpret the user's request and determine which cells need to be changed.

### User's Correction Request:
{{{userFeedback}}}

---

### Current Sheet Data (Cell-Value Pairs):
{{#each currentSheetData}}
- Cell: {{this.cell}}, Value: '{{this.value}}'
{{/each}}

---

### Your Response:
Return ONLY a JSON array of objects for the cells that need to be changed. Each object must have a "targetCell" and a "value".

For example, if the user says "Change the company name in B2 to 'New Corp'", you should return:
\`\`\`json
[
  { "targetCell": "B2", "value": "New Corp" }
]
\`\`\`

- Only include cells that need to be changed.
- If the user's request is unclear or you cannot determine the change, return an empty array.
- Do not make up changes. Only apply what the user has requested.
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

const correctFilledFormFlow = ai.defineFlow(
  {
    name: 'correctFilledFormFlow',
    inputSchema: CorrectFilledFormInputSchema,
    outputSchema: CorrectFilledFormOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      return [];
    }
    return output;
  }
);
