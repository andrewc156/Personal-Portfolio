/**
 * Wires the hero canvas (Hero.astro) and its settings form (HeroSettings.astro, inside F1's
 * panel) to HeroController.
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

declare global {
  interface HTMLElement {
    /** The running hero controller (read by e2e tests). */
    __hero?: HeroController;
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

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;
  const map = root.querySelector<HTMLCanvasElement>('[data-hero-map]');
  const strip = root.querySelector<HTMLCanvasElement>('[data-hero-strip]');
  const stripBox = root.querySelector<HTMLElement>('[data-hero-strip-box]');
  const readout = root.querySelector<HTMLElement>('[data-hero-readout]');
  const summary = root.querySelector<HTMLElement>('[data-hero-summary]');
  if (!map || !strip || !stripBox || !readout || !summary) return;

  const form = document.querySelector<HTMLFormElement>('[data-hero-settings]');
  const seedInput = byId<HTMLInputElement>('hero-seed');
  const levelInput = byId<HTMLInputElement>('hero-level');
  const playButtons = document.querySelectorAll<HTMLButtonElement>('[data-hero-play]');
  const newButtons = document.querySelectorAll<HTMLButtonElement>('[data-hero-new]');
  const panel = document.getElementById('settings-panel');

  const param = new URLSearchParams(location.search).get('seed');
  const seed = param !== null && param.trim() !== '' ? normalizeSeed(param) : randomSeed();
  if (seedInput) seedInput.value = String(seed);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hero: HeroController;
  try {
    hero = new HeroController({ root, map, strip, stripBox, readout, summary }, readForm(seed), {
      reducedMotion,
    });
  } catch {
    return; // No 2-D canvas: the static fallback illustration stays visible.
  }
  root.__hero = hero;
  stripBox.hidden = !hero.settings.showBarcode;

  const sync = (s: HeroUiState) => {
    for (const b of playButtons) {
      const label = s.playing ? 'Pause' : 'Play';
      if (b.textContent !== label) b.textContent = label;
    }
    if (seedInput && seedInput.value !== String(s.seed) && document.activeElement !== seedInput) {
      seedInput.value = String(s.seed);
    }
    // The level slider follows playback only while the panel is open and it isn't being dragged.
    if (levelInput && panel && !panel.hidden && document.activeElement !== levelInput) {
      const v = (Math.round(s.progress * 200) / 2).toString();
      if (levelInput.value !== v) {
        levelInput.value = v;
        syncSliderOutput(levelInput);
      }
    }
  };
  hero.onUi = sync;
  sync({ playing: hero.playing, progress: hero.progress, seed: hero.settings.seed });

  for (const b of playButtons) b.addEventListener('click', () => hero.togglePlay());
  for (const b of newButtons) b.addEventListener('click', () => hero.newTerrain());

  if (form) {
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      if (t.id === 'hero-level') {
        hero.scrubTo(Number(t.value) / 100);
        return;
      }
      if (t.id === 'hero-seed') return; // applied on change, so typing a number doesn't thrash
      hero.update(readForm(hero.settings.seed));
    });
    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.id === 'hero-seed') {
        const s = normalizeSeed(t.value);
        t.value = String(s);
        hero.newTerrain(s);
      }
    });
    form.addEventListener('reset', () => {
      // Let the form restore its defaults first; keep the current terrain seed.
      setTimeout(() => {
        if (seedInput) seedInput.value = String(hero.settings.seed);
        hero.update(readForm(hero.settings.seed));
        stripBox.hidden = !hero.settings.showBarcode;
        sync({ playing: hero.playing, progress: hero.progress, seed: hero.settings.seed });
      }, 0);
    });
    form.addEventListener('input', () => {
      stripBox.hidden = !hero.settings.showBarcode;
    });
  }
  if (panel) {
    panel.addEventListener('settings:toggle', () =>
      sync({ playing: hero.playing, progress: hero.progress, seed: hero.settings.seed }),
    );
  }
}

init();
