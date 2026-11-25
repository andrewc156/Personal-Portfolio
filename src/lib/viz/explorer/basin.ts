import type { GridGeo } from './geo.ts';
import type { BasinMaskFile, ColoradoMeta } from './types.ts';

/**
 * Basin mask (stretch S3, F12b): decoding and checking basin-mask.bin / basin-mask.json against
 * meta.json, upsampling the per-cell mask to a pixel raster (the screen or the hillshade), the
 * hatched layer, and the URL-hash state. Pure functions; the controller and the client do the I/O.
 *
 * The mask is display-only. The flood, the barcode and the lakes are always computed on the whole
 * rectangle (spec §6.1); the mask never enters that computation.
 *
 * Format (docs/data.md "basin-mask.bin format"): two bit planes of ⌈cells / 8⌉ bytes. Cell index
 * i = y·W + x, row 0 north, as grid.f32. Bit i of a plane is (byte[i >> 3] >> (i & 7)) & 1.
 * Plane 0: 1 = basin (HU-2 14 or 15). Plane 1: 1 = basin cell assigned to 15; 0 elsewhere.
 */

export const MASK_PLANES = 2;

export interface MaskCheck {
  ok: boolean;
  problems: string[];
}

export function planeBytes(cells: number): number {
  return Math.ceil(cells / 8);
}

/** Bit i of plane `plane` (0 or 1). */
export function maskBit(bytes: Uint8Array, cells: number, plane: number, i: number): number {
  return (bytes[plane * planeBytes(cells) + (i >> 3)] >> (i & 7)) & 1;
}

/** Plane `plane` as one byte (0/1) per cell. */
export function decodePlane(
  bytes: Uint8Array,
  cells: number,
  plane: number,
  out: Uint8Array = new Uint8Array(cells),
): Uint8Array {
  const off = plane * planeBytes(cells);
  for (let i = 0; i < cells; i++) out[i] = (bytes[off + (i >> 3)] >> (i & 7)) & 1;
  return out;
}

export interface BasinMask {
  /** 1 = cell inside WBD HU-2 14 ∪ 15 (plane 0). */
  inside: Uint8Array;
  /** 14 or 15 for basin cells (plane 1), 0 outside. */
  region: Uint8Array;
  /** Number of basin cells. */
  count: number;
}

/** Both planes → per-cell inside flag and region (14 / 15). */
export function decodeMask(bytes: Uint8Array, cells: number): BasinMask {
  const inside = decodePlane(bytes, cells, 0);
  const lower = decodePlane(bytes, cells, 1);
  const region = new Uint8Array(cells);
  let count = 0;
  for (let i = 0; i < cells; i++) {
    if (inside[i]) {
      count++;
      region[i] = lower[i] ? 15 : 14;
    }
  }
  return { inside, region, count };
}

/**
 * File-level checks before decoding: meta.json must list the mask (basinMask, files entry with
 * the byte length), the length must be 2 planes × ⌈cells / 8⌉, and basin-mask.json must describe
 * the same format and the same grid as meta.json (size, bbox, cell size, extent, grid SHA-256).
 */
export function checkMaskFiles(
  binBytes: number,
  info: BasinMaskFile,
  meta: ColoradoMeta,
): MaskCheck {
  const problems: string[] = [];
  const bm = meta.basinMask;
  if (!bm) return { ok: false, problems: ['meta.json has no basinMask entry'] };
  const pb = planeBytes(meta.cells);
  const want = MASK_PLANES * pb;
  const listed = meta.files[bm.file]?.bytes;
  if (binBytes !== want) problems.push(`${bm.file} is ${binBytes} bytes, expected ${want}`);
  if (listed !== binBytes) problems.push(`${bm.file} is ${binBytes} bytes, meta lists ${listed}`);
  if (info.format?.name !== bm.format) problems.push('basin-mask.json format ≠ meta.json');
  if (info.format?.planeBytes !== pb) problems.push('basin-mask.json planeBytes ≠ ⌈cells / 8⌉');
  if (info.format?.bytes !== binBytes) problems.push('basin-mask.json bytes ≠ file length');
  const g = info.grid;
  if (!g) problems.push('basin-mask.json has no grid');
  else {
    if (g.width !== meta.width || g.height !== meta.height || g.cells !== meta.cells) {
      problems.push('basin-mask.json grid size ≠ meta.json');
    }
    if (g.cellDeg !== meta.cellDeg) problems.push('basin-mask.json cellDeg ≠ meta.json');
    if (!close(g.bbox, meta.bbox)) problems.push('basin-mask.json bbox ≠ meta.json');
    if (!close(g.extent, meta.native.extent)) problems.push('basin-mask.json extent ≠ meta.json');
    if (g.sha256 !== meta.files['grid.f32']?.sha256) {
      problems.push('basin-mask.json grid SHA-256 ≠ grid.f32 in meta.json');
    }
  }
  if (info.stats?.basinCells !== bm.basinCells) {
    problems.push('basin-mask.json basinCells ≠ meta.json');
  }
  return { ok: problems.length === 0, problems };
}

