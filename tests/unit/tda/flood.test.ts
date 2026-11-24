import { describe, expect, it } from 'vitest';
import { allFiniteBars, computeH0, Flood } from '../../../src/lib/tda/index.ts';
import type { MergeEvent } from '../../../src/lib/tda/index.ts';
import { bfsLabels, randomGrid, rng } from './helpers.ts';

describe('Flood', () => {
  it('golden grid: events, alive(), isWet, componentOf', () => {
    const f = new Flood(new Float32Array([10, 1, 8, 3, 6, 5, 10]), 7, 1);
    expect(f.alive()).toBe(0);
    expect(f.level).toBe(-Infinity);
    expect(f.advanceTo(5)).toEqual([
      { type: 'birth', level: 1, cell: 1, lake: 1, into: -1 },
      { type: 'birth', level: 3, cell: 3, lake: 3, into: -1 },
      { type: 'birth', level: 5, cell: 5, lake: 5, into: -1 },
    ]);
    expect(f.alive()).toBe(3);
    expect(f.wetCount).toBe(3);
    expect(f.isWet(4)).toBe(false);
    expect(f.componentOf(4)).toBe(-1);
    expect(f.advanceTo(7)).toEqual([{ type: 'merge', level: 6, cell: 4, lake: 5, into: 3 }]);
    expect(f.componentOf(5)).toBe(3);
    expect(f.advanceTo(9)).toEqual([{ type: 'merge', level: 8, cell: 2, lake: 3, into: 1 }]);
    expect(f.alive()).toBe(1);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => f.componentOf(i))).toEqual([-1, 1, 1, 1, 1, 1, -1]);
    expect(f.advanceTo(10)).toHaveLength(0);
    expect(f.wetCount).toBe(7);
  });

  it('lowering the level replays from the bottom; reset() empties', () => {
    const f = new Flood(new Float32Array([10, 1, 8, 3, 6, 5, 10]), 7, 1);
    f.advanceTo(100);
    expect(f.advanceTo(5.5).map((e) => e.cell)).toEqual([1, 3, 5]);
    expect(f.alive()).toBe(3);
    expect(f.advanceTo(5.2)).toEqual([]); // no cell lies in (5.2, 5.5]: nothing to undo
    expect(f.level).toBe(5.2);
    f.reset();
    expect(f.alive()).toBe(0);
    expect(f.isWet(1)).toBe(false);
  });

  it('levelAtPercentile uses the ≺ order', () => {
    const h = new Float32Array([10, 1, 8, 3, 6, 5, 10]);
    const f = new Flood(h, 7, 1);
    expect(f.levelAtPercentile(0)).toBe(1);
    expect(f.levelAtPercentile(100)).toBe(10);
    expect(f.levelAtPercentile(50)).toBe(6); // order [1,3,5,4,2,0,6] → k = 3 → cell 4
    expect(f.levelAtPercentile(-5)).toBe(1);
    expect(f.levelAtPercentile(500)).toBe(10);
  });

  it('accepts a precomputed order', () => {
    const g = randomGrid(rng(5), 30, true);
    const r = computeH0(g.heights, g.W, g.H);
    const f = new Flood(g.heights, g.W, g.H, { order: r.order });
    expect(f.order).toBe(r.order);
    expect(() => new Flood(g.heights, g.W, g.H, { order: new Uint32Array(1) })).toThrow();
  });

  for (const conn of [4, 8] as const) {
    it(`${conn}-connectivity: matches computeH0 and a BFS of the sublevel set at random levels`, () => {
      const r = rng(conn);
      for (let t = 0; t < 120; t++) {
        const g = randomGrid(r, 30, t % 2 === 0);
        const h = g.heights;
        const res = computeH0(h, g.W, g.H, { connectivity: conn });
        const f = new Flood(h, g.W, g.H, { connectivity: conn });
        const levels = Array.from({ length: 12 }, () => f.levelAtPercentile(r() * 100));
        levels.push(...levels.slice(0, 3).map((x) => x + 0.5));
        levels.sort((a, b) => a - b);
        const events: MergeEvent[] = [];
        for (const level of levels) {
          events.push(...f.advanceTo(level));
          const labels = bfsLabels(h, g.W, g.H, conn, (i) => h[i] <= level);
          const lakes = new Set<number>();
          for (let i = 0; i < h.length; i++) {
            expect(f.isWet(i)).toBe(h[i] <= level);
            expect(f.componentOf(i)).toBe(labels[i]); // root = ≺-oldest cell of the lake
            if (labels[i] >= 0) lakes.add(labels[i]);
          }
          expect(f.alive()).toBe(lakes.size);
        }
        events.push(...f.advanceTo(Infinity));
        const merges = events.filter((e) => e.type === 'merge');
        expect(merges.map((e) => [e.lake, e.cell, e.into, e.level])).toEqual(
          allFiniteBars(res).map((b) => [b.birthCell, b.deathCell, b.mergedInto, b.death]),
        );
        expect(events.filter((e) => e.type === 'birth').length).toBe(res.stats.births);
        expect(f.alive()).toBe(1);
        // Going back down replays to the same state.
        const mid = f.levelAtPercentile(40);
        f.advanceTo(mid);
        const g2 = new Flood(h, g.W, g.H, { connectivity: conn });
        g2.advanceTo(mid);
        expect(f.alive()).toBe(g2.alive());
        for (let i = 0; i < h.length; i++) expect(f.componentOf(i)).toBe(g2.componentOf(i));
      }
    });
  }
});
