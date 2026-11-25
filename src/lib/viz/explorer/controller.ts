import { Flood, isEssential } from '../../tda/index.ts';
import type { Bar, H0Result } from '../../tda/index.ts';
import type { ThemeName } from '../common/palettes.ts';
import { axisEdges, paintHatch, screenAxes, type BasinMask } from './basin.ts';
import { cellPosition, isCursorKey, moveCursor, startCell, type CursorKey } from './cursor.ts';
import { cellAreas, cellAtFraction, cellEdges, gridGeo, type GridGeo } from './geo.ts';
import { basinMask, lakeMask, traceOutline, WaterPainter } from './map.ts';
import {
  identitySlots,
  indexLakes,
  isAlive,
  LevelScale,
  nextDown,
  selectRows,
  IDENTITY_K,
  type LakeIndex,
  type Pacing,
  type StripView,
  type Units,
} from './model.ts';
import { IDENTITY, NEUTRAL_WATER, packRgba, WATER_ALPHA } from './palette.ts';
import {
  barcodeHit,
  diagramHit,
  drawStrip,
  niceTicks,
  rowAtY,
  rowPitch,
  stripFont,
  stripLayout,
  tickLabel,
  type StripLayout,
  type StripState,
} from './strip.ts';
import {
  hoverText,
  infoCard,
  length,
  NBSP,
  readouts,
  stripLabel,
  summaryText,
  type InfoCard,
} from './text.ts';
import type { ColoradoMeta } from './types.ts';

/**
 * Runtime for /rising-water/ (spec §6.4): the live flood over the Colorado grid, the map overlay,
 * the barcode / diagram strip, readouts, selection, pointer and keyboard input, and the pause rules
 * (off-screen, hidden tab, reduced motion). The pure parts live in model.ts, map.ts, strip.ts and
 * text.ts. The controller is created after the data are loaded and verified (explorer-client.ts).
 */

export interface ExplorerSettings {
  speed: number;
  pacing: Pacing;
  minPersistence: number;
  topN: number;
  units: Units;
  view: StripView;
}

export const EXPLORER_DEFAULTS: ExplorerSettings = {
  speed: 1,
  pacing: 'percentile',
  minPersistence: 10,
  topN: 40,
  units: 'm',
  view: 'barcode',
};

/** Seconds for one full rise at 1×. */
export const SWEEP_SECONDS = 40;
/** Reduced motion: a static frame at this scrubber position, with a Play button. */
export const REDUCED_MOTION_PROGRESS = 0.45;
const DPR_CAP = 2;
const READOUT_MS = 150;
/** Quiet time before the cell live region speaks, so holding an arrow key doesn't chatter. */
const ANNOUNCE_MS = 400;
/** Smallest drawn side of the keyboard cell cursor, in CSS px (a cell is about 2 px wide). */
const CURSOR_MIN_CSS = 11;
const NO_DASH: number[] = [];

export interface ExplorerElements {
  root: HTMLElement;
  stage: HTMLElement;
  map: HTMLCanvasElement;
  strip: HTMLCanvasElement;
  level: HTMLElement;
  levelAlt: HTMLElement;
  percentile: HTMLElement;
  lakes: HTMLElement;
  area: HTMLElement;
  hover: HTMLElement;
  /** Polite live region for keyboard / touch cell readouts (null: none on the page). */
  cellLive?: HTMLElement | null;
  cardTitle: HTMLElement;
  cardText: HTMLElement;
  summary: HTMLElement;
}

export interface ExplorerData {
  meta: ColoradoMeta;
  heights: Float32Array;
  result: H0Result;
}

export interface ExplorerUi {
  playing: boolean;
  progress: number;
  level: number;
  units: Units;
  selected: Bar | null;
}

interface Colors {
  text: string;
  muted: string;
  bg: string;
  control: string;
  accent: string;
}

export class ExplorerController {
  readonly els: ExplorerElements;
  readonly geo: GridGeo;
  readonly index: LakeIndex;
  readonly scale: LevelScale;
  readonly flood: Flood;
  readonly heights: Float32Array;
  readonly result: H0Result;
  settings: ExplorerSettings;
  /** Water level (m) — the source of truth; `progress` is its scrubber position. */
  level = 0;
  progress = 0;
  playing = false;
  /** Rendered frames (read by e2e to check pausing). */
  frames = 0;
  selected: Bar | null = null;
  rows: Bar[] = [];
  onUi: (s: ExplorerUi) => void = () => {};

