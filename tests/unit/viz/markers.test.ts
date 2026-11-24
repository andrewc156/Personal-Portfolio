import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/lib/viz/common/rng.ts';
import { clampMarker, placeLabel, type Box } from '../../../src/lib/viz/hero/markers.ts';

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