function close(a: readonly number[] | undefined, b: readonly number[]): boolean {
  return !!a && a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 1e-6);
}

/** SHA-256 checks against meta.files (skipped for a null hash or a file without a listed hash). */
export function checkMaskHashes(
  binHash: string | null,
  jsonHash: string | null,
  meta: ColoradoMeta,
): MaskCheck {
  const problems: string[] = [];
  const bm = meta.basinMask;
  if (!bm) return { ok: false, problems: ['meta.json has no basinMask entry'] };
  const wantBin = meta.files[bm.file]?.sha256;
  const wantJson = meta.files[bm.metaFile]?.sha256;
  if (binHash !== null && wantBin && binHash !== wantBin)
    problems.push(`${bm.file} SHA-256 ≠ meta.json`);
  if (jsonHash !== null && wantJson && jsonHash !== wantJson) {
    problems.push(`${bm.metaFile} SHA-256 ≠ meta.json`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Bit-level checks: the unused high bits of each plane's last byte are 0, plane 1 is 0 outside
 * plane 0, and plane 0 has exactly `basinCells` ones (meta.basinMask.basinCells).
 */
export function checkPlanes(bytes: Uint8Array, cells: number, basinCells: number): MaskCheck {
  const problems: string[] = [];
  const pb = planeBytes(cells);
  const used = cells - 8 * (pb - 1);
  const padMask = used === 8 ? 0 : 0xff & ~((1 << used) - 1);
  for (let p = 0; p < MASK_PLANES; p++) {
    if (bytes[p * pb + pb - 1] & padMask) problems.push(`plane ${p} has padding bits set`);
  }
  let count = 0;
  let stray = 0;
  for (let k = 0; k < pb; k++) {
    const a = bytes[k];
    const b = bytes[pb + k];
    count += popcount8(a);
    stray += popcount8(b & ~a);
  }
  if (stray) problems.push(`plane 1 has ${stray} cells outside plane 0`);
  if (count !== basinCells)
    problems.push(`plane 0 has ${count} basin cells, meta lists ${basinCells}`);
  return { ok: problems.length === 0, problems };
}

function popcount8(v: number): number {
  v = v - ((v >> 1) & 0x55);
  v = (v & 0x33) + ((v >> 2) & 0x33);
  return (v + (v >> 4)) & 0x0f;
}

/**
 * "USGS Watershed Boundary Dataset regions 14–15" from basin-mask.json → source.regions (a run of
 * consecutive region codes is written with an en dash).
 */
export function regionsLabel(regions: readonly { huc2: string }[]): string {
  const codes = regions.map((r) => r.huc2).sort();
  const nums = codes.map(Number);
  const consecutive =
    codes.length > 1 &&
    nums.every((v, k) => Number.isInteger(v) && (k === 0 || v === nums[k - 1] + 1));
  const list = consecutive ? `${codes[0]}–${codes[codes.length - 1]}` : codes.join(', ');
  return `USGS Watershed Boundary Dataset region${codes.length === 1 ? '' : 's'} ${list}`;
}

// ---- upsampling -------------------------------------------------------------------------------

/**
 * Upsampling along one axis: out[p] = the grid column (or row) containing the centre of output
 * pixel p, for a raster of n pixels spanning the native footprint (nativeLen native pixels, `block`
 * native pixels per cell, `cells` cells; the last cell may be partial). Uses the same rule as
 * geo.cellAtFraction, so the mask, the water (nearest-neighbour drawImage) and hover agree.
 *
 * For the hillshade (10 native px per hillshade px, 30 per cell) every cell edge falls on a
 * hillshade pixel edge: hillshade pixel p belongs to cell ⌊p / 3⌋.
 */
export function axisCells(
  n: number,
  nativePerPx: number,
  block: number,
  cells: number,
  out: Int32Array = new Int32Array(n),
): Int32Array {
  for (let p = 0; p < n; p++) {
    const u = Math.floor((p + 0.5) * nativePerPx);
    out[p] = Math.min(cells - 1, Math.floor(u / block));
  }
  return out;
}

/** Column / row lookups for a raster of nx × ny pixels covering the map (the canvas). */
export function screenAxes(
  nx: number,
  ny: number,
  g: GridGeo,
): { cols: Int32Array; rows: Int32Array } {
  return {
    cols: axisCells(nx, g.nativeW / nx, g.block, g.W),
    rows: axisCells(ny, g.nativeH / ny, g.block, g.H),
  };
}

/**
 * Pixel position of every grid line 0…cells along an axis: the first output pixel whose cell is
 * ≥ k (n for k = cells). Boundary strokes centred on these integers sit exactly between the pixels
 * the fill puts on either side, so the line and the hatching are aligned to the device pixel.
 */
export function axisEdges(
  axis: Int32Array,
  cells: number,
  out: Int32Array = new Int32Array(cells + 1),
): Int32Array {
  let p = 0;
  for (let k = 0; k <= cells; k++) {
    while (p < axis.length && axis[p] < k) p++;
    out[k] = p;
  }
  return out;
}

/** Nearest-neighbour upsample of a per-cell mask onto the raster given by `cols` × `rows`. */
export function upsampleMask(
  mask: Uint8Array,
  W: number,
  cols: Int32Array,
  rows: Int32Array,
  out: Uint8Array = new Uint8Array(cols.length * rows.length),
): Uint8Array {
  const nx = cols.length;
  for (let py = 0; py < rows.length; py++) {
    const base = rows[py] * W;
    const o = py * nx;
    for (let px = 0; px < nx; px++) out[o + px] = mask[base + cols[px]];
  }
  return out;
}

export interface HatchStyle {
  /** Packed RGBA (little-endian, as palette.packRgba) for the dimmed background outside. */
  dim: number;
  /** Packed RGBA for the hatch lines outside. */
  hatch: number;
  /** Device pixels between hatch lines, and their width. */
  period: number;
  width: number;
}

/**
 * The layer drawn over the water: transparent inside the basin, dimmed with diagonal hatching
 * outside (land and water alike). `pixels` is nx × ny packed RGBA (ImageData order). One pass, no
 * allocation; run once per resize or theme change, not per frame.
 */
export function paintHatch(
  pixels: Uint32Array,
  inside: Uint8Array,
  W: number,
  cols: Int32Array,
  rows: Int32Array,
  style: HatchStyle,
): void {
  const nx = cols.length;
  const { dim, hatch, period, width } = style;
  for (let py = 0; py < rows.length; py++) {
    const base = rows[py] * W;
    const o = py * nx;
    for (let px = 0; px < nx; px++) {
      pixels[o + px] = inside[base + cols[px]] ? 0 : (px + py) % period < width ? hatch : dim;
    }
  }
}

// ---- URL hash state ---------------------------------------------------------------------------

/**
 * The explorer's URL-hash state, e.g. "#mask=basin". Before F12b the page used the hash only for
 * section anchors (#lakes, #about-data, …); those still work and are left alone: a hash is a
 * state hash only if it parses as key=value pairs with a known key. Returns null for anything
 * else (no hash, an anchor), true / false for mask=basin / mask=off.
 */
export function parseMaskHash(hash: string): boolean | null {
  const h = hash.replace(/^#/, '');
  if (!h.includes('=')) return null;
  const p = new URLSearchParams(h);
  const v = p.get('mask');
  if (v === null) return null;
  if (v === 'basin') return true;
  if (v === 'off' || v === 'none' || v === '') return false;
  return null;
}

/**
 * The hash to write after the toggle changes: "#mask=basin" when on; when off, "" (no hash) if the
 * current hash was a state hash, otherwise the current hash unchanged.
 */
export function maskHash(on: boolean, current: string): string {
  if (on) return '#mask=basin';
  return parseMaskHash(current) === null ? current : '';
}