  private readonly slotOf: Int16Array;
  private readonly identityBars: Bar[];
  private readonly painter: WaterPainter;
  private readonly image: ImageData;
  private readonly offscreen: HTMLCanvasElement;
  private readonly offCtx: CanvasRenderingContext2D;
  private readonly mapCtx: CanvasRenderingContext2D;
  private readonly stripCtx: CanvasRenderingContext2D;
  private readonly edges: { xs: Float64Array; ys: Float64Array };
  private readonly mask: Uint8Array;
  private readonly queue: Int32Array;
  private maskLake = -1;
  private maskWet = -2;
  private paintedWet = -1;
  private fills: string[] = [];
  private ticks: number[] = [];
  private tickText: string[] = [];
  private theme: ThemeName = 'light';
  private colors: Colors = {
    text: '#1c1b19',
    muted: '#5c574f',
    bg: '#f7f4ee',
    control: '#8a8378',
    accent: '#0b4f7a',
  };
  private dpr = 1;
  private L: StripLayout = stripLayout(1, 1, 1);
  private stripState: StripState;
  private raf = 0;
  private last = -1;
  private dirty = true;
  private onscreen = true;
  private visible = true;
  private running = false;
  /** Cell under a hovering pointer (cleared when it leaves the map). */
  private hoverCell = -1;
  /** Last tapped cell (touch / pen): stays shown after release until dismissed (QA-07). */
  private pinnedCell = -1;
  /** Keyboard cell cursor (QA-08); −1 while the arrow keys move the water level. */
  private cursorCell = -1;
  /** Where the cursor was when last turned off (it comes back there). */
  private lastCursor = -1;
  private announceTimer = 0;
  private pendingAnnounce = '';
  private lastReadoutAt = -Infinity;
  private readoutTimer = 0;
  private summaryTimer = 0;
  private lastUiAt = 0;
  private cleanup: (() => void)[] = [];
  private readonly renderMs = new Float64Array(1024);
  private renderCount = 0;
  /** Outline drawing state (bound once so frames don't allocate closures). */
  private segScaleX = 1;
  private segScaleY = 1;
  private labelBoxes = new Float64Array(4 * (IDENTITY_K + 2));
  private labelCount = 0;
  private readonly dash = [5, 4];
  /** Basin mask (F12b): display-only; null until the client has loaded and verified it. */
  private basin: BasinMask | null = null;
  private basinOn = false;
  /** Set by the client from basin-mask.json (basin.regionsLabel). */
  basinLabel = 'the basin mask';
  private basinLayer: HTMLCanvasElement | null = null;
  /** Size and colours the cached layer was built for; rebuilt when any changes. */
  private basinStale = true;
  private basinW = 0;
  private basinH = 0;
  private basinBg = '';
  private basinMuted = '';
  private basinEdgeX: Int32Array = new Int32Array(0);
  private basinEdgeY: Int32Array = new Int32Array(0);

  constructor(
    els: ExplorerElements,
    data: ExplorerData,
    settings: ExplorerSettings,
    opts: { reducedMotion: boolean },
  ) {
    this.els = els;
    this.settings = { ...settings };
    this.heights = data.heights;
    this.result = data.result;
    this.geo = gridGeo(data.meta);
    const { W, H } = this.geo;
    const mc = els.map.getContext('2d');
    const sc = els.strip.getContext('2d');
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const oc = off.getContext('2d');
    if (!mc || !sc || !oc) throw new Error('2-D canvas unavailable');
    this.mapCtx = mc;
    this.stripCtx = sc;
    this.offscreen = off;
    this.offCtx = oc;
    this.flood = new Flood(data.heights, W, H, { order: data.result.order });
    this.scale = new LevelScale(data.heights, data.result.order, cellAreas(this.geo));
    this.index = indexLakes(data.result.bars);
    this.slotOf = identitySlots(this.index, W * H);
    this.identityBars = [];
    if (this.index.essential) this.identityBars.push(this.index.essential);
    for (let r = 1; r < IDENTITY_K && r <= this.index.ranked.length; r++) {
      this.identityBars.push(this.index.ranked[r - 1]);
    }
    this.image = new ImageData(W, H);
    this.painter = new WaterPainter(W, H, new Uint32Array(this.image.data.buffer));
    this.edges = cellEdges(this.geo);
    this.mask = new Uint8Array(W * H);
    this.queue = new Int32Array(W * H);
    this.stripState = {
      L: this.L,
      view: this.settings.view,
      rows: this.rows,
      fills: this.fills,
      level: 0,
      minH: this.scale.minH,
      maxH: this.scale.maxH,
      colors: { axis: '', text: '', level: '', highlight: '' },
      selected: -1,
      ticks: this.ticks,
      tickText: this.tickText,
      levelText: '',
      font: stripFont(1),
    };
    this.readTheme();
    this.applyColors();
    this.selectRows();
    this.buildTicks();
    this.measure();
    this.labelStrip();
    if (opts.reducedMotion) {
      this.setProgressInternal(REDUCED_MOTION_PROGRESS);
      this.playing = false;
    } else {
      this.setProgressInternal(0);
      this.playing = true;
    }
    this.render();
    this.dirty = false;
    this.updateSummary();
    this.observe();
    this.syncState();
    this.emitUi(true);
    this.schedule();
  }

  // ---- public controls -----------------------------------------------------------------------

