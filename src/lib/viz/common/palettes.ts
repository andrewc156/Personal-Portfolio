/**
 * Art palettes (spec §4.2): Delta, Canyon, Glacier, Estuary, Mono, each with a light and a dark
 * variant. `identity` is the categorical lake-identity set. Every identity set is checked in
 * tests/unit/viz/palettes.test.ts:
 * - minimum pairwise CIEDE2000 ≥ IDENTITY_MIN_DELTA_E with normal vision and under simulated
 *   protanopia, deuteranopia and tritanopia (Machado et al. 2009, severity 1.0, linear RGB);
 * - contrast ≥ 3:1 (WCAG non-text) against the barcode strip background (--color-surface).
 * Colour is never the only cue: a highlighted lake also gets an outline and a label.
 */

export type ThemeName = 'light' | 'dark';
export type PaletteName = 'delta' | 'canyon' | 'glacier' | 'estuary' | 'mono';

export interface PaletteTheme {
  /** Land elevation tint, low → high. */
  land: readonly string[];
  /** Lake identity colours (categorical). */
  identity: readonly string[];
  /** "Color by depth" ramp, shallow → deep. */
  depth: readonly string[];
  /** Shoreline outline colour (blended with the water colour). */
  shoreline: string;
}

export interface Palette {
  name: PaletteName;
  label: string;
  light: PaletteTheme;
  dark: PaletteTheme;
}

export const IDENTITY_MIN_DELTA_E = 10;
export const IDENTITY_MIN_CONTRAST = 3;

/** Barcode strip backgrounds: must match --color-surface in src/styles/tokens.css (tested). */
export const SURFACE: Record<ThemeName, string> = { light: '#fdfbf7', dark: '#1a1d20' };

const DEPTH_LIGHT = ['#a9cbe0', '#5b93bb', '#1f5f8f', '#0b3557'];
const DEPTH_DARK = ['#1d3a50', '#2a6a93', '#58a6d6', '#a9d8f5'];

export const PALETTES: readonly Palette[] = [
  {
    name: 'delta',
    label: 'Delta',
    light: {
      land: ['#e9e2d3', '#d6c9ae', '#b9a684', '#8f7d60'],
      identity: ['#1f5f99', '#b5531f', '#178257', '#673247', '#171782', '#8f1919'],
      depth: DEPTH_LIGHT,
      shoreline: '#1c1b19',
    },
    dark: {
      land: ['#23221f', '#34312b', '#4a453b', '#686052'],
      identity: ['#5aa9e6', '#f0a04b', '#badcb7', '#ce2c7d', '#8f763d', '#5664e1'],
      depth: DEPTH_DARK,
      shoreline: '#e8e5df',
    },
  },
  {
    name: 'canyon',
    label: 'Canyon',
    light: {
      land: ['#f0dfcb', '#e0bf9c', '#c69470', '#9a6a4a'],
      identity: ['#2d5f7a', '#a0441f', '#178277', '#a145de', '#171782', '#673242'],
      depth: DEPTH_LIGHT,
      shoreline: '#2a1a12',
    },
    dark: {
      land: ['#2a201b', '#3d2c22', '#58402f', '#7a5a43'],
      identity: ['#7fb6d0', '#e07a52', '#efefa4', '#755bdc', '#42838a', '#d7b1ac'],
      depth: DEPTH_DARK,
      shoreline: '#f0e4d8',
    },
  },
  {
    name: 'glacier',
    label: 'Glacier',
    light: {
      land: ['#eef1f2', '#d8e0e4', '#b9c6ce', '#8d9ea9'],
      identity: ['#1d6a8a', '#8a5a1d', '#171782', '#7a1f28', '#a145de', '#da2b5f'],
      depth: DEPTH_LIGHT,
      shoreline: '#10202a',
    },
    dark: {
      land: ['#1b1f23', '#262d33', '#36414a', '#4f5e69'],
      identity: ['#7cc4e0', '#e0b07c', '#6c60d7', '#946647', '#3d8f87', '#9e932e'],
      depth: DEPTH_DARK,
      shoreline: '#e6eef2',
    },
  },
  {
    name: 'estuary',
    label: 'Estuary',
    light: {
      land: ['#e8e6d2', '#cfd2ae', '#a9b286', '#7f8a62'],
      identity: ['#1f7a6a', '#7a6a10', '#391b7e', '#7b5bc8', '#6b2e2e', '#d02569'],
      depth: DEPTH_LIGHT,
      shoreline: '#1a1f14',
    },
    dark: {
      land: ['#1f221c', '#2c3126', '#3f4734', '#5a6448'],
      identity: ['#5cc6a4', '#d9c35a', '#7e5ec9', '#996633', '#b6a9ea', '#428a7b'],
      depth: DEPTH_DARK,
      shoreline: '#e8ecdc',
    },
  },
  {
    name: 'mono',
    label: 'Mono',
    light: {
      land: ['#f2f1ee', '#dcdad5', '#bdbab3', '#94918a'],
      identity: ['#14283a', '#2e4d66', '#4d6f8c', '#6e8ba6'],
      depth: ['#c4ccd3', '#8a98a5', '#4f5f6e', '#1c2833'],
      shoreline: '#111111',
    },
    dark: {
      land: ['#1c1c1c', '#2a2a2a', '#3d3d3d', '#585858'],
      identity: ['#5d6f80', '#8b9dad', '#bdcad6', '#f5f7f9'],
      depth: ['#2b3640', '#4f6070', '#8597a8', '#c8d4de'],
      shoreline: '#f2f2f2',
    },
  },
];

export const DEFAULT_PALETTE: PaletteName = 'delta';

export function getPalette(name: string): Palette {
  return PALETTES.find((p) => p.name === name) ?? PALETTES[0];
}
