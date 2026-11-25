import { mulberry32 } from '../../common/rng.ts';
import { gridSize } from '../terrain.ts';
import { PixelGrid, packMix, rgbOf } from './pixels.ts';
import type { ModeColors, ModeSim } from './types.ts';

/**
 * Fractal pond: the 2-D wave equation u_tt = c²∇²u inside a Koch-snowflake pond with fixed
 * walls (u = 0 on and beyond the shore, so waves reflect).
 *
 * Scheme: explicit leapfrog with the 5-point Laplacian on unit cells,
 *   u⁺ = 2u − u⁻ + C²·Δu   (optionally with light damping),
 * where C = c·Δt/Δx is the Courant number. In 2-D this is stable only for C ≤ 1/√2 (CFL); the
 * pond uses C = 0.5. Without damping the scheme conserves the discrete energy
 *   E = ½ Σ (u⁺ − u)² + ½ C² Σ_edges (u⁺_a − u⁺_b)(u_a − u_b),
 * which tests/unit/viz/modes/pond.test.ts checks along with blow-up above the CFL limit.
 */

export const MAX_COURANT = Math.SQRT1_2;
export const POND_COURANT = 0.5;
export const POND_STEP_HZ = 120;
/** Per-step damping (amplitude falls by e after ~1 / POND_DAMPING steps). */
export const POND_DAMPING = 0.0018;
const DROP_AMP = 1;
const DROP_RADIUS = 1.6;
/** Automatic drops arrive every AUTO_MIN … AUTO_MIN + AUTO_SPREAD steps. */
const AUTO_MIN = 130;
const AUTO_SPREAD = 120;
export const POND_WARM_STEPS = 150;

/**
 * Koch snowflake polygon (x, y pairs, y down) of the given level: an equilateral triangle
 * whose every edge is replaced, `level` times, by four edges with an outward bump.
 * Level 0 has 3 vertices; level n has 3·4ⁿ.
 */
export function kochSnowflake(level: number): Float64Array {
  // Clockwise on screen (y down) = counter-clockwise in y-up maths; outward is to the left of
  // each edge in screen terms, which the −60° rotation below produces.
  let pts: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
    pts.push(Math.cos(a), Math.sin(a));
  }
  const c = Math.cos(-Math.PI / 3);
  const s = Math.sin(-Math.PI / 3);
  for (let l = 0; l < level; l++) {
    const next: number[] = [];
    const n = pts.length / 2;
    for (let k = 0; k < n; k++) {
      const ax = pts[2 * k];
      const ay = pts[2 * k + 1];
      const bx = pts[(2 * (k + 1)) % (2 * n)];
      const by = pts[(2 * (k + 1) + 1) % (2 * n)];
      const dx = (bx - ax) / 3;
      const dy = (by - ay) / 3;
      const p1x = ax + dx;
      const p1y = ay + dy;
      next.push(
        ax,
        ay,
        p1x,
        p1y,
        p1x + c * dx - s * dy,
        p1y + s * dx + c * dy,
        ax + 2 * dx,
        ay + 2 * dy,
      );
    }
    pts = next;
  }
  return Float64Array.from(pts);
}

/** Shoelace area of a polygon given as (x, y) pairs (absolute value). */
export function polygonArea(poly: Float64Array): number {
  const n = poly.length / 2;
  let a = 0;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    a += poly[2 * k] * poly[2 * j + 1] - poly[2 * j] * poly[2 * k + 1];
  }
  return Math.abs(a) / 2;
}

/**
 * Rasterise a polygon onto a W × H grid: mask[i] = 1 where the cell centre is inside (even–odd
 * rule, by scanline). `poly` is already in cell coordinates.
 */
