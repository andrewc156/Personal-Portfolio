import { describe, expect, it } from 'vitest';
import {
  attributionBlocks,
  blockText,
  dataFacts,
  linkify,
  parseAttribution,
} from '../../../../src/lib/viz/explorer/about.ts';
import {
  contrast,
  hexToRgb,
  minPairwiseDeltaE,
  type CvdKind,
} from '../../../../src/lib/viz/common/color.ts';
import { SURFACE } from '../../../../src/lib/viz/common/palettes.ts';
import { barsFromFile } from '../../../../src/lib/viz/explorer/data.ts';
import { gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import { indexLakes, IDENTITY_K } from '../../../../src/lib/viz/explorer/model.ts';
import { IDENTITY, NEUTRAL_WATER, packRgba } from '../../../../src/lib/viz/explorer/palette.ts';
import {
  fmt,
  hoverText,
  infoCard,
  lakeRows,
  length,
  lengthBoth,
  M_PER_FT,
  MINUS,
  NBSP,
  readouts,
  stripLabel,
  summaryText,
  toFeet,
} from '../../../../src/lib/viz/explorer/text.ts';
import { attributionMd, barcode, docLakes, meta } from './helpers.ts';

const g = gridGeo(meta);
const index = indexLakes(barsFromFile(barcode));
const plain = (s: string) => s.replaceAll(NBSP, ' ');

describe('units and number formatting', () => {
  it('converts with the international foot and joins number and unit with a no-break space', () => {
    expect(M_PER_FT).toBe(0.3048);
    expect(toFeet(0.3048)).toBeCloseTo(1, 12);
    expect(length(1671.5, 'm')).toBe(`1,671.5${NBSP}m`);
    expect(length(1671.5, 'ft')).toBe(`5,484${NBSP}ft`);
    expect(lengthBoth(1000, 'ft')).toBe(`3,281${NBSP}ft (1,000.0${NBSP}m)`);
    expect(length(-2.885, 'm')).toBe(`${MINUS}2.9${NBSP}m`);
    expect(fmt(-0.01, 1)).toBe('0.0');
  });

  it('readouts', () => {
    const r = readouts(1671.5, 49.94, 17, 50.47, 'm');
    expect(r).toEqual({
      level: `1,671.5${NBSP}m`,
      levelAlt: `5,484${NBSP}ft`,
      percentile: '49.9',
      lakes: '17',
      area: `50.5${NBSP}%`,
    });
  });
});

describe('info card (values from the data)', () => {
  it('reproduces docs/data.md for the 10 longest-lived lakes', () => {
    for (const row of docLakes()) {
      const bar = index.ranked[row.rank - 1];
      const card = infoCard(bar, index, g, 'm');
      const text = plain(card.text);
      expect(plain(card.title)).toBe(`Lake ${row.rank} · birth cell ${row.birthCell}`);
      const num = (s: string) => fmt(Number(s), 1);
      expect(text).toBe(
        `Born at ${num(row.birth)} m near ${row.birthWhere}, merged at ${num(row.death)} m at ` +
          `${row.deathWhere} into the lowest lake (cell ${row.into}), persistence ${row.persistence} m.`,
      );
    }
  });

  it('names the absorbing lake by rank when it is not the lowest lake', () => {
    const bar = index.ranked.find((b) => b.mergedInto !== meta.min.cell)!;
    const r = index.rankOf.get(bar.mergedInto)!;
    expect(r).toBeGreaterThan(0);
    expect(plain(infoCard(bar, index, g, 'm').text)).toContain(
      `into lake ${r} (cell ${bar.mergedInto})`,
    );
  });

  it('the lowest lake never merges', () => {
    const card = infoCard(index.essential!, index, g, 'ft');
    expect(plain(card.title)).toBe(`The lowest lake · birth cell ${meta.min.cell}`);
    expect(card.text).toContain('never merges');
    expect(card.text).not.toContain('merged at');
    expect(plain(card.text)).toContain('31.9454° N, 114.7646° W');
  });

  it('feet', () => {
    const card = infoCard(index.ranked[2], index, g, 'ft');
    expect(card.text).toContain(`${fmt(toFeet(index.ranked[2].birth), 0)}${NBSP}ft`);
  });
});

describe('table rows, hover, summary, labels', () => {
  it('lowest lake plus the top n', () => {
    const rows = lakeRows(index, g, 20, 'm');
    expect(rows).toHaveLength(21);
    expect(rows[0].rank).toBe(0);
    expect(rows[0].death).toBe('never');
    expect(rows[1].edge).toBe('east edge');
    expect(rows.slice(1).map((r) => r.rank)).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
  });

  it('hover text', () => {
    const t = plain(hoverText(meta.max.cell, meta.max.value, g, null, 'm'));
    expect(t).toContain('3,697.8 m');
    expect(t).toContain('37.8454° N, 107.4146° W');
    expect(t).toContain('dry');
    const w = plain(hoverText(17991, 1275.7, g, { rank: 3, cell: 17991 }, 'm'));
    expect(w).toContain('under water, lake 3');
  });

  it('summary mentions state, level, lakes and the selection', () => {
    const s = summaryText({
      playing: false,
      level: 100,
      percentile: 2,
      lakes: 1,
      areaPct: 2.5,
      units: 'm',
      pacing: 'percentile',
      view: 'barcode',
      rows: 40,
      selected: { title: 'Lake 3', text: 'Born at …' },
    });
    expect(s).toMatch(/^Paused\. Water level 100\.0/);
    expect(s).toContain('1 lake;');
    expect(s).toContain('Selected: Lake 3.');
  });

  it('strip label follows the view', () => {
    expect(stripLabel('barcode')).toMatch(/^Barcode:/);
    expect(stripLabel('diagram')).toMatch(/^Persistence diagram:/);
  });
});

describe('About the data (from meta.json and ATTRIBUTION.md)', () => {
  it('keeps the required notice verbatim as a quote', () => {
    const blocks = attributionBlocks(attributionMd, meta);
    const quote = blocks.find((b) => b.kind === 'quote')!;
    expect(blockText(quote)).toBe(meta.licence.requiredNotice);
    // Every non-heading line of ATTRIBUTION.md survives (whitespace-normalised).
    const all = blocks.map(blockText).join(' ').replace(/\s+/g, ' ');
    for (const line of attributionMd.split('\n')) {
      const t = line.replace(/^#+\s*|^>\s?/, '').trim();
      if (!t || line.startsWith('# ')) continue;
      expect(all).toContain(t.replace(/\s+/g, ' '));
    }
  });

  it('fails the build if the notice is altered', () => {
    expect(() =>
      attributionBlocks(attributionMd.replace('all rights reserved', 'some rights'), meta),
    ).toThrow();
  });

  it('linkify keeps trailing punctuation out of URLs', () => {
    const s = linkify('see https://example.org/a. And (https://x.y/z) end');
    expect(s.filter((x) => x.href).map((x) => x.href)).toEqual([
      'https://example.org/a',
      'https://x.y/z',
    ]);
    expect(s.map((x) => x.text).join('')).toBe(
      'see https://example.org/a. And (https://x.y/z) end',
    );
  });

  it('parses headings, paragraphs and quotes', () => {
    const b = parseAttribution('# T\n\nA\nB\n\n> q1\n> q2\n');
    expect(b.map((x) => [x.kind, blockText(x)])).toEqual([
      ['heading', 'T'],
      ['paragraph', 'A B'],
      ['quote', 'q1 q2'],
    ]);
  });

  it('facts come from meta.json', () => {
    const f = dataFacts(meta);
    expect(f.find((x) => x.label === 'Study area')?.value).toBe(
      'Colorado River Basin study area (RiverNets coverage)',
    );
    expect(f.find((x) => x.label === 'Licence')?.href).toBe(meta.licence.url);
    expect(f.find((x) => x.label === 'Vertical datum')?.value).toBe(meta.verticalDatum);
  });
});

describe('explorer palette', () => {
  const KINDS: (CvdKind | undefined)[] = [undefined, 'protanopia', 'deuteranopia', 'tritanopia'];
  for (const theme of ['light', 'dark'] as const) {
    const ids = IDENTITY[theme].map(hexToRgb);
    it(`${theme}: ${IDENTITY_K} identity colours`, () => expect(ids).toHaveLength(IDENTITY_K));
    for (const kind of KINDS) {
      it(`${theme}: identity + neutral ΔE2000 ≥ 10 (${kind ?? 'normal vision'})`, () => {
        expect(minPairwiseDeltaE(ids, kind)).toBeGreaterThanOrEqual(10);
        expect(
          minPairwiseDeltaE([...ids, hexToRgb(NEUTRAL_WATER[theme])], kind),
        ).toBeGreaterThanOrEqual(10);
      });
    }
    it(`${theme}: ≥ 3:1 contrast on the strip`, () => {
      const bg = hexToRgb(SURFACE[theme]);
      for (const c of ids) expect(contrast(c, bg)).toBeGreaterThanOrEqual(3);
    });
  }

  it('packRgba packs little-endian RGBA', () => {
    expect(packRgba('#102030', 200)).toBe(((200 << 24) | (0x30 << 16) | (0x20 << 8) | 0x10) >>> 0);
  });
});
