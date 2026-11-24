import { isEssential } from '../../tda/index.ts';
import type { Bar, H0Result } from '../../tda/index.ts';
import type { BarcodeFile, ColoradoMeta } from './types.ts';

/**
 * Loading and verification of the Colorado data (spec §6.4, docs/data.md). Pure functions apart
 * from `sha256Hex`, which uses Web Crypto (browser and Node ≥ 20).
 */

export const DATA_BASE = '/data/colorado/';

/** Problems found while checking the grid file against meta.json / barcode.json. */
export interface GridCheck {
  ok: boolean;
  problems: string[];
}

/** Byte-level checks of grid.f32: length vs W·H·4, meta.files and barcode.grid. */
export function checkGridBytes(
  byteLength: number,
  meta: ColoradoMeta,
  barcode: BarcodeFile,
): GridCheck {
  const problems: string[] = [];
  const expected = meta.width * meta.height * 4;
  if (meta.width * meta.height !== meta.cells) problems.push('meta.cells ≠ width × height');
  if (byteLength !== expected)
    problems.push(`grid.f32 is ${byteLength} bytes, expected ${expected}`);
  const listed = meta.files['grid.f32']?.bytes;
  if (listed !== byteLength) problems.push(`grid.f32 is ${byteLength} bytes, meta lists ${listed}`);
  if (barcode.grid.width !== meta.width || barcode.grid.height !== meta.height) {
    problems.push('barcode.json grid size differs from meta.json');
  }
  if (barcode.grid.bytes !== byteLength) problems.push('barcode.json grid bytes differ');
  return { ok: problems.length === 0, problems };
}

/** Compare the file's SHA-256 with meta.json and barcode.json. `actual` null = not computed. */
export function checkGridHash(
  actual: string | null,
  meta: ColoradoMeta,
  barcode: BarcodeFile,
): GridCheck {
  if (actual === null) return { ok: true, problems: [] };
  const problems: string[] = [];
  if (meta.files['grid.f32']?.sha256 !== actual) problems.push('grid.f32 SHA-256 ≠ meta.json');
  if (barcode.grid.sha256 !== actual) problems.push('grid.f32 SHA-256 ≠ barcode.json');
  return { ok: problems.length === 0, problems };
}

/** Little-endian float32, row-major, north row first (docs/data.md step 6). */
export function decodeGrid(buffer: ArrayBuffer): Float32Array {
  const n = buffer.byteLength >> 2;
  if (LITTLE_ENDIAN) return new Float32Array(buffer.slice(0, n * 4));
  const out = new Float32Array(n);
  const view = new DataView(buffer);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** Lower-case hex SHA-256, or null if Web Crypto isn't available (e.g. an insecure origin). */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = new Uint8Array(await subtle.digest('SHA-256', buffer));
  let s = '';
  for (const b of digest) s += b.toString(16).padStart(2, '0');
  return s;
}

/** barcode.json columns → Bar objects (essential: death = +∞, deathCell = mergedInto = −1). */
export function barsFromFile(file: BarcodeFile): Bar[] {
  const out: Bar[] = [];
  for (let k = 0; k < file.b.length; k++) {
    const d = file.d[k];
    out.push({
      birth: file.b[k],
      death: d === null ? Infinity : d,
      birthCell: file.bi[k],
      deathCell: file.di[k],
      mergedInto: file.mi[k],
    });
  }
  return out;
}

/** The live bars barcode.json should contain: persistence ≥ minPersistence, plus essential. */
export function exportedBars(result: H0Result, minPersistence: number): Bar[] {
  // Persistence is the float64 difference of the float32 heights, as in the pipeline.
  return result.bars.filter((b) => isEssential(b) || b.death - b.birth >= minPersistence);
}

export interface BarcodeMatch {
  ok: boolean;
  /** Bars compared (live exported vs file). */
  live: number;
  file: number;
  /** Bars whose (bi, di, mi, b, d) agree exactly. */
  identical: number;
  /** Human-readable differences (at most 8). */
  problems: string[];
}

/**
 * Live engine bars vs barcode.json: identical (bi, di, mi) in the same order and equal b and d.
 * barcode.json stores exact float32 values (DECISIONS #35), so b and d must be ===; we also check
 * b === heights[bi] and d === heights[di], and the birth / zero-length counts.
 */
export function compareBarcode(
  result: H0Result,
  file: BarcodeFile,
  heights: Float32Array,
): BarcodeMatch {
  const live = exportedBars(result, file.minPersistence);
  const want = barsFromFile(file);
  const problems: string[] = [];
  const note = (s: string) => {
    if (problems.length < 8) problems.push(s);
  };
  if (file.b.length !== file.count)
    note(`barcode.json count ${file.count} ≠ ${file.b.length} rows`);
  if (live.length !== want.length) note(`live ${live.length} bars, file ${want.length}`);
  let identical = 0;
  const m = Math.min(live.length, want.length);
  for (let k = 0; k < m; k++) {
    const a = live[k];
    const b = want[k];
    const same =
      a.birthCell === b.birthCell &&
      a.deathCell === b.deathCell &&
      a.mergedInto === b.mergedInto &&
      a.birth === b.birth &&
      a.death === b.death &&
      b.birth === heights[b.birthCell] &&
      (b.deathCell < 0 ? b.death === Infinity : b.death === heights[b.deathCell]);
    if (same) identical++;
    else {
      note(
        `bar ${k}: live (${a.birthCell}, ${a.deathCell}, ${a.birth}, ${a.death}) ≠ file (${b.birthCell}, ${b.deathCell}, ${b.birth}, ${b.death})`,
      );
    }
  }
  if (result.stats.births !== file.stats.births) {
    note(`births: live ${result.stats.births}, file ${file.stats.births}`);
  }
  if (result.stats.zeroLength !== file.stats.zeroLengthBars) {
    note(`zero-length: live ${result.stats.zeroLength}, file ${file.stats.zeroLengthBars}`);
  }
  if (result.stats.essential !== file.stats.essential) note('essential bar count differs');
  return {
    ok: problems.length === 0 && identical === want.length,
    live: live.length,
    file: want.length,
    identical,
    problems,
  };
}

/** Fetch a data file, failing loudly on a non-2xx response. */
export async function fetchData(name: string, kind: 'json'): Promise<unknown>;
export async function fetchData(name: string, kind: 'buffer'): Promise<ArrayBuffer>;
export async function fetchData(name: string, kind: 'json' | 'buffer'): Promise<unknown> {
  const res = await fetch(DATA_BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return kind === 'json' ? res.json() : res.arrayBuffer();
}
