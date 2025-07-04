
'use server';
/**
 * @fileOverview An AI flow that intelligently maps vendor data to PDF form fields.
 *
 * - mapDataToPdfFields - A function that takes vendor data and PDF field names and returns a mapping.
 * - MapDataToPdfFieldsInput - The input type for the function.
 * - MapDataToPdfFieldsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VendorDataItemSchema = z.object({
  fieldName: z.string().describe("The name of the field from the vendor's master data."),
  value: z.string().describe('The corresponding value for the field.'),
});

const MapDataToPdfFieldsInputSchema = z.object({
  vendorData: z.array(VendorDataItemSchema).describe("A structured list of the vendor's master data."),
  pdfFieldNames: z.array(z.string()).describe("A list of available field names from the PDF form."),
});
export type MapDataToPdfFieldsInput = z.infer<typeof MapDataToPdfFieldsInputSchema>;

const MapDataToPdfFieldsOutputSchema = z.array(
  z.object({
    pdfFieldName: z.string().describe('The name of the PDF form field to be filled.'),
    value: z.string().describe('The value from the vendor data to write into the field.'),
  })
);
export type MapDataToPdfFieldsOutput = z.infer<typeof MapDataToPdfFieldsOutputSchema>;


export async function mapDataToPdfFields(input: MapDataToPdfFieldsInput): Promise<MapDataToPdfFieldsOutput> {
  return mapDataToPdfFieldsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'mapDataToPdfFieldsPrompt',
  input: { schema: MapDataToPdfFieldsInputSchema },
  output: { schema: MapDataToPdfFieldsOutputSchema },
  prompt: `You are an AI data mapping expert. Your task is to intelligently map structured vendor data to the fields of a PDF form.

Use fuzzy matching and semantic understanding to find the best match. For example, a vendor field named "PAN" should map to a PDF field named "pan_number" or "Permanent Account Number".

Only return mappings for fields you can confidently match. If a vendor data field does not have a suitable corresponding field in the PDF, ignore it.

### Vendor Master Data:
{{#each vendorData}}
- {{this.fieldName}}: {{this.value}}
{{/each}}

### Available PDF Form Fields:
{{#each pdfFieldNames}}
- {{this}}
{{/each}}

Return a JSON array of objects, where each object contains a "pdfFieldName" from the list above and the "value" from the vendor data that should be placed in that field. Do not include explanations or markdown.
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


const mapDataToPdfFieldsFlow = ai.defineFlow(
  {
    name: 'mapDataToPdfFieldsFlow',
    inputSchema: MapDataToPdfFieldsInputSchema,
    outputSchema: MapDataToPdfFieldsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      console.warn("AI returned a null or empty response for mapDataToPdfFieldsFlow.");
      return [];
    }

    return output;
  }
);
