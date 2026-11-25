import { describe, expect, it } from 'vitest';
import { computeH0, Flood, isEssential } from '../../../src/lib/tda/index.ts';
import { HERO_DEFAULTS } from '../../../src/lib/viz/hero/controller.ts';
import {
  isAlive,
  levelAt,
  pickStartProgress,
  selectBars,
  START_MAX_WET,
  START_MIN_DEPTH_M,
  type BarInterval,
  type Pacing,
} from '../../../src/lib/viz/hero/model.ts';
import { generateTerrain, gridSize, heightRange } from '../../../src/lib/viz/hero/terrain.ts';

/** F19b: the hero's first frame starts part-way up, so it already shows a few lakes. */

function setup(seed: number, cssW = 565, cssH = 318, pacing: Pacing = 'linear') {
  const { W, H } = gridSize(cssW, cssH);
  const heights = generateTerrain(W, H, { seed, scale: 1.5, roughness: 0.5 });
  const result = computeH0(heights, W, H);
  const flood = new Flood(heights, W, H, { order: result.order });
  const [minH, maxH] = heightRange(heights);
  const rows = selectBars(result, HERO_DEFAULTS.minPersistence, HERO_DEFAULTS.maxBars);
  const level = (p: number) => levelAt(p, pacing, minH, maxH, (q) => flood.levelAtPercentile(q));
  const start = () => pickStartProgress(rows, heights, result.order, pacing);
  return { W, H, flood, rows, level, start };
}

const visible = (rows: readonly BarInterval[], L: number) =>
  rows.filter((b) => isAlive(b, L) && b.birth + START_MIN_DEPTH_M <= L).length;

function pickSorted(rows: readonly BarInterval[], sorted: Float32Array, pacing: Pacing = 'linear') {
  const order = Uint32Array.from(sorted, (_, i) => i);
  return pickStartProgress(rows, sorted, order, pacing);
}

describe('pickStartProgress', () => {
  it('is deterministic per seed and grid, and stays in the search range', () => {
    for (const seed of [1, 7, 42, 123, 2024, 99999]) {
      const a = setup(seed);
      const p = a.start();
      const b = setup(seed);
      expect(b.start()).toBe(p);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('shows more visible lakes than the bottom level, without drowning the map', () => {
    for (const seed of [1, 7, 42, 123, 2024, 99999]) {
      const s = setup(seed);
      const p = s.start();
      const L = s.level(p);
      // At the bottom only the essential lake exists and it has no depth yet.
      expect(visible(s.rows, s.level(0))).toBe(0);
      expect(visible(s.rows, L)).toBeGreaterThanOrEqual(1);
      s.flood.advanceTo(L);
      expect(s.flood.wetCount / (s.W * s.H)).toBeLessThanOrEqual(START_MAX_WET);
    }
  });

  it.each(['linear', 'percentile'] as const)(
    'seed 25 at 375px frames several deep lakes in %s pacing',
    (pacing) => {
      // The 375px viewport lays out a 341px-wide, 16:9 map (85 × 48 cells).
      const s = setup(25, 341, (341 * 9) / 16, pacing);
      const p = s.start();
      const L = s.level(p);
      s.flood.advanceTo(L);
      expect(s.flood.wetCount / (s.W * s.H)).toBeLessThanOrEqual(START_MAX_WET);
      expect(visible(s.rows, L)).toBeGreaterThanOrEqual(3);
    },
  );

  it('seed 42 at desktop size starts with several lakes in view', () => {
    const s = setup(42);
    const p = s.start();
    s.flood.advanceTo(s.level(p));
    expect(s.flood.alive()).toBeGreaterThanOrEqual(3);
  });

  it('breaks ties toward the target wet share, then the smaller p', () => {
    // One essential bar born at 0: every candidate shows exactly one visible lake from 15 m.
    const rows: BarInterval[] = [{ birth: 0, death: Infinity }];
    const sorted = Float32Array.from({ length: 100 }, (_, i) => i * 10); // 0 … 990 m
    // Closest to 15% and earliest is L = 140 m for both one deep lake and no deep lakes.
    expect(pickSorted(rows, sorted)).toBe(140 / 990);
    expect(pickSorted([], sorted)).toBe(140 / 990);
  });

  it('finds a narrow multi-lake overlap between cells and beyond 35% progress', () => {
    const sorted = Float32Array.from({ length: 101 }, (_, i) => (i < 30 ? i * 10 : 500 + i * 5));
    const rows = [
      { birth: 0, death: Infinity },
      { birth: 425.25, death: 440.5 },
      { birth: 425.375, death: 440.625 },
    ];
    const level = (p: number) => levelAt(p, 'linear', 0, 1000, () => 0);
    expect(visible(rows, level(pickSorted(rows, sorted)))).toBe(3);
    // No cell height is inside either narrow interval; percentile pacing cannot show them.
    const percentile = pickSorted(rows, sorted, 'percentile');
    expect(visible(rows, sorted[Math.round(percentile * (sorted.length - 1))])).toBe(1);
  });

  it('keeps the best framed single lake if other lakes only deepen above the wet cap', () => {
    const sorted = Float32Array.from({ length: 20 }, (_, i) => i * 10);
    const rows = [
      { birth: 0, death: Infinity },
      { birth: 65, death: 100 },
      { birth: 70, death: 105 },
    ];
    expect(pickSorted(rows, sorted)).toBe(20 / 190);
  });

  it('falls back to the lowest level if tied lowest cells exceed the wet cap', () => {
    const sorted = Float32Array.of(0, 0, 0, 0, 20, 25);
    expect(pickSorted([{ birth: 0, death: Infinity }], sorted)).toBe(0);
  });

  it('the essential bar is always a drawn row', () => {
    const s = setup(42);
    expect(s.rows.some(isEssential)).toBe(true);
  });
});

describe('hero defaults (F19b)', () => {
  it('the barcode shows at most 12 rows by default so bars stay legible', () => {
    expect(HERO_DEFAULTS.maxBars).toBe(12);
    expect(HERO_DEFAULTS.minPersistence).toBe(10);
  });
});
