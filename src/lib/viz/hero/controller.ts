import { computeH0, Flood, isEssential, persistence } from '../../tda/index.ts';
import type { Bar, H0Result } from '../../tda/index.ts';
import { getPalette, type PaletteName, type ThemeName } from '../common/palettes.ts';
import { normalizeSeed, randomSeed } from '../common/rng.ts';
import {
  barcodeHit,
  diagramHit,
  drawBarcode,
  drawDiagram,
  stripFont,
  stripLayout,
  type BarcodeView,
  type StripLayout,
  type StripState,
} from './barcode.ts';
import {
  basinMask,
  buildLakeTable,
  levelAt,
  selectBars,
  type LakeTable,
  type Pacing,
} from './model.ts';
import { clampMarker, placeLabel, type Box } from './markers.ts';
import { MapPainter, type ColorBy } from './render-map.ts';
import { generateTerrain, gridSize, heightRange, hillshade } from './terrain.ts';
import { barReadout, cellReadout, levelReadout, metres, stripLabel, summaryText } from './text.ts';

/**
 * Runtime for the home-page hero (spec §6.3): terrain, flood animation, map and barcode
 * rendering, pointer and keyboard interaction, and the pause rules (off-screen, hidden tab,
 * reduced motion). The pure parts live in terrain.ts, model.ts, render-map.ts and barcode.ts.
 */

export interface HeroSettings {
  seed: number;
  scale: number;
  roughness: number;
  speed: number;
  pacing: Pacing;
  loop: boolean;
  showBarcode: boolean;
  minPersistence: number;
  maxBars: number;
  view: BarcodeView;
  palette: PaletteName;
  colorBy: ColorBy;
  shoreline: boolean;
}

export const HERO_DEFAULTS: Omit<HeroSettings, 'seed'> = {
  scale: 1.5,
  roughness: 0.5,
  speed: 1,
  pacing: 'linear',
  loop: true,
  showBarcode: true,
  minPersistence: 10,
  maxBars: 30,
  view: 'barcode',
  palette: 'delta',
  colorBy: 'lake',
  shoreline: true,
};

/** Seconds for one full rise at speed 1×. */
export const SWEEP_SECONDS = 14;
/** Hold at the top before looping (spec §6.3: about 2.5 s). */
export const HOLD_MS = 2500;
/** Reduced motion: static frame at about 45 % of the rise. */
export const REDUCED_MOTION_PROGRESS = 0.45;
const DPR_CAP = 2;

export interface HeroElements {
  root: HTMLElement;
  map: HTMLCanvasElement;
  strip: HTMLCanvasElement;
  stripBox: HTMLElement;
  readout: HTMLElement;
  summary: HTMLElement;
}

export interface HeroUiState {
  playing: boolean;
  progress: number;
  seed: number;
}

interface Terrain {
  W: number;
  H: number;
  heights: Float32Array;
  result: H0Result;
  flood: Flood;
  lakes: LakeTable;
  minH: number;
  maxH: number;
  painter: MapPainter;
  image: ImageData;
  pixels: Uint32Array;
  offscreen: HTMLCanvasElement;
  offCtx: CanvasRenderingContext2D;
  mask: Uint8Array;
  queue: Int32Array;
  /** flood.levelAtPercentile, bound once per terrain so frames don't allocate a closure. */
  pct: (p: number) => number;
}

export class HeroController {
  readonly els: HeroElements;
  settings: HeroSettings;
  /** Rendered frames (read by e2e to check pausing). */
  frames = 0;
  /** Animation progress p ∈ [0, 1]. */
  progress = 0;
  playing = false;
  /** Called on play/pause, seed change and (throttled) progress change. */
  onUi: (s: HeroUiState) => void = () => {};

