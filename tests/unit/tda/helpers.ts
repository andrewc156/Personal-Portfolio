import { readFileSync } from 'node:fs';

/** mulberry32: small deterministic PRNG returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export interface Grid {
  W: number;
  H: number;
  heights: Float32Array;
  ties: boolean;
}

/** Random W×H grid, 1..maxSide per side; with ties uses a small integer range. */
export function randomGrid(r: () => number, maxSide: number, ties: boolean): Grid {
  const W = randInt(r, 1, maxSide);
  const H = randInt(r, 1, maxSide);
  const heights = new Float32Array(W * H);
  const levels = randInt(r, 1, 8);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = ties ? randInt(r, -levels, levels) : r() * 2000 - 1000;
  }
  return { W, H, heights, ties };
}

export function neighbors(i: number, W: number, H: number, connectivity: 4 | 8): number[] {
  const x = i % W;
  const y = (i - x) / W;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (connectivity === 4 && dx !== 0 && dy !== 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
    }
  }
  return out;
}

/** Brute-force ≺: (h[a], a) < (h[b], b). Independent of the engine's sort. */
export function precedes(h: Float32Array, a: number, b: number): boolean {
  return h[a] < h[b] || (h[a] === h[b] && a < b);
}

/**
 * Labels the connected components of the cells accepted by `inSet` by BFS. Each label is the
 * ≺-minimum cell of its component; cells outside the set get −1.
 */
export function bfsLabels(
  h: Float32Array,
  W: number,
  H: number,
  connectivity: 4 | 8,
  inSet: (i: number) => boolean,
): Int32Array {
  const n = W * H;
  const label = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s] || !inSet(s)) continue;
    const comp: number[] = [s];
    seen[s] = 1;
    let min = s;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q];
      if (precedes(h, c, min)) min = c;
      for (const j of neighbors(c, W, H, connectivity)) {
        if (!seen[j] && inSet(j)) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    for (const c of comp) label[c] = min;
  }
  return label;
}

export function loadFixture<T>(name: string): T {
  const url = new URL(`../../fixtures/tda/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}
