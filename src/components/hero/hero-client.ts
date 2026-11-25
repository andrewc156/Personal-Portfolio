/**
 * Wires the hero canvas (Hero.astro) and its settings form (HeroSettings.astro, inside F1's
 * panel) to the running mode: HeroController for Rising water (the default, loaded with the
 * page) or a ModeController for the extra modes, which are loaded on demand with import().
 * Switching modes destroys the previous controller first (frame, timers, listeners, observers).
 */
import { syncSliderOutput } from '../site/settings';
import { normalizeSeed, randomSeed } from '../../lib/viz/common/rng';
import type { PaletteName } from '../../lib/viz/common/palettes';
import {
  HERO_DEFAULTS,
  HeroController,
  type HeroSettings,
  type HeroUiState,
} from '../../lib/viz/hero/controller';
import type { BarcodeView } from '../../lib/viz/hero/barcode';
import type { Pacing } from '../../lib/viz/hero/model';
import type { ColorBy } from '../../lib/viz/hero/render-map';
import { ISLANDS_EXPLAINER } from '../../lib/viz/hero/text';
import {
  COLLATZ_DEFAULT_STEPS,
  DEFAULT_MODE,
  isHeroMode,
  modeMeta,
  type HeroModeId,
} from '../../lib/viz/hero/modes/meta';
import type { ModeController, ModeSettings } from '../../lib/viz/hero/modes/shell';

/** What the buttons, keyboard and tests need from either kind of controller. */
interface ArtController {
  readonly playing: boolean;
  readonly settings: { seed: number };
  readonly frames: number;
  readonly isRunning: boolean;
  readonly pendingTimers: number;
  onUi: (s: HeroUiState) => void;
  togglePlay(): void;
  setPlaying(on: boolean): void;
  newTerrain(seed?: number): void;
  destroy(): void;
}

