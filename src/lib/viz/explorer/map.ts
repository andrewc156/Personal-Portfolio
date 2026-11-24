import type { Flood } from '../../tda/index.ts';

/**
 * Water overlay for the explorer map, drawn from the same grid and the same Flood the barcode
 * uses: a cell is coloured iff Flood says it is wet, with its lake's identity colour (or the shared
 * neutral colour). All buffers are allocated once; `paint` allocates nothing.
 */
export class WaterPainter {
  readonly W: number;
  readonly H: number;
  readonly n: number;
  /** One packed RGBA value per cell (ImageData order, little-endian). */
  readonly pixels: Uint32Array;
  private slotColors: Uint32Array = new Uint32Array(0);
  private neutral = 0;

  constructor(W: number, H: number, pixels?: Uint32Array) {
    this.W = W;
    this.H = H;
    this.n = W * H;
    this.pixels = pixels ?? new Uint32Array(this.n);
    if (this.pixels.length !== this.n) throw new RangeError('pixels.length !== W·H');
  }

  setColors(slotColors: Uint32Array, neutral: number): void {
    this.slotColors = slotColors;
    this.neutral = neutral;
  }

  /** Colour every wet cell by its lake (Flood.componentOf = birth cell → slotOf). Dry = transparent. */
  paint(flood: Flood, slotOf: Int16Array): void {
    const px = this.pixels;
    const cols = this.slotColors;
    const neutral = this.neutral;
    for (let i = 0; i < this.n; i++) {
      if (!flood.isWet(i)) {
        px[i] = 0;
        continue;
      }
      const s = slotOf[flood.componentOf(i)];
      px[i] = s >= 0 ? cols[s] : neutral;
    }
  }
}

/** mask[i] = 1 iff cell i belongs to lake `lake` (its birth cell) right now. Returns the count. */
export function lakeMask(flood: Flood, lake: number, mask: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < mask.length; i++) {
    const v = flood.componentOf(i) === lake ? 1 : 0;
    mask[i] = v;
    c += v;
  }
  return c;
}

/**
 * The lake just before it spilled: the 4-connected set containing `birthCell` among cells that are
 * ≺-earlier than the death cell (`deathRank` = its rank). Fills `mask`, uses `queue` as scratch,
 * returns the number of cells.
 */
export function basinMask(
  birthCell: number,
  deathRank: number,
  rank: Uint32Array,
  W: number,
  H: number,
  mask: Uint8Array,
  queue: Int32Array,
): number {
  mask.fill(0);
  if (rank[birthCell] >= deathRank) return 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = birthCell;
  mask[birthCell] = 1;
  while (head < tail) {
    const i = queue[head++];
    const y = (i / W) | 0;
    const x = i - y * W;
    if (y > 0) tail = visit(i - W, tail);
    if (y < H - 1) tail = visit(i + W, tail);
    if (x > 0) tail = visit(i - 1, tail);
    if (x < W - 1) tail = visit(i + 1, tail);
  }
  return tail;

  function visit(j: number, t: number): number {
    if (mask[j] === 0 && rank[j] < deathRank) {
      mask[j] = 1;
      queue[t++] = j;
    }
    return t;
  }
}

/**
 * Boundary of a cell mask as axis-aligned segments in grid-edge coordinates (x in 0…W, y in 0…H),
 * with runs merged. Calls `seg(x0, y0, x1, y1)` for each. Returns the total edge length in cells
 * (the perimeter), which tests compare with a brute-force count.
 */
export function traceOutline(
  mask: Uint8Array,
  W: number,
  H: number,
  seg: (x0: number, y0: number, x1: number, y1: number) => void,
): number {
  let total = 0;
  // Horizontal edges on grid line y (between rows y − 1 and y).
  for (let y = 0; y <= H; y++) {
    let start = -1;
    for (let x = 0; x <= W; x++) {
      let edge = false;
      if (x < W) {
        const a = y > 0 ? mask[(y - 1) * W + x] : 0;
        const b = y < H ? mask[y * W + x] : 0;
        edge = a !== b;
      }
      if (edge && start < 0) start = x;
      else if (!edge && start >= 0) {
        seg(start, y, x, y);
        total += x - start;
        start = -1;
      }
    }
  }
  // Vertical edges on grid line x (between columns x − 1 and x).
  for (let x = 0; x <= W; x++) {
    let start = -1;
    for (let y = 0; y <= H; y++) {
      let edge = false;
      if (y < H) {
        const a = x > 0 ? mask[y * W + x - 1] : 0;
        const b = x < W ? mask[y * W + x] : 0;
        edge = a !== b;
      }
      if (edge && start < 0) start = y;
      else if (!edge && start >= 0) {
        seg(x, start, x, y);
        total += y - start;
        start = -1;
      }
    }
  }
  return total;
}
