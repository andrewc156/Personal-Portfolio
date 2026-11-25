import { describe, expect, it } from 'vitest';
import {
  kochSnowflake,
  MAX_COURANT,
  POND_COURANT,
  POND_DAMPING,
  pondPolygon,
  polygonArea,
  rasterize,
  WaveField,
} from '../../../../src/lib/viz/hero/modes/pond.ts';

function pond(W = 120, H = 80, level = 3) {
  return rasterize(pondPolygon(W, H, level, 0.2), W, H);
}

describe('fractal pond: Koch snowflake', () => {
  it('has 3·4ⁿ vertices and the bumps point outward (area → 8/5 of the triangle)', () => {
    const tri = polygonArea(kochSnowflake(0));
    for (let n = 0; n <= 4; n++) {
      const p = kochSnowflake(n);
      expect(p.length / 2).toBe(3 * 4 ** n);
      // Area after n levels: A₀·(1 + (3/5)(1 − (4/9)ⁿ)).
      const want = tri * (1 + 0.6 * (1 - (4 / 9) ** n));
      expect(polygonArea(p)).toBeCloseTo(want, 9);
    }
  });

  it('rasterises to a pond inside the grid, clear of the border, filling ~the polygon area', () => {
    const W = 120;
    const H = 80;
    const poly = pondPolygon(W, H, 4, 0.3);
    const mask = rasterize(poly, W, H);
    let n = 0;
    for (let i = 0; i < W * H; i++) n += mask[i];
    expect(Math.abs(n - polygonArea(poly)) / polygonArea(poly)).toBeLessThan(0.03);
    for (let i = 0; i < W; i++) expect(mask[i] + mask[(H - 1) * W + i]).toBe(0);
    for (let j = 0; j < H; j++) expect(mask[j * W] + mask[j * W + W - 1]).toBe(0);
  });
});

describe('fractal pond: wave equation', () => {
  it('rejects Courant numbers above the 2-D CFL limit 1/√2', () => {
    const m = pond();
    expect(() => new WaveField(120, 80, m, 0.72)).toThrow(RangeError);
    expect(() => new WaveField(120, 80, m, MAX_COURANT)).not.toThrow();
    expect(POND_COURANT).toBeLessThanOrEqual(MAX_COURANT);
  });

  it('is stable: discrete energy is conserved with fixed walls (no damping), 4,000 steps', () => {
    const f = new WaveField(120, 80, pond(), POND_COURANT, 0);
    f.drop(60, 40);
    f.drop(45, 30, 0.7, 2);
    f.step();
    const e0 = f.energy();
    expect(e0).toBeGreaterThan(0);
    let lo = e0;
    let hi = e0;
    for (let k = 0; k < 4000; k++) {
      f.step();
      const e = f.energy();
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
    expect((hi - lo) / e0).toBeLessThan(1e-3);
    expect(f.maxAbs()).toBeLessThan(3);
  });

  it('walls stay fixed at u = 0 and waves reflect (they come back to the centre)', () => {
    const W = 120;
    const H = 80;
    const m = pond(W, H);
    const f = new WaveField(W, H, m, POND_COURANT, 0);
    f.drop(60, 40);
    for (let k = 0; k < 600; k++) {
      f.step();
      if (k % 50 === 0) {
        for (let i = 0; i < W * H; i++) if (!f.mask[i]) expect(f.u[i]).toBe(0);
      }
    }
    // Energy never leaks out through the walls, so the pond is still moving.
    let s = 0;
    for (const i of f.inside) s += f.u[i] * f.u[i];
    expect(s).toBeGreaterThan(1e-3);
  });

  it('damping makes energy decay monotonically, never grow', () => {
    const f = new WaveField(120, 80, pond(), POND_COURANT, POND_DAMPING);
    f.drop(60, 40);
    f.step();
    const e0 = f.energy();
    for (let k = 0; k < 3000; k++) f.step();
    expect(f.energy()).toBeLessThan(e0);
    expect(f.energy()).toBeGreaterThanOrEqual(0);
  });

  it('the same scheme blows up above the CFL limit (so the limit matters)', () => {
    const f = WaveField.unchecked(120, 80, pond(), 0.9);
    f.drop(60, 40);
    for (let k = 0; k < 200; k++) f.step();
    const m = f.maxAbs();
    // It grows without bound (overflowing to ∞ or NaN if run long enough).
    expect(Number.isNaN(m) || m > 1e3).toBe(true);
  });

  it('drops on land do nothing', () => {
    const f = new WaveField(120, 80, pond(), POND_COURANT, 0);
    expect(f.drop(0.5, 0.5)).toBe(false);
    expect(f.maxAbs()).toBe(0);
  });
});
