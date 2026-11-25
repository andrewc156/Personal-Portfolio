import { valueNoise2 } from '../../common/noise.ts';
import { mulberry32 } from '../../common/rng.ts';
import { gridSize } from '../terrain.ts';
import { grouped } from './meta.ts';
import { PixelGrid, rgbOf } from './pixels.ts';
import type { ModeColors, ModeSim } from './types.ts';
import type { RGB } from '../../common/color.ts';
import { packRgb } from '../../common/color.ts';

/**
 * Dye spill: dye particles carried by a divergence-free "curl-noise" current plus Brownian
 * diffusion.
 *
 * The current is the curl of a stream function ψ: u = ∂ψ/∂y, v = −∂ψ/∂x. ψ is smooth value
 * noise, tapered to 0 at the walls so the walls are streamlines (no flow through them). ψ is
 * stored on the cell corners and interpolated bilinearly inside each cell; the velocity is the
 * exact curl of that interpolant, which is divergence-free inside every cell (∂²ψ/∂x∂y cancels)
 * and has a continuous normal component across cell edges, so the discrete field carries no
 * sources or sinks. Two such fields are blended as A·cos ωt + B·sin ωt (still a curl, so still
 * divergence-free), which makes the current shift slowly without per-step noise sampling.
 *
 * Units: one cell = 1 length unit, time in seconds; fixed steps of 1 / STEP_HZ s.
 */

export const DYE_STEP_HZ = 60;
/** Particle pool size (a ring: new dye replaces the oldest). */
export const DYE_CAPACITY = 9000;
/** Brownian diffusivity in cells² / s: each step adds N(0, 2·D·dt) to x and y. */
export const DYE_DIFFUSIVITY = 0.5;
/** Particles live this many steps, fading over the last FADE_STEPS. */
export const DYE_LIFE_STEPS = 660;
const FADE_STEPS = 240;
/** Source leak, particles per step. */
const LEAK_PER_STEP = 12;
/** Particles per click or Enter. */
export const DYE_RELEASE = 700;
/** Typical current speed as a fraction of the grid height per second. */
const SPEED = 0.1;
/** Noise features per grid height. */
const FREQ = 2.2;
/** Period of the A/B blend, seconds. */
const PERIOD_S = 50;
/** Steps simulated before the first frame (the static frame under reduced motion). */
export const DYE_WARM_STEPS = 300;

