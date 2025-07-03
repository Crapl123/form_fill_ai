import { config } from 'dotenv';
config();

import '@/ai/flows/extract-fields-from-excel.ts';
import '@/ai/flows/match-fields-with-google-sheet-data.ts';