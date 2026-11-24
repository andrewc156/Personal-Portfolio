import { fbm2 } from '../common/noise.ts';

/** Synthetic terrain for the home-page hero (spec §6.3). Pure and deterministic per seed. */

export interface TerrainParams {
  seed: number;
  /** Feature size: larger means broader valleys and ridges. */
  scale: number;
  /** fBm gain: larger means more small-scale detail (and more small dips). */
  roughness: number;
}

export const TERRAIN_DEFAULTS = { scale: 1.5, roughness: 0.5 } as const;
export const SCALE_RANGE = { min: 0.5, max: 3, step: 0.1 } as const;
export const ROUGHNESS_RANGE = { min: 0.3, max: 0.75, step: 0.05 } as const;

/** Heights are rescaled to 0 … RELIEF_M metres. */
export const RELIEF_M = 1000;
/** Target cell size in CSS px and the hard cap on cells (spec §6.3: ~4–6 px, ≤ 40k). */
export const CELL_PX = 4;
export const MAX_CELLS = 40_000;

/**
 * Grid size for a canvas of cssW × cssH CSS pixels: about one cell per `cellPx` px, never more
 * than `maxCells` cells (the cell size grows instead), and at least 8 × 4.
 */
export function gridSize(
  cssW: number,
  cssH: number,
  cellPx = CELL_PX,
  maxCells = MAX_CELLS,
): { W: number; H: number; cellPx: number } {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  let px = Math.max(1, cellPx);
  if ((w / px) * (h / px) > maxCells) px = Math.sqrt((w * h) / maxCells);
  let W = Math.max(8, Math.round(w / px));
  let H = Math.max(4, Math.round(h / px));
  while (W * H > maxCells) {
    if (W >= H) W--;
    else H--;
  }
  return { W, H, cellPx: w / W };
}

/**
 * Fractal value-noise terrain. Noise is sampled in coordinates normalised by the grid width, so
 * the same seed gives the same landscape (at a different resolution) on any grid size.
 * Returns float32 heights in [0, RELIEF_M], row 0 = north.
 */
export function generateTerrain(W: number, H: number, p: TerrainParams): Float32Array {
  const out = new Float32Array(W * H);
  const freq = 3 / Math.max(0.1, p.scale);
  // Enough octaves to reach roughly two cells per lattice step, within 3 … 6.
  const octaves = Math.max(3, Math.min(6, Math.floor(Math.log2(W / (freq * 2))) + 1));
  const gain = Math.min(0.9, Math.max(0.1, p.roughness));
  const seed = p.seed | 0;
  // A second, coarse layer warps the coordinates a little so ridges aren't grid-aligned.
  const warpSeed = (seed ^ 0x5bd1e995) | 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * freq;
      const v = (y / W) * freq;
      const wu = fbm2(u * 0.5, v * 0.5, warpSeed, 2, 0.5) - 0.5;
      const wv = fbm2(u * 0.5 + 17.3, v * 0.5 + 4.1, warpSeed, 2, 0.5) - 0.5;
      const z = fbm2(u + wu * 0.8, v + wv * 0.8, seed, octaves, gain);
      out[y * W + x] = z;
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
  }
  const span = hi - lo || 1;
  for (let i = 0; i < out.length; i++) {
    // A gentle power curve widens valley floors so lakes have room to grow.
    // Clamp: `out` is float32, so a stored value can round just outside [lo, hi].
    const t = Math.min(1, Math.max(0, (out[i] - lo) / span));
    out[i] = Math.pow(t, 1.35) * RELIEF_M;
  }
  return out;
}

/** Min and max of a height grid. */
export function heightRange(h: Float32Array): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < h.length; i++) {
    const v = h[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/**
 * Hillshade in [0, 1], lit from the north-west at 45°. `cellMetres` sets the vertical
 * exaggeration (smaller cells → steeper slopes → stronger shading).
 */
export function hillshade(
  h: Float32Array,
  W: number,
  H: number,
  cellMetres = 12000 / W,
  out: Float32Array = new Float32Array(W * H),
): Float32Array {
  const lx = -0.5;
  const ly = -0.5;
  const lz = Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    const yn = y > 0 ? y - 1 : y;
    const ys = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < W; x++) {
      const xw = x > 0 ? x - 1 : x;
      const xe = x < W - 1 ? x + 1 : x;
      const dzdx = (h[y * W + xe] - h[y * W + xw]) / ((xe - xw || 1) * cellMetres);
      const dzdy = (h[ys * W + x] - h[yn * W + x]) / ((ys - yn || 1) * cellMetres);
      const nx = -dzdx;
      const ny = -dzdy;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const s = (nx * lx + ny * ly + lz) / len;
      out[y * W + x] = s < 0 ? 0 : s > 1 ? 1 : s;
    }
  }
  return out;
}
