
'use server';
/**
 * @fileOverview An AI flow that intelligently maps vendor data to a pre-structured supplier form.
 *
 * - fillSupplierForm - A function that takes vendor data and a supplier form's structure and returns cell-value pairs for filling the form.
 * - FillSupplierFormInput - The input type for the fillSupplierForm function.
 * - FillSupplierFormOutput - The return type for the fillSupplierForm function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VendorDataItemSchema = z.object({
  fieldName: z.string().describe("The name of the field from the vendor's master data."),
  value: z.string().describe('The corresponding value for the field.'),
});

const FormStructureItemSchema = z.object({
    fieldName: z.string().describe('The name of the field as identified in the supplier form.'),
    cellLocation: z.string().describe('The cell where the value should be placed.'),
});

const FillSupplierFormInputSchema = z.object({
  vendorData: z.array(VendorDataItemSchema).describe("A structured list of the vendor's master data."),
  formStructure: z.array(FormStructureItemSchema).describe("A pre-analyzed structure of the supplier form, with field labels and target cell locations."),
});
export type FillSupplierFormInput = z.infer<typeof FillSupplierFormInputSchema>;

const FillSupplierFormOutputSchema = z.object({
  fieldsToFill: z.array(
    z.object({
      targetCell: z.string().describe('The cell in the supplier form that should be filled.'),
      value: z.string().describe('The value from the vendor data to write into the target cell.'),
      labelGuessed: z.string().optional().describe('The label from the supplier form that the AI used to determine the target cell.'),
    })
  ).describe("An array of fields for which the AI found corresponding data in the vendor's master sheet."),
  fieldsToQuery: z.array(
     z.object({
        labelGuessed: z.string().describe("The label of the field that was identified in the supplier form."),
        targetCell: z.string().describe("The cell location where the value for this field should be placed."),
     })
  ).describe("An array of fields the AI identified in the form but could not find matching data for in the vendor's master sheet.")
});

export type FillSupplierFormOutput = z.infer<typeof FillSupplierFormOutputSchema>;

export async function fillSupplierForm(input: FillSupplierFormInput): Promise<FillSupplierFormOutput> {
  return fillSupplierFormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fillSupplierFormPrompt',
  input: { schema: FillSupplierFormInputSchema },
  output: {schema: FillSupplierFormOutputSchema},
  prompt: `You are an AI assistant helping to map a vendor's master data to a pre-analyzed supplier form structure.

### Context:
- The vendor data is a list of fields and values (e.g., "GST Number", "PAN", etc.).
- The supplier form structure is a list of field labels that have already been identified on the form, along with the specific cell where each corresponding value should be entered.

### Your Task:
1.  For each field in the **Input Supplier Form Structure**, find the best matching field in the **Input Vendor Data**. Use fuzzy matching and semantic understanding (e.g., form field "GST No" should match vendor field "GST Number").
2.  If you find a confident match, create an object for the \`fieldsToFill\` array. This object must contain the \`targetCell\` from the form structure and the corresponding \`value\` from the vendor data. Include the original form label in \`labelGuessed\`.
3.  If you CANNOT find a matching value in the vendor data for a given field from the form structure, you MUST add an object to the \`fieldsToQuery\` array. This object should contain the \`labelGuessed\` (the field name from the form structure) and the \`targetCell\` from the form structure.
4.  **CRITICAL:** Every single field from the **Input Supplier Form Structure** must result in an entry in *either* the \`fieldsToFill\` array or the \`fieldsToQuery\` array. Do not omit any fields.

---

### Format Your Response:
A SINGLE JSON object with two keys: "fieldsToFill" and "fieldsToQuery".

Example Response:
\`\`\`json
{
  "fieldsToFill": [
    { "labelGuessed": "GST Number", "targetCell": "B2", "value": "27ABCDE1234F1Z5" }
  ],
  "fieldsToQuery": [
    { "labelGuessed": "Company's VAT Number", "targetCell": "C5" }
  ]
}
\`\`\`
---
### Rules:
-   Be comprehensive: Every field from the form structure must be accounted for.
-   Use fuzzy matching to align fields like "PAN" and "Permanent Account Number".
-   Do not hallucinate values. Only use the provided vendor data.
-   If no match is found for an identified field, it MUST go into the \`fieldsToQuery\` array.

---

### Input Vendor Data:
{{#each vendorData}}
- {{this.fieldName}}: {{this.value}}
{{/each}}

### Input Supplier Form Structure:
{{#each formStructure}}
- Field Label: "{{this.fieldName}}", Target Cell: {{this.cellLocation}}
{{/each}}

Only return the JSON object. Do not include explanation, markdown, or formatting.
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

const fillSupplierFormFlow = ai.defineFlow(
  {
    name: 'fillSupplierFormFlow',
    inputSchema: FillSupplierFormInputSchema,
    outputSchema: FillSupplierFormOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    
    if (!output) {
      // If the AI fails, we must assume all fields need to be queried.
      console.warn("AI returned a null or empty response for fillSupplierFormFlow.");
      return { 
        fieldsToFill: [], 
        fieldsToQuery: input.formStructure.map(field => ({
            labelGuessed: field.fieldName,
            targetCell: field.cellLocation,
        })) 
      };
    }

    return output;
  }
);
