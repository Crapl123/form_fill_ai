
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

const FillSupplierFormOutputSchema = z.array(
  z.object({
    targetCell: z.string().describe('The cell in the supplier form that should be filled.'),
    value: z.string().describe('The value from the vendor data to write into the target cell.'),
  })
);
export type FillSupplierFormOutput = z.infer<typeof FillSupplierFormOutputSchema>;

export async function fillSupplierForm(input: FillSupplierFormInput): Promise<FillSupplierFormOutput> {
  return fillSupplierFormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fillSupplierFormPrompt',
  input: {
      schema: z.object({
        // Handlebars needs the JSON as strings, so we define them as such here.
        VENDOR_DATA_JSON: z.string(),
        SUPPLIER_FORM_CELLS_JSON: z.string(),
      })
  },
  output: {schema: FillSupplierFormOutputSchema},
  prompt: `You are an AI assistant helping fill out a supplier registration form using data from a vendor's master data sheet.

### Context:
- The vendor data is a structured list of fields with values (like "GST Number", "PAN", etc.)
- The supplier registration form is another Excel file with various field labels and empty cells.
- The layout of the supplier form can vary.

---

### Your Task:
1. Understand the meaning of the field names in the vendor data (e.g., "GST No" ≈ "GST Number").
2. Scan the supplier registration form to identify where each vendor field should go.
3. Find the cell next to or below each label that best matches a vendor field, and assume that is where the value should be filled.
4. Only fill **empty cells**. Never overwrite labels or filled data.
5. Return only values that can be confidently matched using fuzzy logic — skip anything uncertain.

---

### Format Your Response:
A JSON array like this:
\`\`\`json
[
  { "targetCell": "B2", "value": "27ABCDE1234F1Z5" },
  { "targetCell": "B3", "value": "ABCDE1234F" }
]
\`\`\`
Rules:
Use fuzzy matching to align fields like "GST No" and "GST Number", or "PAN" and "Permanent Account Number".

Do not hallucinate values or make up data. Only use the provided vendor data.

Do not write into cells that already contain field labels or non-empty values.

If no match is found for a vendor field, skip it.

If multiple fields match the same label, use the most semantically correct one.

Input Vendor Data:
{{{VENDOR_DATA_JSON}}}

Input Supplier Form (Flattened Excel as cell-value pairs):
{{{SUPPLIER_FORM_CELLS_JSON}}}

Only return the JSON array of cell-value mappings. Do not include explanation, markdown, or formatting.
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
    const { output } = await prompt({
      VENDOR_DATA_JSON: JSON.stringify(input.vendorData, null, 2),
      SUPPLIER_FORM_CELLS_JSON: JSON.stringify(input.supplierFormCells, null, 2),
    });
    
    if (!output) {
      // If the AI fails to produce a valid response, return an empty array.
      // This prevents crashes and indicates that no fields could be mapped.
      console.warn("AI returned a null or empty response for fillSupplierFormFlow.");
      return [];
    }

    return output;
  }
);
