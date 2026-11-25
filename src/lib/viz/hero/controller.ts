import { computeH0, computeH1Islands, Flood, isEssential, persistence } from '../../tda/index.ts';
import type { Bar, H0Result, IslandBar } from '../../tda/index.ts';
import { getPalette, type PaletteName, type ThemeName } from '../common/palettes.ts';
import { normalizeSeed, randomSeed } from '../common/rng.ts';
import {
  barcodeHit,
  diagramHit,
  drawBarcode,
  drawDiagram,
  levelToX,
  rowPitch,
  stripFont,
  stripLayout,
  type BarcodeView,
  type StripLayout,
  type StripState,
} from './barcode.ts';
import { selectIslandBars } from './islands.ts';
import {
  basinMask,
  buildLakeTable,
  isAlive,
  levelAt,
  pickStartProgress,
  selectBars,
  type LakeTable,
  type Pacing,
} from './model.ts';
import { clampMarker, placeLabel, separatePass, type Box, type Point } from './markers.ts';
import { progressMilestone } from './playback.ts';
import { MapPainter, type ColorBy } from './render-map.ts';
import { generateTerrain, gridSize, heightRange, hillshade } from './terrain.ts';
import {
  barReadout,
  cellReadout,
  islandBarReadout,
  islandLevelReadout,
  islandsSummaryText,
  levelReadout,
  metres,
  selectedIslandText,
  selectedLakeText,
  stripLabel,
  summaryText,
} from './text.ts';

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
  maxBars: 12,
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
/** During playback the live summary refreshes at progress quarters, at most this often. */
export const SUMMARY_MILESTONE_GAP_MS = 3000;

export interface HeroElements {
  root: HTMLElement;
  map: HTMLCanvasElement;
  strip: HTMLCanvasElement;
  stripBox: HTMLElement;
  readout: HTMLElement;
  summary: HTMLElement;
  islandsCopy: HTMLElement | null;
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
  /**
   * Where autoplay began on load (pickStartProgress), so the first frame already shows a few
   * lakes; REDUCED_MOTION_PROGRESS under reduced motion. Read by tests.
   */
  startAt = 0;
  playing = false;
  /** Called on play/pause, seed change and (throttled) progress change. */
  onUi: (s: HeroUiState) => void = () => {};
  /**
   * Called only for the user's own playback actions (Play/Pause button or Space via
   * togglePlay, and scrubbing): true = play/replay, false = a manual pause. Automatic stops
   * (the end of a run, reduced motion, off-screen) never call it (QA-05).
   */
  onUserPlayback: (playing: boolean) => void = () => {};

  private t!: Terrain;
  private rows: Bar[] = [];
  private islandBars: readonly IslandBar[] | null = null;
  private islandRows: IslandBar[] = [];
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
  /** A mouse or pen hover tracks the current lake as the water level changes; a tap pins a row. */
  private followMapHover = false;
  /** True while the highlight was set by pointing at a lake on the map (not by the strip). */
  private mapPicked = false;
  private lastReadoutAt = -Infinity;
  private readoutTimer = 0;
  private lastUiAt = 0;
  private summaryTimer = 0;
  /** Last announced playback milestone (progressMilestone) and when the summary last changed. */
  private milestone = 0;
  private lastSummaryAt = -Infinity;
  /** The next summary leads with the explicitly selected bar (keyboard, click, tap). */
  private announceSelection = false;
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
  private destroyed = false;
  /** Pass-marker position scratch (reused every highlight frame). */
  private passPt: Point = { x: 0, y: 0 };

  /**
   * opts.autoplay (default true) lets a mode switch start paused after a manual pause (QA-05);
   * opts.progress restores a held water level. Reduced motion never autoplays and, without a
   * held level, shows the static frame at REDUCED_MOTION_PROGRESS.
   */
  constructor(
    els: HeroElements,
    settings: HeroSettings,
    opts: { reducedMotion: boolean; autoplay?: boolean; progress?: number },
  ) {
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
    const held =
      opts.progress !== undefined && Number.isFinite(opts.progress)
        ? Math.min(1, Math.max(0, opts.progress))
        : undefined;
    if (opts.reducedMotion) {
      this.progress = held ?? REDUCED_MOTION_PROGRESS;
      this.playing = false;
    } else {
      // Start part-way up so the first painted frame shows land and a few lakes. Loops and
      // replays still start from the bottom, so the births are shown every cycle after this.
      this.progress = held ?? this.startProgress();
      this.playing = opts.autoplay ?? true;
    }
    this.startAt = this.progress;
    this.milestone = progressMilestone(this.progress);
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
    const { strip, islandsCopy } = this.els;
    strip.setAttribute('aria-label', stripLabel(this.settings.view));
    if (!islandsCopy) return;
    islandsCopy.hidden = this.settings.view !== 'islands';
    if (islandsCopy.hidden) strip.removeAttribute('aria-describedby');
    else strip.setAttribute('aria-describedby', islandsCopy.id);
  }

