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
