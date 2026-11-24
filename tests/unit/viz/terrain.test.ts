import { describe, expect, it } from 'vitest';
import {
  generateTerrain,
  gridSize,
  hillshade,
  MAX_CELLS,
  RELIEF_M,
} from '../../../src/lib/viz/hero/terrain.ts';
import { mulberry32, normalizeSeed, randomSeed } from '../../../src/lib/viz/common/rng.ts';

describe('terrain', () => {
  it('is deterministic per seed and params', () => {
    const a = generateTerrain(120, 60, { seed: 42, scale: 1.5, roughness: 0.5 });
    const b = generateTerrain(120, 60, { seed: 42, scale: 1.5, roughness: 0.5 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });

  it('differs between seeds and spans 0 … RELIEF_M', () => {
    const a = generateTerrain(80, 40, { seed: 1, scale: 1.5, roughness: 0.5 });
    const b = generateTerrain(80, 40, { seed: 2, scale: 1.5, roughness: 0.5 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(false);
    expect(Math.min(...a)).toBe(0);
    expect(Math.max(...a)).toBeCloseTo(RELIEF_M, 2);
    for (const v of a) expect(Number.isFinite(v)).toBe(true);
  });

  it('grid follows ~4 CSS px per cell and never exceeds 40k cells', () => {
    expect(gridSize(600, 300)).toMatchObject({ W: 150, H: 75 });
    for (const [w, h] of [
      [343, 171],
      [1920, 960],
      [4000, 2000],
    ]) {
      const g = gridSize(w, h);
      expect(g.W * g.H).toBeLessThanOrEqual(MAX_CELLS);
      expect(g.cellPx).toBeGreaterThanOrEqual(3.5);
    }
  });

  it('hillshade is in [0, 1]', () => {
    const h = generateTerrain(50, 25, { seed: 7, scale: 1, roughness: 0.6 });
    for (const s of hillshade(h, 50, 25)) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('seeded rng and seed helpers', () => {
    const r1 = mulberry32(9);
    const r2 = mulberry32(9);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
    expect(normalizeSeed('12.7')).toBe(12);
    expect(normalizeSeed(-5)).toBe(0);
    expect(normalizeSeed('abc')).toBe(0);
    expect(randomSeed(() => 0.5)).toBe(500000);
  });
});
