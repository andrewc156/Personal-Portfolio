import { describe, expect, it } from 'vitest';
import { barsFromFile } from '../../../../src/lib/viz/explorer/data.ts';
import {
  blockSpan,
  cellAreas,
  cellAtFraction,
  cellCenter,
  cellEdges,
  displayAspect,
  edgeOf,
  gridGeo,
} from '../../../../src/lib/viz/explorer/geo.ts';
import { indexLakes } from '../../../../src/lib/viz/explorer/model.ts';
import { cellLatLon, fmt, NBSP } from '../../../../src/lib/viz/explorer/text.ts';
import { barcode, docLakes, meta } from './helpers.ts';

const g = gridGeo(meta);
/** docs/data.md writes "37.7204° N, 107.0692° W" with plain spaces. */
const plain = (s: string) => s.replaceAll(NBSP, ' ');

describe('grid geometry', () => {
  it('30 native pixels per cell, partial last column and row as meta.edgeBlocks says', () => {
    expect(g.block).toBe(30);
    const [c0, c1] = blockSpan(g.W - 1, g.block, g.nativeW);
    const [r0, r1] = blockSpan(g.H - 1, g.block, g.nativeH);
    expect(c1 - c0).toBe(meta.edgeBlocks.lastColumnNativePx);
    expect(r1 - r0).toBe(meta.edgeBlocks.lastRowNativePx);
  });

  it('cell centres of the min and max cells equal meta.min / meta.max', () => {
    for (const m of [meta.min, meta.max]) {
      const c = cellCenter(m.cell, g);
      expect(c.lat).toBeCloseTo(m.lat, 6);
      expect(c.lon).toBeCloseTo(m.lon, 6);
      expect(m.cell).toBe(m.y * meta.width + m.x);
    }
  });

  it('full cells follow meta.cellCenter: lon = W + (x + 0.5)·cellDeg, lat = N − (y + 0.5)·cellDeg', () => {
    const i = 200 * meta.width + 100;
    const c = cellCenter(i, g);
    expect(c.lon).toBeCloseTo(meta.native.extent[0] + 100.5 * meta.cellDeg, 9);
    expect(c.lat).toBeCloseTo(meta.native.extent[3] - 200.5 * meta.cellDeg, 9);
  });

  it('lat/lon of the 10 longest-lived lakes match docs/data.md (values read from the files)', () => {
    const doc = docLakes();
    expect(doc).toHaveLength(10);
    const index = indexLakes(barsFromFile(barcode));
    for (const row of doc) {
      const bar = index.ranked[row.rank - 1];
      expect(bar.birthCell).toBe(row.birthCell);
      expect(bar.deathCell).toBe(row.deathCell);
      expect(bar.mergedInto).toBe(row.into);
      expect(plain(cellLatLon(bar.birthCell, g))).toBe(row.birthWhere);
      expect(plain(cellLatLon(bar.deathCell, g))).toBe(row.deathWhere);
      expect(fmt(bar.death - bar.birth, 1)).toBe(row.persistence);
      expect(bar.birth.toFixed(1)).toBe(row.birth);
      expect(bar.death.toFixed(1)).toBe(row.death);
    }
  });

  it('display aspect from the footprint ≈ meta.derived.displayAspect (portrait, ≈ 0.63)', () => {
    const a = displayAspect(g);
    expect(Math.abs(a - meta.derived.displayAspect)).toBeLessThan(1e-3);
    expect(a).toBeGreaterThan(0.6);
    expect(a).toBeLessThan(0.66);
  });

  it('cellAtFraction inverts cell centres, including the partial edge cells', () => {
    const { xs, ys } = cellEdges(g);
    expect(xs[0]).toBe(0);
    expect(xs[g.W]).toBe(1);
    expect(ys[g.H]).toBe(1);
    for (const i of [0, g.W - 1, (g.H - 1) * g.W, g.W * g.H - 1, meta.min.cell, 12345]) {
      const x = i % g.W;
      const y = Math.floor(i / g.W);
      expect(cellAtFraction((xs[x] + xs[x + 1]) / 2, (ys[y] + ys[y + 1]) / 2, g)).toBe(i);
    }
    expect(cellAtFraction(-0.01, 0.5, g)).toBe(-1);
    expect(cellAtFraction(0.5, 1, g)).toBe(-1);
  });

  it('cell areas shrink northwards and at the partial edges', () => {
    const a = cellAreas(g);
    expect(a[0]).toBeLessThan(a[(g.H - 2) * g.W]); // north row < southern full row
    expect(a[g.W - 1]).toBeLessThan(a[g.W - 2]); // partial east column
    expect(a.every((v) => v > 0)).toBe(true);
  });

  it('edgeOf names the rectangle edges', () => {
    expect(edgeOf(58027, g.W, g.H)).toBe('east edge');
    expect(edgeOf(50, g.W, g.H)).toBe('north edge');
    expect(edgeOf(17991, g.W, g.H)).toBe('');
    expect(edgeOf(0, g.W, g.H)).toBe('north-west edge');
  });
});
