import { config } from 'dotenv';
config();

import '@/ai/flows/fill-supplier-form.ts';
import '@/ai/flows/map-data-to-pdf-fields.ts';
import '@/ai/flows/reconstruct-pdf-with-data.ts';
import '@/ai/flows/correct-filled-form.ts';
import '@/ai/flows/extract-fields-from-excel.ts';