export function rasterize(poly: Float64Array, W: number, H: number): Uint8Array {
  const mask = new Uint8Array(W * H);
  const n = poly.length / 2;
  const xs = new Float64Array(n);
  for (let j = 0; j < H; j++) {
    const y = j + 0.5;
    let m = 0;
    for (let k = 0; k < n; k++) {
      const ax = poly[2 * k];
      const ay = poly[2 * k + 1];
      const q = (k + 1) % n;
      const bx = poly[2 * q];
      const by = poly[2 * q + 1];
      if (ay <= y !== by <= y) xs[m++] = ax + ((y - ay) / (by - ay)) * (bx - ax);
    }
    const row = xs.subarray(0, m).sort();
    for (let p = 0; p + 1 < m; p += 2) {
      const x0 = Math.max(0, Math.ceil(row[p] - 0.5));
      const x1 = Math.min(W - 1, Math.floor(row[p + 1] - 0.5));
      for (let i = x0; i <= x1; i++) mask[j * W + i] = 1;
    }
  }
  return mask;
}

/**
 * The wave field. Cells outside `mask` (and the grid border) are walls with u = 0. Pure, no DOM.
 */
export class WaveField {
  readonly W: number;
  readonly H: number;
  readonly mask: Uint8Array;
  /** Indices of water cells, in row order. */
  readonly inside: Int32Array;
  readonly c2: number;
  damping: number;
  u: Float32Array;
  prev: Float32Array;
  private next: Float32Array;

  constructor(W: number, H: number, mask: Uint8Array, courant = POND_COURANT, damping = 0) {
    if (!(courant > 0 && courant <= MAX_COURANT)) {
      throw new RangeError(`Courant number ${courant} breaks the 2-D CFL limit 1/√2`);
    }
    this.W = W;
    this.H = H;
    this.mask = mask.slice();
    // The border is always wall, so neighbour reads never leave the grid.
    for (let i = 0; i < W; i++) this.mask[i] = this.mask[(H - 1) * W + i] = 0;
    for (let j = 0; j < H; j++) this.mask[j * W] = this.mask[j * W + W - 1] = 0;
    let n = 0;
    for (let i = 0; i < W * H; i++) n += this.mask[i];
    this.inside = new Int32Array(n);
    n = 0;
    for (let i = 0; i < W * H; i++) if (this.mask[i]) this.inside[n++] = i;
    this.c2 = courant * courant;
    this.damping = damping;
    this.u = new Float32Array(W * H);
    this.prev = new Float32Array(W * H);
    this.next = new Float32Array(W * H);
  }

  /**
   * Unchecked constructor for tests that need to show what breaks above the CFL limit.
   * @internal
   */
  static unchecked(W: number, H: number, mask: Uint8Array, courant: number): WaveField {
    const f = new WaveField(W, H, mask, POND_COURANT, 0);
    (f as { c2: number }).c2 = courant * courant;
    return f;
  }

  step(): void {
    const { u, prev, next, inside, W, c2 } = this;
    const keep = 1 - this.damping;
    for (let q = 0; q < inside.length; q++) {
      const i = inside[q];
      const lap = u[i - 1] + u[i + 1] + u[i - W] + u[i + W] - 4 * u[i];
      next[i] = u[i] + keep * (u[i] - prev[i]) + c2 * lap;
    }
    this.prev = u;
    this.u = next;
    this.next = prev;
  }

  /** A Gaussian bump at (x, y) (cell units), starting at rest. False if (x, y) is on land. */
  drop(x: number, y: number, amp = DROP_AMP, radius = DROP_RADIUS): boolean {
    const { W, H, mask, u, prev } = this;
    const ci = Math.floor(x);
    const cj = Math.floor(y);
    if (ci < 0 || cj < 0 || ci >= W || cj >= H || !mask[cj * W + ci]) return false;
    const R = Math.ceil(radius * 3);
    const inv = 1 / (2 * radius * radius);
    for (let j = Math.max(0, cj - R); j <= Math.min(H - 1, cj + R); j++) {
      for (let i = Math.max(0, ci - R); i <= Math.min(W - 1, ci + R); i++) {
        const k = j * W + i;
        if (!mask[k]) continue;
        const dx = i + 0.5 - x;
        const dy = j + 0.5 - y;
        const b = amp * Math.exp(-(dx * dx + dy * dy) * inv);
        u[k] += b;
        prev[k] += b;
      }
    }
    return true;
  }

