import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  axisCells,
  axisEdges,
  checkMaskFiles,
  checkMaskHashes,
  checkPlanes,
  decodeMask,
  decodePlane,
  maskBit,
  maskHash,
  paintHatch,
  parseMaskHash,
  planeBytes,
  regionsLabel,
  screenAxes,
  upsampleMask,
} from '../../../../src/lib/viz/explorer/basin.ts';
import { basinFacts, inegiNote } from '../../../../src/lib/viz/explorer/about.ts';
import { sha256Hex } from '../../../../src/lib/viz/explorer/data.ts';
import { cellAtFraction, gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import type { BasinMaskFile } from '../../../../src/lib/viz/explorer/types.ts';
import { meta } from './helpers.ts';

/** F12b: the basin mask (stretch S3) — decoding, checks, upsampling, hatching, hash state. */

const DIR = 'public/data/colorado/';
const binFile = readFileSync(DIR + 'basin-mask.bin');
const jsonFile = readFileSync(DIR + 'basin-mask.json');
const bytes = new Uint8Array(binFile.buffer, binFile.byteOffset, binFile.byteLength);
const info = JSON.parse(jsonFile.toString('utf8')) as BasinMaskFile;
const geo = gridGeo(meta);
const toBuf = (b: Buffer) =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** Grid cell of a point, the same way the explorer maps the native footprint (docs/data.md). */
function cellOf(lat: number, lon: number): number {
  const fx = (lon - geo.west) / (geo.east - geo.west);
  const fy = (geo.north - lat) / (geo.north - geo.south);
  return cellAtFraction(fx, fy, geo);
}

/** docs/data.md "Sanity points" table, parsed rather than retyped. */
function gnisPoints(): { place: string; lat: number; lon: number; expected: string }[] {
  const md = readFileSync('docs/data.md', 'utf8');
  const start = md.indexOf('| Place | GNIS ID |');
  const out: { place: string; lat: number; lon: number; expected: string }[] = [];
  for (const line of md.slice(start).split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const c = line.split('|').map((x) => x.trim());
    const [lat, lon] = c[3].split(',').map((v) => Number(v.replace('−', '-')));
    out.push({ place: c[1], lat, lon, expected: c[4] });
  }
  return out;
}

describe('basin-mask.bin decoding (plane 0 / plane 1, LSB first)', () => {
  it('bit i is (byte[i >> 3] >> (i & 7)) & 1', () => {
    const b = new Uint8Array([0b0000_0101, 0b1000_0000, 0b0000_0010, 0]);
    // 10 cells → 2 bytes per plane.
    expect(planeBytes(10)).toBe(2);
    expect(Array.from(decodePlane(b, 10, 0))).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(maskBit(b, 10, 0, 15)).toBe(1); // bit 7 of byte 1 (beyond 10 cells: padding)
    expect(Array.from(decodePlane(b, 10, 1))).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    const m = decodeMask(b, 10);
    expect(Array.from(m.region.slice(0, 3))).toEqual([14, 0, 14]);
    expect(m.count).toBe(2);
  });

  it('checkPlanes catches padding bits, plane 1 outside plane 0 and a wrong count', () => {
    // 10 cells: bits 10..15 of each plane are padding.
    const ok = new Uint8Array([0b101, 0, 0b100, 0]);
    expect(checkPlanes(ok, 10, 2).problems).toEqual([]);
    expect(checkPlanes(new Uint8Array([0b101, 0b100, 0b100, 0]), 10, 2).problems[0]).toMatch(
      /plane 0 has padding/,
    );
    expect(checkPlanes(new Uint8Array([0b101, 0, 0b010, 0]), 10, 2).problems[0]).toMatch(
      /plane 1 has 1 cells outside/,
    );
    expect(checkPlanes(ok, 10, 3).problems[0]).toMatch(/plane 0 has 2 basin cells/);
  });

  it('the committed file passes every check meta.json supports', async () => {
    expect(checkMaskFiles(bytes.length, info, meta).problems).toEqual([]);
    const h = checkMaskHashes(
      await sha256Hex(toBuf(binFile)),
      await sha256Hex(toBuf(jsonFile)),
      meta,
    );
    expect(h.problems).toEqual([]);
    expect(checkPlanes(bytes, meta.cells, meta.basinMask!.basinCells).problems).toEqual([]);
    const m = decodeMask(bytes, meta.cells);
    expect(m.count).toBe(meta.basinMask!.basinCells);
    let r14 = 0;
    let r15 = 0;
    for (const r of m.region) {
      if (r === 14) r14++;
      else if (r === 15) r15++;
    }
    expect(r14).toBe(info.stats.regions['14'].cells);
    expect(r15).toBe(info.stats.regions['15'].cells);
  });

  it('rejects a wrong length, a different grid, and a changed byte', async () => {
    expect(checkMaskFiles(bytes.length - 1, info, meta).ok).toBe(false);
    const other = { ...info, grid: { ...info.grid, sha256: '0'.repeat(64) } };
    expect(checkMaskFiles(bytes.length, other, meta).problems).toContain(
      'basin-mask.json grid SHA-256 ≠ grid.f32 in meta.json',
    );
    const shifted = { ...info, grid: { ...info.grid, width: info.grid.width + 1 } };
    expect(checkMaskFiles(bytes.length, shifted, meta).ok).toBe(false);
    const bad = Buffer.from(binFile);
    bad[5000] ^= 0x10;
    const h = checkMaskHashes(await sha256Hex(toBuf(bad)), null, meta);
    expect(h.problems).toEqual(['basin-mask.bin SHA-256 ≠ meta.json']);
    expect(checkMaskHashes(null, null, meta).ok).toBe(true);
    const noMask = { ...meta, basinMask: undefined };
    expect(checkMaskFiles(bytes.length, info, noMask).problems).toEqual([
      'meta.json has no basinMask entry',
    ]);
  });
});

describe('alignment with known places (docs/data.md GNIS sanity points)', () => {
  const m = decodeMask(bytes, meta.cells);
  const pts = gnisPoints();

  it('parses the table', () => {
    expect(pts.map((p) => p.place)).toContain('Lake Mead');
    expect(pts.map((p) => p.place)).toContain('Great Salt Lake');
  });

  it('Lake Mead is inside (region 15), Great Salt Lake is outside; every on-grid point agrees', () => {
    const mead = pts.find((p) => p.place === 'Lake Mead')!;
    const gsl = pts.find((p) => p.place === 'Great Salt Lake')!;
    expect(m.region[cellOf(mead.lat, mead.lon)]).toBe(15);
    expect(m.inside[cellOf(gsl.lat, gsl.lon)]).toBe(0);
    let checked = 0;
    for (const p of pts) {
      const c = cellOf(p.lat, p.lon);
      if (c < 0) {
        expect(p.expected).toBe('outside'); // Denver, Albuquerque: east of the bbox
        continue;
      }
      const want = p.expected === 'outside' ? 0 : Number(p.expected);
      expect(m.region[c], p.place).toBe(want);
      checked++;
    }
    expect(checked).toBe(10);
  });

  it('the grid minimum (the delta) is inside, as basin-mask.json records', () => {
    expect(m.inside[meta.min.cell]).toBe(1);
  });
});

describe('upsampling', () => {
  it('hillshade resolution: pixel p belongs to cell ⌊p / 3⌋ and every cell edge is a pixel edge', () => {
    const hs = meta.hillshade;
    const per = Math.round(hs.cellDeg / meta.native.pixelDeg); // 10 native px per hillshade px
    const cols = axisCells(hs.width, per, geo.block, geo.W);
    const rows = axisCells(hs.height, per, geo.block, geo.H);
    expect(cols.length).toBe(977);
    expect(rows.length).toBe(1241);
    for (let p = 0; p < cols.length; p++)
      expect(cols[p]).toBe(Math.min(geo.W - 1, Math.floor(p / 3)));
    for (let p = 0; p < rows.length; p++)
      expect(rows[p]).toBe(Math.min(geo.H - 1, Math.floor(p / 3)));
    const ex = axisEdges(cols, geo.W);
    for (let k = 0; k < geo.W; k++) expect(ex[k]).toBe(3 * k);
    expect(ex[geo.W]).toBe(hs.width);
    const m = decodeMask(bytes, meta.cells);
    const up = upsampleMask(m.inside, geo.W, cols, rows);
    for (let py = 0; py < rows.length; py += 7) {
      for (let px = 0; px < cols.length; px += 5) {
        const cell =
          Math.min(geo.H - 1, Math.floor(py / 3)) * geo.W + Math.min(geo.W - 1, Math.floor(px / 3));
        expect(up[py * cols.length + px]).toBe(m.inside[cell]);
      }
    }
  });

  it('screen resolution uses the same cell rule as hover (cellAtFraction)', () => {
    for (const [nx, ny] of [
      [343, 545],
      [686, 1091],
      [1201, 1910],
    ]) {
      const { cols, rows } = screenAxes(nx, ny, geo);
      for (let p = 0; p < nx; p++) {
        const c = cellAtFraction((p + 0.5) / nx, 0.5, geo);
        expect(cols[p]).toBe(c % geo.W);
      }
      for (let p = 0; p < ny; p++) {
        const c = cellAtFraction(0.5, (p + 0.5) / ny, geo);
        expect(rows[p]).toBe(Math.floor(c / geo.W));
      }
      // Monotone, covers every cell, edges strictly increase.
      const ex = axisEdges(cols, geo.W);
      expect(ex[0]).toBe(0);
      expect(ex[geo.W]).toBe(nx);
      for (let k = 1; k <= geo.W; k++) expect(ex[k]).toBeGreaterThanOrEqual(ex[k - 1]);
    }
  });

  it('paintHatch: transparent inside, dim or hatch outside, aligned to the cell under each pixel', () => {
    // 2 × 2 grid, upsampled to 8 × 8; cell 0 and cell 3 inside.
    const inside = new Uint8Array([1, 0, 0, 1]);
    const cols = Int32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);
    const rows = Int32Array.from([0, 0, 0, 0, 1, 1, 1, 1]);
    const px = new Uint32Array(64);
    paintHatch(px, inside, 2, cols, rows, { dim: 7, hatch: 9, period: 4, width: 1 });
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const inCell = inside[rows[y] * 2 + cols[x]];
        const v = px[y * 8 + x];
        if (inCell) expect(v).toBe(0);
        else expect(v).toBe((x + y) % 4 < 1 ? 9 : 7);
      }
    }
  });
});

