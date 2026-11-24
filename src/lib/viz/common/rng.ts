/** Seeded randomness for the generative canvases. Deterministic: same seed, same numbers. */

/** Mulberry32: a small, fast 32-bit PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash of (x, y, seed) → [0, 1). Stateless, so noise can be sampled anywhere. */
export function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Largest seed accepted by the settings (seeds are integers 0 … MAX_SEED). */
export const MAX_SEED = 999_999;

/** Clamp anything to a valid integer seed. */
export function normalizeSeed(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_SEED, Math.max(0, n));
}

/** A fresh seed for "New terrain". `random` is injectable for tests. */
export function randomSeed(random: () => number = Math.random): number {
  return Math.floor(random() * (MAX_SEED + 1));
}