  setPlaying(on: boolean): void {
    if (on && this.progress >= 1) this.setProgressInternal(0);
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

  /** Move the scrubber to p ∈ [0, 1] (pauses playback). */
  scrubTo(p: number): void {
    this.pause();
    this.setProgressInternal(p);
    this.dirty = true;
    this.emitUi(true);
    this.queueSummary(300);
    this.schedule();
  }

  scrubBy(dp: number): void {
    this.scrubTo(this.progress + dp);
  }

  /** Set the water level directly (pauses playback). */
  setLevel(level: number): void {
    this.pause();
    this.setLevelInternal(level);
    this.dirty = true;
    this.emitUi(true);
    this.queueSummary(300);
    this.schedule();
  }

  /**
   * Select a lake (by its bar): the level jumps to just below the bar's death level, so the lake is
   * shown at its largest, just before it spills. The lowest lake never dies: the level goes to the
   * top, where it holds all the water. Passing null clears the selection.
   */
  select(bar: Bar | null): void {
    this.pause();
    this.selected = bar;
    this.maskLake = -1;
    if (bar) this.setLevelInternal(isEssential(bar) ? this.scale.maxH : nextDown(bar.death));
    this.stripState.selected = bar ? this.rows.indexOf(bar) : -1;
    this.dirty = true;
    this.updateCard();
    this.emitUi(true);
    this.queueSummary(0);
    this.schedule();
  }

  /** Select the lake born at `cell` (its id), e.g. from a table button. */
  selectCell(cell: number): boolean {
    const bar = this.index.barOf.get(cell);
    if (!bar) return false;
    this.select(bar);
    return true;
  }

  /** Move the selection to the next / previous drawn row. */
  cycleSelection(dir: 1 | -1): void {
    const n = this.rows.length;
    if (n === 0) return;
    const k = this.selected ? this.rows.indexOf(this.selected) : -1;
    const next = k < 0 ? (dir > 0 ? 0 : n - 1) : (k + dir + n) % n;
    this.select(this.rows[next]);
  }

  /**
   * Hand over the verified basin mask (or null) and show or hide it. The mask only changes what is
   * drawn over the map and the text that mentions it; the flood and the barcode never use it.
   */
  setBasin(mask: BasinMask | null, on: boolean): void {
    if (mask && mask !== this.basin) {
      this.basin = mask;
      this.basinStale = true;
    }
    const show = on && !!this.basin;
    if (show === this.basinOn && !mask) return;
    this.basinOn = show;
    this.els.root.dataset.basin = show ? 'on' : 'off';
    this.dirty = true;
    this.updateCard();
    this.refreshInspect();
    this.queueSummary(0);
    this.schedule();
  }

  get basinShown(): boolean {
    return this.basinOn;
  }

  /** 14 or 15 inside the basin, 0 outside, −1 if the mask isn't loaded. */
  basinAt(cell: number): number {
    if (!this.basin || cell < 0 || cell >= this.basin.region.length) return -1;
    return this.basin.region[cell];
  }

  update(next: Partial<ExplorerSettings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...next };
    const s = this.settings;
    if (s.minPersistence !== prev.minPersistence || s.topN !== prev.topN) this.selectRows();
    if (s.units !== prev.units) {
      this.buildTicks();
      this.updateCard();
    }
    if (s.pacing !== prev.pacing) this.progress = this.scale.progressAt(this.level, s.pacing);
    if (s.view !== prev.view) {
      this.stripState.view = s.view;
      this.labelStrip();
    }
    this.dirty = true;
    this.updateReadout(true);
    this.emitUi(true);
    this.queueSummary(300);
    this.schedule();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.readoutTimer);
    clearTimeout(this.summaryTimer);
    clearTimeout(this.announceTimer);
    this.cleanup.forEach((f) => f());
  }

  // ---- read-only views (tests, client) -------------------------------------------------------

  get isRunning(): boolean {
    return this.running;
  }

  get wetCount(): number {
    this.flood.advanceTo(this.level);
    return this.flood.wetCount;
  }

  get lakeCount(): number {
    this.flood.advanceTo(this.level);
    return this.flood.alive();
  }

  get percentile(): number {
    return this.scale.percentile(this.wetCount);
  }

  get areaPercent(): number {
    return this.scale.areaPercent(this.wetCount);
  }

  /** Recent render() durations in ms (most recent last). */
  renderTimes(): number[] {
    const n = Math.min(this.renderCount, this.renderMs.length);
    const out: number[] = [];
    for (let k = this.renderCount - n; k < this.renderCount; k++) {
      out.push(this.renderMs[k % this.renderMs.length]);
    }
    return out;
  }

  /** Identity colour of a bar's lake (or the neutral bar colour). */
  fillOf(bar: Bar): string {
    const s = this.slotOf[bar.birthCell];
    return s >= 0 ? IDENTITY[this.theme][s] : this.colors.control;
  }

  /** The stage's map cell under fractional map coordinates (exposed for tests). */
  cellAt(fx: number, fy: number): number {
    return cellAtFraction(fx, fy, this.geo);
  }

  // ---- cell inspection (pointer, touch, keyboard cursor) -------------------------------------

  /** The keyboard cursor's cell, or −1 when it is off. */
  get cursor(): number {
    return this.cursorCell;
  }

  /** The cell whose readout is shown (hover, then cursor, then last tap), or −1. */
  shownCell(): number {
    if (this.hoverCell >= 0) return this.hoverCell;
    if (this.cursorCell >= 0) return this.cursorCell;
    return this.pinnedCell;
  }

  /**
   * Turn the keyboard cell cursor on (at the hovered or tapped cell, else where it was last, else
   * the selected lake's pit, else the centre of the grid) or off. While it is on, the arrow keys move it instead of the
   * water level.
   */
  setCursor(on: boolean): void {
    if (on === this.cursorCell >= 0) return;
    if (on) {
      const last =
        this.hoverCell >= 0
          ? this.hoverCell
          : this.pinnedCell >= 0
            ? this.pinnedCell
            : this.lastCursor;
      this.cursorCell = startCell(
        last,
        this.selected ? this.selected.birthCell : -1,
        this.geo.W,
        this.geo.H,
      );
      this.pinnedCell = -1;
    } else {
      this.lastCursor = this.cursorCell;
      this.cursorCell = -1;
    }
    this.els.root.dataset.cursor = on ? 'on' : 'off';
    this.refreshInspect();
    this.announce(
      on
        ? `Cell cursor on. ${this.inspectText(this.cursorCell)}`
        : 'Cell cursor off. The arrow keys move the water level again.',
      0,
    );
    this.dirty = true;
    this.schedule();
  }

  /** Move the keyboard cursor as `key` does (turning it on first if needed). */
  moveCursorKey(key: CursorKey, shift: boolean): void {
    if (this.cursorCell < 0) this.setCursor(true);
    const next = moveCursor(this.cursorCell, key, shift, this.geo.W, this.geo.H);
    if (next === this.cursorCell) {
      this.announce(`Edge of the grid. ${this.inspectText(next)}`, ANNOUNCE_MS);
      return;
    }
    this.cursorCell = next;
    this.refreshInspect();
    this.announce(this.inspectText(next), ANNOUNCE_MS);
    this.dirty = true;
    this.schedule();
  }

  /** Forget the tapped cell (tap elsewhere / Escape). Returns whether anything was cleared. */
  clearPinned(): boolean {
    if (this.pinnedCell < 0) return false;
    this.pinnedCell = -1;
    this.refreshInspect();
    return true;
  }

  private inspectText(cell: number): string {
    const base = this.hoverReadout(cell);
    if (cell !== this.cursorCell) return base;
    return `Cursor at ${cellPosition(cell, this.geo.W, this.geo.H)}: ${base}`;
  }

  /** Visible readout under the map: the shown cell, or the default hint. */
  private refreshInspect(): void {
    const cell = this.shownCell();
    this.flood.advanceTo(this.level);
    set(
      this.els.hover,
      cell >= 0 ? this.inspectText(cell) : (this.els.hover.dataset.default ?? ''),
    );
    const v = cell >= 0 ? String(cell) : '';
    if (this.els.root.dataset.hoverCell !== v) this.els.root.dataset.hoverCell = v;
    const c = this.cursorCell >= 0 ? String(this.cursorCell) : '';
    if (this.els.root.dataset.cursorCell !== c) this.els.root.dataset.cursorCell = c;
  }

  /** Polite, debounced announcement (keyboard and touch only; mouse hover never speaks). */
  private announce(text: string, delay: number): void {
    const live = this.els.cellLive;
    if (!live) return;
    this.pendingAnnounce = text;
    clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => {
      this.announceTimer = 0;
      set(live, this.pendingAnnounce);
    }, delay);
  }

  // ---- internals: state ----------------------------------------------------------------------

  private pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.syncState();
  }

  private setProgressInternal(p: number): void {
    this.progress = Math.min(1, Math.max(0, p));
    this.level = this.scale.levelAt(this.progress, this.settings.pacing);
  }

  private setLevelInternal(level: number): void {
    this.level = Math.min(this.scale.maxH, Math.max(this.scale.minH, level));
    this.progress = this.scale.progressAt(this.level, this.settings.pacing);
  }

  private selectRows(): void {
    const s = this.settings;
    this.rows = selectRows(this.index, s.minPersistence, s.topN, this.result.rank);
    this.fills = this.rows.map((b) => this.fillOf(b));
    this.stripState.rows = this.rows;
    this.stripState.fills = this.fills;
    this.stripState.selected = this.selected ? this.rows.indexOf(this.selected) : -1;
  }

  private buildTicks(): void {
    const u = this.settings.units;
    this.ticks = niceTicks(this.scale.minH, this.scale.maxH, u);
    this.tickText = this.ticks.map((v) => tickLabel(v, u));
    this.stripState.ticks = this.ticks;
    this.stripState.tickText = this.tickText;
  }

  private labelStrip(): void {
    this.els.strip.setAttribute('aria-label', stripLabel(this.settings.view));
  }

  private updateCard(): void {
    const card = this.card();
    const title = card ? card.title : 'No lake selected';
    const text = card
      ? card.text + this.basinNote(this.selected!.birthCell, 'card')
      : 'Click a bar, or use a button in the “Longest-lived lakes” table, to see where a lake is born and where it spills.';
    if (this.els.cardTitle.textContent !== title) this.els.cardTitle.textContent = title;
    if (this.els.cardText.textContent !== text) this.els.cardText.textContent = text;
    this.els.root.dataset.selected = this.selected ? String(this.selected.birthCell) : '';
  }

  /** " Its pit is inside the basin mask (WBD region 15)." etc., or "" while the mask is off. */
  private basinNote(cell: number, where: 'card' | 'hover'): string {
    if (!this.basinOn) return '';
    const r = this.basinAt(cell);
    if (r < 0) return '';
    if (where === 'hover')
      return r ? ` · inside the basin mask (region${NBSP}${r})` : ' · outside the basin mask';
    return r
      ? ` Its pit is inside the basin mask (WBD region${NBSP}${r}).`
      : ' Its pit is outside the basin mask.';
  }

  /** The info card for the selected lake, or null. */
  card(): InfoCard | null {
    return this.selected
      ? infoCard(this.selected, this.index, this.geo, this.settings.units)
      : null;
  }

  // ---- colours and sizing --------------------------------------------------------------------

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
      bg: v('--color-surface', this.colors.bg),
      control: v('--color-control', this.colors.control),
      accent: v('--color-accent', this.colors.accent),
    };
  }

  private applyColors(): void {
    const cols = new Uint32Array(IDENTITY_K);
    IDENTITY[this.theme].forEach((c, k) => (cols[k] = packRgba(c, WATER_ALPHA.identity)));
    this.painter.setColors(cols, packRgba(NEUTRAL_WATER[this.theme], WATER_ALPHA.neutral));
    this.paintedWet = -1;
    this.fills = this.rows.map((b) => this.fillOf(b));
    this.stripState.fills = this.fills;
    const c = this.stripState.colors;
    c.axis = this.colors.control;
    c.text = this.colors.muted;
    c.level = this.colors.accent;
    c.highlight = this.colors.text;
    this.dirty = true;
  }

  private onThemeChange = (): void => {
    const before = this.theme;
    const text = this.colors.text;
    this.readTheme();
    if (before === this.theme && text === this.colors.text) return;
    this.applyColors();
    this.basinStale = true;
    this.schedule();
  };

  private measure(): void {
    this.dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
    const m = this.els.map.getBoundingClientRect();
    const s = this.els.strip.getBoundingClientRect();
    const mw = Math.max(1, Math.round(this.dpr * m.width));
    const mh = Math.max(1, Math.round(this.dpr * m.height));
    if (this.els.map.width !== mw || this.els.map.height !== mh) {
      this.els.map.width = mw;
      this.els.map.height = mh;
    }
    const sw = Math.max(1, Math.round(this.dpr * s.width));
    const sh = Math.max(1, Math.round(this.dpr * s.height));
    if (this.els.strip.width !== sw || this.els.strip.height !== sh) {
      this.els.strip.width = sw;
      this.els.strip.height = sh;
    }
    this.L = stripLayout(s.width, s.height, this.dpr);
    this.stripState.L = this.L;
    this.stripState.font = stripFont(this.dpr);
    this.dirty = true;
  }

  // ---- animation loop ------------------------------------------------------------------------

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
    const p = this.progress + (dt / 1000 / SWEEP_SECONDS) * this.settings.speed;
    this.setProgressInternal(p);
    if (this.progress >= 1) {
      this.playing = false;
      this.syncState();
      this.queueSummary(0);
      this.emitUi(true);
      return;
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
    this.onUi({
      playing: this.playing,
      progress: this.progress,
      level: this.level,
      units: this.settings.units,
      selected: this.selected,
    });
  }

  // ---- rendering -----------------------------------------------------------------------------

  private render(): void {
    const t0 = performance.now();
    const flood = this.flood;
    flood.advanceTo(this.level);
    if (flood.wetCount !== this.paintedWet) {
      this.painter.paint(flood, this.slotOf);
      this.offCtx.putImageData(this.image, 0, 0);
      this.paintedWet = flood.wetCount;
    }
    const ctx = this.mapCtx;
    const cw = this.els.map.width;
    const ch = this.els.map.height;
    const g = this.geo;
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    // One grid cell = `block` native pixels; the last column/row are partial, so the image runs
    // slightly past the canvas and is clipped there.
    ctx.drawImage(
      this.offscreen,
      0,
      0,
      g.W,
      g.H,
      0,
      0,
      ((g.W * g.block) / g.nativeW) * cw,
      ((g.H * g.block) / g.nativeH) * ch,
    );
    if (this.basinOn) this.drawBasin(cw, ch);
    this.labelCount = 0;
    if (this.selected) this.drawSelected(this.selected);
    this.drawLakeLabels();
    if (this.cursorCell >= 0) this.drawCursor(this.cursorCell);

    const st = this.stripState;
    st.level = this.level;
    st.levelText = length(this.level, this.settings.units);
    drawStrip(this.stripCtx, st);
    this.frames++;
    this.renderMs[this.renderCount % this.renderMs.length] = performance.now() - t0;
    this.renderCount++;
    this.updateReadout(!this.playing);
  }

  /**
   * Basin mask over the water: hatching outside, a line along the boundary. The layer is rasterised
   * once per canvas size and theme at device resolution (each device pixel takes the cell under its
   * centre, the same rule as the water and hover), then copied 1:1 each frame.
   */
  private drawBasin(cw: number, ch: number): void {
    // Compared field by field (no per-frame string building).
    if (
      this.basinStale ||
      cw !== this.basinW ||
      ch !== this.basinH ||
      this.basinBg !== this.colors.bg ||
      this.basinMuted !== this.colors.muted
    ) {
      this.buildBasinLayer(cw, ch);
      this.basinStale = false;
      this.basinW = cw;
      this.basinH = ch;
      this.basinBg = this.colors.bg;
      this.basinMuted = this.colors.muted;
    }
    if (this.basinLayer) this.mapCtx.drawImage(this.basinLayer, 0, 0);
  }

  /** Last basin-layer rasterisation time in ms (read by e2e / the checker). */
  basinBuildMs = 0;

  private buildBasinLayer(cw: number, ch: number): void {
    const mask = this.basin;
    if (!mask) return;
    const t0 = performance.now();
    const g = this.geo;
    const d = this.dpr;
    const layer = this.basinLayer ?? document.createElement('canvas');
    this.basinLayer = layer;
    layer.width = cw;
    layer.height = ch;
    const lc = layer.getContext('2d');
    if (!lc) return;
    const { cols, rows } = screenAxes(cw, ch, g);
    const img = new ImageData(cw, ch);
    const dark = this.theme === 'dark';
    paintHatch(new Uint32Array(img.data.buffer), mask.inside, g.W, cols, rows, {
      dim: packRgba(this.colors.bg, dark ? 150 : 130),
      hatch: packRgba(this.colors.muted, dark ? 170 : 150),
      period: Math.max(4, Math.round(7 * d)),
      width: Math.max(1, Math.round(d)),
    });
    lc.putImageData(img, 0, 0);
    // Boundary on the device-pixel grid lines between inside and outside pixels. Segments on the
    // study-area rectangle are skipped: that is the edge of the data, not of the basin.
    this.basinEdgeX = axisEdges(
      cols,
      g.W,
      this.basinEdgeX.length === g.W + 1 ? this.basinEdgeX : undefined,
    );
    this.basinEdgeY = axisEdges(
      rows,
      g.H,
      this.basinEdgeY.length === g.H + 1 ? this.basinEdgeY : undefined,
    );
    const ex = this.basinEdgeX;
    const ey = this.basinEdgeY;
    lc.beginPath();
    traceOutline(mask.inside, g.W, g.H, (x0, y0, x1, y1) => {
      if ((x0 === x1 && (x0 === 0 || x0 === g.W)) || (y0 === y1 && (y0 === 0 || y0 === g.H))) {
        return;
      }
      lc.moveTo(ex[x0], ey[y0]);
      lc.lineTo(ex[x1], ey[y1]);
    });
    lc.lineCap = 'square';
    lc.lineJoin = 'miter';
    lc.strokeStyle = this.colors.bg;
    lc.lineWidth = 4 * d;
    lc.stroke();
    lc.strokeStyle = this.colors.accent;
    lc.lineWidth = 2 * d;
    lc.stroke();
    this.basinBuildMs = performance.now() - t0;
  }

  private cellX(i: number): number {
    const x = i % this.geo.W;
    return ((this.edges.xs[x] + this.edges.xs[x + 1]) / 2) * this.els.map.width;
  }

  private cellY(i: number): number {
    const y = Math.floor(i / this.geo.W);
    return ((this.edges.ys[y] + this.edges.ys[y + 1]) / 2) * this.els.map.height;
  }

  private seg = (x0: number, y0: number, x1: number, y1: number): void => {
    const xs = this.edges.xs;
    const ys = this.edges.ys;
    this.mapCtx.moveTo(xs[x0] * this.segScaleX, ys[y0] * this.segScaleY);
    this.mapCtx.lineTo(xs[x1] * this.segScaleX, ys[y1] * this.segScaleY);
  };

  /** Outline, pit and pass markers and labels for the selected lake (never colour alone). */
  private drawSelected(bar: Bar): void {
    const ctx = this.mapCtx;
    const d = this.dpr;
    const level = this.level;
    const g = this.geo;
    const wet = this.flood.wetCount;
    let merged = false;
    let have = false;
    if (level >= bar.birth) {
      if (level >= bar.death) {
        merged = true;
        if (this.maskLake !== bar.birthCell || this.maskWet !== -1) {
          basinMask(
            bar.birthCell,
            this.result.rank[bar.deathCell],
            this.result.rank,
            g.W,
            g.H,
            this.mask,
            this.queue,
          );
          this.maskLake = bar.birthCell;
          this.maskWet = -1;
        }
      } else if (this.maskLake !== bar.birthCell || this.maskWet !== wet) {
        lakeMask(this.flood, bar.birthCell, this.mask);
        this.maskLake = bar.birthCell;
        this.maskWet = wet;
      }
      have = true;
    }
    if (have) {
      this.segScaleX = this.els.map.width;
      this.segScaleY = this.els.map.height;
      this.dash[0] = 5 * d;
      this.dash[1] = 4 * d;
      ctx.setLineDash(merged ? this.dash : NO_DASH);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      traceOutline(this.mask, g.W, g.H, this.seg);
      ctx.strokeStyle = this.colors.bg;
      ctx.lineWidth = 4 * d;
      ctx.stroke();
      ctx.strokeStyle = this.colors.text;
      ctx.lineWidth = 2 * d;
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    }
    const cw = this.els.map.width;
    const chh = this.els.map.height;
    const clampX = (x: number, r: number) => Math.min(cw - r - 2 * d, Math.max(r + 2 * d, x));
    const clampY = (y: number, r: number) => Math.min(chh - r - 2 * d, Math.max(r + 2 * d, y));
    const pitR = 5 * d;
    const passR = 6 * d;
    const px = clampX(this.cellX(bar.birthCell), pitR);
    const py = clampY(this.cellY(bar.birthCell), pitR);
    const finite = !isEssential(bar);
    const qx = finite ? clampX(this.cellX(bar.deathCell), passR) : 0;
    const qy = finite ? clampY(this.cellY(bar.deathCell), passR) : 0;
    if (finite) {
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
    // Pit drawn last so it is never hidden by an adjacent pass.
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
    const rank = this.index.rankOf.get(bar.birthCell);
    const name = rank === 0 ? 'Lowest lake' : `Lake ${rank ?? ''}`;
    ctx.font = `600 ${12 * d}px "IBM Plex Sans", system-ui, sans-serif`;
    this.placeLabel(`${name} · pit`, px, py, pitR + 4 * d, 16 * d);
    if (finite)
      this.placeLabel(
        level >= bar.death ? 'pass' : 'pass (spills here)',
        qx,
        qy,
        passR + 4 * d,
        16 * d,
      );
  }

  /**
   * Keyboard cell cursor: a square ring around the cell (at least CURSOR_MIN_CSS wide, since a
   * cell is only about 2 CSS px), in the surface colour under the text colour so it reads on both
   * the relief and the water, with the exact cell filled.
   */
  private drawCursor(cell: number): void {
    const ctx = this.mapCtx;
    const d = this.dpr;
    const cw = this.els.map.width;
    const chh = this.els.map.height;
    const W = this.geo.W;
    const y = Math.floor(cell / W);
    const x = cell - y * W;
    const x0 = this.edges.xs[x] * cw;
    const x1 = this.edges.xs[x + 1] * cw;
    const y0 = this.edges.ys[y] * chh;
    const y1 = this.edges.ys[y + 1] * chh;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const half = Math.max(x1 - x0, y1 - y0, CURSOR_MIN_CSS * d) / 2;
    ctx.setLineDash(NO_DASH);
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = this.colors.bg;
    ctx.lineWidth = 4 * d;
    ctx.strokeRect(cx - half, cy - half, 2 * half, 2 * half);
    ctx.strokeStyle = this.colors.text;
    ctx.lineWidth = 2 * d;
    ctx.strokeRect(cx - half, cy - half, 2 * half, 2 * half);
    ctx.fillStyle = this.colors.text;
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  }

  /** Number labels at the pits of identity lakes that are alive now. */
  private drawLakeLabels(): void {
    const ctx = this.mapCtx;
    const d = this.dpr;
    ctx.font = `600 ${11 * d}px "IBM Plex Mono", ui-monospace, monospace`;
    for (let k = 0; k < this.identityBars.length; k++) {
      const b = this.identityBars[k];
      if (b === this.selected || !isAlive(b, this.level)) continue;
      const text = k === 0 ? 'lowest' : String(k);
      this.placeLabel(text, this.cellX(b.birthCell), this.cellY(b.birthCell), 3 * d, 14 * d);
    }
  }

  /**
   * Draw `text` next to (x, y), inside the canvas and clear of earlier labels where possible
   * (right, left, above, below). The box list is preallocated.
   */
  private placeLabel(text: string, x: number, y: number, r: number, lh: number): void {
    const ctx = this.mapCtx;
    const d = this.dpr;
    const cw = this.els.map.width;
    const chh = this.els.map.height;
    const w = ctx.measureText(text).width + 4 * d;
    let bx = 0;
    let by = 0;
    for (let c = 0; c < 4; c++) {
      bx = c === 0 ? x + r : c === 1 ? x - r - w : x - w / 2;
      by = c === 2 ? y - r - lh : c === 3 ? y + r : y - lh / 2;
      bx = Math.min(cw - w - 2 * d, Math.max(2 * d, bx));
      by = Math.min(chh - lh - 2 * d, Math.max(2 * d, by));
      if (!this.overlaps(bx, by, w, lh)) break;
    }
    const n = this.labelCount;
    if (4 * (n + 1) <= this.labelBoxes.length) {
      this.labelBoxes[4 * n] = bx;
      this.labelBoxes[4 * n + 1] = by;
      this.labelBoxes[4 * n + 2] = w;
      this.labelBoxes[4 * n + 3] = lh;
      this.labelCount++;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 * d;
    ctx.strokeStyle = this.colors.bg;
    ctx.strokeText(text, bx + 2 * d, by + lh / 2);
    ctx.fillStyle = this.colors.text;
    ctx.fillText(text, bx + 2 * d, by + lh / 2);
  }

  private overlaps(x: number, y: number, w: number, h: number): boolean {
    const b = this.labelBoxes;
    for (let k = 0; k < this.labelCount; k++) {
      const bx = b[4 * k];
      const by = b[4 * k + 1];
      if (x < bx + b[4 * k + 2] && bx < x + w && y < by + b[4 * k + 3] && by < y + h) return true;
    }
    return false;
  }

  // ---- readouts and summary ------------------------------------------------------------------

  /**
   * Readouts always match the map when not playing (pause, scrub, selection, settings). During
   * play they are throttled to one update per 150 ms, with a guaranteed trailing update.
   */
  private updateReadout(force: boolean): void {
    const now = performance.now();
    if (!force && this.playing) {
      const wait = READOUT_MS - (now - this.lastReadoutAt);
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
    this.flood.advanceTo(this.level);
    const wet = this.flood.wetCount;
    const r = readouts(
      this.level,
      this.scale.percentile(wet),
      this.flood.alive(),
      this.scale.areaPercent(wet),
      this.settings.units,
    );
    const e = this.els;
    set(e.level, r.level);
    set(e.levelAlt, r.levelAlt);
    set(e.percentile, r.percentile);
    set(e.lakes, r.lakes);
    set(e.area, r.area);
    if (this.shownCell() >= 0) this.refreshInspect();
  }

  private hoverReadout(cell: number): string {
    const lake = this.flood.componentOf(cell);
    return (
      hoverText(
        cell,
        this.heights[cell],
        this.geo,
        lake >= 0 ? { rank: this.index.rankOf.get(lake), cell: lake } : null,
        this.settings.units,
      ) + this.basinNote(cell, 'hover')
    );
  }

  private queueSummary(delay: number): void {
    clearTimeout(this.summaryTimer);
    this.summaryTimer = window.setTimeout(() => this.updateSummary(), delay);
  }

  private updateSummary(): void {
    this.flood.advanceTo(this.level);
    const wet = this.flood.wetCount;
    const text = summaryText({
      playing: this.playing,
      level: this.level,
      percentile: this.scale.percentile(wet),
      lakes: this.flood.alive(),
      areaPct: this.scale.areaPercent(wet),
      units: this.settings.units,
      pacing: this.settings.pacing,
      view: this.settings.view,
      rows: this.rows.length,
      selected: this.card(),
      basin: this.basinOn ? this.basinLabel : null,
    });
    set(this.els.summary, text);
  }

  // ---- events --------------------------------------------------------------------------------

  private observe(): void {
    const { stage, map, strip } = this.els;
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
    io.observe(this.els.root);
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

    const ro = new ResizeObserver(() => {
      this.measure();
      this.schedule();
    });
    ro.observe(map);
    ro.observe(strip);
    this.cleanup.push(() => ro.disconnect());

    const mo = new MutationObserver(this.onThemeChange);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.cleanup.push(() => mo.disconnect());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', this.onThemeChange);
    this.cleanup.push(() => mq.removeEventListener('change', this.onThemeChange));

    // Keyboard, scoped to the focused stage so it never hijacks form controls or page scrolling.
    on(stage, 'keydown', (e) => {
      if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter') {
        this.setCursor(this.cursorCell < 0);
        e.preventDefault();
        return;
      }
      if (this.cursorCell >= 0) {
        // Cell cursor on: arrows, Home/End and Page Up/Down move it; Escape turns it off.
        if (isCursorKey(e.key)) {
          this.moveCursorKey(e.key, e.shiftKey);
          e.preventDefault();
          return;
        }
        if (e.key === 'Escape') {
          this.setCursor(false);
          e.preventDefault();
          return;
        }
      }
      const step = e.shiftKey ? 0.05 : 0.005;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          this.togglePlay();
          break;
        case 'ArrowLeft':
          this.scrubBy(-step);
          break;
        case 'ArrowRight':
          this.scrubBy(step);
          break;
        case 'Home':
          this.scrubTo(0);
          break;
        case 'End':
          this.scrubTo(1);
          break;
        case 'ArrowUp':
          this.cycleSelection(-1);
          break;
        case 'ArrowDown':
          this.cycleSelection(1);
          break;
        case 'Escape':
          if (this.selected) this.select(null);
          else if (!this.clearPinned()) return;
          break;
        default:
          return;
      }
      e.preventDefault();
    });

    on(map, 'pointermove', (e) => this.mapHover(e));
    on(map, 'pointerdown', (e) => {
      this.mapHover(e);
      // Touch and pen: keep the tapped cell's readout after release (QA-07).
      if (e.pointerType !== 'mouse' && this.hoverCell >= 0) this.pin(this.hoverCell);
    });
    on(map, 'pointerleave', () => {
      this.hoverCell = -1;
      this.refreshInspect();
    });
    // A tap or click anywhere else dismisses a tapped readout.
    const outside = (e: PointerEvent) => {
      if (this.pinnedCell >= 0 && !(e.target instanceof Node && map.contains(e.target))) {
        this.clearPinned();
      }
    };
    document.addEventListener('pointerdown', outside);
    this.cleanup.push(() => document.removeEventListener('pointerdown', outside));

    on(strip, 'pointermove', (e) => {
      strip.style.cursor = this.stripHit(e) >= 0 ? 'pointer' : 'default';
    });
    on(strip, 'click', (e) => {
      const k = this.stripHit(e);
      if (k >= 0) this.select(this.rows[k]);
    });
  }

  private stripHit(e: MouseEvent): number {
    const r = this.els.strip.getBoundingClientRect();
    const x = (e.clientX - r.left) * this.dpr;
    const y = (e.clientY - r.top) * this.dpr;
    if (this.settings.view === 'diagram') {
      return diagramHit(x, y, 10 * this.dpr, this.rows, this.scale.minH, this.scale.maxH, this.L);
    }
    if (x < this.L.left - 4 * this.dpr || x > this.L.right + 14 * this.dpr) return -1;
    return barcodeHit(y, this.rows.length, this.L);
  }

  private mapHover(e: PointerEvent): void {
    const r = this.els.map.getBoundingClientRect();
    const cell = cellAtFraction(
      (e.clientX - r.left) / r.width,
      (e.clientY - r.top) / r.height,
      this.geo,
    );
    if (cell < 0) return;
    this.hoverCell = cell;
    this.refreshInspect();
  }

  private pin(cell: number): void {
    if (this.cursorCell >= 0) {
      // Keyboard cursor on: the tap moves it, so the arrow keys continue from there.
      this.cursorCell = cell;
      this.pinnedCell = -1;
      this.dirty = true;
      this.schedule();
    } else {
      this.pinnedCell = cell;
    }
    this.refreshInspect();
    this.announce(this.inspectText(cell), 0);
  }

  /** Row index under a strip point in CSS px (for tests). */
  rowAtCss(y: number): number {
    return rowAtY(y * this.dpr, this.rows.length, this.L);
  }

  /** CSS y of the centre of drawn row k (for tests). */
  rowCenterCss(k: number): number {
    const pitch = rowPitch(this.rows.length, this.L);
    return (this.L.top + (k + 0.5) * pitch) / this.dpr;
  }
}

function set(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