  /** Discrete energy at the half step between `prev` and `u` (conserved without damping). */
  energy(): number {
    const { u, prev, W, H, c2 } = this;
    let kin = 0;
    let pot = 0;
    for (let i = 0; i < W * H; i++) {
      const d = u[i] - prev[i];
      kin += d * d;
    }
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (i + 1 < W) pot += (u[k + 1] - u[k]) * (prev[k + 1] - prev[k]);
        if (j + 1 < H) pot += (u[k + W] - u[k]) * (prev[k + W] - prev[k]);
      }
    }
    return 0.5 * kin + 0.5 * c2 * pot;
  }

  maxAbs(): number {
    let m = 0;
    for (let q = 0; q < this.inside.length; q++) m = Math.max(m, Math.abs(this.u[this.inside[q]]));
    return m;
  }
}

/** Fit the snowflake into a W × H grid, centred, with a margin; optional rotation. */
export function pondPolygon(W: number, H: number, level: number, rotation: number): Float64Array {
  const base = kochSnowflake(level);
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const p = new Float64Array(base.length);
  for (let k = 0; k < base.length; k += 2) {
    const x = c * base[k] - s * base[k + 1];
    const y = s * base[k] + c * base[k + 1];
    p[k] = x;
    p[k + 1] = y;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const margin = 2;
  const scale = Math.min((W - 2 * margin) / (x1 - x0), (H - 2 * margin) / (y1 - y0));
  const ox = W / 2 - (scale * (x0 + x1)) / 2;
  const oy = H / 2 - (scale * (y0 + y1)) / 2;
  for (let k = 0; k < p.length; k += 2) {
    p[k] = ox + scale * p[k];
    p[k + 1] = oy + scale * p[k + 1];
  }
  return p;
}

const LUT_STEPS = 256;
const RIPPLE_GAIN = 5;
const SLOPE_GAIN = 6;

export class PondSim implements ModeSim {
  readonly id = 'pond' as const;
  readonly interactive = true;
  readonly stepHz = POND_STEP_HZ;
  field!: WaveField;
  level = 4;
  drops = 0;
  userDrops = 0;
  private rand: () => number = Math.random;
  private nextAuto = 0;
  private steps = 0;
  private grid = new PixelGrid();
  private lut = new Uint32Array(LUT_STEPS);
  private land = new Uint32Array(0);
  private colors: ModeColors | null = null;

  build(seed: number, cssW: number, cssH: number): void {
    const { W, H } = gridSize(cssW, cssH);
    this.rand = mulberry32((seed ^ 0x3c6ef372) >>> 0);
    this.level = H >= 56 ? 4 : 3;
    const rot = (this.rand() * Math.PI) / 3;
    const mask = rasterize(pondPolygon(W, H, this.level, rot), W, H);
    this.field = new WaveField(W, H, mask, POND_COURANT, POND_DAMPING);
    this.drops = 0;
    this.userDrops = 0;
    this.steps = 0;
    this.nextAuto = 0;
    this.land = new Uint32Array(W * H);
    if (this.colors) this.paintLand();
  }

  needsRebuild(cssW: number, cssH: number): boolean {
    const { W, H } = gridSize(cssW, cssH);
    return !this.field || W !== this.field.W || H !== this.field.H;
  }

  warm(): void {
    for (let k = 0; k < POND_WARM_STEPS; k++) this.step();
  }

  restart(): void {}

  finished(): boolean {
    return false;
  }

  private autoDrop(): void {
    const f = this.field;
    if (f.inside.length === 0) return;
    // Pick a water cell well inside: retry a few times for one with water all around.
    let cell = f.inside[Math.floor(this.rand() * f.inside.length)];
    for (let t = 0; t < 6; t++) {
      const W = f.W;
      if (f.mask[cell - 2] && f.mask[cell + 2] && f.mask[cell - 2 * W] && f.mask[cell + 2 * W])
        break;
      cell = f.inside[Math.floor(this.rand() * f.inside.length)];
    }
    if (f.drop((cell % f.W) + 0.5, Math.floor(cell / f.W) + 0.5)) this.drops++;
  }

  step(): void {
    if (this.steps >= this.nextAuto) {
      this.autoDrop();
      this.nextAuto = this.steps + AUTO_MIN + Math.floor(this.rand() * AUTO_SPREAD);
    }
    this.field.step();
    this.steps++;
  }

  setColors(c: ModeColors): void {
    this.colors = c;
    const water = rgbOf(c.water);
    const surface = rgbOf(c.surface);
    const deep = rgbOf(c.waterDeep);
    const dark = c.theme === 'dark';
    // Troughs toward the deep tone, crests toward the surface tone.
    const mid = dark ? water : mixRgb(surface, water, 0.7);
    const crest = dark ? mixRgb(water, deep, 0.9) : surface;
    const trough = dark ? rgbOf(c.sunken) : deep;
    for (let k = 0; k < LUT_STEPS; k++) {
      const t = (k / (LUT_STEPS - 1)) * 2 - 1;
      this.lut[k] = t >= 0 ? packMix(mid, crest, t) : packMix(mid, trough, -t);
    }
    if (this.field) this.paintLand();
  }

  private paintLand(): void {
    const c = this.colors;
    if (!c) return;
    const f = this.field;
    const l1 = rgbOf(c.land1);
    const l2 = rgbOf(c.land2);
    const shore = packMix(rgbOf(c.land3), rgbOf(c.text), 0.15);
    const { W, H, mask } = f;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (mask[k]) continue;
        const coast =
          (i > 0 && mask[k - 1]) ||
          (i < W - 1 && mask[k + 1]) ||
          (j > 0 && mask[k - W]) ||
          (j < H - 1 && mask[k + W]);
        // A faint diagonal grain so the land reads as ground, not as a flat panel.
        this.land[k] = coast ? shore : packMix(l1, l2, ((i + 2 * j) % 7) / 18);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
    const f = this.field;
    this.grid.ensure(f.W, f.H);
    const px = this.grid.pixels;
    px.set(this.land);
    const { u, inside, W } = f;
    const lut = this.lut;
    const half = (LUT_STEPS - 1) / 2;
    for (let q = 0; q < inside.length; q++) {
      const i = inside[q];
      // Height plus a light from the upper left (slope), soft-clipped so drops never saturate.
      const v = RIPPLE_GAIN * u[i] + SLOPE_GAIN * (u[i - 1] + u[i - W] - u[i + 1] - u[i + W]);
      const t = v / (1 + Math.abs(v));
      px[i] = lut[(half + t * half + 0.5) | 0];
    }
    this.grid.blit(ctx, cw, ch);
  }

  poke(fx: number, fy: number): boolean {
    const f = this.field;
    const ok = f.drop(fx * f.W, fy * f.H, DROP_AMP * 1.3, DROP_RADIUS);
    if (ok) {
      this.drops++;
      this.userDrops++;
    }
    return ok;
  }

  readout(): string {
    const n = this.userDrops;
    return `Koch snowflake pond, level ${this.level} · ${n === 1 ? '1 pebble' : `${n} pebbles`} by you`;
  }

  summary(): string {
    const n = this.userDrops;
    const by =
      n === 0
        ? 'None has been dropped by clicking yet.'
        : `${n === 1 ? '1 was' : `${n} were`} dropped by clicking.`;
    return `Ripples spread across a pond shaped like a level ${this.level} Koch snowflake and reflect off its fixed walls. Pebbles fall on their own every few seconds. ${by}`;
  }

  label(): string {
    return `Animated pond shaped like a level ${this.level} Koch snowflake, with ripples reflecting off its walls. Click, tap, or press Enter to drop a pebble.`;
  }
}

function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
