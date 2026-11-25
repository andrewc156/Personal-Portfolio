import { describe, expect, it } from 'vitest';
import {
  cellFlux,
  DYE_CAPACITY,
  DYE_LIFE_STEPS,
  DyeField,
  streamField,
  velocityAt,
} from '../../../../src/lib/viz/hero/modes/dye.ts';
import { mulberry32 } from '../../../../src/lib/viz/common/rng.ts';

/** Central-difference divergence of the sampled velocity at (x, y) with step h. */
function divergence(psi: Float32Array, W: number, H: number, x: number, y: number, h: number) {
  const a = new Float64Array(2);
  const b = new Float64Array(2);
  velocityAt(psi, W, H, x + h, y, a);
  velocityAt(psi, W, H, x - h, y, b);
  const dudx = (a[0] - b[0]) / (2 * h);
  velocityAt(psi, W, H, x, y + h, a);
  velocityAt(psi, W, H, x, y - h, b);
  const dvdy = (a[1] - b[1]) / (2 * h);
  return { div: dudx + dvdy, scale: Math.abs(dudx) + Math.abs(dvdy) };
}

describe('dye spill: curl-noise current', () => {
  const W = 120;
  const H = 60;
  const psi = streamField(W, H, 42);

  it('is divergence-free: ≈ 0 at 2,000 random points', () => {
    const rand = mulberry32(7);
    let worst = 0;
    let typical = 0;
    for (let n = 0; n < 2000; n++) {
      // Stay off cell edges so the central difference stays inside one cell.
      const x = 1 + Math.floor(rand() * (W - 2)) + 0.1 + 0.8 * rand();
      const y = 1 + Math.floor(rand() * (H - 2)) + 0.1 + 0.8 * rand();
      const { div, scale } = divergence(psi, W, H, x, y, 0.05);
      worst = Math.max(worst, Math.abs(div));
      typical = Math.max(typical, scale);
    }
    expect(typical).toBeGreaterThan(0.01); // the field really moves
    expect(worst).toBeLessThan(1e-9 + 1e-6 * typical);
  });

  it('every cell has zero net flux (no sources or sinks)', () => {
    let worst = 0;
    let flow = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        worst = Math.max(worst, Math.abs(cellFlux(psi, W, i, j)));
        flow = Math.max(flow, Math.abs(psi[j * (W + 1) + i + 1] - psi[j * (W + 1) + i]));
      }
    }
    expect(flow).toBeGreaterThan(0.01);
    expect(worst).toBeLessThan(1e-4 * flow);
  });

  it('walls are streamlines: no flow through the boundary', () => {
    const v = new Float64Array(2);
    for (let i = 0; i < W; i++) {
      velocityAt(psi, W, H, i + 0.5, 0, v);
      expect(Math.abs(v[1])).toBeLessThan(1e-9);
      velocityAt(psi, W, H, i + 0.5, H, v);
      expect(Math.abs(v[1])).toBeLessThan(1e-9);
    }
    for (let j = 0; j < H; j++) {
      velocityAt(psi, W, H, 0, j + 0.5, v);
      expect(Math.abs(v[0])).toBeLessThan(1e-9);
      velocityAt(psi, W, H, W, j + 0.5, v);
      expect(Math.abs(v[0])).toBeLessThan(1e-9);
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(streamField(W, H, 42)).toEqual(psi);
    expect(streamField(W, H, 43)).not.toEqual(psi);
  });
});

describe('dye spill: particles', () => {
  it('same seed and steps give the same plume', () => {
    const a = new DyeField(80, 40, 5);
    const b = new DyeField(80, 40, 5);
    for (let k = 0; k < 200; k++) {
      a.step();
      b.step();
    }
    expect(a.px).toEqual(b.px);
    expect(a.py).toEqual(b.py);
  });

  it('particles stay inside the box and the pool never overflows', () => {
    const f = new DyeField(60, 30, 9);
    for (let k = 0; k < 400; k++) {
      if (k % 50 === 0) f.release(30, 15);
      f.step();
    }
    expect(f.alive()).toBeLessThanOrEqual(DYE_CAPACITY);
    for (let k = 0; k < DYE_CAPACITY; k++) {
      if (f.steps - f.born[k] >= DYE_LIFE_STEPS) continue;
      expect(f.px[k]).toBeGreaterThanOrEqual(0);
      expect(f.px[k]).toBeLessThanOrEqual(60);
      expect(f.py[k]).toBeGreaterThanOrEqual(0);
      expect(f.py[k]).toBeLessThanOrEqual(30);
    }
  });

  it('Brownian diffusion spreads a release: variance grows about 2·D·t', () => {
    // Freeze the current to isolate diffusion.
    const f = new DyeField(200, 200, 3);
    (f as unknown as { a: Float32Array }).a.fill(0);
    (f as unknown as { b: Float32Array }).b.fill(0);
    f.psi.fill(0);
    f.srcX = -1e6; // the leak sits far away; we only track the release
    const start = f.steps;
    f.release(100, 100);
    const ids: number[] = [];
    for (let k = 0; k < DYE_CAPACITY; k++) if (f.born[k] === start) ids.push(k);
    const varOf = () => {
      let m = 0;
      for (const k of ids) m += f.px[k];
      m /= ids.length;
      let v = 0;
      for (const k of ids) v += (f.px[k] - m) ** 2;
      return v / ids.length;
    };
    const v0 = varOf();
    for (let k = 0; k < 120; k++) f.step();
    const grew = varOf() - v0;
    // 2·D·t with D = 0.5 cells²/s over 2 s → 2 cells²; allow sampling noise.
    expect(grew).toBeGreaterThan(1.4);
    expect(grew).toBeLessThan(2.6);
  });

  it('a release adds dye where it was clicked', () => {
    const f = new DyeField(80, 40, 11);
    f.release(60, 30);
    f.splat();
    expect(f.density[30 * 80 + 60]).toBeGreaterThan(10);
    expect(f.releases).toBe(1);
  });
});
