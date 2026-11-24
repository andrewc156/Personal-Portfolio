import { describe, expect, it } from 'vitest';
import {
  allFiniteBars,
  computeH0,
  Flood,
  persistence,
  sortCells,
  sortCellsByComparator,
} from '../../../src/lib/tda/index.ts';
import { loadFixture, rng } from './helpers.ts';

interface GoldenCase {
  name: string;
  W: number;
  H: number;
  heights: number[];
  connectivity: 4 | 8;
  finite: [number, number, number, number][];
  essential: [number, number][];
}

describe('golden 1×7 grid [10, 1, 8, 3, 6, 5, 10] (F3 criterion 2)', () => {
  const r = computeH0(new Float32Array([10, 1, 8, 3, 6, 5, 10]), 7, 1);

  it('has finite bars 5→6 (cells 5, 4) and 3→8 (cells 3, 2)', () => {
    const finite = r.bars.filter((b) => b.death !== Infinity);
    expect(finite).toEqual([
      { birth: 5, death: 6, birthCell: 5, deathCell: 4, mergedInto: 3 },
      { birth: 3, death: 8, birthCell: 3, deathCell: 2, mergedInto: 1 },
    ]);
  });

  it('has one essential bar born at 1 in cell 1', () => {
    const essential = r.bars.filter((b) => b.death === Infinity);
    expect(essential).toEqual([
      { birth: 1, death: Infinity, birthCell: 1, deathCell: -1, mergedInto: -1 },
    ]);
    expect(r.stats).toEqual({
      cells: 7,
      connectivity: 4,
      births: 3,
      finite: 2,
      zeroLength: 0,
      essential: 1,
    });
    expect(persistence(r.bars[1])).toBe(5);
  });

  it('returns the ≺ order', () => {
    expect([...r.order]).toEqual([1, 3, 5, 4, 2, 0, 6]);
  });
});

describe('checkerboard [[0,1],[1,0]] (F3 criterion 3)', () => {
  const board = new Float32Array([0, 1, 1, 0]);

  it('4-connectivity: one finite bar 0→1 plus the essential bar', () => {
    const r = computeH0(board, 2, 2);
    expect(r.bars.map((b) => [b.birth, b.death])).toEqual([
      [0, 1],
      [0, Infinity],
    ]);
    // Cell 3 (the later 0 under ≺) dies at cell 1 (the earlier 1), joining the lake of cell 0.
    expect(r.bars[0]).toMatchObject({ birthCell: 3, deathCell: 1, mergedInto: 0 });
  });

  it('4-connectivity is the default', () => {
    expect(computeH0(board, 2, 2, { connectivity: 4 })).toEqual(computeH0(board, 2, 2));
  });

  it('8-connectivity: no finite bar', () => {
    const r = computeH0(board, 2, 2, { connectivity: 8 });
    expect(r.bars.map((b) => [b.birth, b.death])).toEqual([[0, Infinity]]);
    expect(r.stats.finite).toBe(0);
  });
});

describe('shared golden fixture (tests/fixtures/tda/golden.json)', () => {
  const { cases } = loadFixture<{ cases: GoldenCase[] }>('golden.json');
  for (const c of cases) {
    it(c.name, () => {
      const r = computeH0(new Float32Array(c.heights), c.W, c.H, { connectivity: c.connectivity });
      const finite = r.bars.filter((b) => b.death !== Infinity);
      const essential = r.bars.filter((b) => b.death === Infinity);
      expect(finite.map((b) => [b.birth, b.death, b.birthCell, b.deathCell])).toEqual(c.finite);
      expect(essential.map((b) => [b.birth, b.birthCell])).toEqual(c.essential);
    });
  }
});

describe('zero-length bars', () => {
  it('a plateau between two pits yields a zero-length bar, dropped from bars but counted', () => {
    // 1×5 strip: pits at cells 0, 2 (height 1) and 4 (height 0); cell 3 is a flat pass at 1.
    const h = new Float32Array([1, 3, 1, 1, 0]);
    const r = computeH0(h, 5, 1);
    // ≺ order: 4(0), 0(1), 2(1), 3(1), 1(3). Cell 2 is born at 1, cell 3 (h=1) joins lakes 2 and
    // 4: lake 2 is younger, so it dies at 1 — a zero-length bar. Lake 0 dies at 3 in cell 1.
    expect(r.zeroLength).toEqual([
      { birth: 1, death: 1, birthCell: 2, deathCell: 3, mergedInto: 4 },
    ]);
    expect(r.bars).toEqual([
      { birth: 1, death: 3, birthCell: 0, deathCell: 1, mergedInto: 4 },
      { birth: 0, death: Infinity, birthCell: 4, deathCell: -1, mergedInto: -1 },
    ]);
    expect(r.stats).toMatchObject({ births: 3, finite: 2, zeroLength: 1, essential: 1 });
    expect(allFiniteBars(r).map((b) => b.deathCell)).toEqual([3, 1]);
  });

  it('a constant grid has one essential bar and no finite bars', () => {
    const r = computeH0(new Float32Array(12).fill(4), 4, 3);
    expect(r.bars).toEqual([
      { birth: 4, death: Infinity, birthCell: 0, deathCell: -1, mergedInto: -1 },
    ]);
    expect(r.stats.births).toBe(1);
  });
});

describe('input handling', () => {
  it('1×1 grid', () => {
    const r = computeH0(new Float32Array([7]), 1, 1);
    expect(r.bars).toEqual([
      { birth: 7, death: Infinity, birthCell: 0, deathCell: -1, mergedInto: -1 },
    ]);
  });

  it('rejects NaN, bad sizes and bad connectivity', () => {
    expect(() => computeH0(new Float32Array([0, NaN]), 2, 1)).toThrow(RangeError);
    expect(() => computeH0(new Float32Array(5), 2, 2)).toThrow(RangeError);
    expect(() => computeH0(new Float32Array(0), 0, 0)).toThrow(RangeError);
    expect(() => computeH0(new Float32Array(4), 2, 2, { connectivity: 6 as 4 })).toThrow(
      RangeError,
    );
    expect(() => new Flood(new Float32Array(4), 2, 2).advanceTo(NaN)).toThrow(RangeError);
  });

  it('treats −0 and +0 as equal heights (tie broken by index)', () => {
    expect([...sortCells(new Float32Array([0, -0, 0, -0]))]).toEqual([0, 1, 2, 3]);
  });

  it('rejects ±Infinity heights (death = +∞ is reserved for essential bars)', () => {
    expect(() => computeH0(new Float32Array([0, Infinity]), 2, 1)).toThrow(RangeError);
    expect(() => computeH0(new Float32Array([-Infinity, 0]), 2, 1)).toThrow(RangeError);
  });

  it('packed-key sort equals the comparator sort', () => {
    const r = rng(99);
    for (let t = 0; t < 50; t++) {
      const n = 1 + Math.floor(r() * 3000);
      const h = new Float32Array(n);
      const ties = t % 2 === 0;
      for (let i = 0; i < n; i++) {
        h[i] = ties ? Math.floor(r() * 7) - 3 : (r() - 0.5) * 1e6 * (r() < 0.1 ? 1e-30 : 1);
      }
      expect([...sortCells(h)]).toEqual([...sortCellsByComparator(h)]);
    }
  });
});
