import { hexToRgb, mixRgb, packRgb, rampRgb, type RGB } from '../common/color.ts';
import type { PaletteTheme } from '../common/palettes.ts';

/**
 * Map pixels for the hero, at one pixel per grid cell (the canvas scales it up). All buffers
 * and colour tables are allocated when the terrain or palette changes, never per frame.
 */

export type ColorBy = 'lake' | 'depth';

/** The parts of the engine's Flood the painter reads. */
export interface FloodView {
  readonly wetCount: number;
  componentOf(i: number): number;
}

export interface PaintOptions {
  level: number;
  colorBy: ColorBy;
  shoreline: boolean;
  /** Lake id (birth cell) to outline, or −1. */
  highlight: number;
  /**
   * When the highlighted lake has already merged, its basin just before it died (1 = in lake);
   * null while it is still alive (then membership is componentOf(i) === highlight).
   */
  highlightMask: Uint8Array | null;
}

/** Depth in metres at which water reaches the deepest shade. */
export const FULL_DEPTH_M = 220;
const DEPTH_STEPS = 32;

export class MapPainter {
  readonly W: number;
  readonly H: number;
  readonly n: number;
  /** comp[i] = lake id of cell i after the last paint (−1 = dry). Read by hover readouts. */
  readonly comp: Int32Array;
  private heights: Float32Array;
  private rank: Uint32Array;
  private slotOf: Int16Array;
  private land: Uint32Array;
  private shade: Float32Array;
  private minH = 0;
  private maxH = 1;
  private K = 1;
  private waterLut = new Uint32Array(DEPTH_STEPS);
  private shoreLut = new Uint32Array(1);
  private depthLut = new Uint32Array(DEPTH_STEPS);
  private depthShore = 0;
  private outline = 0;
  private halo = 0;

  constructor(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.n = W * H;
    this.comp = new Int32Array(this.n);
    this.heights = new Float32Array(this.n);
    this.rank = new Uint32Array(this.n);
    this.slotOf = new Int16Array(this.n);
    this.land = new Uint32Array(this.n);
    this.shade = new Float32Array(this.n);
  }

  /** New terrain: heights, the engine's rank array, hillshade and lake slots. */
  setTerrain(
    heights: Float32Array,
    rank: Uint32Array,
    shade: Float32Array,
    slotOf: Int16Array,
    minH: number,
    maxH: number,
  ): void {
    if (heights.length !== this.n) throw new RangeError('terrain size mismatch');
    this.heights = heights;
    this.rank = rank;
    this.shade = shade;
    this.slotOf = slotOf;
    this.minH = minH;
    this.maxH = maxH > minH ? maxH : minH + 1;
  }

  /**
   * Palette or theme change: rebuilds the land pixels (tint × hillshade) and the water tables.
   * `outline`/`halo` are the highlight ring colours (page text and background).
   */
  setColors(theme: PaletteTheme, outline: string, halo: string, dark: boolean): void {
    const landStops = theme.land.map(hexToRgb);
    const span = this.maxH - this.minH;
    for (let i = 0; i < this.n; i++) {
      const t = (this.heights[i] - this.minH) / span;
      const c = rampRgb(landStops, t);
      // Hillshade: 0.5 is flat ground; brighten lit slopes and darken shaded ones.
      const s = this.shade[i];
      const k = dark ? 0.55 + 0.9 * s : 0.72 + 0.5 * s;
      this.land[i] = packRgb(clamp8(c[0] * k), clamp8(c[1] * k), clamp8(c[2] * k));
    }
    const K = theme.identity.length;
    this.K = K;
    this.waterLut = new Uint32Array(K * DEPTH_STEPS);
    this.shoreLut = new Uint32Array(K);
    const shore = hexToRgb(theme.shoreline);
    const deep: RGB = dark ? [0, 0, 0] : [8, 16, 28];
    for (let k = 0; k < K; k++) {
      const base = hexToRgb(theme.identity[k]);
      for (let s = 0; s < DEPTH_STEPS; s++) {
        // Shallow water is slightly lighter, deep water slightly darker; identity stays clear.
        const t = s / (DEPTH_STEPS - 1);
        const c =
          t < 0.25
            ? mixRgb(base, [255, 255, 255], (0.25 - t) * 0.5)
            : mixRgb(base, deep, (t - 0.25) * 0.4);
        this.waterLut[k * DEPTH_STEPS + s] = packed(c);
      }
      this.shoreLut[k] = packed(mixRgb(base, shore, 0.55));
    }
    const depthStops = theme.depth.map(hexToRgb);
    for (let s = 0; s < DEPTH_STEPS; s++) {
      this.depthLut[s] = packed(rampRgb(depthStops, s / (DEPTH_STEPS - 1)));
    }
    this.depthShore = packed(mixRgb(depthStops[depthStops.length - 1], shore, 0.5));
    this.outline = packed(hexToRgb(outline));
    this.halo = packed(hexToRgb(halo));
  }

