import { describe, expect, it } from 'vitest';
import {
  computeH1Islands,
  Flood,
  islandPersistence,
  Islands,
  type IslandBar,
} from '../../../src/lib/tda/index.ts';
import { loadFixture, neighbors, precedes, randInt, rng } from './helpers.ts';

/**
 * Islands (H1) barcode, spec stretch S2. An island at water level t is an 8-connected (when the
 * water is 4-connected) component of the land {h > t} that contains no border cell.
 */

const isBorder = (i: number, W: number, H: number) => {
  const x = i % W;
  const y = (i - x) / W;
  return x === 0 || y === 0 || x === W - 1 || y === H - 1;
};

/**
 * Brute force: BFS components of the cells accepted by `isLand`, with land connectivity. Each
 * cell gets the ≺-MAXIMUM cell of its component, or −1 if it is not land or the component
 * contains a border cell (mainland).
 */
function islandLabels(
  h: Float32Array,
  W: number,
  H: number,
  landConn: 4 | 8,
  isLand: (i: number) => boolean,
): Int32Array {
  const n = W * H;
  const label = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s] || !isLand(s)) continue;
    const comp = [s];
    seen[s] = 1;
    let max = s;
    let border = false;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q];
      if (precedes(h, max, c)) max = c;
      if (isBorder(c, W, H)) border = true;
      for (const j of neighbors(c, W, H, landConn)) {
        if (!seen[j] && isLand(j)) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    if (!border) for (const c of comp) label[c] = max;
  }
  return label;
}

/** The set of island peaks in a label array. */
const peaksOf = (label: Int32Array) => new Set([...label].filter((v) => v >= 0));

/**
 * Brute-force elder-rule tracking at cell resolution: land after step k is every cell whose
 * ≺-rank is ≥ k (the reverse sweep), relabelled by BFS from scratch at each step. An island
 * with peak p is "alive" while p is the ≺-max of a component with no border cell. The step
 * where p stops being alive gives its saddle (the cell just added) and what it merged into.
 */
function bruteForceBars(h: Float32Array, W: number, H: number, landConn: 4 | 8) {
  const n = W * H;
  const ord = [...Array(n).keys()].sort((a, b) => (precedes(h, a, b) ? -1 : 1));
  const rank = new Int32Array(n);
  ord.forEach((c, k) => (rank[c] = k));
  const bars: [number, number, number][] = [];
  let births = 0;
  let prev = new Set<number>();
  for (let k = n - 1; k >= 0; k--) {
    const cell = ord[k];
    const label = islandLabels(h, W, H, landConn, (i) => rank[i] >= k);
    const now = peaksOf(label);
    if (now.has(cell)) births++;
    for (const p of prev) {
      if (!now.has(p)) bars.push([p, cell, label[p]]);
    }
    prev = now;
  }
  return { bars, births, rank };
}

function randomSmallGrid(r: () => number) {
  const W = randInt(r, 1, 11);
  const H = randInt(r, 1, 11);
  const heights = new Float32Array(W * H);
  const mode = randInt(r, 0, 3);
  const levels = randInt(r, 1, 6);
  for (let i = 0; i < heights.length; i++) {
    if (mode === 0)
      heights[i] = randInt(r, 0, levels); // ties
    else if (mode === 1)
      heights[i] = r() < 0.4 ? 0 : randInt(r, -levels, levels); // plateaus
    else if (mode === 2)
      heights[i] = r() * 100; // tie-free
    else heights[i] = Math.round(4 * Math.sin(i * 0.7 + r()) + 3 * r()); // bumpy, ties
  }
  return { W, H, heights };
}

const allBars = (res: ReturnType<typeof computeH1Islands>): IslandBar[] => [
  ...res.bars,
  ...res.zeroLength,
];

interface GoldenCase {
  name: string;
  W: number;
  H: number;
  connectivity: 4 | 8;
  heights: number[];
  bars: [number, number, number, number, number][];
  births: number;
  zeroLength: number;
}

