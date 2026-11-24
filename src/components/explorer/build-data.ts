/**
 * Build-time access to public/data/colorado/ for the /rising-water/ page (server only). The page's
 * "Longest-lived lakes" table and "About the data" section are generated from these files.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BarcodeFile, ColoradoMeta } from '../../lib/viz/explorer/types.ts';

const DIR = join(process.cwd(), 'public', 'data', 'colorado');

export function readMeta(): ColoradoMeta {
  return JSON.parse(readFileSync(join(DIR, 'meta.json'), 'utf8')) as ColoradoMeta;
}

export function readBarcode(): BarcodeFile {
  return JSON.parse(readFileSync(join(DIR, 'barcode.json'), 'utf8')) as BarcodeFile;
}

export function readAttribution(): string {
  return readFileSync(join(DIR, 'ATTRIBUTION.md'), 'utf8');
}
