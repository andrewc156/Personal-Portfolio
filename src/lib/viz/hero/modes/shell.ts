import { getPalette, type PaletteName, type ThemeName } from '../../common/palettes.ts';
import { normalizeSeed, randomSeed } from '../../common/rng.ts';
import { modeMeta, type HeroModeId } from './meta.ts';
import type { ModeColors, ModeSim } from './types.ts';

/**
 * Runtime shell for the extra hero modes: canvas sizing (DPR ≤ 2), a fixed-step loop, the
 * pause rules (off-screen, hidden tab, reduced motion), keyboard and pointer input, the
 * readout and the screen-reader summary. destroy() cancels the frame, clears every timer and
 * removes every listener and observer it added.
 */

const DPR_CAP = 2;
/** Hold at the end of a growth mode before looping with a new seed (as Rising water). */
export const MODE_HOLD_MS = 2500;
/** At most this many fixed steps per frame (a slow frame doesn't spiral). */
const MAX_STEPS_PER_FRAME = 6;
const READOUT_MS = 250;

export interface ModeElements {
  root: HTMLElement;
  map: HTMLCanvasElement;
  readout: HTMLElement;
  summary: HTMLElement;
}

export interface ModeSettings {
  seed: number;
  speed: number;
  palette: PaletteName;
  collatzSteps?: number;
}

export interface ModeUiState {
  playing: boolean;
  progress: number;
  seed: number;
}

export class ModeController {
  readonly els: ModeElements;
  readonly sim: ModeSim;
  readonly mode: HeroModeId;
  settings: ModeSettings;
  frames = 0;
  playing = false;
  /** Fixed steps taken since the last build (read by e2e). */
  stepsTaken = 0;
  /** User pokes that hit (read by e2e). */
  pokes = 0;
  onUi: (s: ModeUiState) => void = () => {};

  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = -1;
  private acc = 0;
  private holdLeft = 0;
  private dirty = true;
  private onscreen = true;
  private visible = true;
  private running = false;
  private dpr = 1;
  private css = { w: 0, h: 0 };
  private resizeTimer = 0;
  private summaryTimer = 0;
  private lastReadoutAt = -Infinity;
  private cleanup: (() => void)[] = [];
  private destroyed = false;
  private theme: ThemeName = 'light';
  private colors: ModeColors;

  constructor(
    els: ModeElements,
    sim: ModeSim,
    settings: ModeSettings,
    opts: { reducedMotion: boolean },
  ) {
    this.els = els;
    this.sim = sim;
    this.mode = sim.id;
    this.settings = { ...settings, seed: normalizeSeed(settings.seed) };
    const ctx = els.map.getContext('2d');
    if (!ctx) throw new Error('2-D canvas unavailable');
    this.ctx = ctx;
    this.colors = this.readColors();
    this.measure();
    this.playing = !opts.reducedMotion;
    this.build(opts.reducedMotion);
    this.render();
    this.updateSummary();
    this.observe();
    this.syncState();
    this.schedule();
  }

  // ---- public controls -------------------------------------------------------------------

  setPlaying(on: boolean): void {
    if (this.destroyed) return;
    const replay = on && this.sim.finished();
    if (replay) {
      this.sim.restart();
      this.holdLeft = 0;
      this.dirty = true;
      if (this.mode === 'collatz') {
        this.acc = 0;
        this.lastReadoutAt = -Infinity;
      }
    }
    if (this.playing === on) return;
    this.playing = on;
    this.last = -1;
    this.dirty = true;
    this.syncState();
    this.emitUi();
    if (replay && this.mode === 'collatz') this.updateSummary();
    else this.queueSummary(0);
    this.schedule();
  }

  togglePlay(): void {
    this.setPlaying(!this.playing);
  }

  /** New state with `seed` (random if omitted); "New terrain" and N. */
  newTerrain(seed?: number): void {
    if (this.destroyed) return;
    this.settings.seed = normalizeSeed(seed ?? randomSeed());
    this.build(false);
    this.dirty = true;
    this.emitUi();
    if (this.mode === 'collatz') this.updateSummary();
    else this.queueSummary(300);
    this.schedule();
  }

  update(next: Partial<ModeSettings>): void {
    if (this.destroyed) return;
    const prev = this.settings;
    this.settings = { ...prev, ...next, seed: normalizeSeed(next.seed ?? prev.seed) };
    const paletteChanged = this.settings.palette !== prev.palette;
    if (paletteChanged) this.colors = this.readColors();
    if (this.settings.seed !== prev.seed) {
      this.newTerrain(this.settings.seed);
      return;
    }
    if (this.mode === 'collatz' && this.settings.collatzSteps !== prev.collatzSteps) {
      this.build(false);
      if (!this.playing) this.sim.previewDepth?.();
      this.dirty = true;
      this.updateReadout(true);
      this.updateSummary();
      this.schedule();
      return;
    }
    if (paletteChanged) {
      this.sim.setColors(this.colors);
      this.dirty = true;
      this.schedule();
    }
  }

