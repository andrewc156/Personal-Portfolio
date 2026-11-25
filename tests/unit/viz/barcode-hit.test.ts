import { describe, expect, it } from 'vitest';
import {
  BAR_HIT_TOLERANCE,
  barcodeHit,
  levelToX,
  rowPitch,
  stripLayout,
} from '../../../src/lib/viz/hero/barcode.ts';
import type { BarInterval } from '../../../src/lib/viz/hero/model.ts';

/** F26 QA-14: only the drawn bar (plus a small tolerance) is a hit target. */
describe('barcodeHit', () => {
  const minH = 0;
  const maxH = 1000;
  const rows: BarInterval[] = [
    { birth: 0, death: Infinity },
    { birth: 171, death: 414 },
    { birth: 600, death: 620 },
  ];
  for (const dpr of [1, 2]) {
    const L = stripLayout(600, 104, dpr);
    const pitch = rowPitch(rows.length, L);
    const yOf = (k: number) => L.top + (k + 0.5) * pitch;
    const x = (v: number) => levelToX(v, minH, maxH, L);
    const tol = BAR_HIT_TOLERANCE * dpr;

    it(`hits inside the drawn bar and within the tolerance (dpr ${dpr})`, () => {
      expect(barcodeHit(x(300), yOf(1), rows, maxH, minH, maxH, L)).toBe(1);
      expect(barcodeHit(x(171) - tol + 0.5, yOf(1), rows, maxH, minH, maxH, L)).toBe(1);
      expect(barcodeHit(x(414) + tol - 0.5, yOf(1), rows, maxH, minH, maxH, L)).toBe(1);
      // A short bar is still easy to pick.
      expect(barcodeHit(x(610), yOf(2), rows, maxH, minH, maxH, L)).toBe(2);
    });

    it(`blank space in a bar's row is not a hit (dpr ${dpr})`, () => {
      // The QA repro: far right of Lake 2's finished bar on the same row.
      expect(barcodeHit(x(825), yOf(1), rows, maxH, minH, maxH, L)).toBe(-1);
      expect(barcodeHit(x(171) - tol - 1, yOf(1), rows, maxH, minH, maxH, L)).toBe(-1);
      expect(barcodeHit(x(414) + tol + 1, yOf(1), rows, maxH, minH, maxH, L)).toBe(-1);
      expect(barcodeHit(x(50), yOf(2), rows, maxH, minH, maxH, L)).toBe(-1);
      // Below the last row.
      expect(barcodeHit(x(300), L.top + rows.length * pitch + 1, rows, maxH, minH, maxH, L)).toBe(
        -1,
      );
    });

    it(`a growing bar is only hit up to the current level (dpr ${dpr})`, () => {
      const level = 300;
      expect(barcodeHit(x(250), yOf(1), rows, level, minH, maxH, L)).toBe(1);
      expect(barcodeHit(x(400), yOf(1), rows, level, minH, maxH, L)).toBe(-1);
      // Not born yet: nothing drawn, nothing to hit.
      expect(barcodeHit(x(610), yOf(2), rows, level, minH, maxH, L)).toBe(-1);
      // The infinite bar runs to the level line.
      expect(barcodeHit(x(299), yOf(0), rows, level, minH, maxH, L)).toBe(0);
      expect(barcodeHit(x(900), yOf(0), rows, level, minH, maxH, L)).toBe(-1);
    });
  }
});
