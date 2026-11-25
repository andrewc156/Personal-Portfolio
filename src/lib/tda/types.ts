/** Neighborhood used to decide which cells touch. 4 (N, S, E, W) is the default everywhere. */
export type Connectivity = 4 | 8;

export interface H0Options {
  /** 4 (default) or 8. */
  connectivity?: Connectivity;
}

/**
 * One bar of the H0 barcode of the sublevel-set filtration (spec §6.1).
 *
 * - `birth` / `birthCell`: height and index of the lake's lowest cell (its pit). The birth cell is
 *   also the lake's id: it is the union-find root of the lake while the lake is alive.
 * - `death` / `deathCell`: height and index of the cell where the lake spilled into an older lake
 *   (its pass). For an essential bar, `death` is `Infinity` and `deathCell` is `-1`.
 * - `mergedInto`: birth cell (id) of the older lake that absorbed this one; `-1` for essential bars.
 */
export interface Bar {
  birth: number;
  death: number;
  birthCell: number;
  deathCell: number;
  mergedInto: number;
}

export interface H0Stats {
  cells: number;
  connectivity: Connectivity;
  /** Components born (cells with no ≺-earlier neighbor). */
  births: number;
  /** Finite bars, including zero-length ones. */
  finite: number;
  /** Finite bars with death == birth (plateaus). Counted here, dropped from `bars`. */
  zeroLength: number;
  /** Bars with death = +∞ (one per connected domain; 1 for a full grid). */
  essential: number;
}

export interface H0Result {
  /**
   * Bars for display: every finite bar with death > birth, in sweep order (by the ≺-rank of the
   * death cell, then by the ≺-rank of the dying lake's birth cell), followed by the essential
   * bars in ≺ order of their birth cells.
   */
  bars: Bar[];
  /** Zero-length finite bars (death == birth), in the same sweep order. Debug only. */
  zeroLength: Bar[];
  /** Cell indices sorted by ≺, i.e. by (height, index). */
  order: Uint32Array;
  /** Inverse of `order`: rank[i] is the position of cell i in `order`. */
  rank: Uint32Array;
  stats: H0Stats;
}

/**
 * An event reported by `Flood.advanceTo`.
 *
 * - `birth`: a new lake appears at `cell` (`lake === cell`, `into === -1`).
 * - `merge`: lake `lake` (its birth cell) dies at pass `cell` and joins the older lake `into`.
 *   Zero-length lifetimes (birth and merge at the same height) are reported too.
 */
export interface MergeEvent {
  type: 'birth' | 'merge';
  level: number;
  cell: number;
  lake: number;
  into: number;
}

export interface IslandsOptions {
  /**
   * Connectivity of the WATER: 4 (default, as in §6.1) or 8. Land uses the complementary
   * neighbourhood (8 when water is 4, 4 when water is 8), which is what makes islands dual to
   * the holes of the flooded region.
   */
  connectivity?: Connectivity;
  /** A precomputed ≺ order (e.g. `computeH0(...).order`) to skip re-sorting. Not validated. */
  order?: Uint32Array;
}

/**
 * One bar of the islands (H1) barcode (spec stretch S2). An island is alive at water level t
 * iff birth ≤ t < death, the same half-open convention as the H0 lakes.
 *
 * - `birth` / `saddleCell`: the level and cell at which the water cut this land off, either from
 *   the mainland (land touching the grid border) or from a taller island it was part of.
 * - `death` / `peakCell`: the height and cell of the island's hilltop. The peak is its id.
 * - `mergedInto`: peak cell of the taller island it was split from, or −1 if it was cut off
 *   from the mainland directly.
 */
export interface IslandBar {
  birth: number;
  death: number;
  peakCell: number;
  saddleCell: number;
  mergedInto: number;
}

export interface IslandsStats {
  cells: number;
  /** Water connectivity (4 by default). */
  connectivity: Connectivity;
  /** Land connectivity: the complement of `connectivity`. */
  landConnectivity: Connectivity;
  /** Hill components started in the reverse sweep: non-border cells with no ≻-later land neighbour. */
  births: number;
  /** All island bars, including zero-length ones. Equals `births` (no island is essential). */
  finite: number;
  /** Bars with death == birth (plateaus). Counted here, dropped from `bars`. */
  zeroLength: number;
}

export interface IslandsResult {
  /**
   * Bars with death > birth in reverse-sweep order: by descending ≺-rank of the saddle cell,
   * and, for several islands cut off at one cell, eldest (≺-greatest peak) first.
   */
  bars: IslandBar[];
  /** Zero-length bars (death == birth), same order. Debug only. */
  zeroLength: IslandBar[];
  /** Cell indices sorted by ≺ (ascending; the sweep walks it backwards). */
  order: Uint32Array;
  /** Inverse of `order`. */
  rank: Uint32Array;
  /** Merge tree: joined[i] = component (peak cell, or W·H for the mainland) cell i joined. */
  joined: Int32Array;
  /** Merge tree: for a peak p, the cell where its component died; −1 for non-peaks. */
  saddleOf: Int32Array;
  /** Merge tree: for a peak p, the peak it merged into (−1 = mainland or non-peak). */
  intoOf: Int32Array;
  stats: IslandsStats;
}

/**
 * An event reported by `Islands.advanceTo` as the water rises.
 *
 * - `birth`: island `peak` appears when the water reaches `cell` (its saddle).
 * - `death`: island `peak` goes under (`cell === peak`).
 */
export interface IslandEvent {
  type: 'birth' | 'death';
  level: number;
  peak: number;
  cell: number;
}
