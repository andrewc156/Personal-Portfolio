import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  contrast,
  hexToRgb,
  minPairwiseDeltaE,
  type CvdKind,
} from '../../../src/lib/viz/common/color.ts';
import {
  IDENTITY_MIN_CONTRAST,
  IDENTITY_MIN_DELTA_E,
  PALETTES,
  SURFACE,
} from '../../../src/lib/viz/common/palettes.ts';

/**
 * Lake identity colours (spec §4.2): distinguishable with normal vision and under simulated
 * protanopia, deuteranopia and tritanopia (Machado et al. 2009, severity 1.0, linear RGB),
 * measured as the minimum pairwise CIEDE2000 within each palette and theme. Each colour also
 * has ≥ 3:1 contrast against the barcode strip background (WCAG 1.4.11 non-text contrast).
 */
const KINDS: (CvdKind | undefined)[] = [undefined, 'protanopia', 'deuteranopia', 'tritanopia'];

describe('palettes', () => {
  it('has the five named palettes', () => {
    expect(PALETTES.map((p) => p.label)).toEqual(['Delta', 'Canyon', 'Glacier', 'Estuary', 'Mono']);
  });

  it('SURFACE matches --color-surface in tokens.css for both themes', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    const all = [...css.matchAll(/--color-surface:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
    expect(all[0]).toBe(SURFACE.light);
    expect(all.slice(1).every((c) => c === SURFACE.dark)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  for (const p of PALETTES) {
    for (const theme of ['light', 'dark'] as const) {
      const cs = p[theme].identity.map(hexToRgb);
      for (const kind of KINDS) {
        it(`${p.label} ${theme}: identity colours ΔE2000 ≥ ${IDENTITY_MIN_DELTA_E} (${kind ?? 'normal vision'})`, () => {
          expect(cs.length).toBeGreaterThanOrEqual(4);
          expect(minPairwiseDeltaE(cs, kind)).toBeGreaterThanOrEqual(IDENTITY_MIN_DELTA_E);
        });
      }
      it(`${p.label} ${theme}: identity colours have ≥ 3:1 contrast on the strip`, () => {
        const bg = hexToRgb(SURFACE[theme]);
        for (const c of cs) expect(contrast(c, bg)).toBeGreaterThanOrEqual(IDENTITY_MIN_CONTRAST);
      });
      it(`${p.label} ${theme}: ramps parse`, () => {
        for (const h of [...p[theme].land, ...p[theme].depth, p[theme].shoreline]) hexToRgb(h);
      });
    }
  }
});