describe('URL hash state', () => {
  it('parses #mask=basin and leaves section anchors alone (backward compatible)', () => {
    expect(parseMaskHash('#mask=basin')).toBe(true);
    expect(parseMaskHash('mask=basin')).toBe(true);
    expect(parseMaskHash('#mask=off')).toBe(false);
    expect(parseMaskHash('#mask=')).toBe(false);
    expect(parseMaskHash('')).toBe(null);
    expect(parseMaskHash('#lakes')).toBe(null);
    expect(parseMaskHash('#about-data')).toBe(null);
    expect(parseMaskHash('#other=1')).toBe(null);
    expect(parseMaskHash('#mask=bogus')).toBe(null);
  });

  it('writes #mask=basin when on; off clears only a state hash', () => {
    expect(maskHash(true, '')).toBe('#mask=basin');
    expect(maskHash(true, '#lakes')).toBe('#mask=basin');
    expect(maskHash(false, '#mask=basin')).toBe('');
    expect(maskHash(false, '#lakes')).toBe('#lakes');
    expect(maskHash(false, '')).toBe('');
    expect(parseMaskHash(maskHash(true, ''))).toBe(true);
  });
});

describe('copy from basin-mask.json', () => {
  it('label "USGS Watershed Boundary Dataset regions 14–15", never "US portion only"', () => {
    expect(regionsLabel(info.source.regions)).toBe('USGS Watershed Boundary Dataset regions 14–15');
    expect(regionsLabel([{ huc2: '15' }])).toBe('USGS Watershed Boundary Dataset region 15');
    expect(regionsLabel([{ huc2: '14' }, { huc2: '16' }])).toBe(
      'USGS Watershed Boundary Dataset regions 14, 16',
    );
  });

  it('facts and the INEGI note come from the file', () => {
    const f = basinFacts(info, meta);
    expect(f.find((x) => x.label === 'Source')?.value).toBe(info.source.name);
    expect(f.find((x) => x.label === 'Use')?.value).toBe(info.attribution.publicDomain);
    expect(f.filter((x) => x.label.startsWith('Region ')).map((x) => x.href)).toEqual(
      info.source.regions.map((r) => r.url),
    );
    const note = inegiNote(info)!;
    expect(note).toContain('INEGI');
    expect(note).toContain('have been updated to include harmonized hydrologic units');
    expect(note.toLowerCase()).not.toContain('us portion');
    expect(inegiNote({ ...info, coverage: ['nothing about Mexico'] })).toBe(null);
  });
});
