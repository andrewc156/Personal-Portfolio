import { describe, expect, it } from 'vitest';
import { allFiniteBars, computeH0 } from '../../../src/lib/tda/index.ts';
import type { Bar, H0Result } from '../../../src/lib/tda/index.ts';
import { bfsLabels, neighbors, precedes, randomGrid, rng } from './helpers.ts';
import type { Grid } from './helpers.ts';

/** F3 criterion 4: property tests on random grids from 1×1 to 40×40, with and without ties. */

const GRIDS = 600;

function makeGrids(seed: number): Grid[] {
  const r = rng(seed);
  const grids: Grid[] = [];
  for (let t = 0; t < GRIDS; t++) grids.push(randomGrid(r, t % 10 === 0 ? 3 : 40, t % 2 === 0));
  // Include the extremes explicitly.
  grids.push({ W: 1, H: 1, heights: new Float32Array([3]), ties: false });
  grids.push(randomGrid(() => 0.999999, 40, true)); // 40×40 constant grid
  return grids;
}

function pairs(r: H0Result): string[] {
  return [...allFiniteBars(r), ...r.bars.filter((b) => b.death === Infinity)].map(
    (b) => `${b.birthCell}:${b.deathCell}:${b.mergedInto}`,
  );
}

/**
 * Checks every finite bar against an independent BFS of the sublevel set just before its death
 * cell was added: the death cell must touch ≥ 2 distinct components, the absorbing lake must be
 * the oldest of them, and every dying lake is younger.
 */
function checkDeaths(g: Grid, conn: 4 | 8, finite: Bar[]): void {
  const h = g.heights;
  const byDeath = new Map<number, Bar[]>();
  for (const b of finite) {
    const list = byDeath.get(b.deathCell) ?? [];
    list.push(b);
    byDeath.set(b.deathCell, list);
  }
  for (const [d, dying] of byDeath) {
    const labels = bfsLabels(h, g.W, g.H, conn, (i) => precedes(h, i, d));
    const comps = new Set<number>();
    for (const j of neighbors(d, g.W, g.H, conn)) if (labels[j] >= 0) comps.add(labels[j]);
    // every death cell had ≥ 2 distinct neighbor roots
    expect(comps.size).toBeGreaterThanOrEqual(2);
    expect(dying.length).toBe(comps.size - 1);
    const oldest = [...comps].reduce((a, b) => (precedes(h, a, b) ? a : b));
    for (const b of dying) {
      // every death kills the younger root: the survivor is the ≺-oldest, the dying lake younger
      expect(b.mergedInto).toBe(oldest);
      expect(precedes(h, b.mergedInto, b.birthCell)).toBe(true);
      expect(comps.has(b.birthCell)).toBe(true);
      expect(b.birth).toBe(h[b.birthCell]);
      expect(b.death).toBe(h[d]);
    }
    const dyingCells = new Set(dying.map((b) => b.birthCell));
    expect(dyingCells.size).toBe(dying.length);
    for (const c of comps) if (c !== oldest) expect(dyingCells.has(c)).toBe(true);
  }
}

/** A random strictly increasing map applied to the distinct values of the grid. */
function increasingTransform(h: Float32Array, r: () => number): Float32Array {
  const values = [...new Set(h)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  let v = -5000 + Math.floor(r() * 100);
  for (const x of values) {
    v += 1 + Math.floor(r() * 50); // integers: exact in float32, strictly increasing
    map.set(x, v);
  }
  return Float32Array.from(h, (x) => map.get(x)!);
}

for (const conn of [4, 8] as const) {
  describe(`properties, ${conn}-connectivity, ${GRIDS + 2} random grids`, () => {
    const grids = makeGrids(conn === 4 ? 1234 : 5678);
    const r = rng(conn * 1000 + 1);

    it('births = number of cells with no ≺-earlier neighbor; finite + essential = births', () => {
      let withTies = 0;
      let zeroLength = 0;
      for (const g of grids) {
        const res = computeH0(g.heights, g.W, g.H, { connectivity: conn });
        const h = g.heights;
        const minima: number[] = [];
        for (let i = 0; i < h.length; i++) {
          if (neighbors(i, g.W, g.H, conn).every((j) => !precedes(h, j, i))) minima.push(i);
        }
        expect(res.stats.births).toBe(minima.length);
        const finite = allFiniteBars(res);
        const essential = res.bars.filter((b) => b.death === Infinity);
        expect(finite.length + essential.length).toBe(minima.length);
        expect(res.stats.finite).toBe(finite.length);
        expect(res.stats.essential).toBe(essential.length);
        expect(essential.length).toBe(1); // a full grid is connected
        // Every pit is the birth cell of exactly one bar.
        const birthCells = [...finite, ...essential].map((b) => b.birthCell).sort((a, b) => a - b);
        expect(birthCells).toEqual(minima);
        // Display bars never include zero-length bars; zeroLength holds exactly those.
        for (const b of res.bars) expect(b.death > b.birth).toBe(true);
        for (const b of res.zeroLength) expect(b.death).toBe(b.birth);
        zeroLength += res.zeroLength.length;
        if (g.ties) withTies++;
      }
      expect(withTies).toBeGreaterThanOrEqual(250);
      expect(zeroLength).toBeGreaterThan(0); // ties really exercise plateaus
    });

    it('every death kills the younger root, at a cell with ≥ 2 distinct neighbor roots', () => {
      for (const g of grids) {
        const res = computeH0(g.heights, g.W, g.H, { connectivity: conn });
        checkDeaths(g, conn, allFiniteBars(res));
      }
    });

    it('essential bar is born at the ≺-minimum cell', () => {
      for (const g of grids) {
        const res = computeH0(g.heights, g.W, g.H, { connectivity: conn });
        expect(res.bars[res.bars.length - 1].birthCell).toBe(res.order[0]);
      }
    });

    it('(birthCell, deathCell) pairs are invariant under strictly increasing transforms', () => {
      for (const g of grids) {
        const a = computeH0(g.heights, g.W, g.H, { connectivity: conn });
        const b = computeH0(increasingTransform(g.heights, r), g.W, g.H, { connectivity: conn });
        expect(pairs(b)).toEqual(pairs(a));
        // An exact affine map too (integers stay exact in float32).
        if (g.ties) {
          const c = computeH0(
            Float32Array.from(g.heights, (x) => 3 * x + 11),
            g.W,
            g.H,
            { connectivity: conn },
          );
          expect(pairs(c)).toEqual(pairs(a));
        }
      }
    });
  });
}
