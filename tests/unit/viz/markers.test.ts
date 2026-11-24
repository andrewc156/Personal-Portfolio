import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/lib/viz/common/rng.ts';
import {
  clampMarker,
  placeLabel,
  separatePass,
  type Box,
  type Point,
} from '../../../src/lib/viz/hero/markers.ts';

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('marker placement', () => {
  it('clamps markers inside the canvas, clear of the corners', () => {
    expect(clampMarker(-10, 300, 5, 6)).toBe(11);
    expect(clampMarker(400, 300, 5, 6)).toBe(289);
    expect(clampMarker(150, 300, 5, 6)).toBe(150);
    expect(clampMarker(5, 10, 5, 6)).toBe(5); // too small: centre
  });

  it('pit and pass labels stay inside the canvas and never overlap (random cases)', () => {
    const rnd = mulberry32(5);
    for (let n = 0; n < 2000; n++) {
      const W = 340 + rnd() * 900;
      const H = W / 2;
      const r = 6;
      const px = clampMarker(rnd() * W, W, r, 6);
      const py = clampMarker(rnd() * H, H, r, 6);
      // Pass often sits close to the pit, the case that collided at 375 px.
      const qx = clampMarker(px + (rnd() - 0.5) * 60, W, r, 6);
      const qy = clampMarker(py + (rnd() - 0.5) * 30, H, r, 6);
      const avoid: Box[] = [
        { x: px - r, y: py - r, w: 2 * r, h: 2 * r },
        { x: qx - r, y: qy - r, w: 2 * r, h: 2 * r },
      ];
      const a = placeLabel(px, py, r, 90, 16, W, H, 4, 4, avoid);
      expect(a.x).toBeGreaterThanOrEqual(4);
      expect(a.y).toBeGreaterThanOrEqual(4);
      expect(a.x + a.w).toBeLessThanOrEqual(W - 4 + 1e-9);
      expect(a.y + a.h).toBeLessThanOrEqual(H - 4 + 1e-9);
      avoid.push(a);
      const b = placeLabel(qx, qy, r, 110, 16, W, H, 4, 4, avoid);
      expect(b.x).toBeGreaterThanOrEqual(4);
      expect(b.x + b.w).toBeLessThanOrEqual(W - 4 + 1e-9);
      expect(b.y).toBeGreaterThanOrEqual(4);
      expect(b.y + b.h).toBeLessThanOrEqual(H - 4 + 1e-9);
      expect(overlap(a, b)).toBe(false);
    }
  });

  it('prefers the right-hand side when there is room', () => {
    const b = placeLabel(100, 100, 5, 50, 16, 400, 200, 4, 4, []);
    expect(b).toEqual({ x: 109, y: 92, w: 50, h: 16 });
  });
});

describe('pit / pass separation', () => {
  const pitR = 5;
  const passR = 6;
  const gap = 3;
  const margin = 6;
  const need = pitR + passR + gap;

  it('leaves markers that are already apart exactly where they are', () => {
    const out: Point = { x: 0, y: 0 };
    expect(separatePass(100, 100, pitR, 130, 100, passR, gap, 400, 200, margin, out)).toEqual({
      x: 130,
      y: 100,
    });
  });

  it('moves an adjacent pass diamond clear of the pit ring, along pit → pass', () => {
    const out: Point = { x: 0, y: 0 };
    // Adjacent cells 6 px apart (the overlapping case at small sizes).
    separatePass(100, 100, pitR, 106, 100, passR, gap, 400, 200, margin, out);
    expect(out.y).toBe(100);
    expect(out.x).toBeCloseTo(100 + need, 9);
    // Same cell: pushed to the right by default.
    separatePass(100, 100, pitR, 100, 100, passR, gap, 400, 200, margin, out);
    expect(Math.hypot(out.x - 100, out.y - 100)).toBeGreaterThanOrEqual(need - 1e-9);
  });

  it('pushes the other way when the edge blocks the natural direction', () => {
    const out: Point = { x: 0, y: 0 };
    const W = 400;
    const px = clampMarker(W, W, pitR, margin); // pit at the right edge
    const qx = clampMarker(W, W, passR, margin); // pass clamped next to it
    separatePass(px, 100, pitR, qx, 100, passR, gap, W, 200, margin, out);
    expect(out.x).toBeLessThan(px);
    expect(Math.hypot(out.x - px, out.y - 100)).toBeGreaterThanOrEqual(need - 1e-9);
    expect(out.x).toBeLessThanOrEqual(W - passR - margin);
  });

  it('never leaves the markers touching and keeps the diamond inside (random cases)', () => {
    const rnd = mulberry32(11);
    const out: Point = { x: 0, y: 0 };
    for (let n = 0; n < 5000; n++) {
      const W = 120 + rnd() * 1100;
      const H = W / 2;
      const px = clampMarker(rnd() * W, W, pitR, margin);
      const py = clampMarker(rnd() * H, H, pitR, margin);
      const qx = clampMarker(px + (rnd() - 0.5) * 24, W, passR, margin);
      const qy = clampMarker(py + (rnd() - 0.5) * 24, H, passR, margin);
      separatePass(px, py, pitR, qx, qy, passR, gap, W, H, margin, out);
      expect(Math.hypot(out.x - px, out.y - py)).toBeGreaterThanOrEqual(need - 1e-9);
      expect(out.x).toBeGreaterThanOrEqual(passR + margin - 1e-9);
      expect(out.x).toBeLessThanOrEqual(W - passR - margin + 1e-9);
      expect(out.y).toBeGreaterThanOrEqual(passR + margin - 1e-9);
      expect(out.y).toBeLessThanOrEqual(H - passR - margin + 1e-9);
      if (Math.hypot(qx - px, qy - py) >= need) expect(out).toEqual({ x: qx, y: qy });
    }
  });
});