declare global {
  interface HTMLElement {
    /** The Rising water controller while that mode runs (read by e2e tests). */
    __hero?: HeroController;
    /** The extra-mode controller while one runs (read by e2e tests). */
    __heroMode?: ModeController;
    /** The active controller, whichever mode (read by e2e tests). */
    __art?: ArtController;
    /** Switch modes programmatically (e2e); resolves once the new mode has drawn. */
    __setHeroMode?: (id: HeroModeId) => Promise<void>;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function readForm(seed: number): HeroSettings {
  const num = (id: string, fallback: number) => {
    const el = byId<HTMLInputElement>(id);
    const v = el ? Number(el.value) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  const str = (id: string, fallback: string) => byId<HTMLSelectElement>(id)?.value ?? fallback;
  const bool = (id: string, fallback: boolean) => byId<HTMLInputElement>(id)?.checked ?? fallback;
  const D = HERO_DEFAULTS;
  return {
    seed,
    scale: num('hero-scale', D.scale),
    roughness: num('hero-roughness', D.roughness),
    speed: num('hero-speed', D.speed),
    pacing: str('hero-pacing', D.pacing) as Pacing,
    loop: bool('hero-loop', D.loop),
    showBarcode: bool('hero-show-barcode', D.showBarcode),
    minPersistence: num('hero-min-persistence', D.minPersistence),
    maxBars: num('hero-max-bars', D.maxBars),
    view: str('hero-view', D.view) as BarcodeView,
    palette: str('hero-palette', D.palette) as PaletteName,
    colorBy: str('hero-color-by', D.colorBy) as ColorBy,
    shoreline: bool('hero-shoreline', D.shoreline),
  };
}

function readModeForm(id: HeroModeId, seed: number): ModeSettings {
  const { speed, palette } = readForm(seed);
  const settings: ModeSettings = { seed, speed, palette };
  if (id === 'collatz') {
    settings.collatzSteps =
      byId<HTMLInputElement>('hero-collatz-steps')?.valueAsNumber ?? COLLATZ_DEFAULT_STEPS;
  }
  return settings;
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;
  const map = root.querySelector<HTMLCanvasElement>('[data-hero-map]');
  const strip = root.querySelector<HTMLCanvasElement>('[data-hero-strip]');
  const stripBox = root.querySelector<HTMLElement>('[data-hero-strip-box]');
  const readout = root.querySelector<HTMLElement>('[data-hero-readout]');
  const summary = root.querySelector<HTMLElement>('[data-hero-summary]');
  const keys = root.querySelector<HTMLElement>('[data-hero-keys]');
  if (!map || !strip || !stripBox || !readout || !summary) return;
  const caption = document.querySelector<HTMLElement>('[data-hero-caption]');
  const captionLink = document.querySelector<HTMLElement>('[data-hero-caption-link]');
  const risingMapLabel = map.getAttribute('aria-label') ?? '';

  const form = document.querySelector<HTMLFormElement>('[data-hero-settings]');
  const islandsCopy = form?.querySelector<HTMLElement>('[data-hero-islands-copy]') ?? null;
  const seedInput = byId<HTMLInputElement>('hero-seed');
  const levelInput = byId<HTMLInputElement>('hero-level');
  const modeInput = byId<HTMLSelectElement>('hero-mode');
  const modeNote = document.querySelector<HTMLElement>('[data-mode-note]');
  const risingOnly = document.querySelectorAll<HTMLElement>('[data-rising-only]');
  const collatzOnly = form?.querySelector<HTMLElement>('[data-collatz-only]');
  const playButtons = document.querySelectorAll<HTMLButtonElement>('[data-hero-play]');
  const newButtons = document.querySelectorAll<HTMLButtonElement>('[data-hero-new]');
  const panel = document.getElementById('settings-panel');

  const params = new URLSearchParams(location.search);
  const param = params.get('seed');
  const seed = param !== null && param.trim() !== '' ? normalizeSeed(param) : randomSeed();
  if (seedInput) seedInput.value = String(seed);
  const modeParam = params.get('mode');
  const startMode: HeroModeId = isHeroMode(modeParam) ? modeParam : DEFAULT_MODE;
  if (modeInput) modeInput.value = startMode;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current: ArtController | null = null;
  let mode: HeroModeId = DEFAULT_MODE;
  /** Bumped on every switch, so a slow import() for an abandoned mode is dropped. */
  let token = 0;

  const sync = (s: HeroUiState) => {
    for (const b of playButtons) {
      const label = s.playing ? 'Pause' : 'Play';
      if (b.textContent !== label) b.textContent = label;
    }
    if (seedInput && seedInput.value !== String(s.seed) && document.activeElement !== seedInput) {
      seedInput.value = String(s.seed);
    }
    // The level slider follows playback only while the panel is open and it isn't being dragged.
    if (
      mode === 'rising' &&
      levelInput &&
      panel &&
      !panel.hidden &&
      document.activeElement !== levelInput
    ) {
      const v = (Math.round(s.progress * 200) / 2).toString();
      if (levelInput.value !== v) {
        levelInput.value = v;
        syncSliderOutput(levelInput);
      }
    }
  };
  const syncNow = () => {
    if (!current) return;
    const p = current instanceof HeroController ? current.progress : 0;
    sync({ playing: current.playing, progress: p, seed: current.settings.seed });
  };

  const setCaption = (text: string) => {
    if (caption && caption.textContent !== text) caption.textContent = text;
  };

  const applyRisingStrip = ({ showBarcode, view }: HeroSettings) => {
    stripBox.hidden = !showBarcode;
    setCaption(showBarcode && view === 'islands' ? ISLANDS_EXPLAINER : modeMeta('rising').caption);
  };

  /** Texts, labels and visible controls for `id`. */
  const applyChrome = (id: HeroModeId) => {
    const meta = modeMeta(id);
    const rising = id === 'rising';
    root.dataset.mode = id;
    root.setAttribute('aria-label', meta.groupLabel);
    root.setAttribute('aria-keyshortcuts', meta.shortcuts);
    if (keys) keys.textContent = meta.keys;
    if (captionLink) captionLink.hidden = !rising;
    for (const el of risingOnly) el.hidden = !rising;
    if (collatzOnly) collatzOnly.hidden = id !== 'collatz';
    if (modeNote) modeNote.hidden = rising;
    if (rising) {
      map.setAttribute('aria-label', risingMapLabel);
      applyRisingStrip(readForm(0));
    } else {
      stripBox.hidden = true;
      setCaption(meta.caption);
    }
  };

  const startRising = (s: number): boolean => {
    let hero: HeroController;
    try {
      hero = new HeroController(
        { root, map, strip, stripBox, readout, summary, islandsCopy },
        readForm(s),
        {
          reducedMotion,
        },
      );
    } catch {
      return false; // No 2-D canvas: the static fallback illustration stays visible.
    }
    root.__hero = hero;
    root.__art = hero;
    hero.onUi = sync;
    current = hero;
    return true;
  };

  const setMode = async (id: HeroModeId): Promise<void> => {
    const my = ++token;
    const s = current?.settings.seed ?? seed;
    // Tear down first, so nothing from the old mode runs while the new one loads.
    current?.destroy();
    current = null;
    root.__hero = undefined;
    root.__heroMode = undefined;
    root.__art = undefined;
    mode = id;
    if (modeInput && modeInput.value !== id) modeInput.value = id;
    applyChrome(id);
    if (id === 'rising') {
      startRising(s);
      syncNow();
      return;
    }
    let mod: typeof import('../../lib/viz/hero/modes/index');
    try {
      mod = await import('../../lib/viz/hero/modes/index');
    } catch {
      if (my === token) void setMode('rising');
      return;
    }
    if (my !== token) return; // another switch happened while loading
    let ctl: ModeController;
    try {
      ctl = mod.createMode(id, { root, map, readout, summary }, readModeForm(id, s), {
        reducedMotion,
      });
    } catch {
      return;
    }
    ctl.onUi = sync;
    root.__heroMode = ctl;
    root.__art = ctl;
    current = ctl;
    syncNow();
  };
  root.__setHeroMode = setMode;

  applyChrome('rising');
  if (startMode === 'rising') {
    if (!startRising(seed)) return;
    syncNow();
  } else {
    void setMode(startMode);
  }

  if (modeInput) {
    modeInput.disabled = false;
    modeInput.addEventListener('change', () => {
      if (isHeroMode(modeInput.value) && modeInput.value !== mode) void setMode(modeInput.value);
    });
  }

  for (const b of playButtons) b.addEventListener('click', () => current?.togglePlay());
  for (const b of newButtons) b.addEventListener('click', () => current?.newTerrain());

  if (form) {
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      if (t.id === 'hero-seed') return; // applied on change, so typing a number doesn't thrash
      if (!current) return;
      if (current instanceof HeroController) {
        if (t.id === 'hero-level') {
          current.scrubTo(Number(t.value) / 100);
          return;
        }
        current.update(readForm(current.settings.seed));
        applyRisingStrip(current.settings);
      } else {
        (current as ModeController).update(readModeForm(mode, current.settings.seed));
      }
    });
    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.id === 'hero-seed') {
        const s = normalizeSeed(t.value);
        t.value = String(s);
        current?.newTerrain(s);
      }
    });
    form.addEventListener('reset', () => {
      // Let the form restore its defaults first; keep the current seed.
      setTimeout(() => {
        const s = current?.settings.seed ?? seed;
        if (seedInput) seedInput.value = String(s);
        if (mode !== DEFAULT_MODE) {
          void setMode(DEFAULT_MODE);
          return;
        }
        if (!current) return;
        if (current instanceof HeroController) {
          current.update(readForm(s));
          applyRisingStrip(current.settings);
        } else {
          (current as ModeController).update(readModeForm(mode, s));
        }
        syncNow();
      }, 0);
    });
  }
  if (panel) panel.addEventListener('settings:toggle', syncNow);
}

init();
