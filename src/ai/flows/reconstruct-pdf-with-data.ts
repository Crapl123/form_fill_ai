
'use server';
/**
 * @fileOverview An AI flow that attempts to reconstruct a flat PDF with new data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReconstructPdfInputSchema = z.object({
  masterData: z.record(z.string()).describe("A key-value object of master data to fill into the form."),
  pdfTextContent: z.string().describe("The full, unstructured text content extracted from a non-fillable PDF."),
});
export type ReconstructPdfInput = z.infer<typeof ReconstructPdfInputSchema>;

const ReconstructPdfOutputSchema = z.string().describe("The reconstructed text of the document, with the master data values filled in.");
export type ReconstructPdfOutput = z.infer<typeof ReconstructPdfOutputSchema>;


export async function reconstructPdfWithData(input: ReconstructPdfInput): Promise<ReconstructPdfOutput> {
  return reconstructPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reconstructPdfPrompt',
  input: { schema: ReconstructPdfInputSchema },
  // Raw text output, not JSON
  prompt: `You are an expert data entry assistant. Your task is to intelligently fill in a document using the provided master data.

You will be given the full text content of a document and a JSON object of master data.

Your job is to return a SINGLE string that is the complete, reconstructed text of the original document, but with the master data values inserted in the correct places.

### Rules:
1.  Use the entire original text as your starting point. Do not omit any sections, headers, or paragraphs.
2.  Intelligently find the labels in the document text that correspond to the keys in the master data (e.g., "Company Name" in the text should match the "Company Name" key in the data).
3.  Replace placeholder characters like underscores (\`______\`) or empty space after a label with the corresponding value from the master data.
4.  Preserve the original line breaks and general spacing as best as possible.
5.  If a field from the master data has no corresponding label in the document, ignore it.
6.  Return ONLY the final, reconstructed text string. Do not include any explanations, comments, or markdown formatting.

---
### Master Data (as a JSON object):
{{JSON.stringify masterData}}

---
### Original Document Text:
{{{pdfTextContent}}}

---
### Reconstructed Document Text Output (Your response starts here):
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

const reconstructPdfFlow = ai.defineFlow(
  {
    name: 'reconstructPdfFlow',
    inputSchema: ReconstructPdfInputSchema,
    outputSchema: ReconstructPdfOutputSchema,
  },
  async (input) => {
    const response = await prompt(input);

    if (!response || !response.text) {
        throw new Error("The AI failed to reconstruct the document text. The response was empty.");
    }
    
    // We expect the raw text response
    return response.text;
  }
);
