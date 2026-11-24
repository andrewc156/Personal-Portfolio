import { describe, expect, it } from 'vitest';
import { Flood, isEssential } from '../../../../src/lib/tda/index.ts';
import type { Bar } from '../../../../src/lib/tda/index.ts';
import { cellAreas, gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import {
  IDENTITY_K,
  identitySlots,
  indexLakes,
  LevelScale,
  nextDown,
  selectRows,
} from '../../../../src/lib/viz/explorer/model.ts';
import { heights, liveResult, meta } from './helpers.ts';

const res = liveResult();
const index = indexLakes(res.bars);
const n = meta.width * meta.height;

function bar(birth: number, death: number, birthCell: number): Bar {
  return { birth, death, birthCell, deathCell: birthCell + 1, mergedInto: 0 };
}

describe('lake ranking and identity colours', () => {
  it('ranks finite lakes by persistence, ties in sweep order; the lowest lake is rank 0', () => {
    const bars = [bar(0, 5, 10), bar(1, 3, 20), bar(2, 7, 30), bar(0, Infinity, 0)];
    const ix = indexLakes(bars);
    // persistences 5, 2, 5 → 10 and 30 (sweep order), then 20.
    expect(ix.ranked.map((b) => b.birthCell)).toEqual([10, 30, 20]);
    expect(ix.rankOf.get(0)).toBe(0);
  });

  it('ties keep sweep order', () => {
    const bars = [bar(0, 2, 10), bar(5, 9, 20), bar(1, 3, 30), bar(0, Infinity, 0)];
    const ix = indexLakes(bars);
    // persistences 2, 4, 2 → 20 first, then 10 and 30 in their original (sweep) order.
    expect(ix.ranked.map((b) => b.birthCell)).toEqual([20, 10, 30]);
    expect(ix.rankOf.get(0)).toBe(0);
    expect(ix.rankOf.get(20)).toBe(1);
    expect(ix.essential?.birthCell).toBe(0);
  });

  it('on the real grid: persistence is non-increasing and the essential lake is the grid minimum', () => {
    for (let k = 1; k < index.ranked.length; k++) {
      const a = index.ranked[k - 1];
      const b = index.ranked[k];
      expect(a.death - a.birth).toBeGreaterThanOrEqual(b.death - b.birth);
    }
    expect(index.essential?.birthCell).toBe(meta.min.cell);
  });

  it('K identity slots: the lowest lake and the K − 1 longest-lived lakes', () => {
    const slots = identitySlots(index, n);
    const used = [...slots].filter((s) => s >= 0);
    expect(used.length).toBe(IDENTITY_K);
    expect(new Set(used).size).toBe(IDENTITY_K);
    expect(slots[meta.min.cell]).toBe(0);
    expect(slots[index.ranked[0].birthCell]).toBe(1);
  });

  it('elder rule: an identity lake is only ever absorbed by an identity lake', () => {
    const slots = identitySlots(index, n);
    for (const b of res.bars) {
      if (isEssential(b)) continue;
      const survivor = index.barOf.get(b.mergedInto)!;
      // A survivor's persistence is at least that of the lake it absorbs.
      expect(survivor.death - survivor.birth).toBeGreaterThanOrEqual(b.death - b.birth);
      if (slots[b.birthCell] >= 0) expect(slots[b.mergedInto]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('selectRows', () => {
  it('returns engine Bar objects: lowest lake + longest bars ≥ min persistence, capped, in birth order', () => {
    const rows = selectRows(index, 10, 40, res.rank);
    expect(rows).toHaveLength(40);
    for (const r of rows) expect(res.bars).toContain(r); // the same objects, not copies
    expect(rows[0]).toBe(index.essential);
    for (let k = 1; k < rows.length; k++) {
      expect(res.rank[rows[k - 1].birthCell]).toBeLessThan(res.rank[rows[k].birthCell]);
    }
    const shortest = Math.min(...rows.filter((b) => !isEssential(b)).map((b) => b.death - b.birth));
    // Exactly the 39 longest finite bars.
    const top = index.ranked.slice(0, 39);
    expect(new Set(rows.filter((b) => !isEssential(b)))).toEqual(new Set(top));
    expect(shortest).toBe(top[38].death - top[38].birth);
  });

  it('min persistence filters and the essential bar always stays', () => {
    const rows = selectRows(index, 300, 600, res.rank);
    expect(rows.every((b) => isEssential(b) || b.death - b.birth >= 300)).toBe(true);
    expect(rows.length).toBe(1 + index.ranked.filter((b) => b.death - b.birth >= 300).length);
    expect(selectRows(index, 1e6, 600, res.rank)).toEqual([index.essential]);
  });
});

describe('LevelScale (pacing, percentile, area)', () => {
  const scale = new LevelScale(heights, res.order, cellAreas(gridGeo(meta)));
  const flood = new Flood(heights, meta.width, meta.height, { order: res.order });

  it('percentile pacing equals Flood.levelAtPercentile', () => {
    for (const p of [0, 0.1, 0.37, 0.5, 0.99, 1]) {
      expect(scale.levelAt(p, 'percentile')).toBe(flood.levelAtPercentile(p * 100));
    }
  });

  it('linear pacing runs from the lowest to the highest cell', () => {
    expect(scale.levelAt(0, 'linear')).toBe(scale.minH);
    expect(scale.minH).toBe(heights[meta.min.cell]);
    expect(scale.maxH).toBe(heights[meta.max.cell]);
    expect(scale.levelAt(1, 'linear')).toBe(scale.maxH);
    expect(scale.levelAt(0.5, 'linear')).toBeCloseTo((scale.minH + scale.maxH) / 2, 9);
  });

  it('countAtOrBelow equals Flood.wetCount; progressAt inverts levelAt', () => {
    for (const lv of [-10, scale.minH, 0, 1000.5, 1671.5, 2500, scale.maxH, 1e5]) {
      flood.advanceTo(lv);
      expect(scale.countAtOrBelow(lv)).toBe(flood.wetCount);
    }
    for (const p of [0, 0.2, 0.45, 0.8, 1]) {
      for (const pacing of ['linear', 'percentile'] as const) {
        const lv = scale.levelAt(p, pacing);
        const back = scale.levelAt(scale.progressAt(lv, pacing), pacing);
        // Same flooded set either way.
        expect(scale.countAtOrBelow(back)).toBe(scale.countAtOrBelow(lv));
      }
    }
  });

  it('percentile and area are 0–100 and monotone; area weights by latitude', () => {
    expect(scale.percentile(0)).toBe(0);
    expect(scale.percentile(n)).toBe(100);
    expect(scale.areaPercent(0)).toBe(0);
    expect(scale.areaPercent(n)).toBeCloseTo(100, 9);
    let prev = -1;
    for (let k = 0; k <= n; k += 997) {
      const a = scale.areaPercent(k);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    // Not identical to the cell-count percentile (cells differ in area).
    expect(Math.abs(scale.areaPercent(n / 2) - 50)).toBeGreaterThan(0.01);
  });
});

describe('nextDown', () => {
  it('is the largest double below x', () => {
    for (const x of [1671.5, -2.885, 1, 0.1, 3177.0810546875, -1e-300]) {
      const d = nextDown(x);
      expect(d).toBeLessThan(x);
      expect((d + x) / 2 === d || (d + x) / 2 === x).toBe(true);
    }
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
  });

  it('just below a death level, the dying lake is still alive', () => {
    const flood = new Flood(heights, meta.width, meta.height, { order: res.order });
    for (const b of index.ranked.slice(0, 25)) {
      flood.advanceTo(nextDown(b.death));
      expect(flood.componentOf(b.birthCell)).toBe(b.birthCell);
      expect(flood.isWet(b.deathCell)).toBe(false);
      flood.advanceTo(b.death);
      expect(flood.componentOf(b.birthCell)).toBe(b.mergedInto);
    }
  });
});