function smooth(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

/**
 * Tapered stream-function samples on the (W+1) × (H+1) cell corners, from value noise with
 * `seed`. Corner (i, j) sits at x = i, y = j. Zero on the boundary.
 */
export function streamField(W: number, H: number, seed: number, out?: Float32Array): Float32Array {
  const NW = W + 1;
  const psi = out ?? new Float32Array(NW * (H + 1));
  const f = FREQ / H;
  const amp = (SPEED * H * H) / FREQ;
  const m = 0.18 * H;
  for (let j = 0; j <= H; j++) {
    const ty = smooth(j / m) * smooth((H - j) / m);
    for (let i = 0; i <= W; i++) {
      const tx = smooth(i / m) * smooth((W - i) / m);
      // Two octaves; the second, weaker one adds small eddies.
      const n =
        0.7 * valueNoise2(i * f, j * f, seed) +
        0.3 * valueNoise2(i * f * 2.3, j * f * 2.3, seed ^ 0x2c1b3c6d);
      psi[j * NW + i] = amp * (n - 0.5) * 2 * tx * ty;
    }
  }
  return psi;
}

/**
 * Velocity (u, v) at (x, y): the curl of the bilinear interpolant of corner samples `psi`
 * on a W × H grid. Points outside are clamped to the boundary cells. Writes into `out`.
 */
export function velocityAt(
  psi: Float32Array,
  W: number,
  H: number,
  x: number,
  y: number,
  out: Float64Array,
): void {
  const NW = W + 1;
  let i = Math.floor(x);
  let j = Math.floor(y);
  if (i < 0) i = 0;
  else if (i > W - 1) i = W - 1;
  if (j < 0) j = 0;
  else if (j > H - 1) j = H - 1;
  const fx = Math.min(1, Math.max(0, x - i));
  const fy = Math.min(1, Math.max(0, y - j));
  const k = j * NW + i;
  const p00 = psi[k];
  const p10 = psi[k + 1];
  const p01 = psi[k + NW];
  const p11 = psi[k + NW + 1];
  // u = ∂ψ/∂y, v = −∂ψ/∂x of ψ = (1−fx)(1−fy)p00 + fx(1−fy)p10 + (1−fx)fy p01 + fx fy p11.
  out[0] = (1 - fx) * (p01 - p00) + fx * (p11 - p10);
  out[1] = -((1 - fy) * (p10 - p00) + fy * (p11 - p01));
}

/** Net outward flux through the four edges of cell (i, j) (exactly 0 for a curl field). */
export function cellFlux(psi: Float32Array, W: number, i: number, j: number): number {
  const NW = W + 1;
  const k = j * NW + i;
  const p00 = psi[k];
  const p10 = psi[k + 1];
  const p01 = psi[k + NW];
  const p11 = psi[k + NW + 1];
  // Flux of u through a vertical edge = ψ(top→bottom difference); of v through a horizontal
  // edge = −(left→right difference). Each corner appears twice with opposite signs.
  const east = p11 - p10;
  const west = p01 - p00;
  const south = -(p11 - p01);
  const north = -(p10 - p00);
  return east - west + (south - north);
}

/** Pure dye state: particles, the current and the density grid. No DOM. */
export class DyeField {
  readonly W: number;
  readonly H: number;
  readonly px = new Float32Array(DYE_CAPACITY);
  readonly py = new Float32Array(DYE_CAPACITY);
  readonly born = new Int32Array(DYE_CAPACITY);
  /** Current stream function on the corners (A·cos + B·sin). */
  readonly psi: Float32Array;
  readonly density: Float32Array;
  srcX: number;
  srcY: number;
  steps = 0;
  releases = 0;
  private a: Float32Array;
  private b: Float32Array;
  private head = 0;
  private filled = 0;
  private rand: () => number;
  private spare = 0;
  private hasSpare = false;
  private vel = new Float64Array(2);
  private readonly dt = 1 / DYE_STEP_HZ;
  private readonly sigma = Math.sqrt(2 * DYE_DIFFUSIVITY * (1 / DYE_STEP_HZ));

  constructor(W: number, H: number, seed: number) {
    this.W = W;
    this.H = H;
    this.a = streamField(W, H, seed | 0);
    this.b = streamField(W, H, (seed ^ 0x51ed270b) | 0);
    this.psi = new Float32Array(this.a.length);
    this.density = new Float32Array(W * H);
    this.rand = mulberry32((seed ^ 0x6a09e667) >>> 0);
    // Leak source somewhere in the left half, away from the walls.
    this.srcX = W * (0.15 + 0.3 * this.rand());
    this.srcY = H * (0.3 + 0.4 * this.rand());
    for (let i = 0; i < DYE_CAPACITY; i++) this.born[i] = -1e9;
    this.updatePsi();
  }

  /** Standard normal (Box–Muller, two per draw). */
  private gauss(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    const u = 1 - this.rand();
    const v = this.rand();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    this.hasSpare = true;
    return r * Math.cos(2 * Math.PI * v);
  }

  private updatePsi(): void {
    const w = (2 * Math.PI * this.steps * this.dt) / PERIOD_S;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const { a, b, psi } = this;
    for (let k = 0; k < psi.length; k++) psi[k] = c * a[k] + s * b[k];
  }

  /** Add one particle near (x, y), spread by `r` cells. */
  private spawn(x: number, y: number, r: number): void {
    const k = this.head;
    this.px[k] = Math.min(this.W - 0.01, Math.max(0.01, x + r * this.gauss()));
    this.py[k] = Math.min(this.H - 0.01, Math.max(0.01, y + r * this.gauss()));
    this.born[k] = this.steps;
    this.head = (k + 1) % DYE_CAPACITY;
    if (this.filled < DYE_CAPACITY) this.filled++;
  }

  /** Spill DYE_RELEASE particles at (x, y) in cell units. */
  release(x: number, y: number): void {
    for (let n = 0; n < DYE_RELEASE; n++) this.spawn(x, y, 1.2);
    this.releases++;
  }

  /** Particles still visible. */
  alive(): number {
    let n = 0;
    for (let k = 0; k < this.filled; k++) if (this.steps - this.born[k] < DYE_LIFE_STEPS) n++;
    return n;
  }

  step(): void {
    const { W, H, px, py, born, vel, psi, dt, sigma } = this;
    if (this.steps % 3 === 0) this.updatePsi();
    for (let n = 0; n < LEAK_PER_STEP; n++) this.spawn(this.srcX, this.srcY, 0.8);
    for (let k = 0; k < this.filled; k++) {
      if (this.steps - born[k] >= DYE_LIFE_STEPS) continue;
      let x = px[k];
      let y = py[k];
      // Midpoint (RK2) advection along the current.
      velocityAt(psi, W, H, x, y, vel);
      const mx = x + 0.5 * dt * vel[0];
      const my = y + 0.5 * dt * vel[1];
      velocityAt(psi, W, H, mx, my, vel);
      x += dt * vel[0] + sigma * this.gauss();
      y += dt * vel[1] + sigma * this.gauss();
      // Reflect at the walls.
      if (x < 0) x = -x;
      else if (x > W) x = 2 * W - x;
      if (y < 0) y = -y;
      else if (y > H) y = 2 * H - y;
      px[k] = Math.min(W - 1e-3, Math.max(1e-3, x));
      py[k] = Math.min(H - 1e-3, Math.max(1e-3, y));
    }
    this.steps++;
  }

  /** Bilinear splat of every live particle (weighted by its fade) into `density`. */
  splat(): void {
    const { W, H, px, py, born, density } = this;
    density.fill(0);
    for (let k = 0; k < this.filled; k++) {
      const age = this.steps - born[k];
      if (age >= DYE_LIFE_STEPS) continue;
      const w = Math.min(1, (DYE_LIFE_STEPS - age) / FADE_STEPS);
      const x = px[k] - 0.5;
      const y = py[k] - 0.5;
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const i0 = i < 0 ? 0 : i;
      const j0 = j < 0 ? 0 : j;
      const i1 = i + 1 > W - 1 ? W - 1 : i + 1;
      const j1 = j + 1 > H - 1 ? H - 1 : j + 1;
      density[j0 * W + i0] += w * (1 - fx) * (1 - fy);
      density[j0 * W + i1] += w * fx * (1 - fy);
      density[j1 * W + i0] += w * (1 - fx) * fy;
      density[j1 * W + i1] += w * fx * fy;
    }
  }
}

const SHADE_STEPS = 32;
const DYE_STEPS = 48;

export class DyeSim implements ModeSim {
  readonly id = 'dye' as const;
  readonly interactive = true;
  readonly stepHz = DYE_STEP_HZ;
  field!: DyeField;
  private grid = new PixelGrid();
  /** lut[s * DYE_STEPS + d]: water shade s, dye amount d. */
  private lut = new Uint32Array(SHADE_STEPS * DYE_STEPS);
  private stripe = 1;

  build(seed: number, cssW: number, cssH: number): void {
    const { W, H } = gridSize(cssW, cssH);
    this.field = new DyeField(W, H, seed);
    this.stripe = (SPEED * H * H) / FREQ / 5;
  }

  needsRebuild(cssW: number, cssH: number): boolean {
    const { W, H } = gridSize(cssW, cssH);
    return !this.field || W !== this.field.W || H !== this.field.H;
  }

  warm(): void {
    // Even the static frame shows a developed plume: same steps either way.
    for (let k = 0; k < DYE_WARM_STEPS; k++) this.field.step();
  }

  restart(): void {}

  finished(): boolean {
    return false;
  }

  step(): void {
    this.field.step();
  }

  setColors(c: ModeColors): void {
    const base = mix(rgbOf(c.surface), rgbOf(c.water), c.theme === 'dark' ? 0.55 : 0.38);
    const deep = rgbOf(c.waterDeep);
    const dye = rgbOf(c.palette.identity[1] ?? c.accent);
    for (let s = 0; s < SHADE_STEPS; s++) {
      const water = mix(base, deep, (0.1 * s) / (SHADE_STEPS - 1));
      for (let d = 0; d < DYE_STEPS; d++) {
        const col = mix(water, dye, (0.92 * d) / (DYE_STEPS - 1));
        this.lut[s * DYE_STEPS + d] = packRgb(
          Math.round(col[0]),
          Math.round(col[1]),
          Math.round(col[2]),
        );
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
    const f = this.field;
    const { W, H, density, psi } = f;
    const NW = W + 1;
    this.grid.ensure(W, H);
    f.splat();
    const px = this.grid.pixels;
    const lut = this.lut;
    const inv = (2 * Math.PI) / this.stripe;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * NW + i;
        // Bands along contours of ψ, which are the streamlines of the current.
        const p = 0.25 * (psi[k] + psi[k + 1] + psi[k + NW] + psi[k + NW + 1]);
        const s = ((0.5 + 0.5 * Math.cos(p * inv)) * (SHADE_STEPS - 1) + 0.5) | 0;
        const a = 1 - Math.exp(-0.22 * density[j * W + i]);
        const d = (a * (DYE_STEPS - 1) + 0.5) | 0;
        px[j * W + i] = lut[s * DYE_STEPS + d];
      }
    }
    this.grid.blit(ctx, cw, ch);
  }

  poke(fx: number, fy: number): boolean {
    if (!(fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1)) return false;
    this.field.release(fx * this.field.W, fy * this.field.H);
    return true;
  }

  readout(): string {
    const f = this.field;
    const r = f.releases === 1 ? '1 spill' : `${f.releases} spills`;
    return `${grouped(f.alive())} dye particles · ${r} by you`;
  }

  summary(): string {
    const f = this.field;
    const by =
      f.releases === 0
        ? 'None has been spilled by clicking yet.'
        : `${f.releases === 1 ? '1 spill was' : `${f.releases} spills were`} added by clicking.`;
    return `Dye leaks from one point and drifts on a swirling current while it spreads out. ${grouped(
      f.alive(),
    )} dye particles are in the water. ${by}`;
  }

  label(): string {
    return 'Animated dye plume drifting and spreading on a swirling current. Click, tap, or press Enter to spill more dye.';
  }
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
