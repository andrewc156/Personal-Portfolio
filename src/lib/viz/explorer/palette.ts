import { hexToRgb } from '../common/color.ts';
import type { ThemeName } from '../common/palettes.ts';
import { IDENTITY_K } from './model.ts';

/**
 * Explorer colours. IDENTITY[theme][0] is the lowest lake, [r] the r-th longest-lived finite lake.
 * Chosen by a greedy max–min search, then checked in tests/unit/viz/explorer/palette.test.ts:
 * - minimum pairwise CIEDE2000 ≥ 10 with normal vision and simulated protanopia, deuteranopia and
 *   tritanopia (Machado et al. 2009, severity 1.0), also against the neutral water colour;
 * - ≥ 3:1 contrast against the strip background (--color-surface).
 * Colour is never the only cue: identity lakes carry number labels on the map, and a selected
 * lake gets an outline, pit and pass markers and a label.
 */
export const IDENTITY: Record<ThemeName, readonly string[]> = {
  light: [
    '#1f5f99',
    '#8b0200',
    '#b38930',
    '#8c88bf',
    '#9e5852',
    '#0ba095',
    '#c12b00',
    '#6f6aec',
    '#0000fa',
    '#6f3b63',
    '#ef5788',
    '#7d2037',
  ],
  dark: [
    '#5aa9e6',
    '#cce827',
    '#87801e',
    '#52f1ff',
    '#cb8099',
    '#746ff1',
    '#b6eb9f',
    '#3f8d60',
    '#b5aa07',
    '#95b077',
    '#ffb2c1',
    '#e235a4',
  ],
};

/** The one colour every other lake shares on the map. */
export const NEUTRAL_WATER: Record<ThemeName, string> = { light: '#b4c8e0', dark: '#105054' };

/** Map overlay opacity (0–255): identity lakes, neutral lakes. */
export const WATER_ALPHA = { identity: 200, neutral: 190 } as const;

if (IDENTITY.light.length !== IDENTITY_K || IDENTITY.dark.length !== IDENTITY_K) {
  throw new Error('IDENTITY must have IDENTITY_K colours per theme');
}

/** Pack a colour with alpha for a Uint32Array view over ImageData (little-endian RGBA). */
export function packRgba(hex: string, alpha: number): number {
  const [r, g, b] = hexToRgb(hex);
  return (((alpha & 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
