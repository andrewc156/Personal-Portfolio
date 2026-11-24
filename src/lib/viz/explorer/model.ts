import { isEssential } from '../../tda/index.ts';
import type { Bar } from '../../tda/index.ts';

/**
 * The explorer's data model: lake ranks, identity colour slots, which bars the strip draws, and
 * water level ↔ scrubber position. Pure functions over the engine's Bar objects.
 */

export type Pacing = 'percentile' | 'linear';
export type Units = 'm' | 'ft';
export type StripView = 'barcode' | 'diagram';

/** Number of identity colours: the lowest lake plus the 11 longest-lived finite lakes. */
export const IDENTITY_K = 12;

export interface LakeIndex {
  /** Finite bars, longest-lived first (ties: earlier in sweep order). ranked[r − 1] has rank r. */
  ranked: Bar[];
  /** The essential bar (the lowest lake), if present. */
  essential: Bar | null;
  /** birth cell → rank (1-based for finite lakes, 0 for the lowest lake). */
  rankOf: Map<number, number>;
  /** birth cell → bar. */
  barOf: Map<number, Bar>;
}

/**
 * Rank lakes by persistence (death − birth), longest first. `bars` must be in sweep order (as
 * computeH0 and barcode.json give them); the sort is stable, so ties keep sweep order, the rule
 * docs/data.md's lakes table uses.
 */
export function indexLakes(bars: readonly Bar[]): LakeIndex {
  const finite = bars.filter((b) => !isEssential(b));
  const ranked = finite.slice().sort((a, b) => b.death - b.birth - (a.death - a.birth));
  const essential = bars.find(isEssential) ?? null;
  const rankOf = new Map<number, number>();
  const barOf = new Map<number, Bar>();
  ranked.forEach((b, k) => {
    rankOf.set(b.birthCell, k + 1);
    barOf.set(b.birthCell, b);
  });
  if (essential) {
    rankOf.set(essential.birthCell, 0);
    barOf.set(essential.birthCell, essential);
  }
  return { ranked, essential, rankOf, barOf };
}

/**
 * Identity colour slot per cell (−1 = shared neutral water). Slot 0 is the lowest lake, slot r is
 * the r-th longest-lived finite lake (r < K). The slot is keyed by the lake's birth cell, which is
 * the engine's union-find root (`Flood.componentOf`), so a merged region takes the colour of the
 * older lake that absorbed it. Consistent with the elder rule: a survivor's persistence is at least
 * that of the lake it absorbs, so an identity lake is only ever absorbed by an identity lake.
 */
export function identitySlots(index: LakeIndex, cells: number, K = IDENTITY_K): Int16Array {
  const slotOf = new Int16Array(cells).fill(-1);
  if (index.essential) slotOf[index.essential.birthCell] = 0;
  for (let r = 1; r < K && r <= index.ranked.length; r++) slotOf[index.ranked[r - 1].birthCell] = r;
  return slotOf;
}

/**
 * Rows the strip draws, as references to the engine's own Bar objects: the lowest lake, then the
 * longest-lived finite bars with persistence ≥ minPersistence, at most `topN` rows in total; in
 * row order by birth height (≺ rank of the birth cell), so the lowest lake is the top row.
 */
export function selectRows(
  index: LakeIndex,
  minPersistence: number,
  topN: number,
  cellRank: ArrayLike<number>,
): Bar[] {
  const rows: Bar[] = [];
  const cap = Math.max(1, Math.floor(topN));
  if (index.essential) rows.push(index.essential);
  for (const b of index.ranked) {
    if (rows.length >= cap) break;
    if (b.death - b.birth < minPersistence) break; // ranked is sorted, so the rest are shorter
    rows.push(b);
  }
  return rows.sort((a, b) => cellRank[a.birthCell] - cellRank[b.birthCell]);
}

/** Largest double strictly below x (x finite). "Just below the death level." */
export function nextDown(x: number): number {
  if (Number.isNaN(x) || x === -Infinity) return x;
  if (x === Infinity) return Number.MAX_VALUE;
  if (x === 0) return -Number.MIN_VALUE;
  const f = new Float64Array(1);
  const u = new BigInt64Array(f.buffer);
  f[0] = x;
  u[0] += x > 0 ? -1n : 1n;
  return f[0];
}

/**
 * Water level ↔ scrubber position p ∈ [0, 1], for both pacings, plus flooded-fraction readouts.
 * `sorted` is the heights in ≺ order (heights[order[k]]), non-decreasing.
 */
export class LevelScale {
  readonly sorted: Float32Array;
  readonly n: number;
  readonly minH: number;
  readonly maxH: number;
  /** cumArea[k] = total area of the k lowest cells (in ≺ order); cumArea[n] = total. */
  private readonly cumArea: Float64Array;

  constructor(heights: Float32Array, order: Uint32Array, areas: Float64Array) {
    const n = order.length;
    this.n = n;
    this.sorted = new Float32Array(n);
    this.cumArea = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) {
      const i = order[k];
      this.sorted[k] = heights[i];
      this.cumArea[k + 1] = this.cumArea[k] + areas[i];
    }
    this.minH = this.sorted[0];
    this.maxH = this.sorted[n - 1];
  }

  /**
   * Level at position p. Percentile pacing: the height of the cell at rank round(p·(n − 1)) (same as
   * Flood.levelAtPercentile(100p)), so the flooded area grows at a steady rate. Linear: metres rise
   * at a steady rate. Either way p = 0 is the lowest cell and p = 1 the highest.
   */
  levelAt(p: number, pacing: Pacing): number {
    const q = Math.min(1, Math.max(0, Number.isNaN(p) ? 0 : p));
    if (pacing === 'percentile') return this.sorted[Math.round(q * (this.n - 1))];
    if (q >= 1) return this.maxH;
    return this.minH + q * (this.maxH - this.minH);
  }

  /** Position of `level` on the scrubber (inverse of levelAt, exact for linear pacing). */
  progressAt(level: number, pacing: Pacing): number {
    if (pacing === 'percentile') {
      const c = this.countAtOrBelow(level);
      return c <= 1 ? 0 : (c - 1) / (this.n - 1);
    }
    if (this.maxH <= this.minH) return 1;
    return Math.min(1, Math.max(0, (level - this.minH) / (this.maxH - this.minH)));
  }

  /** Number of cells with h ≤ level (= Flood.wetCount after advanceTo(level)). */
  countAtOrBelow(level: number): number {
    let lo = 0;
    let hi = this.n;
    const s = this.sorted;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (s[mid] <= level) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Percentile of the level among cell heights: 100 · (cells at or below) / cells. */
  percentile(wetCount: number): number {
    return (100 * wetCount) / this.n;
  }

  /** Percentage of the study area's ground area under water (cells weighted by area). */
  areaPercent(wetCount: number): number {
    const k = Math.min(this.n, Math.max(0, wetCount));
    return (100 * this.cumArea[k]) / this.cumArea[this.n];
  }
}

/** True while the lake is its own lake at `level` (born, not yet merged). */
export function isAlive(bar: Bar, level: number): boolean {
  return level >= bar.birth && level < bar.death;
}
