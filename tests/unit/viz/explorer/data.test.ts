import { describe, expect, it } from 'vitest';
import { isEssential } from '../../../../src/lib/tda/index.ts';
import {
  barsFromFile,
  checkGridBytes,
  checkGridHash,
  compareBarcode,
  decodeGrid,
  exportedBars,
  sha256Hex,
} from '../../../../src/lib/viz/explorer/data.ts';
import type { BarcodeFile } from '../../../../src/lib/viz/explorer/types.ts';
import { barcode, gridBuffer, heights, liveResult, meta } from './helpers.ts';

/**
 * Acceptance criterion 2 (§10/F6): the engine run on the real grid.f32 gives exactly the bars in
 * barcode.json — identical (bi, di, mi) in the same order and identical b, d values.
 */
describe('Colorado data files', () => {
  it('grid.f32 has the size meta.json and barcode.json describe', () => {
    const c = checkGridBytes(gridBuffer.byteLength, meta, barcode);
    expect(c.problems).toEqual([]);
    expect(heights.length).toBe(meta.width * meta.height);
  });

  it('grid.f32 SHA-256 matches meta.json and barcode.json', async () => {
    const hash = await sha256Hex(gridBuffer);
    expect(hash).toBe(meta.files['grid.f32'].sha256);
    expect(checkGridHash(hash, meta, barcode).ok).toBe(true);
    expect(checkGridHash('0'.repeat(64), meta, barcode).ok).toBe(false);
  });

  it('decodes little-endian float32 with the min and max meta.json records', () => {
    expect(heights[meta.min.cell]).toBeCloseTo(meta.min.value, 3);
    expect(heights[meta.max.cell]).toBeCloseTo(meta.max.value, 3);
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of heights) {
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    expect(lo).toBe(heights[meta.min.cell]);
    expect(hi).toBe(heights[meta.max.cell]);
  });

  it('flags a wrong byte length', () => {
    expect(checkGridBytes(gridBuffer.byteLength - 4, meta, barcode).ok).toBe(false);
  });

  it('decodeGrid reads little-endian regardless of platform', () => {
    const buf = new ArrayBuffer(8);
    const v = new DataView(buf);
    v.setFloat32(0, 1.5, true);
    v.setFloat32(4, -2885.25, true);
    expect(Array.from(decodeGrid(buf))).toEqual([1.5, -2885.25]);
  });
});

describe('live engine barcode = barcode.json', () => {
  it('every exported bar is identical (bi, di, mi, b, d), in order', () => {
    const res = liveResult();
    const m = compareBarcode(res, barcode, heights);
    expect(m.problems).toEqual([]);
    expect(m.ok).toBe(true);
    expect(m.identical).toBe(barcode.count);
    expect(m.live).toBe(barcode.count);
  });

  it('pairs match column by column (independent of compareBarcode)', () => {
    const live = exportedBars(liveResult(), barcode.minPersistence);
    expect(live.map((b) => b.birthCell)).toEqual(barcode.bi);
    expect(live.map((b) => b.deathCell)).toEqual(barcode.di);
    expect(live.map((b) => b.mergedInto)).toEqual(barcode.mi);
    expect(live.map((b) => b.birth)).toEqual(barcode.b);
    expect(live.map((b) => (isEssential(b) ? null : b.death))).toEqual(barcode.d);
    // The file's values are the exact float32 heights.
    barcode.bi.forEach((c, k) => expect(barcode.b[k]).toBe(heights[c]));
  });

  it('stats agree with barcode.json', () => {
    const s = liveResult().stats;
    expect(s.births).toBe(barcode.stats.births);
    expect(s.zeroLength).toBe(barcode.stats.zeroLengthBars);
    expect(s.finite).toBe(barcode.stats.finiteBars);
    expect(s.essential).toBe(1);
  });

  it('detects a tampered file', () => {
    const bad: BarcodeFile = { ...barcode, di: barcode.di.slice() };
    bad.di[5] = bad.di[5] + 1;
    const m = compareBarcode(liveResult(), bad, heights);
    expect(m.ok).toBe(false);
    expect(m.identical).toBe(barcode.count - 1);
    const short: BarcodeFile = { ...barcode, b: barcode.b.slice(0, -1), count: barcode.count - 1 };
    expect(compareBarcode(liveResult(), short, heights).ok).toBe(false);
    const shifted: BarcodeFile = {
      ...barcode,
      b: barcode.b.map((v, k) => (k === 3 ? v + 0.1 : v)),
    };
    expect(compareBarcode(liveResult(), shifted, heights).ok).toBe(false);
  });

  it('barsFromFile maps null deaths to the essential bar', () => {
    const bars = barsFromFile(barcode);
    expect(bars.filter(isEssential)).toHaveLength(1);
    expect(bars[bars.length - 1].birthCell).toBe(meta.min.cell);
    expect(bars[bars.length - 1].mergedInto).toBe(-1);
  });
});
