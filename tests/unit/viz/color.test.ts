import { describe, expect, it } from 'vitest';
import {
  contrast,
  deltaE2000Lab,
  hexToRgb,
  packRgb,
  rgbToHex,
  simulateCvd,
} from '../../../src/lib/viz/common/color.ts';

describe('colour maths', () => {
  it('CIEDE2000 matches Sharma, Wu & Dalal (2005) test data', () => {
    const cases: [number[], number[], number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    for (const [a, b, e] of cases) {
      expect(
        deltaE2000Lab(a as [number, number, number], b as [number, number, number]),
      ).toBeCloseTo(e, 4);
    }
  });

  it('WCAG contrast: black on white is 21:1', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it('hex round-trips and packs little-endian RGBA', () => {
    expect(rgbToHex(hexToRgb('#1f5f99'))).toBe('#1f5f99');
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
    const u = new Uint32Array([packRgb(1, 2, 3)]);
    expect(Array.from(new Uint8Array(u.buffer))).toEqual([1, 2, 3, 255]);
  });

  it('CVD simulation leaves greys unchanged and collapses red/green for deutans', () => {
    const g = simulateCvd([128, 128, 128], 'deuteranopia');
    for (const c of g) expect(Math.abs(c - 128)).toBeLessThan(1.5);
    const red = simulateCvd([200, 60, 60], 'deuteranopia');
    const green = simulateCvd([60, 140, 60], 'deuteranopia');
    // Red and green move much closer together than in normal vision.
    const d = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    expect(d(red, green)).toBeLessThan(d([200, 60, 60], [60, 140, 60]) / 2);
  });
});
