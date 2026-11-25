/**
 * Build-time access to public/data/colorado/ for the /rising-water/ page (server only). The page's
 * "Longest-lived lakes" table and "About the data" section are generated from these files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BarcodeFile, BasinMaskFile, ColoradoMeta } from '../../lib/viz/explorer/types.ts';

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

/** basin-mask.json (stretch S3), or null if meta.json doesn't list a mask (the toggle is omitted). */
export function readBasinMaskInfo(meta: ColoradoMeta): BasinMaskFile | null {
  const bm = meta.basinMask;
  if (!bm) return null;
  const path = join(DIR, bm.metaFile);
  if (!existsSync(path)) throw new Error(`meta.json lists ${bm.metaFile}, but the file is missing`);
  const info = JSON.parse(readFileSync(path, 'utf8')) as BasinMaskFile;
  if (info.attribution?.credit !== bm.credit) {
    throw new Error('basin-mask.json attribution.credit ≠ meta.json basinMask.credit');
  }
  return info;
}
