import { allFiniteBars, isEssential, persistence } from '../../tda/index.ts';
import type { Bar, H0Result } from '../../tda/index.ts';

/**
 * The hero's data model: which lake gets which identity colour and label, which bars the
 * barcode draws, and how far each bar has grown at a water level. Pure functions; the
 * renderer (controller.ts, barcode.ts) only draws what these return.
 */

export type BarInterval = Pick<Bar, 'birth' | 'death'>;

export type Pacing = 'linear' | 'percentile';

export interface LakeTable {
  /** Number of identity colours. */
  K: number;
  /** slotOf[cell] = identity colour index for the lake born at `cell`, or −1 if no lake is born there. */
  slotOf: Int16Array;
  /** labelOf[cell] = 1-based lake number ("Lake 3") for the lake born at `cell`, or 0. */
  labelOf: Int32Array;
  /** Every lake (display, zero-length and essential bars), most persistent first. */
  ranked: Bar[];
}

/**
 * Lakes ordered by importance: essential bars first, then by persistence (longest first), ties
 * broken by the ≺-rank of the birth cell. Zero-length lakes come last, since their persistence is 0.
 */
export function rankLakes(result: H0Result): Bar[] {
  const all = allFiniteBars(result).concat(result.bars.filter(isEssential));
  const rank = result.rank;
  return all.sort((a, b) => {
    const ea = isEssential(a) ? 1 : 0;
    const eb = isEssential(b) ? 1 : 0;
    if (ea !== eb) return eb - ea;
    const d = persistence(b) - persistence(a);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return rank[a.birthCell] - rank[b.birthCell];
  });
}

/**
 * Identity colours and labels. The lake id is its birth cell, which is also the engine's
 * union-find root (`Flood.componentOf`), so a merged region automatically takes the colour of
 * the older lake that absorbed it (the elder rule): its root is the older lake's birth cell.
 * The k-th most persistent lake gets colour k mod K, so the K most persistent lakes always
 * have distinct colours.
 */
export function buildLakeTable(result: H0Result, K: number): LakeTable {
  const n = result.order.length;
  const slotOf = new Int16Array(n).fill(-1);
  const labelOf = new Int32Array(n);
  const ranked = rankLakes(result);
  for (let k = 0; k < ranked.length; k++) {
    const c = ranked[k].birthCell;
    slotOf[c] = k % K;
    labelOf[c] = k + 1;
  }
  return { K, slotOf, labelOf, ranked };
}

/**
 * The bars the barcode draws, as references to the engine's own `result.bars` objects:
 * - only bars with persistence ≥ `minPersistence` (the essential bar always qualifies);
 * - at most `maxBars` of them, keeping the most persistent (essential first);
 * - in row order: by birth (≺-rank of the birth cell), so the essential bar is the top row.
 */
export function selectBars(result: H0Result, minPersistence: number, maxBars: number): Bar[] {
  const rank = result.rank;
  const keep = result.bars.filter((b) => isEssential(b) || persistence(b) >= minPersistence);
  keep.sort((a, b) => {
    const ea = isEssential(a) ? 1 : 0;
    const eb = isEssential(b) ? 1 : 0;
    if (ea !== eb) return eb - ea;
    const d = persistence(b) - persistence(a);
    if (d !== 0) return d;
    return rank[a.birthCell] - rank[b.birthCell];
  });
  const rows = keep.slice(0, Math.max(0, Math.floor(maxBars)));
  return rows.sort((a, b) => rank[a.birthCell] - rank[b.birthCell]);
}

/**
 * How much of `bar` exists at water level `level`: from its birth to min(death, level).
 * Returns false before the lake is born. `out` is reused to avoid allocation per frame.
 */
export function barExtent(bar: BarInterval, level: number, out: [number, number]): boolean {
  if (level < bar.birth) return false;
  out[0] = bar.birth;
  out[1] = Math.min(bar.death, level);
  return true;
}

/** True while the lake is still its own lake at `level` (born, not yet merged). */
export function isAlive(bar: BarInterval, level: number): boolean {
  return level >= bar.birth && level < bar.death;
}

/**
 * Water level for animation progress p ∈ [0, 1].
 * - linear: metres rise at a constant rate from the lowest to the highest cell;
 * - percentile: the flooded area grows at a constant rate (p·100 % of cells).
 * Either way p = 0 is the lowest cell and p = 1 the highest. Pacing changes only the speed,
 * never which lakes merge with which (spec §6.6 item 8).
 */