  private t!: Terrain;
  private rows: Bar[] = [];
  private fills: string[] = [];
  private ticks: number[] = [];
  private tickText: string[] = [];
  private highlight = -1;
  private highlightMaskFor = -1;
  private holdLeft = 0;
  private raf = 0;
  private last = -1;
  private dirty = true;
  private onscreen = true;
  private visible = true;
  private running = false;
  /** Map cell under the pointer (−1 = none); its readout wins over the level readout. */
  private hoverCell = -1;
  private lastReadoutAt = -Infinity;
  private readoutTimer = 0;
  private lastUiAt = 0;
  private summaryTimer = 0;
  private theme: ThemeName = 'light';
  private colors = {
    text: '#1c1b19',
    muted: '#5c574f',
    bg: '#f7f4ee',
    border: '#d9d2c5',
    accent: '#0b4f7a',
  };
  private mapCtx: CanvasRenderingContext2D;
  private stripCtx: CanvasRenderingContext2D;
  private L: StripLayout = stripLayout(1, 1, 1);
  private stripState: StripState;
  private dpr = 1;
  private mapCss = { w: 0, h: 0 };
  private stripCss = { w: 0, h: 0 };
  private resizeTimer = 0;
  private cleanup: (() => void)[] = [];

  constructor(els: HeroElements, settings: HeroSettings, opts: { reducedMotion: boolean }) {
    this.els = els;
    this.settings = { ...settings, seed: normalizeSeed(settings.seed) };
    const mc = els.map.getContext('2d');
    const sc = els.strip.getContext('2d');
    if (!mc || !sc) throw new Error('2-D canvas unavailable');
    this.mapCtx = mc;
    this.stripCtx = sc;
    this.stripState = {
      L: this.L,
      rows: this.rows,
      fills: this.fills,
      level: 0,
      minH: 0,
      maxH: 1,
      colors: { axis: '', text: '', level: '', highlight: '' },
      highlight: -1,
      ticks: this.ticks,
      tickText: this.tickText,
      levelText: '',
      font: stripFont(1),
    };
    this.readTheme();
    this.measure();
    this.build();
    this.labelStrip();
    if (opts.reducedMotion) {
      this.progress = REDUCED_MOTION_PROGRESS;
      this.playing = false;
    } else {
      this.playing = true;
    }
    // First frame right away (not on the next rAF) so the canvas is never blank after hydration.
    this.render();
    this.dirty = false;
    this.updateSummary();
    this.observe();
    this.syncState();
    this.schedule();
  }

  /** The strip canvas's accessible name follows the current view (§6.6 items 3–5). */
  private labelStrip(): void {
    this.els.strip.setAttribute('aria-label', stripLabel(this.settings.view));
  }

  // ---- public controls -------------------------------------------------------------------

  setPlaying(on: boolean): void {
    if (on && this.progress >= 1) {
      // Replay from the bottom after the end.
      this.progress = 0;
      this.holdLeft = 0;
    }
    if (this.playing === on) return;
    this.playing = on;
    this.last = -1;
    this.dirty = true;
    this.syncState();
    this.emitUi(true);
    this.queueSummary(0);
    this.schedule();
  }

  togglePlay(): void {
    this.setPlaying(!this.playing);
  }

  /** Jump to progress p (pauses playback). */
  scrubTo(p: number): void {
    this.progress = Math.min(1, Math.max(0, p));
    this.holdLeft = 0;
    if (this.playing) {
      this.playing = false;
      this.syncState();
    }
    this.dirty = true;
    this.emitUi(true);
    this.queueSummary(300);
    this.schedule();
  }

  scrubBy(dp: number): void {
    this.scrubTo(this.progress + dp);
  }

  /** New terrain with `seed` (random if omitted). Keeps the water level. */
  newTerrain(seed?: number): void {
    this.settings.seed = normalizeSeed(seed ?? randomSeed());
    this.build();
    this.dirty = true;
    this.emitUi(true);
    this.queueSummary(300);
    this.schedule();
  }