  /** Identity colour index of lake `lake` (birth cell), as used for its water pixels. */
  slot(lake: number): number {
    const s = this.slotOf[lake];
    return s < 0 ? 0 : s % this.K;
  }

  /** Paint every cell into `out` (length W·H, packed RGBA). No allocation. */
  paint(out: Uint32Array, flood: FloodView, o: PaintOptions): void {
    const { W, H, n, comp, heights, rank, land } = this;
    const wet = flood.wetCount;
    for (let i = 0; i < n; i++) comp[i] = rank[i] < wet ? flood.componentOf(i) : -1;
    const level = o.level;
    const byDepth = o.colorBy === 'depth';
    const shoreOn = o.shoreline;
    const hl = o.highlight;
    const mask = o.highlightMask;
    const waterLut = this.waterLut;
    const shoreLut = this.shoreLut;
    const depthLut = this.depthLut;
    const slotOf = this.slotOf;
    const K = this.K;
    const depthScale = (DEPTH_STEPS - 1) / FULL_DEPTH_M;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const c = comp[i];
        let px: number;
        if (c < 0) {
          px = land[i];
        } else {
          let s = ((level - heights[i]) * depthScale) | 0;
          if (s < 0) s = 0;
          else if (s >= DEPTH_STEPS) s = DEPTH_STEPS - 1;
          let slot = slotOf[c];
          slot = slot < 0 ? 0 : slot % K;
          px = byDepth ? depthLut[s] : waterLut[slot * DEPTH_STEPS + s];
          if (shoreOn) {
            const dry =
              (y > 0 && comp[i - W] < 0) ||
              (y < H - 1 && comp[i + W] < 0) ||
              (x > 0 && comp[i - 1] < 0) ||
              (x < W - 1 && comp[i + 1] < 0);
            if (dry) px = byDepth ? this.depthShore : shoreLut[slot];
          }
        }
        if (hl >= 0) {
          const inside = mask ? mask[i] === 1 : c === hl;
          let edge = false;
          if (y > 0 && inside !== (mask ? mask[i - W] === 1 : comp[i - W] === hl)) edge = true;
          else if (y < H - 1 && inside !== (mask ? mask[i + W] === 1 : comp[i + W] === hl))
            edge = true;
          else if (x > 0 && inside !== (mask ? mask[i - 1] === 1 : comp[i - 1] === hl)) edge = true;
          else if (x < W - 1 && inside !== (mask ? mask[i + 1] === 1 : comp[i + 1] === hl))
            edge = true;
          // Two-tone ring: text colour inside the lake's edge, background colour just outside,
          // so the outline reads against any water or land colour.
          if (edge) px = inside ? this.outline : this.halo;
        }
        out[i] = px;
      }
    }
  }
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function packed(c: RGB): number {
  return packRgb(clamp8(c[0]), clamp8(c[1]), clamp8(c[2]));
}
