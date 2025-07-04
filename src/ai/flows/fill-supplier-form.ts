
'use server';
/**
 * @fileOverview An AI flow that intelligently maps vendor data to a supplier form.
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

const SupplierFormCellSchema = z.object({
  cell: z.string().describe('The cell address (e.g., A1, B2).'),
  value: z.string().describe('The existing text content of the cell (can be a label or empty).'),
});

const FillSupplierFormInputSchema = z.object({
  vendorData: z.array(VendorDataItemSchema).describe("A structured list of the vendor's master data."),
  supplierFormCells: z.array(SupplierFormCellSchema).describe("A flattened structure of the supplier form to be filled."),
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
  prompt: `You are an AI assistant helping fill out a supplier registration form using data from a vendor's master data sheet.

### Context:
- The vendor data is a structured list of fields with values (like "GST Number", "PAN", etc.).
- The supplier registration form is another Excel file with various field labels and empty cells.
- The layout of the supplier form can vary.

---

### Your Task:
1.  Analyze the entire supplier form to identify ALL potential fields where data should be entered. A field is typically an empty cell next to or below a label.
2.  For each field you identify, check if you can find a corresponding value in the Input Vendor Data using fuzzy matching (e.g., "GST No" ≈ "GST Number").
3.  If you find a match, add an object to the \`fieldsToFill\` array in your response. Include the guessed label text from the form.
4.  If you identify a field but CANNOT find a matching value in the vendor data, add an object to the \`fieldsToQuery\` array. This tells the user what information is missing.
5.  Only fill **empty cells**. Never overwrite labels or existing data.

---

### Format Your Response:
A SINGLE JSON object with two keys: "fieldsToFill" and "fieldsToQuery".

Example Response:
\`\`\`json
{
  "fieldsToFill": [
    { "labelGuessed": "GST Number", "targetCell": "B2", "value": "27ABCDE1234F1Z5" },
    { "labelGuessed": "PAN Number", "targetCell": "B3", "value": "ABCDE1234F" }
  ],
  "fieldsToQuery": [
    { "labelGuessed": "Company's VAT Number", "targetCell": "C5" }
  ]
}
\`\`\`

---
### Rules:
-   Be comprehensive: Identify all possible fields in the supplier form.
-   Use fuzzy matching to align fields like "PAN" and "Permanent Account Number".
-   Do not hallucinate values. Only use the provided vendor data.
-   If no match is found for an identified field, it MUST go into the \`fieldsToQuery\` array.
-   If no fields can be identified or filled, return an object with two empty arrays.

---

Input Vendor Data:
{{#each vendorData}}
- {{this.fieldName}}: {{this.value}}
{{/each}}

Input Supplier Form (Flattened Excel as cell-value pairs):
{{#each supplierFormCells}}
- Cell: {{this.cell}}, Value: '{{this.value}}'
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
      // If the AI fails to produce a valid response, return an empty object.
      // This prevents crashes and indicates that no fields could be mapped.
      console.warn("AI returned a null or empty response for fillSupplierFormFlow.");
      return { fieldsToFill: [], fieldsToQuery: [] };
    }

    return output;
  }
);
