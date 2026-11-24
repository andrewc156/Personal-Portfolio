/**
 * The total order of spec §6.1: i ≺ j iff (h[i], i) < (h[j], j) lexicographically.
 */

/** Throws unless heights has exactly W·H finite entries (no NaN, no ±Infinity). */
export function validateGrid(heights: Float32Array, W: number, H: number): void {
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) {
    throw new RangeError(`grid size must be positive integers, got ${W}×${H}`);
  }
  if (heights.length !== W * H) {
    throw new RangeError(`heights.length ${heights.length} !== W·H = ${W * H}`);
  }
  for (let i = 0; i < heights.length; i++) {
    if (!Number.isFinite(heights[i])) throw new RangeError(`heights[${i}] is ${heights[i]}`);
  }
}

/** Largest grid for which the packed-key sort is exact: 32 key bits + index bits ≤ 53. */
const PACKED_MAX_CELLS = 1 << 21;

/**
 * Returns cell indices sorted by ≺. Uses a packed Float64 key (order-preserving float32 bits ·
 * 2^k + index) sorted natively, which is exact for up to 2^21 cells; larger grids fall back to a
 * comparator sort.
 */
export function sortCells(heights: Float32Array): Uint32Array {
  const n = heights.length;
  if (n > PACKED_MAX_CELLS) return sortCellsByComparator(heights);
  let bits = 0;
  while (1 << bits < n) bits++;
  const scale = 2 ** bits;
  const f = new Float32Array(1);
  const u = new Uint32Array(f.buffer);
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const h = heights[i];
    f[0] = h === 0 ? 0 : h; // fold -0 into +0: they are equal heights
    const b = u[0];
    // Map IEEE-754 bits to an unsigned key with the same order as the float value.
    const key = b & 0x80000000 ? ~b >>> 0 : (b | 0x80000000) >>> 0;
    keys[i] = key * scale + i;
  }
  keys.sort();
  const order = new Uint32Array(n);
  for (let k = 0; k < n; k++) order[k] = keys[k] % scale;
  return order;
}

/** Reference comparator sort by (height, index). Used for very large grids and in tests. */
export function sortCellsByComparator(heights: Float32Array): Uint32Array {
  const order = new Uint32Array(heights.length);
  for (let i = 0; i < order.length; i++) order[i] = i;
  order.sort((a, b) => heights[a] - heights[b] || a - b);
  return order;
}

export function rankOf(order: Uint32Array): Uint32Array {
  const rank = new Uint32Array(order.length);
  for (let k = 0; k < order.length; k++) rank[order[k]] = k;
  return rank;
}