  // ---- public controls -------------------------------------------------------------------

  setPlaying(on: boolean): void {
    if (on && this.progress >= 1) {
      // Replay from the bottom after the end.
      this.progress = 0;
      this.holdLeft = 0;
      this.milestone = 0;
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

  /** The user's Play/Pause (button or Space). */
  togglePlay(): void {
    this.setPlaying(!this.playing);
    this.onUserPlayback(this.playing);
  }

  /** Jump to progress p (pauses playback; a user scrub holds the level, QA-05). */
  scrubTo(p: number): void {
    this.progress = Math.min(1, Math.max(0, p));
    this.holdLeft = 0;
    this.milestone = progressMilestone(this.progress);
    this.onUserPlayback(false);
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
    const viewChanged = s.view !== prev.view;
    const rowsChanged = s.minPersistence !== prev.minPersistence || s.maxBars !== prev.maxBars;
    if (viewChanged) this.highlight = -1;
    if (s.seed !== prev.seed || s.scale !== prev.scale || s.roughness !== prev.roughness) {
      this.build();
      this.emitUi(true);
    } else {
      if (rowsChanged || viewChanged) this.selectRows();
      if (s.palette !== prev.palette) this.applyColors();
      if (s.showBarcode !== prev.showBarcode) {
        this.els.stripBox.hidden = !s.showBarcode;
        this.measure();
      }
    }
    this.dirty = true;
    if (viewChanged) this.labelStrip();
    if (
      s.pacing !== prev.pacing ||
      viewChanged ||
      rowsChanged ||
      s.showBarcode !== prev.showBarcode
    ) {
      this.queueSummary(300);
    }
    this.schedule();
  }

  /** Highlight the barcode row k (−1 clears). */
  highlightRow(k: number): void {
    this.followMapHover = false;
    this.mapPicked = false;
    this.setHighlight(k);
  }

  private setHighlight(k: number, repaint = true): void {
    const next = k >= 0 && k < this.stripRows.length ? k : -1;
    if (next === this.highlight) return;
    this.highlight = next;
    this.highlightMaskFor = -1;
    if (!repaint) return;
    this.dirty = true;
    this.updateReadout(true);
    this.schedule();
  }

  /** Move the highlight to the next/previous bar that exists at the current level. */
  cycleHighlight(dir: 1 | -1): void {
    const level = this.level();
    const rows = this.stripRows;
    const n = rows.length;
    if (n === 0) return;
    let k = this.highlight;
    for (let step = 0; step < n; step++) {
      k = k < 0 ? (dir > 0 ? 0 : n - 1) : (k + dir + n) % n;
      if (rows[k].birth <= level) {
        this.highlightRow(k);
        this.announceSelected();
        return;
      }
    }
  }

  /**
   * Explicit selection (keyboard, click or tap, not hover): the live summary leads with the
   * selected bar, debounced so holding an arrow key announces only where it stops (QA-09).
   */
  private announceSelected(): void {
    this.announceSelection = this.highlight >= 0;
    this.queueSummary(150);
  }

  /**
   * Stop for good: cancel the frame and every timer this controller set (resize settle, readout
   * trailing update, summary debounce), and remove all listeners and observers. Later calls into
   * the controller don't schedule anything.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.resizeTimer);
    clearTimeout(this.readoutTimer);
    clearTimeout(this.summaryTimer);
    this.resizeTimer = 0;
    this.readoutTimer = 0;
    this.summaryTimer = 0;
    for (const f of this.cleanup) f();
    this.cleanup.length = 0;
    this.setRunning(false);
  }

  /** Index of the highlighted barcode row, or −1 (read by e2e). */
  get highlightedRow(): number {
    return this.highlight;
  }

  /** Lake bars selected for the barcode and diagram. */
  get drawnRows(): readonly Bar[] {
    return this.rows;
  }

  /** The island engine rows used by the island view. */
  get drawnIslandRows(): readonly IslandBar[] {
    return this.islandRows;
  }

  private get stripRows(): readonly (Bar | IslandBar)[] {
    return this.settings.view === 'islands' ? this.islandRows : this.rows;
  }

  get grid(): { W: number; H: number } {
    return { W: this.t.W, H: this.t.H };
  }

  /** Timers this controller has pending (resize, readout, summary); read by e2e after destroy(). */
  get pendingTimers(): number {
    return (this.resizeTimer ? 1 : 0) + (this.readoutTimer ? 1 : 0) + (this.summaryTimer ? 1 : 0);
  }

  get isRunning(): boolean {
    return this.running;
  }

  level(): number {
    const t = this.t;
    return levelAt(this.progress, this.settings.pacing, t.minH, t.maxH, t.pct);
  }

  /** First-frame progress for this terrain (see pickStartProgress in model.ts). */
  private startProgress(): number {
    const t = this.t;
    return pickStartProgress(this.rows, t.heights, t.result.order, this.settings.pacing);
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
    this.hoverCell = -1;
    this.followMapHover = false;
    this.mapPicked = false;
    this.holdLeft = 0;
    this.islandBars = null;
    this.islandRows = [];
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
    const prev = this.stripRows[this.highlight];
    this.rows = selectBars(this.t.result, this.settings.minPersistence, this.settings.maxBars);
    if (this.settings.view === 'islands') {
      const t = this.t;
      this.islandBars ??= computeH1Islands(t.heights, t.W, t.H, { order: t.result.order }).bars;
      this.islandRows = selectIslandBars(
        this.islandBars,
        this.settings.minPersistence,
        this.settings.maxBars,
      );
    }
    this.highlight = prev ? this.stripRows.indexOf(prev) : -1;
    this.highlightMaskFor = -1;
    this.refreshFills();
  }

  private refreshFills(): void {
    const theme = getPalette(this.settings.palette)[this.theme];
    const t = this.t;
    this.fills =
      this.settings.view === 'islands'
        ? this.islandRows.map(() => this.colors.accent)
        : this.rows.map((b) => theme.identity[t.painter.slot(b.birthCell)]);
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
    if (this.destroyed) return;
    this.measure();
    this.schedule();
    // Rebuild the grid (same seed) only once the size settles.
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = 0;
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
    if (this.destroyed) return;
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
        this.milestone = 0;
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
    // Coarse milestones for the live summary (quarters, and the top), not every frame (QA-09).
    const m = progressMilestone(this.progress);
    if (m !== this.milestone) {
      this.milestone = m;
      if (m === 4 || performance.now() - this.lastSummaryAt >= SUMMARY_MILESTONE_GAP_MS) {
        this.queueSummary(0);
      }
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
    if (this.followMapHover && this.settings.view !== 'islands') {
      this.pickMapRow(this.floodedLakeRow(this.hoverCell), false);
    }
    const hl = this.settings.view === 'islands' ? undefined : this.rows[this.highlight];
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
    if (hl) {
      this.drawMarkers(
        hl.birthCell,
        `Lake ${t.lakes.labelOf[hl.birthCell]} · pit`,
        hl.deathCell,
        level >= hl.death ? 'pass' : 'pass (spills here)',
      );
    }
    if (this.settings.view === 'islands') {
      const island = this.islandRows[this.highlight];
      if (island && island.birth <= level) {
        this.drawMarkers(island.peakCell, 'Island peak', island.saddleCell, 'Cut off here');
      }
    }

    if (this.settings.showBarcode) {
      const st = this.stripState;
      st.L = this.L;
      st.rows = this.stripRows;
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

  /** A ring and optional diamond link a selected bar to its cells. */
  private drawMarkers(
    ringCell: number,
    ringLabel: string,
    diamondCell: number,
    diamondLabel: string,
  ): void {
    const t = this.t;
    const ctx = this.mapCtx;
    const cw = this.els.map.width;
    const chh = this.els.map.height;
    const sx = cw / t.W;
    const sy = chh / t.H;
    const d = this.dpr;
    // Keep markers clear of the frame's rounded corners.
    const margin = 6 * d;
    const pitR = 5 * d;
    const passR = 6 * d;
    const px = clampMarker(((ringCell % t.W) + 0.5) * sx, cw, pitR, margin);
    const py = clampMarker((Math.floor(ringCell / t.W) + 0.5) * sy, chh, pitR, margin);
    const hasPass = diamondCell >= 0;
    let qx = 0;
    let qy = 0;
    if (hasPass) {
      const rx = clampMarker(((diamondCell % t.W) + 0.5) * sx, cw, passR, margin);
      const ry = clampMarker((Math.floor(diamondCell / t.W) + 0.5) * sy, chh, passR, margin);
      // Adjacent pit and pass cells would put the markers on top of each other: move the
      // diamond just clear of the pit ring (a 3 px gap) so both stay visible.
      const q = separatePass(px, py, pitR, rx, ry, passR, 3 * d, cw, chh, margin, this.passPt);
      qx = q.x;
      qy = q.y;
    }

    ctx.font = `600 ${12 * d}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';

    if (hasPass) {
      // Pass: a diamond, drawn first so the pit ring stays on top if they ever touch.
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
    // Pit: ringed dot, drawn last.
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
    draw(ringLabel, px, py, pitR);
    if (hasPass) draw(diamondLabel, qx, qy, passR);
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
        if (!this.readoutTimer && !this.destroyed) {
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
    if (this.settings.view === 'islands') {
      const island = this.islandRows[this.highlight];
      return island && island.birth <= level
        ? islandBarReadout(island)
        : islandLevelReadout(level, this.countIslands(level));
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

  private countIslands(level: number): number {
    let count = 0;
    if (this.islandBars) {
      for (const bar of this.islandBars) if (isAlive(bar, level)) count++;
    }
    return count;
  }

  private queueSummary(delay: number): void {
    clearTimeout(this.summaryTimer);
    if (this.destroyed) return;
    this.summaryTimer = window.setTimeout(() => {
      this.summaryTimer = 0;
      this.updateSummary();
    }, delay);
  }

  private updateSummary(): void {
    const text = this.summaryNow();
    this.announceSelection = false;
    this.lastSummaryAt = performance.now();
    if (this.els.summary.textContent !== text) this.els.summary.textContent = text;
  }

  /** Live-region text for the explicitly selected bar, or null. */
  private selectedText(level: number): string | null {
    if (this.highlight < 0) return null;
    if (this.settings.view === 'islands') {
      const island = this.islandRows[this.highlight];
      return island && island.birth <= level ? selectedIslandText(island) : null;
    }
    const hl = this.rows[this.highlight];
    if (!hl || hl.birth > level) return null;
    const t = this.t;
    return selectedLakeText(
      hl,
      t.lakes.labelOf[hl.birthCell],
      hl.mergedInto >= 0 ? t.lakes.labelOf[hl.mergedInto] : 0,
    );
  }

  private summaryNow(): string {
    const level = this.level();
    const selected = this.selectedText(level);
    // An explicit selection is announced on its own; later pause/scrub summaries mention it
    // at the end. Playback milestones leave it out so they stay short.
    if (this.announceSelection && selected) return selected;
    const tail = this.playing ? null : selected;
    if (this.settings.view === 'islands') {
      let shown = 0;
      for (const bar of this.islandRows) if (bar.birth <= level) shown++;
      return islandsSummaryText({
        playing: this.playing,
        progress: this.progress,
        level,
        alive: this.countIslands(level),
        shown,
        rows: this.islandRows.length,
        seed: this.settings.seed,
        chart: this.settings.showBarcode,
        selected: tail,
      });
    }
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
    return summaryText({
      playing: this.playing,
      progress: this.progress,
      level,
      alive: this.t.flood.alive(),
      shown,
      rows: this.rows.length,
      longest: longest ? { bar: longest, label: this.t.lakes.labelOf[longest.birthCell] } : null,
      seed: this.settings.seed,
      view: this.settings.showBarcode
        ? this.settings.view === 'diagram'
          ? 'diagram'
          : 'barcode'
        : null,
      selected: tail,
    });
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
          if (this.highlight < 0 && !this.followMapHover) return;
          this.highlightRow(-1);
          this.announceSelected();
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
    // Pointing at a lake also highlights its bar, the map-to-barcode half of the link (the
    // strip handles barcode-to-map). Mouse: while hovering. Touch: a tap picks or clears it.
    on(map, 'pointermove', (e) => this.mapHover(e, e.pointerType !== 'touch'));
    on(map, 'pointerdown', (e) => {
      this.mapHover(e, true);
      // A click or tap on a lake is an explicit selection: announce it (hover is not).
      if (this.mapPicked && this.highlight >= 0) this.announceSelected();
    });
    on(map, 'pointerleave', (e) => {
      this.hoverCell = -1;
      this.followMapHover = false;
      if (e.pointerType !== 'touch' && this.mapPicked) {
        this.highlightRow(-1);
      }
      this.updateReadout(true);
    });

    // Barcode: hover (mouse/pen) or tap (touch) a bar to highlight its lake.
    on(strip, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.highlightRow(this.stripHit(e));
    });
    on(strip, 'pointerdown', (e) => {
      const k = this.stripHit(e);
      const before = this.highlight;
      this.highlightRow(e.pointerType === 'touch' && k === this.highlight ? -1 : k);
      // Announce a click/tap selection; clearing in blank space only refreshes the summary.
      if (this.highlight >= 0 || before >= 0) this.announceSelected();
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
    return barcodeHit(x, y, this.stripRows, level, this.t.minH, this.t.maxH, this.L);
  }

  private mapHover(e: PointerEvent, pick: boolean): void {
    const r = this.els.map.getBoundingClientRect();
    const t = this.t;
    const gx = Math.floor(((e.clientX - r.left) / r.width) * t.W);
    const gy = Math.floor(((e.clientY - r.top) / r.height) * t.H);
    if (gx < 0 || gy < 0 || gx >= t.W || gy >= t.H) return;
    this.hoverCell = gy * t.W + gx;
    if (pick && this.settings.view !== 'islands') {
      this.followMapHover = e.pointerType !== 'touch';
      this.pickMapRow(this.lakeRowAt(this.hoverCell), true);
    }
    this.updateReadout(true);
  }

  private pickMapRow(k: number, repaint: boolean): void {
    // Don't clear a bar picked on the strip just because the pointer crossed dry land.
    if (k < 0 && !this.mapPicked) return;
    this.mapPicked = k >= 0;
    this.setHighlight(k, repaint);
  }

  /** Barcode row of the lake that covers `cell` at the current level, or −1 (dry or not drawn). */
  lakeRowAt(cell: number): number {
    this.t.flood.advanceTo(this.level());
    return this.floodedLakeRow(cell);
  }

  /** Resolve a row after advancing Flood. The active hover can reuse the render's advance. */
  private floodedLakeRow(cell: number): number {
    const t = this.t;
    if (cell < 0 || cell >= t.W * t.H) return -1;
    // A lake's id is its birth cell, which is also its union-find root (elder rule).
    const lake = t.flood.componentOf(cell);
    if (lake < 0) return -1;
    const rows = this.rows;
    for (let k = 0; k < rows.length; k++) if (rows[k].birthCell === lake) return k;
    return -1;
  }

  /**
   * Where barcode row k is drawn at the current level, in CSS px relative to the strip canvas,
   * or null if nothing is drawn (exposed for tests of hit-testing).
   */
  barRect(k: number): { x: number; y: number; w: number; h: number } | null {
    const rows = this.stripRows;
    const bar = rows[k];
    const level = this.level();
    if (!bar || level < bar.birth) return null;
    const L = this.L;
    const pitch = rowPitch(rows.length, L);
    const thick = Math.max(L.dpr, pitch * 0.62);
    const x0 = levelToX(bar.birth, this.t.minH, this.t.maxH, L);
    const x1 = levelToX(Math.min(bar.death, level), this.t.minH, this.t.maxH, L);
    const d = this.dpr;
    return {
      x: x0 / d,
      y: (L.top + k * pitch + (pitch - thick) / 2) / d,
      w: (x1 - x0) / d,
      h: thick / d,
    };
  }

  /** CSS size of the strip (exposed for tests). */
  get stripSize(): { w: number; h: number } {
    return this.stripCss;
  }
}