export function levelAt(
  p: number,
  pacing: Pacing,
  minH: number,
  maxH: number,
  levelAtPercentile: (pct: number) => number,
): number {
  const q = Math.min(1, Math.max(0, p));
  if (q >= 1) return maxH;
  if (pacing === 'percentile') return levelAtPercentile(q * 100);
  return minH + q * (maxH - minH);
}

/** A lake counts as visible once the water in it is at least this deep. */
export const START_MIN_DEPTH_M = 15;
/** Preferred flooded share of the map at the start, and the most allowed. */
export const START_TARGET_WET = 0.15;
export const START_MAX_WET = 0.4;

/**
 * Pick a first frame with the most drawn, live lakes at least 15 m deep, keeping at least 60%
 * land. Ties favor the wet share closest to 15%, then the earlier progress. If no level has
 * several deep lakes, keep the best legal frame; if even the lowest level is too wet, start there.
 * Reuse the engine's height order for binary searches, without copying or scanning the grid.
 */
export function pickStartProgress(
  rows: readonly BarInterval[],
  heights: ArrayLike<number>,
  order: ArrayLike<number>,
  pacing: Pacing,
): number {
  const n = order.length;
  if (n < 2) return 0;
  const heightAt = (rank: number) => heights[order[rank]];
  const minH = heightAt(0);
  const maxH = heightAt(n - 1);
  const cap = Math.floor(n * START_MAX_WET);
  const firstTooWet = heightAt(cap);
  if (minH >= firstTooWet) return 0; // Even the minimum height floods a tied plateau.
  const target = n * START_TARGET_WET;
  let best = 0;
  let bestVis = -1;
  let bestGap = Infinity;

  // Between bar events the visible-lake count is constant and wet share only grows. For each
  // interval it suffices to consider its entry, its last wet-share step, and the two wet-share
  // steps straddling the target. Include the cap as an exclusive right edge. There are only
  // O(rows.length) candidates even when two merges are closer than any fixed progress step.
  consider(minH);
  considerBoundary(heightAt(Math.ceil(target) - 1));
  considerBelow(firstTooWet);
  for (const { birth, death } of rows) {
    const deepEnough = birth + START_MIN_DEPTH_M;
    if (deepEnough >= death) continue;
    considerBoundary(deepEnough);
    considerBoundary(death);
  }
  return best;

  function considerBoundary(L: number): void {
    if (L <= minH || L >= firstTooWet) return;
    consider(L);
    considerBelow(L);
  }

  function considerBelow(L: number): void {
    const rank = countHeights(L, false) - 1;
    if (rank >= 0) consider(heightAt(rank));
  }

  function consider(L: number): void {
    let p: number;
    let actual: number;
    if (pacing === 'percentile') {
      // Percentile pacing can only reach cell heights. Use the first cell at/above the
      // candidate (the same rank convention as Flood.levelAtPercentile).
      const rank = countHeights(L, false);
      p = rank / (n - 1);
      actual = heightAt(rank);
    } else {
      p = progressAt(L, minH, maxH);
      actual = minH + p * (maxH - minH);
      // Ensure round-tripping an inclusive threshold doesn't land just below it.
      if (actual < L) {
        p += Number.EPSILON * p;
        actual = minH + p * (maxH - minH);
      }
    }
    if (actual >= firstTooWet) return;
    let vis = 0;
    for (const b of rows) if (b.birth + START_MIN_DEPTH_M <= actual && actual < b.death) vis++;
    const gap = Math.abs(countHeights(actual, true) - target);
    if (vis > bestVis || (vis === bestVis && (gap < bestGap || (gap === bestGap && p < best)))) {
      best = p;
      bestVis = vis;
      bestGap = gap;
    }
  }

  function countHeights(L: number, includeEqual: boolean): number {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const h = heightAt(mid);
      if (h < L || (includeEqual && h === L)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/** Inverse of levelAt for linear pacing (used to keep the scrubber in place when pacing changes). */
export function progressAt(level: number, minH: number, maxH: number): number {
  if (maxH <= minH) return 1;
  return Math.min(1, Math.max(0, (level - minH) / (maxH - minH)));
}

/**
 * Basin of a lake just before it died: the connected set containing `birthCell` among cells
 * that are ≺-earlier than `deathCell` (`deathRank` = rank of the death cell, or n for the
 * essential bar). 4-connectivity. Fills `mask` (1 = in lake) using `queue` as scratch;
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