  /** Click / tap / Enter at canvas fractions (fx, fy). */
  poke(fx: number, fy: number): boolean {
    if (this.destroyed || !this.sim.interactive) return false;
    const ok = this.sim.poke(fx, fy);
    if (ok) {
      this.pokes++;
      this.dirty = true;
      this.updateReadout(true);
      this.queueSummary(600);
      this.schedule();
    }
    return ok;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.resizeTimer);
    clearTimeout(this.summaryTimer);
    this.resizeTimer = 0;
    this.summaryTimer = 0;
    for (const f of this.cleanup) f();
    this.cleanup.length = 0;
    this.setRunning(false);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Timers this controller has pending (resize settle, summary debounce). */
  get pendingTimers(): number {
    return (this.resizeTimer ? 1 : 0) + (this.summaryTimer ? 1 : 0);
  }

  /** Listeners and observers still attached (0 after destroy). */
  get attached(): number {
    return this.cleanup.length;
  }

  /** Growth modes: 0 … 1; continuous modes report 0. */
  get progress(): number {
    return 0;
  }

  // ---- state -----------------------------------------------------------------------------

  private build(still: boolean): void {
    this.sim.build(this.settings.seed, this.css.w, this.css.h, this.settings.collatzSteps);
    this.sim.setColors(this.colors);
    this.sim.warm(still);
    this.stepsTaken = 0;
    this.holdLeft = 0;
    this.acc = 0;
    if (this.mode === 'collatz') {
      // Paint layer one before taking any ticks after a control-triggered build.
      this.last = -1;
      this.lastReadoutAt = -Infinity;
    }
    this.els.root.dataset.seed = String(this.settings.seed);
    const label = this.sim.label();
    if (this.els.map.getAttribute('aria-label') !== label) {
      this.els.map.setAttribute('aria-label', label);
    }
  }

  private readColors(): ModeColors {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => {
      const x = cs.getPropertyValue(name).trim();
      return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(x) ? x : fallback;
    };
    this.theme = cs.colorScheme.includes('dark') ? 'dark' : 'light';
    const dark = this.theme === 'dark';
    return {
      theme: this.theme,
      text: v('--color-text', dark ? '#e8e5df' : '#1c1b19'),
      muted: v('--color-text-muted', dark ? '#a7a298' : '#5c574f'),
      bg: v('--color-bg', dark ? '#111315' : '#f7f4ee'),
      surface: v('--color-surface', dark ? '#1a1d20' : '#fdfbf7'),
      sunken: v('--color-surface-sunken', dark ? '#0b0c0e' : '#efeae1'),
      border: v('--color-border', dark ? '#33373c' : '#d9d2c5'),
      accent: v('--color-accent', dark ? '#73b6e6' : '#0b4f7a'),
      land1: v('--color-land-1', dark ? '#2a2824' : '#e6dccb'),
      land2: v('--color-land-2', dark ? '#3b3730' : '#cfc0a6'),
      land3: v('--color-land-3', dark ? '#575044' : '#a8957a'),
      water: v('--color-water', dark ? '#2f5f80' : '#6f9fbf'),
      waterDeep: v('--color-water-deep', dark ? '#73b6e6' : '#0b4f7a'),
      palette: getPalette(this.settings.palette)[this.theme],
    };
  }

  private onThemeChange = (): void => {
    if (this.destroyed) return;
    const before = this.theme;
    const text = this.colors.text;
    const next = this.readColors();
    if (before === this.theme && text === next.text) return;
    this.colors = next;
    this.sim.setColors(next);
    this.dirty = true;
    this.schedule();
  };

  private measure(): void {
    this.dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
    const r = this.els.map.getBoundingClientRect();
    const w = Math.max(1, Math.round(this.dpr * r.width));
    const h = Math.max(1, Math.round(this.dpr * r.height));
    if (this.els.map.width !== w || this.els.map.height !== h) {
      this.els.map.width = w;
      this.els.map.height = h;
    }
    this.css = { w: r.width, h: r.height };
    this.dirty = true;
  }