describe('islands golden cases (S2 criterion 4)', () => {
  const { cases } = loadFixture<{ cases: GoldenCase[] }>('islands_golden.json');
  it('covers the required cases', () => {
    const names = cases.map((c) => c.name).join('\n');
    for (const word of ['cone', 'ring ridge', 'two hills', 'touching the border', 'diagonal']) {
      expect(names).toContain(word);
    }
  });
  for (const c of cases) {
    it(c.name, () => {
      const r = computeH1Islands(new Float32Array(c.heights), c.W, c.H, {
        connectivity: c.connectivity,
      });
      expect(r.bars.map((b) => [b.birth, b.death, b.peakCell, b.saddleCell, b.mergedInto])).toEqual(
        c.bars,
      );
      expect(r.stats.births).toBe(c.births);
      expect(r.stats.zeroLength).toBe(c.zeroLength);
      expect(r.stats.finite).toBe(c.births);
    });
  }

  it('ring ridge: one island alive exactly for 2 ≤ t < 5', () => {
    const c = cases.find((k) => k.name.startsWith('ring ridge'))!;
    const isl = new Islands(new Float32Array(c.heights), c.W, c.H);
    const at = (t: number) => (isl.advanceTo(t), isl.alive());
    expect([at(1), at(1.99), at(2), at(4.99), at(5), at(9)]).toEqual([0, 0, 1, 1, 0, 0]);
    expect(islandPersistence(isl.result.bars[0])).toBe(3);
  });

  it('two hills: 1 island on [0, 4), 2 on [4, 7), 1 on [7, 9), 0 from 9', () => {
    const c = cases.find((k) => k.name.startsWith('two hills'))!;
    const isl = new Islands(new Float32Array(c.heights), c.W, c.H);
    const at = (t: number) => {
      isl.advanceTo(t);
      return [isl.alive(), isl.islandOf(20), isl.islandOf(24), isl.islandOf(22)];
    };
    expect(at(-1)).toEqual([0, -1, -1, -1]);
    expect(at(0)).toEqual([1, 20, 20, 20]);
    expect(at(3.5)).toEqual([1, 20, 20, 20]);
    expect(at(4)).toEqual([2, 20, 24, -1]);
    expect(at(7)).toEqual([1, 20, -1, -1]);
    expect(at(9)).toEqual([0, -1, -1, -1]);
  });

  it('a 1×1 grid, thin strips and a constant grid have no islands', () => {
    expect(computeH1Islands(new Float32Array([3]), 1, 1).stats.finite).toBe(0);
    expect(computeH1Islands(new Float32Array([1, 9, 2, 8]), 4, 1).stats.finite).toBe(0);
    expect(computeH1Islands(new Float32Array([1, 9, 2, 8]), 1, 4).stats.finite).toBe(0);
    expect(computeH1Islands(new Float32Array(400).fill(2), 20, 20).stats.finite).toBe(0);
  });

  it('validates input like computeH0', () => {
    expect(() => computeH1Islands(new Float32Array([0, NaN]), 2, 1)).toThrow(RangeError);
    expect(() => computeH1Islands(new Float32Array(3), 2, 2)).toThrow(RangeError);
    expect(() =>
      computeH1Islands(new Float32Array(4), 2, 2, { connectivity: 6 as unknown as 4 }),
    ).toThrow(RangeError);
  });
});

describe('islands brute-force oracle (S2 criterion 3)', () => {
  const r = rng(20261124);
  const grids = Array.from({ length: 80 }, () => randomSmallGrid(r));

  it('uses ≥ 50 grids with ties and plateaus', () => {
    const withTies = grids.filter((g) => new Set(g.heights).size < g.heights.length);
    expect(grids.length).toBeGreaterThanOrEqual(50);
    expect(withTies.length).toBeGreaterThanOrEqual(40);
  });

  for (const conn of [4, 8] as const) {
    const landConn = conn === 4 ? 8 : 4;
    it(`water ${conn}: live bars = non-border land components at every distinct level`, () => {
      let checked = 0;
      for (const { W, H, heights } of grids) {
        const res = computeH1Islands(heights, W, H, { connectivity: conn });
        const bars = allBars(res);
        const levels = [-Infinity, ...new Set(heights)].sort((a, b) => a - b);
        for (const t of levels) {
          const expected = peaksOf(islandLabels(heights, W, H, landConn, (i) => heights[i] > t));
          const live = bars.filter((b) => b.birth <= t && t < b.death).map((b) => b.peakCell);
          expect(live.length).toBe(expected.size);
          expect(new Set(live)).toEqual(expected);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(400);
    });

    it(`water ${conn}: births, deaths and pairings match BFS elder-rule tracking`, () => {
      let total = 0;
      for (const { W, H, heights } of grids) {
        const res = computeH1Islands(heights, W, H, { connectivity: conn });
        const bf = bruteForceBars(heights, W, H, landConn);
        // Same multiset of (peak, saddle, mergedInto), zero-length bars included.
        const got = allBars(res).map((b) => [b.peakCell, b.saddleCell, b.mergedInto]);
        const key = (a: number[]) => a.join(',');
        expect(got.map(key).sort()).toEqual(bf.bars.map(key).sort());
        expect(res.stats.births).toBe(bf.births);
        for (const b of allBars(res)) {
          expect(b.birth).toBe(heights[b.saddleCell]);
          expect(b.death).toBe(heights[b.peakCell]);
          expect(b.death >= b.birth).toBe(true);
          expect(isBorder(b.peakCell, W, H)).toBe(false);
        }
        total += got.length;
      }
      expect(total).toBeGreaterThan(100);
    });
  }

  it('births = non-border cells with no ≻-later land neighbour', () => {
    for (const { W, H, heights } of grids) {
      for (const conn of [4, 8] as const) {
        const res = computeH1Islands(heights, W, H, { connectivity: conn });
        let peaks = 0;
        for (let i = 0; i < W * H; i++) {
          if (isBorder(i, W, H)) continue;
          const landConn = conn === 4 ? 8 : 4;
          if (neighbors(i, W, H, landConn).every((j) => precedes(heights, j, i))) peaks++;
        }
        expect(res.stats.births).toBe(peaks);
      }
    }
  });

  it('pairs are invariant under strictly increasing transforms', () => {
    for (const { W, H, heights } of grids.slice(0, 40)) {
      const mapped = heights.map((v) => Math.fround(v * v * v + 5 * v - 7));
      const a = computeH1Islands(heights, W, H);
      const b = computeH1Islands(mapped, W, H);
      const pairs = (x: typeof a) =>
        allBars(x).map((k) => [k.peakCell, k.saddleCell, k.mergedInto]);
      expect(pairs(b)).toEqual(pairs(a));
    }
  });

  it('duality with H0: islands = lakes − χ(water complex), water 4-connected', () => {
    // Water complex: wet cells, 4-adjacent wet pairs, fully wet 2×2 blocks. β1 = β0 − χ.
    for (const { W, H, heights } of grids) {
      const res = computeH1Islands(heights, W, H);
      const flood = new Flood(heights, W, H);
      const isl = new Islands(heights, W, H);
      for (const t of [...new Set(heights)]) {
        flood.advanceTo(t);
        isl.advanceTo(t);
        const wet = (x: number, y: number) => heights[y * W + x] <= t;
        let chi = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!wet(x, y)) continue;
            chi++;
            if (x + 1 < W && wet(x + 1, y)) chi--;
            if (y + 1 < H && wet(x, y + 1)) chi--;
            if (x + 1 < W && y + 1 < H && wet(x + 1, y) && wet(x, y + 1) && wet(x + 1, y + 1)) {
              chi++;
            }
          }
        }
        expect(isl.alive()).toBe(flood.alive() - chi);
        expect(res.bars.filter((b) => b.birth <= t && t < b.death).length).toBe(isl.alive());
      }
    }
  });
});