  /** Apply changed settings; rebuilds only what the change needs. */
  update(next: Partial<HeroSettings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...next, seed: normalizeSeed(next.seed ?? prev.seed) };
    const s = this.settings;
    if (s.seed !== prev.seed || s.scale !== prev.scale || s.roughness !== prev.roughness) {
      this.build();
      this.emitUi(true);
    } else {
      if (s.minPersistence !== prev.minPersistence || s.maxBars !== prev.maxBars) this.selectRows();
      if (s.palette !== prev.palette) this.applyColors();
      if (s.showBarcode !== prev.showBarcode) {
        this.els.stripBox.hidden = !s.showBarcode;
        this.measure();
      }
    }
    this.dirty = true;
    if (s.view !== prev.view) this.labelStrip();
    if (s.pacing !== prev.pacing || s.view !== prev.view) this.queueSummary(300);
    this.schedule();
  }

  /** Highlight the barcode row k (−1 clears). */
  highlightRow(k: number): void {
    const next = k >= 0 && k < this.rows.length ? k : -1;
    if (next === this.highlight) return;
    this.highlight = next;
    this.highlightMaskFor = -1;
    this.dirty = true;
    this.updateReadout(true);
    this.schedule();
  }

  /** Move the highlight to the next/previous bar that exists at the current level. */
  cycleHighlight(dir: 1 | -1): void {
    const level = this.level();
    const n = this.rows.length;
    if (n === 0) return;
    let k = this.highlight;
    for (let step = 0; step < n; step++) {
      k = k < 0 ? (dir > 0 ? 0 : n - 1) : (k + dir + n) % n;
      if (this.rows[k].birth <= level) {
        this.highlightRow(k);
        return;
      }
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
  }

  /** Bars the barcode currently draws (engine objects), for tests and debugging. */
  get drawnRows(): readonly Bar[] {
    return this.rows;
  }

  get grid(): { W: number; H: number } {
    return { W: this.t.W, H: this.t.H };
  }

  get isRunning(): boolean {
    return this.running;
  }

  level(): number {
    const t = this.t;
    return levelAt(this.progress, this.settings.pacing, t.minH, t.maxH, t.pct);
  }

  // ---- terrain and colours ---------------------------------------------------------------

  private build(): void {
    const { w, h } = this.mapCss;
    const { W, H } = gridSize(w, h);
    const s = this.settings;
    const heights = generateTerrain(W, H, { seed: s.seed, scale: s.scale, roughness: s.roughness });
    const result = computeH0(heights, W, H);
    const flood = new Flood(heights, W, H, { order: result.order });
    const [minH, maxH] = heightRange(heights);
    const shade = hillshade(heights, W, H);
    const old = this.t;
    const reuse = old && old.W === W && old.H === H;
    const painter = reuse ? old.painter : new MapPainter(W, H);
    const lakes = buildLakeTable(result, getPalette(s.palette)[this.theme].identity.length);
    painter.setTerrain(heights, result.rank, shade, lakes.slotOf, minH, maxH);
    let image: ImageData;
    let offscreen: HTMLCanvasElement;
    let offCtx: CanvasRenderingContext2D;
    if (reuse) {
      ({ image, offscreen, offCtx } = old);
    } else {
      image = new ImageData(W, H);
      offscreen = document.createElement('canvas');
      offscreen.width = W;
      offscreen.height = H;
      const c = offscreen.getContext('2d');
      if (!c) throw new Error('2-D canvas unavailable');
      offCtx = c;
    }
    this.t = {
      W,
      H,
      heights,
      result,
      flood,
      lakes,
      minH,
      maxH,
      painter,
      image,
      pixels: new Uint32Array(image.data.buffer),
      offscreen,
      offCtx,
      mask: reuse ? old.mask : new Uint8Array(W * H),
      queue: reuse ? old.queue : new Int32Array(W * H),
      pct: (p: number) => flood.levelAtPercentile(p),
    };
    this.highlight = -1;
    this.highlightMaskFor = -1;
    this.holdLeft = 0;
    this.ticks.length = 0;
    this.tickText.length = 0;
    for (const v of [minH, (minH + maxH) / 2, maxH]) {
      this.ticks.push(v);
      this.tickText.push(metres(v));
    }
    this.selectRows();
    this.applyColors();
    this.els.root.dataset.seed = String(s.seed);
  }

  private selectRows(): void {
    const prev = this.highlight >= 0 ? this.rows[this.highlight] : null;
    this.rows = selectBars(this.t.result, this.settings.minPersistence, this.settings.maxBars);
    this.highlight = prev ? this.rows.indexOf(prev) : -1;
    this.highlightMaskFor = -1;
    this.refreshFills();
  }

  private refreshFills(): void {
    const theme = getPalette(this.settings.palette)[this.theme];
    const t = this.t;
    this.fills = this.rows.map((b) => theme.identity[t.painter.slot(b.birthCell)]);
  }

  private applyColors(): void {
    const theme = getPalette(this.settings.palette)[this.theme];
    const t = this.t;
    if (t.lakes.K !== theme.identity.length) {
      t.lakes = buildLakeTable(t.result, theme.identity.length);
      t.painter.setTerrain(
        t.heights,
        t.result.rank,
        hillshade(t.heights, t.W, t.H),
        t.lakes.slotOf,
        t.minH,
        t.maxH,
      );
    }
    t.painter.setColors(theme, this.colors.text, this.colors.bg, this.theme === 'dark');
    this.refreshFills();
    this.dirty = true;
  }

  private readTheme(): void {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => {
      const x = cs.getPropertyValue(name).trim();
      return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(x) ? x : fallback;
    };
    this.theme = cs.colorScheme.includes('dark') ? 'dark' : 'light';
    this.colors = {
      text: v('--color-text', this.colors.text),
      muted: v('--color-text-muted', this.colors.muted),
      bg: v('--color-bg', this.colors.bg),
      border: v('--color-control', this.colors.border),
      accent: v('--color-accent', this.colors.accent),
    };
  }

  private onThemeChange = (): void => {
    const before = this.theme;
    const text = this.colors.text;
    this.readTheme();
    if (before === this.theme && text === this.colors.text) return;
    this.applyColors();
    this.schedule();
  };

  // ---- sizing ----------------------------------------------------------------------------

  private measure(): boolean {
    this.dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
    const m = this.els.map.getBoundingClientRect();
    const s = this.els.strip.getBoundingClientRect();
    const mw = Math.round(this.dpr * m.width);
    const mh = Math.round(this.dpr * m.height);
    if (this.els.map.width !== mw || this.els.map.height !== mh) {
      this.els.map.width = Math.max(1, mw);
      this.els.map.height = Math.max(1, mh);
    }
    const sw = Math.round(this.dpr * s.width);
    const sh = Math.round(this.dpr * s.height);
    if (this.els.strip.width !== sw || this.els.strip.height !== sh) {
      this.els.strip.width = Math.max(1, sw);
      this.els.strip.height = Math.max(1, sh);
    }
    this.stripCss = { w: s.width, h: s.height };
    this.L = stripLayout(s.width, s.height, this.dpr);
    this.stripState.font = stripFont(this.dpr);
    const changed = m.width !== this.mapCss.w || m.height !== this.mapCss.h;
    this.mapCss = { w: m.width, h: m.height };
    this.dirty = true;
    return changed;
  }

  private onResize = (): void => {
    this.measure();
    this.schedule();
    // Rebuild the grid (same seed) only once the size settles.
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const { W, H } = gridSize(this.mapCss.w, this.mapCss.h);
      if (W !== this.t.W || H !== this.t.H) {
        this.build();
        this.dirty = true;
        this.schedule();
      }
    }, 200);
  };

  // ---- animation loop --------------------------------------------------------------------

  private shouldRun(): boolean {
    return this.playing && this.onscreen && this.visible;
  }

  private schedule(): void {
    if (!this.raf && (this.dirty || this.shouldRun())) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const run = this.shouldRun();
    if (run) {
      const dt = this.last >= 0 ? Math.min(100, now - this.last) : 0;
      this.last = now;
      this.advance(dt);
      this.dirty = true;
    } else {
      this.last = -1;
    }
    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    this.setRunning(run && this.playing);
    if (run && this.playing) this.schedule();
  };

  private advance(dt: number): void {
    if (this.progress >= 1) {
      this.holdLeft -= dt;
      if (this.holdLeft > 0) return;
      if (this.settings.loop) {
        this.newTerrain();
        this.progress = 0;
      } else {
        this.playing = false;
        this.syncState();
        this.queueSummary(0);
      }
      this.emitUi(true);
      return;
    }
    this.progress += (dt / 1000 / SWEEP_SECONDS) * this.settings.speed;
    if (this.progress >= 1) {
      this.progress = 1;
      this.holdLeft = HOLD_MS;
    }
    this.emitUi(false);
  }

  private setRunning(on: boolean): void {
    if (on === this.running) return;
    this.running = on;
    this.els.root.dataset.running = String(on);
  }

  private syncState(): void {
    this.els.root.dataset.state = this.playing ? 'playing' : 'paused';
  }

  private emitUi(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastUiAt < 120) return;
    this.lastUiAt = now;
    this.onUi({ playing: this.playing, progress: this.progress, seed: this.settings.seed });
  }

  // ---- rendering -------------------------------------------------------------------------

  private render(): void {
    const t = this.t;
    const level = this.level();
    t.flood.advanceTo(level);
    const hl = this.highlight >= 0 ? this.rows[this.highlight] : null;
    let hlLake = -1;
    let mask: Uint8Array | null = null;
    if (hl && level >= hl.birth) {
      hlLake = hl.birthCell;
      if (level >= hl.death) {
        // Already merged: outline the basin it had just before it spilled.
        if (this.highlightMaskFor !== hl.birthCell) {
          basinMask(
            hl.birthCell,
            t.result.rank[hl.deathCell],
            t.result.rank,
            t.W,
            t.H,
            t.mask,
            t.queue,
          );
          this.highlightMaskFor = hl.birthCell;
        }
        mask = t.mask;
      }
    }
    t.painter.paint(t.pixels, t.flood, {
      level,
      colorBy: this.settings.colorBy,
      shoreline: this.settings.shoreline,
      highlight: hlLake,
      highlightMask: mask,
    });
    t.offCtx.putImageData(t.image, 0, 0);
    const ctx = this.mapCtx;
    const cw = this.els.map.width;
    const ch = this.els.map.height;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(t.offscreen, 0, 0, cw, ch);
    if (hl) this.drawMarkers(hl, level);

    if (this.settings.showBarcode) {
      const st = this.stripState;
      st.L = this.L;
      st.rows = this.rows;
      st.fills = this.fills;
      st.level = level;
      st.minH = t.minH;
      st.maxH = t.maxH;
      st.colors.axis = this.colors.border;
      st.colors.text = this.colors.muted;
      st.colors.level = this.colors.accent;
      st.colors.highlight = this.colors.text;
      st.highlight = this.highlight;
      st.ticks = this.ticks;
      st.tickText = this.tickText;
      st.levelText = metres(level);
      if (this.settings.view === 'diagram') drawDiagram(this.stripCtx, st);
      else drawBarcode(this.stripCtx, st);
    }
    this.frames++;
    this.updateReadout(!this.playing);
  }

  /** Pit (birth cell) and pass (death cell) markers with labels, so colour is never the only cue. */
  private drawMarkers(bar: Bar, level: number): void {
    const t = this.t;
    const ctx = this.mapCtx;
    const cw = this.els.map.width;
    const chh = this.els.map.height;
    const sx = cw / t.W;
    const sy = chh / t.H;
    const d = this.dpr;
    const label = t.lakes.labelOf[bar.birthCell];
    // Keep markers clear of the frame's rounded corners.
    const margin = 6 * d;
    const pitR = 5 * d;
    const passR = 6 * d;
    const px = clampMarker(((bar.birthCell % t.W) + 0.5) * sx, cw, pitR, margin);
    const py = clampMarker((Math.floor(bar.birthCell / t.W) + 0.5) * sy, chh, pitR, margin);
    const hasPass = !isEssential(bar);
    const qx = hasPass ? clampMarker(((bar.deathCell % t.W) + 0.5) * sx, cw, passR, margin) : 0;
    const qy = hasPass
      ? clampMarker((Math.floor(bar.deathCell / t.W) + 0.5) * sy, chh, passR, margin)
      : 0;

    ctx.font = `600 ${12 * d}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';

    // Pit: ringed dot.
    ctx.beginPath();
    ctx.arc(px, py, pitR, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.bg;
    ctx.fill();
    ctx.lineWidth = 2 * d;
    ctx.strokeStyle = this.colors.text;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 2 * d, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.text;
    ctx.fill();
    if (hasPass) {
      // Pass: a diamond.
      ctx.beginPath();
      ctx.moveTo(qx, qy - passR);
      ctx.lineTo(qx + passR, qy);
      ctx.lineTo(qx, qy + passR);
      ctx.lineTo(qx - passR, qy);
      ctx.closePath();
      ctx.fillStyle = this.colors.bg;
      ctx.fill();
      ctx.lineWidth = 2 * d;
      ctx.strokeStyle = this.colors.text;
      ctx.stroke();
    }

    // Labels: inside the canvas, clear of both markers and of each other.
    const lh = 16 * d;
    const gap = 4 * d;
    const pad = 4 * d;
    const avoid: Box[] = [{ x: px - pitR, y: py - pitR, w: 2 * pitR, h: 2 * pitR }];
    if (hasPass) avoid.push({ x: qx - passR, y: qy - passR, w: 2 * passR, h: 2 * passR });
    const draw = (s: string, mx: number, my: number, r: number) => {
      const w = ctx.measureText(s).width + 4 * d;
      const b = placeLabel(mx, my, r, w, lh, cw, chh, gap, pad, avoid);
      avoid.push(b);
      const tx = b.x + 2 * d;
      const ty = b.y + lh / 2;
      ctx.lineWidth = 4 * d;
      ctx.strokeStyle = this.colors.bg;
      ctx.strokeText(s, tx, ty);
      ctx.fillStyle = this.colors.text;
      ctx.fillText(s, tx, ty);
    };
    draw(`Lake ${label} · pit`, px, py, pitR);
    if (hasPass) draw(level >= bar.death ? 'pass' : 'pass (spills here)', qx, qy, passR);
  }

  /**
   * Refresh the readout line. Whenever the hero is not playing it updates immediately, so it
   * always matches the map after a pause, scrub or the reduced-motion frame. During play it is
   * throttled to one update per 150 ms, with a guaranteed trailing update.
   */
  private updateReadout(force: boolean): void {
    const now = performance.now();
    if (!force && this.playing) {
      const wait = 150 - (now - this.lastReadoutAt);
      if (wait > 0) {
        if (!this.readoutTimer) {
          this.readoutTimer = window.setTimeout(() => {
            this.readoutTimer = 0;
            this.updateReadout(true);
          }, wait);
        }
        return;
      }
    }
    if (this.readoutTimer) {
      clearTimeout(this.readoutTimer);
      this.readoutTimer = 0;
    }
    this.lastReadoutAt = now;
    const text = this.readoutText();
    if (this.els.readout.textContent !== text) this.els.readout.textContent = text;
  }

  private readoutText(): string {
    const t = this.t;
    const level = this.level();
    t.flood.advanceTo(level);
    if (this.hoverCell >= 0 && this.hoverCell < t.W * t.H) {
      const lake = t.flood.componentOf(this.hoverCell);
      return cellReadout(t.heights[this.hoverCell], lake >= 0 ? t.lakes.labelOf[lake] : 0);
    }
    const hl = this.highlight >= 0 ? this.rows[this.highlight] : null;
    if (hl) {
      return barReadout(
        hl,
        t.lakes.labelOf[hl.birthCell],
        hl.mergedInto >= 0 ? t.lakes.labelOf[hl.mergedInto] : 0,
      );
    }
    return levelReadout(level, t.flood.alive());
  }

  /** Number of lakes at the current level (read by e2e to check the readout). */
  get lakeCount(): number {
    this.t.flood.advanceTo(this.level());
    return this.t.flood.alive();
  }

  private queueSummary(delay: number): void {
    clearTimeout(this.summaryTimer);
    this.summaryTimer = window.setTimeout(() => this.updateSummary(), delay);
  }

  private updateSummary(): void {
    const level = this.level();
    this.t.flood.advanceTo(level);
    let shown = 0;
    let longest: Bar | null = null;
    for (const b of this.rows) {
      if (b.birth <= level) shown++;
      if (
        !isEssential(b) &&
        b.death <= level &&
        (!longest || persistence(b) > persistence(longest))
      ) {
        longest = b;
      }
    }
    const text = summaryText({
      playing: this.playing,
      progress: this.progress,
      level,
      alive: this.t.flood.alive(),
      shown,
      rows: this.rows.length,
      longest: longest ? { bar: longest, label: this.t.lakes.labelOf[longest.birthCell] } : null,
      seed: this.settings.seed,
    });
    if (this.els.summary.textContent !== text) this.els.summary.textContent = text;
  }

  // ---- events ----------------------------------------------------------------------------

  private observe(): void {
    const { root, map, strip } = this.els;
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, fn);
      this.cleanup.push(() => el.removeEventListener(type, fn));
    };

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
    ro.observe(strip);
    this.cleanup.push(() => ro.disconnect());

    const mo = new MutationObserver(this.onThemeChange);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.cleanup.push(() => mo.disconnect());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', this.onThemeChange);
    this.cleanup.push(() => mq.removeEventListener('change', this.onThemeChange));

    // Keyboard, scoped to the focused hero so it never hijacks form controls or page scrolling.
    on(root, 'keydown', (e) => {
      if (e.target !== root || e.altKey || e.ctrlKey || e.metaKey) return;
      const big = e.shiftKey ? 0.1 : 0.02;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          this.togglePlay();
          break;
        case 'ArrowLeft':
          this.scrubBy(-big);
          break;
        case 'ArrowRight':
          this.scrubBy(big);
          break;
        case 'Home':
          this.scrubTo(0);
          break;
        case 'End':
          this.scrubTo(1);
          break;
        case 'ArrowUp':
          this.cycleHighlight(-1);
          break;
        case 'ArrowDown':
          this.cycleHighlight(1);
          break;
        case 'Escape':
          if (this.highlight < 0) return;
          this.highlightRow(-1);
          break;
        case 'n':
        case 'N':
          this.newTerrain();
          break;
        default:
          return;
      }
      e.preventDefault();
    });

    // Map: height and lake id under the pointer.
    on(map, 'pointermove', (e) => this.mapHover(e));
    on(map, 'pointerdown', (e) => this.mapHover(e));
    on(map, 'pointerleave', () => {
      this.hoverCell = -1;
      this.updateReadout(true);
    });

    // Barcode: hover (mouse/pen) or tap (touch) a bar to highlight its lake.
    on(strip, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.highlightRow(this.stripHit(e));
    });
    on(strip, 'pointerdown', (e) => {
      const k = this.stripHit(e);
      this.highlightRow(e.pointerType === 'touch' && k === this.highlight ? -1 : k);
    });
    on(strip, 'pointerleave', (e) => {
      if (e.pointerType !== 'touch') this.highlightRow(-1);
    });
  }

  private stripHit(e: PointerEvent): number {
    const r = this.els.strip.getBoundingClientRect();
    const x = (e.clientX - r.left) * this.dpr;
    const y = (e.clientY - r.top) * this.dpr;
    const level = this.level();
    if (this.settings.view === 'diagram') {
      return diagramHit(x, y, 10 * this.dpr, this.rows, level, this.t.minH, this.t.maxH, this.L);
    }
    return barcodeHit(x, y, this.rows, level, this.L);
  }

  private mapHover(e: PointerEvent): void {
    const r = this.els.map.getBoundingClientRect();
    const t = this.t;
    const gx = Math.floor(((e.clientX - r.left) / r.width) * t.W);
    const gy = Math.floor(((e.clientY - r.top) / r.height) * t.H);
    if (gx < 0 || gy < 0 || gx >= t.W || gy >= t.H) return;
    this.hoverCell = gy * t.W + gx;
    this.updateReadout(true);
  }

  /** CSS size of the strip (exposed for tests). */
  get stripSize(): { w: number; h: number } {
    return this.stripCss;
  }
}