  private onResize = (): void => {
    if (this.destroyed) return;
    this.measure();
    this.schedule();
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = 0;
      if (this.destroyed) return;
      if (this.sim.needsRebuild(this.css.w, this.css.h)) {
        this.build(!this.playing);
        this.queueSummary(300);
      }
      this.dirty = true;
      this.schedule();
    }, 200);
  };

  // ---- loop ------------------------------------------------------------------------------

  private shouldRun(): boolean {
    return this.playing && this.onscreen && this.visible;
  }

  private schedule(): void {
    if (this.destroyed || !this.onscreen || !this.visible) return;
    if (!this.raf && (this.dirty || this.playing)) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.destroyed) return;
    const run = this.shouldRun();
    if (run) {
      const dt = this.last >= 0 ? Math.min(100, now - this.last) : 0;
      this.last = now;
      this.advance(dt);
      this.dirty = true;
    } else {
      this.last = -1;
    }
    if (this.dirty && this.onscreen && this.visible) {
      this.render();
      this.dirty = false;
    }
    this.setRunning(run && this.playing);
    if (run && this.playing) this.schedule();
  };

  private advance(dt: number): void {
    const sim = this.sim;
    if (sim.finished()) {
      this.holdLeft -= dt;
      if (this.holdLeft > 0) return;
      this.newTerrain();
      return;
    }
    this.acc += (dt / 1000) * sim.stepHz * this.settings.speed;
    let n = Math.floor(this.acc);
    this.acc -= n;
    if (n > MAX_STEPS_PER_FRAME) n = MAX_STEPS_PER_FRAME;
    for (let k = 0; k < n; k++) {
      sim.step();
      this.stepsTaken++;
      if (sim.finished()) {
        this.holdLeft = MODE_HOLD_MS;
        this.queueSummary(0);
        break;
      }
    }
  }

  private render(): void {
    const c = this.els.map;
    this.sim.draw(this.ctx, c.width, c.height, this.dpr);
    this.frames++;
    this.updateReadout(!this.playing);
  }

  /** Throttled while playing (frames keep coming, so no trailing timer); immediate otherwise. */
  private updateReadout(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastReadoutAt < READOUT_MS) return;
    this.lastReadoutAt = now;
    const text = this.sim.readout();
    if (this.els.readout.textContent !== text) this.els.readout.textContent = text;
  }

  private setRunning(on: boolean): void {
    if (on === this.running) return;
    this.running = on;
    this.els.root.dataset.running = String(on);
  }

  private syncState(): void {
    this.els.root.dataset.state = this.playing ? 'playing' : 'paused';
  }

  private emitUi(): void {
    this.onUi({ playing: this.playing, progress: 0, seed: this.settings.seed });
  }

  private queueSummary(delay: number): void {
    clearTimeout(this.summaryTimer);
    this.summaryTimer = 0;
    if (this.destroyed) return;
    this.summaryTimer = window.setTimeout(() => {
      this.summaryTimer = 0;
      if (!this.destroyed) this.updateSummary();
    }, delay);
  }

  private updateSummary(): void {
    const meta = modeMeta(this.mode);
    const text = `${meta.label}. ${this.playing ? 'Playing' : 'Paused'}. Seed ${
      this.settings.seed
    }. ${this.sim.summary()}`;
    if (this.els.summary.textContent !== text) this.els.summary.textContent = text;
    const label = this.sim.label();
    if (this.els.map.getAttribute('aria-label') !== label) {
      this.els.map.setAttribute('aria-label', label);
    }
  }

  // ---- events ----------------------------------------------------------------------------

  private observe(): void {
    const { root, map } = this.els;

    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      this.onscreen = e.isIntersecting;
      this.last = -1;
      if (!this.onscreen) this.setRunning(false);
      this.schedule();
    });
    io.observe(root);
    this.cleanup.push(() => io.disconnect());

    const onVis = () => {
      this.visible = document.visibilityState !== 'hidden';
      this.last = -1;
      if (!this.visible) this.setRunning(false);
      this.schedule();
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));
    onVis();

    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(map);
    this.cleanup.push(() => ro.disconnect());

    const mo = new MutationObserver(this.onThemeChange);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.cleanup.push(() => mo.disconnect());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', this.onThemeChange);
    this.cleanup.push(() => mq.removeEventListener('change', this.onThemeChange));

    const onKey = (e: KeyboardEvent) => {
      if (e.target !== root || e.altKey || e.ctrlKey || e.metaKey) return;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          this.togglePlay();
          break;
        case 'Enter':
          if (!this.sim.interactive) return;
          this.poke(0.5, 0.5);
          break;
        case 'n':
        case 'N':
          this.newTerrain();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    root.addEventListener('keydown', onKey);
    this.cleanup.push(() => root.removeEventListener('keydown', onKey));

    const onDown = (e: PointerEvent) => {
      if (!this.sim.interactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const r = map.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      this.poke((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    map.addEventListener('pointerdown', onDown);
    this.cleanup.push(() => map.removeEventListener('pointerdown', onDown));
  }
}