describe('Islands incremental view', () => {
  const r = rng(7);
  it('islandOf and alive match BFS at random levels; events replay the barcode', () => {
    for (let g = 0; g < 60; g++) {
      const { W, H, heights } = randomSmallGrid(r);
      for (const conn of [4, 8] as const) {
        const isl = new Islands(heights, W, H, { connectivity: conn });
        const landConn = conn === 4 ? 8 : 4;
        const lo = Math.min(...heights) - 1;
        const hi = Math.max(...heights) + 1;
        const levels = [
          ...new Set(heights),
          ...Array.from({ length: 6 }, () => lo + r() * (hi - lo)),
        ];
        levels.sort((a, b) => a - b);
        let births = 0;
        let deaths = 0;
        for (const t of levels) {
          for (const e of isl.advanceTo(t)) {
            if (e.type === 'birth') births++;
            else deaths++;
          }
          const label = islandLabels(heights, W, H, landConn, (i) => heights[i] > t);
          for (let i = 0; i < W * H; i++) expect(isl.islandOf(i)).toBe(label[i]);
          expect(isl.alive()).toBe(peaksOf(label).size);
          expect(births - deaths).toBe(isl.alive());
        }
        isl.advanceTo(Infinity);
        expect(isl.alive()).toBe(0);
        // Lowering replays from the bottom.
        const t = levels[Math.floor(levels.length / 2)];
        isl.advanceTo(t);
        const label = islandLabels(heights, W, H, landConn, (i) => heights[i] > t);
        for (let i = 0; i < W * H; i++) expect(isl.islandOf(i)).toBe(label[i]);
      }
    }
  });

  it('reuses a precomputed order', () => {
    const { W, H, heights } = randomSmallGrid(rng(3));
    const flood = new Flood(heights, W, H);
    const a = computeH1Islands(heights, W, H);
    const b = computeH1Islands(heights, W, H, { order: flood.order });
    expect(b.bars).toEqual(a.bars);
  });
});

interface AgreementCase {
  id: number;
  kind: string;
  W: number;
  H: number;
  connectivity: 4 | 8;
  heights: number[];
  births: number;
  bars: [number, number, number][];
  zeroLength: number;
}

describe('islands TypeScript ↔ Python agreement (S2 criterion 2)', () => {
  const { cases } = loadFixture<{ cases: AgreementCase[] }>('islands.json');
  it('has ≥ 200 cases with plenty of islands', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(cases.filter((c) => c.bars.length > c.zeroLength).length).toBeGreaterThan(150);
  });
  for (const c of cases) {
    it(`case ${c.id} (${c.kind}, ${c.W}×${c.H}, water ${c.connectivity})`, () => {
      const h = new Float32Array(c.heights);
      const res = computeH1Islands(h, c.W, c.H, { connectivity: c.connectivity });
      // Python lists every bar in reverse-sweep order; merge display and zero-length bars back.
      const rank = res.rank;
      const sweepKey = (b: IslandBar) => -rank[b.saddleCell] * h.length - rank[b.peakCell];
      const merged = allBars(res).sort((a, b) => sweepKey(a) - sweepKey(b));
      expect(merged.map((b) => [b.peakCell, b.saddleCell, b.mergedInto])).toEqual(c.bars);
      expect(res.stats.births).toBe(c.births);
      expect(res.stats.zeroLength).toBe(c.zeroLength);
    });
  }
});
