import type { PaletteTheme, ThemeName } from '../../common/palettes.ts';
import type { HeroModeId } from './meta.ts';

/** Colours a mode draws with: site tokens (read from CSS) plus the chosen art palette. */
export interface ModeColors {
  theme: ThemeName;
  text: string;
  muted: string;
  bg: string;
  surface: string;
  sunken: string;
  border: string;
  accent: string;
  land1: string;
  land2: string;
  land3: string;
  water: string;
  waterDeep: string;
  palette: PaletteTheme;
}

/**
 * One extra hero mode. The shell (./shell.ts) owns the canvas, the loop, timers, observers and
 * input; the sim owns its state and drawing. Simulations advance in fixed steps, so the state
 * after k steps depends only on the seed (and on pokes), never on frame timing.
 */
export interface ModeSim {
  readonly id: HeroModeId;
  /** Click, tap and Enter call poke(). */
  readonly interactive: boolean;
  /** Fixed steps per second at speed 1×. */
  readonly stepHz: number;
  /** Fresh state for `seed` on a canvas of cssW × cssH CSS px. */
  build(seed: number, cssW: number, cssH: number): void;
  /** True if a canvas of this size needs a different grid (the shell then rebuilds). */
  needsRebuild(cssW: number, cssH: number): boolean;
  /** Bring a fresh build to its first frame: the static frame if `still`, else the start. */
  warm(still: boolean): void;
  /** Growth modes: back to the start with the same seed (Play after the end). */
  restart(): void;
  /** Growth modes report true once fully grown (the shell holds, then loops). */
  finished(): boolean;
  step(): void;
  setColors(c: ModeColors): void;
  /** Paint the whole canvas (device px); must be opaque. */
  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number): void;
  /** Interact at (fx, fy) ∈ [0, 1]² of the canvas. Returns false if nothing happened. */
  poke(fx: number, fy: number): boolean;
  /** Short readout line (shown under the canvas). */
  readout(): string;
  /** Screen-reader summary body (the shell adds the play state and seed). */
  summary(): string;
  /** Canvas aria-label. */
  label(): string;
}
