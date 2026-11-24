import { rankOf, sortCells, validateGrid } from './order.ts';
import type { Connectivity, MergeEvent } from './types.ts';

export interface FloodOptions {
  /** 4 (default) or 8. */
  connectivity?: Connectivity;
  /** A precomputed ≺ order (e.g. `computeH0(...).order`) to skip re-sorting. Not validated. */
  order?: Uint32Array;
}

/** Callback used by the sweep. kind 0 = birth, 1 = death (lake dies at cell, joins into). */
type SweepSink = (kind: 0 | 1, cell: number, lake: number, into: number) => void;

/**
 * Incremental sublevel-set flood (spec §6.1, §6.2). Cells are added in ≺ order; each lake is a
 * union-find tree whose root is the lake's birth cell, so `componentOf(i)` is also the lake id.
 * When a cell touches several lakes it joins the oldest (smallest ≺-rank birth cell); every other
 * lake dies there (the elder rule).
 */
export class Flood {
  readonly heights: Float32Array;
  readonly W: number;
  readonly H: number;
  readonly n: number;
  readonly connectivity: Connectivity;
  /** Cells sorted by ≺. */
  readonly order: Uint32Array;
  /** rank[i] = position of cell i in `order`. */
  readonly rank: Uint32Array;

  private readonly parent: Int32Array;
  private readonly roots = new Int32Array(8);
  private readonly dx: Int32Array;
  private readonly dy: Int32Array;
  private added = 0;
  private lakes = 0;
  private currentLevel = -Infinity;

  constructor(heights: Float32Array, W: number, H: number, opts: FloodOptions = {}) {
    validateGrid(heights, W, H);
    const connectivity = opts.connectivity ?? 4;
    if (connectivity !== 4 && connectivity !== 8) {
      throw new RangeError(`connectivity must be 4 or 8, got ${String(connectivity)}`);
    }
    this.heights = heights;
    this.W = W;
    this.H = H;
    this.n = W * H;
    this.connectivity = connectivity;
    this.order = opts.order ?? sortCells(heights);
    if (this.order.length !== this.n) throw new RangeError('order.length !== W·H');
    this.rank = rankOf(this.order);
    this.parent = new Int32Array(this.n);
    // N, S, W, E, then diagonals for 8-connectivity.
    this.dx = Int32Array.from(connectivity === 4 ? [0, 0, -1, 1] : [0, 0, -1, 1, -1, 1, -1, 1]);
    this.dy = Int32Array.from(connectivity === 4 ? [-1, 1, 0, 0] : [-1, 1, 0, 0, -1, -1, 1, 1]);
  }

  /** Back to an empty (dry) grid. */
  reset(): void {
    this.added = 0;
    this.lakes = 0;
    this.currentLevel = -Infinity;
  }

  /** Current water level (−∞ after reset). */
  get level(): number {
    return this.currentLevel;
  }

  /** Number of wet cells, i.e. |{x : h(x) ≤ level}|. */
  get wetCount(): number {
    return this.added;
  }

  /**
   * Raises (or lowers) the water to `level` and returns the births and merges that happened, in
   * sweep order. Lowering the level resets and replays the sweep from the bottom.
   */
  advanceTo(level: number): MergeEvent[] {
    if (Number.isNaN(level)) throw new RangeError('level is NaN');
    const events: MergeEvent[] = [];
    if (level < this.currentLevel) {
      const last = this.added > 0 ? this.heights[this.order[this.added - 1]] : -Infinity;
      if (last > level) this.reset();
    }
    this.currentLevel = level;
    const h = this.heights;
    const sink: SweepSink = (kind, cell, lake, into) => {
      events.push({ type: kind === 0 ? 'birth' : 'merge', level: h[cell], cell, lake, into });
    };
    while (this.added < this.n && h[this.order[this.added]] <= level) this.addNext(sink);
    return events;
  }

  /** True iff cell i is flooded: h[i] ≤ level (with ties resolved by ≺). */
  isWet(i: number): boolean {
    return this.rank[i] < this.added;
  }

  /**
   * Union-find root of cell i, with path compression. The root is the birth cell of i's lake,
   * so it doubles as a stable lake id. Returns −1 for a dry cell.
   */
  componentOf(i: number): number {
    if (this.rank[i] >= this.added) return -1;
    return this.find(i);
  }

  /**
   * The height of the cell at percentile p ∈ [0, 100] of the ≺ order: p = 0 is the lowest cell,
   * p = 100 the highest. advanceTo(levelAtPercentile(p)) floods ≈ p% of the cells (more on ties).
   */
  levelAtPercentile(p: number): number {
    const q = Math.min(100, Math.max(0, Number.isNaN(p) ? 0 : p));
    const k = Math.round((q / 100) * (this.n - 1));
    return this.heights[this.order[k]];
  }

  /** Number of lakes (connected components of the flooded region) right now. */
  alive(): number {
    return this.lakes;
  }

  /** @internal Adds every cell; used by computeH0. */
  sweepAll(sink: SweepSink): void {
    this.reset();
    while (this.added < this.n) this.addNext(sink);
    this.currentLevel = Infinity;
  }

  private find(i: number): number {
    const parent = this.parent;
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  }

  private addNext(sink: SweepSink): void {
    const { W, H, parent, rank, roots, dx, dy } = this;
    const k = this.added;
    const i = this.order[k];
    const y = (i / W) | 0;
    const x = i - y * W;
    let nr = 0;
    for (let d = 0; d < dx.length; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (rank[j] >= k) continue; // not yet added
      const r = this.find(j);
      // Insert r into roots[0..nr) kept sorted by rank (oldest first), skipping duplicates.
      let p = nr;
      let dup = false;
      while (p > 0) {
        const q = roots[p - 1];
        if (q === r) {
          dup = true;
          break;
        }
        if (rank[q] < rank[r]) break;
        p--;
      }
      if (dup) continue;
      for (let m = nr; m > p; m--) roots[m] = roots[m - 1];
      roots[p] = r;
      nr++;
    }
    this.added = k + 1;
    if (nr === 0) {
      parent[i] = i;
      this.lakes++;
      sink(0, i, i, -1);
      return;
    }
    const oldest = roots[0];
    parent[i] = oldest;
    for (let m = 1; m < nr; m++) {
      const r = roots[m];
      parent[r] = oldest;
      this.lakes--;
      sink(1, i, r, oldest);
    }
  }
}
