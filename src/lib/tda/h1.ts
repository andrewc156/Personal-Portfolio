import { rankOf, sortCells, validateGrid } from './order.ts';
import type {
  Connectivity,
  IslandBar,
  IslandEvent,
  IslandsOptions,
  IslandsResult,
} from './types.ts';

/**
 * Islands barcode (spec stretch S2): 1-dimensional persistent homology of the flooded region,
 * computed through Alexander duality as 0-dimensional persistence of the *land* (superlevel set)
 * relative to the grid border. See docs/tda.md, "Islands (H1)".
 *
 * - Water at level t is {h ≤ t}, connected with `connectivity` (4 by default, as in §6.1).
 * - Land at level t is {h > t}, connected with the complementary neighbourhood (8 when water is
 *   4, 4 when water is 8), so diagonal land contacts keep land joined in the default mode.
 * - An island at level t is a land component that contains no border cell.
 * - Sweep: cells are added in the exact reverse of ≺, i.e. by descending (height, index). A
 *   virtual "mainland" node sits at +∞ and is joined to every border cell, so it is always the
 *   eldest component. A cell with no already-added land neighbour (and not on the border) starts
 *   a hill component at its peak. A cell touching several components joins the eldest (mainland
 *   first, otherwise the ≺-greatest peak); every other component dies there (the elder rule).
 * - A component with peak p dying at cell s is the island bar [h[s], h[p]): born when the water
 *   reaches s (closing the ring, or splitting it from a taller island), dead when the water
 *   reaches the hilltop p. Same half-open convention as H0: alive for birth ≤ t < death.
 */
export function computeH1Islands(
  heights: Float32Array,
  W: number,
  H: number,
  opts: IslandsOptions = {},
): IslandsResult {
  validateGrid(heights, W, H);
  const connectivity = opts.connectivity ?? 4;
  if (connectivity !== 4 && connectivity !== 8) {
    throw new RangeError(`connectivity must be 4 or 8, got ${String(connectivity)}`);
  }
  const landConnectivity: Connectivity = connectivity === 4 ? 8 : 4;
  const n = W * H;
  const order = opts.order ?? sortCells(heights);
  if (order.length !== n) throw new RangeError('order.length !== W·H');
  const rank = rankOf(order);

  const MAIN = n; // virtual mainland node, eldest of all
  const parent = new Int32Array(n + 1);
  parent[MAIN] = MAIN;
  /** joined[i] = component (peak cell, or MAIN) that cell i joined when it was added. */
  const joined = new Int32Array(n);
  /** For a peak p: the cell where its component died, and the component it joined. */
  const saddleOf = new Int32Array(n).fill(-1);
  const intoOf = new Int32Array(n).fill(-1);
  const roots = new Int32Array(9);
  const dx = landConnectivity === 4 ? [0, 0, -1, 1] : [0, 0, -1, 1, -1, 1, -1, 1];
  const dy = landConnectivity === 4 ? [-1, 1, 0, 0] : [-1, 1, 0, 0, -1, -1, 1, 1];
  // Age key: larger is elder. MAIN is older than every peak.
  const age = (r: number) => (r === MAIN ? n : rank[r]);

  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };

  let nr = 0;
  /** Inserts root r into roots[0..nr), kept eldest first, skipping duplicates. */
  const insert = (r: number) => {
    let p = nr;
    while (p > 0) {
      const q = roots[p - 1];
      if (q === r) return;
      if (age(q) > age(r)) break;
      p--;
    }
    for (let m = nr; m > p; m--) roots[m] = roots[m - 1];
    roots[p] = r;
    nr++;
  };

  const bars: IslandBar[] = [];
  const zeroLength: IslandBar[] = [];
  let births = 0;
  for (let k = n - 1; k >= 0; k--) {
    const i = order[k];
    const y = (i / W) | 0;
    const x = i - y * W;
    nr = 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) insert(MAIN);
    for (let d = 0; d < dx.length; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (rank[j] <= k) continue; // not yet added (still under water at this stage)
      insert(find(j));
    }
    if (nr === 0) {
      parent[i] = i;
      joined[i] = i;
      births++;
      continue;
    }
    const eldest = roots[0];
    parent[i] = eldest;
    joined[i] = eldest;
    for (let m = 1; m < nr; m++) {
      const r = roots[m];
      parent[r] = eldest;
      saddleOf[r] = i;
      intoOf[r] = eldest === MAIN ? -1 : eldest;
      const bar: IslandBar = {
        birth: heights[i],
        death: heights[r],
        peakCell: r,
        saddleCell: i,
        mergedInto: intoOf[r],
      };
      if (bar.death > bar.birth) bars.push(bar);
      else zeroLength.push(bar);
    }
  }
  return {
    bars,
    zeroLength,
    order,
    rank,
    joined,
    saddleOf,
    intoOf,
    stats: {
      cells: n,
      connectivity,
      landConnectivity,
      births,
      finite: bars.length + zeroLength.length,
      zeroLength: zeroLength.length,
    },
  };
}

