import { hash2 } from './rng.ts';

/** Quintic fade (smootherstep) so value noise has continuous slopes for hillshading. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** 2-D value noise in [0, 1) on an integer lattice, smoothly interpolated. */
export function valueNoise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/**
 * Fractal (fBm) value noise: `octaves` layers, each `lacunarity`× finer and `gain`× weaker.
 * Normalised to [0, 1). Each octave uses a different seed so layers don't line up.
 */
export function fbm2(
  x: number,
  y: number,
  seed: number,
  octaves = 5,
  gain = 0.5,
  lacunarity = 2,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2(x * f, y * f, (seed + o * 1013) | 0);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}