/** death − birth of an island bar: how far its hilltop rises above the level that cut it off. */
export function islandPersistence(bar: IslandBar): number {
  return bar.death - bar.birth;
}

/**
 * Incremental view of the islands barcode for animation. The barcode is computed once (reverse
 * sweep); `advanceTo` then only moves two pointers, and `islandOf` resolves a cell's island at
 * the current level by walking the precomputed merge tree, memoised per level.
 */
export class Islands {
  readonly result: IslandsResult;
  readonly heights: Float32Array;
  readonly n: number;
  private readonly byBirth: IslandBar[];
  private readonly byDeath: IslandBar[];
  private nb = 0;
  private nd = 0;
  private currentLevel = -Infinity;
  private stamp = 1;
  private readonly memoStamp: Uint32Array;
  private readonly memo: Int32Array;

  constructor(heights: Float32Array, W: number, H: number, opts: IslandsOptions = {}) {
    this.heights = heights;
    this.result = computeH1Islands(heights, W, H, opts);
    this.n = W * H;
    const rank = this.result.rank;
    // Ties in level: by ≺-rank of the cell where the event happens, for determinism.
    this.byBirth = [...this.result.bars].sort(
      (a, b) => a.birth - b.birth || rank[a.saddleCell] - rank[b.saddleCell],
    );
    this.byDeath = [...this.result.bars].sort(
      (a, b) => a.death - b.death || rank[a.peakCell] - rank[b.peakCell],
    );
    this.memoStamp = new Uint32Array(this.n);
    this.memo = new Int32Array(this.n);
  }

  /** Back to level −∞: everything is land, joined to the mainland, so no islands. */
  reset(): void {
    this.nb = 0;
    this.nd = 0;
    this.currentLevel = -Infinity;
    this.stamp++;
  }

  get level(): number {
    return this.currentLevel;
  }

  /**
   * Moves the water to `level` and returns the island births and deaths crossed on the way up,
   * sorted by level (births before deaths at equal level). Lowering the level resets and replays.
   * Only bars with death > birth produce events.
   */
  advanceTo(level: number): IslandEvent[] {
    if (Number.isNaN(level)) throw new RangeError('level is NaN');
    if (level < this.currentLevel) this.reset();
    this.currentLevel = level;
    this.stamp++;
    if (this.stamp === 0xffffffff) {
      this.memoStamp.fill(0);
      this.stamp = 1;
    }
    const events: IslandEvent[] = [];
    const { byBirth, byDeath } = this;
    while (this.nb < byBirth.length && byBirth[this.nb].birth <= level) {
      const b = byBirth[this.nb++];
      events.push({ type: 'birth', level: b.birth, peak: b.peakCell, cell: b.saddleCell });
    }
    while (this.nd < byDeath.length && byDeath[this.nd].death <= level) {
      const b = byDeath[this.nd++];
      events.push({ type: 'death', level: b.death, peak: b.peakCell, cell: b.peakCell });
    }
    if (events.length > 1) {
      events.sort(
        (a, b) => a.level - b.level || (a.type === b.type ? 0 : a.type === 'birth' ? -1 : 1),
      );
    }
    return events;
  }

  /** Number of islands at the current level: bars with birth ≤ level < death. */
  alive(): number {
    return this.nb - this.nd;
  }

  /**
   * The island containing cell i at the current level, identified by its peak cell, or −1 if the
   * cell is under water or belongs to the mainland (land connected to the grid border).
   */
  islandOf(i: number): number {
    const h = this.heights;
    const level = this.currentLevel;
    if (h[i] <= level) return -1;
    const { joined, saddleOf, intoOf } = this.result;
    const n = this.n;
    let q = joined[i];
    if (q === n) return -1;
    // Walk up while q has already merged (its saddle is land at this level).
    let start = q;
    let res: number;
    for (;;) {
      if (this.memoStamp[q] === this.stamp) {
        res = this.memo[q];
        break;
      }
      const s = saddleOf[q];
      if (h[s] <= level) {
        res = q; // still separate from its elder: q is the island
        break;
      }
      const up = intoOf[q];
      if (up < 0) {
        res = -1; // merged into the mainland
        break;
      }
      q = up;
    }
    // Memoise the path.
    while (this.memoStamp[start] !== this.stamp) {
      this.memoStamp[start] = this.stamp;
      this.memo[start] = res;
      if (start === q) break;
      const up = intoOf[start];
      if (up < 0) break;
      start = up;
    }
    return res;
  }
}
