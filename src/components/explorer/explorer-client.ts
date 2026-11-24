/**
 * /rising-water/ client: loads grid.f32, meta.json and barcode.json after the first paint, checks
 * the grid (byte length, SHA-256), runs the F3 engine on it in the browser, compares the live
 * barcode with barcode.json, then starts ExplorerController and wires the page's controls.
 */
import { computeH0 } from '../../lib/tda/index.ts';
import {
  checkGridBytes,
  checkGridHash,
  compareBarcode,
  decodeGrid,
  fetchData,
  sha256Hex,
} from '../../lib/viz/explorer/data.ts';
import {
  EXPLORER_DEFAULTS,
  ExplorerController,
  type ExplorerSettings,
  type ExplorerUi,
} from '../../lib/viz/explorer/controller.ts';
import type { Pacing, StripView, Units } from '../../lib/viz/explorer/model.ts';
import { fmt, length, lengthBoth } from '../../lib/viz/explorer/text.ts';
import type { BarcodeFile, ColoradoMeta } from '../../lib/viz/explorer/types.ts';

declare global {
  interface HTMLElement {
    /** The running explorer (read by e2e tests). */
    __explorer?: ExplorerController;
  }
}

const LOG = '[rising-water]';

function q<T extends HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`${LOG} missing ${sel}`);
  return el;
}

function idle(fn: () => void): void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 30);
}

/** Give the main thread back between steps (scheduler.yield where available). */
function yieldToMain(): Promise<void> {
  const sch = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sch?.yield) return sch.yield();
  return new Promise<void>((r) => setTimeout(r, 0));
}

function setStatus(root: HTMLElement, text: string, kind: 'loading' | 'ok' | 'error'): void {
  const el = root.querySelector<HTMLElement>('[data-ex-status]');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

async function load(root: HTMLElement): Promise<void> {
  const tStart = performance.now();
  setStatus(root, 'Loading the elevation grid…', 'loading');
  const [metaRaw, barcodeRaw, buffer] = await Promise.all([
    fetchData('meta.json', 'json'),
    fetchData('barcode.json', 'json'),
    fetchData('grid.f32', 'buffer'),
  ]);
  const meta = metaRaw as ColoradoMeta;
  const barcode = barcodeRaw as BarcodeFile;
  root.dataset.fetchMs = (performance.now() - tStart).toFixed(0);
  await yieldToMain();

  // 1. Bytes: size, then SHA-256. Nothing is computed or drawn from a grid that fails either.
  const bytes = checkGridBytes(buffer.byteLength, meta, barcode);
  if (!bytes.ok) return reject(root, 'the grid file has the wrong size', bytes.problems);
  const hash = await sha256Hex(buffer);
  root.dataset.gridSha256 = hash ?? 'unavailable';
  const hashCheck = checkGridHash(hash, meta, barcode);
  if (!hashCheck.ok) {
    return reject(
      root,
      'the grid file’s SHA-256 checksum is not the published one',
      hashCheck.problems,
    );
  }
  await yieldToMain();
  const heights = decodeGrid(buffer);
  await yieldToMain();

  // 2. The engine, then the comparison with barcode.json, each in its own task.
  const t0 = performance.now();
  const result = computeH0(heights, meta.width, meta.height, { connectivity: 4 });
  const computeMs = performance.now() - t0;
  root.dataset.computeMs = computeMs.toFixed(1);
  await yieldToMain();
  const match = compareBarcode(result, barcode, heights);
  if (!match.ok) {
    return reject(
      root,
      `the barcode computed in your browser does not match barcode.json (${match.identical} of ${match.file} bars identical)`,
      match.problems,
    );
  }
  await yieldToMain();

  // 3. Verified: start the explorer.
  const t1 = performance.now();
  const els = {
    root,
    stage: q(root, '[data-ex-stage]'),
    map: q<HTMLCanvasElement>(root, '[data-ex-map]'),
    strip: q<HTMLCanvasElement>(root, '[data-ex-strip]'),
    level: q(root, '[data-ro-level]'),
    levelAlt: q(root, '[data-ro-level-alt]'),
    percentile: q(root, '[data-ro-pct]'),
    lakes: q(root, '[data-ro-lakes]'),
    area: q(root, '[data-ro-area]'),
    hover: q(root, '[data-ex-hover]'),
    cardTitle: q(root, '[data-ex-card-title]'),
    cardText: q(root, '[data-ex-card-text]'),
    summary: q(root, '[data-ex-summary]'),
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ex = new ExplorerController(els, { meta, heights, result }, readSettings(root), {
    reducedMotion,
  });
  root.dataset.setupMs = (performance.now() - t1).toFixed(1);
  root.__explorer = ex;
  root.dataset.match = 'true';
  setStatus(
    root,
    `Computed in your browser in ${fmt(computeMs, 0)}\u00a0ms: the live barcode matches barcode.json (${match.identical} of ${match.file} bars identical).`,
    'ok',
  );
  wire(root, ex);
  root.dataset.ready = 'true';
}

/**
 * A check failed: one console.error and a polite visible message. Nothing from the grid is drawn
 * or shown, the controls stay disabled and the readouts stay at "–" (as for a load error).
 */
function reject(root: HTMLElement, reason: string, problems: string[]): void {
  console.error(`${LOG} data check failed: ${reason}`, problems);
  root.dataset.match = 'false';
  setStatus(
    root,
    `The elevation data failed its integrity check (${reason}), so the live map and barcode are not shown. The table and the sections below come from the published files.`,
    'error',
  );
}

function readSettings(root: HTMLElement): ExplorerSettings {
  const num = (sel: string, fb: number) => {
    const v = Number(root.querySelector<HTMLInputElement | HTMLSelectElement>(sel)?.value);
    return Number.isFinite(v) ? v : fb;
  };
  const D = EXPLORER_DEFAULTS;
  return {
    speed: num('#ex-speed', D.speed),
    pacing: (root.querySelector<HTMLSelectElement>('#ex-pacing')?.value as Pacing) ?? D.pacing,
    minPersistence: num('#ex-minp', D.minPersistence),
    topN: num('#ex-topn', D.topN),
    units: D.units,
    view: D.view,
  };
}

function wire(root: HTMLElement, ex: ExplorerController): void {
  const play = q<HTMLButtonElement>(root, '[data-ex-play]');
  const levelInput = q<HTMLInputElement>(root, '#ex-level');
  const levelOut = q<HTMLOutputElement>(root, '[data-ex-level-out]');
  const minp = q<HTMLInputElement>(root, '#ex-minp');
  const minpOut = q<HTMLOutputElement>(root, '[data-ex-minp-out]');
  const topn = q<HTMLInputElement>(root, '#ex-topn');
  const topnOut = q<HTMLOutputElement>(root, '[data-ex-topn-out]');
  const speed = q<HTMLSelectElement>(root, '#ex-speed');
  const pacing = q<HTMLSelectElement>(root, '#ex-pacing');
  const unitBtns = root.querySelectorAll<HTMLButtonElement>('[data-ex-units]');
  const viewBtns = root.querySelectorAll<HTMLButtonElement>('[data-ex-view]');
  const lakeBtns = document.querySelectorAll<HTMLButtonElement>('[data-lake-cell]');
  const tableVals = document.querySelectorAll<HTMLElement>('[data-m]');

  const units = () => ex.settings.units;
  const syncMinp = () => {
    const t = length(Number(minp.value), units());
    minpOut.value = t;
    minp.setAttribute('aria-valuetext', t);
  };
  const syncTopn = () => {
    const t = `${topn.value} bars (${ex.rows.length} shown)`;
    topnOut.value = t;
    topn.setAttribute('aria-valuetext', t);
  };
  const syncLevel = (s: ExplorerUi, force: boolean) => {
    if (force || document.activeElement !== levelInput) {
      const v = String(Math.round(s.progress * 1000));
      if (levelInput.value !== v) levelInput.value = v;
    }
    const t = lengthBoth(s.level, s.units);
    if (levelOut.value !== t) levelOut.value = t;
    levelInput.setAttribute('aria-valuetext', t);
  };
  const syncTable = () => {
    for (const el of tableVals) {
      const m = Number(el.dataset.m);
      if (Number.isFinite(m)) el.textContent = length(m, units());
    }
  };
  const sync = (s: ExplorerUi) => {
    const label = s.playing ? 'Pause' : 'Play';
    if (play.textContent !== label) play.textContent = label;
    play.setAttribute('aria-pressed', String(s.playing));
    syncLevel(s, false);
  };
  ex.onUi = sync;

  play.addEventListener('click', () => ex.togglePlay());
  levelInput.addEventListener('input', () => {
    ex.scrubTo(Number(levelInput.value) / 1000);
    syncLevel(
      {
        playing: false,
        progress: ex.progress,
        level: ex.level,
        units: units(),
        selected: ex.selected,
      },
      false,
    );
  });
  speed.addEventListener('change', () => ex.update({ speed: Number(speed.value) || 1 }));
  pacing.addEventListener('change', () => ex.update({ pacing: pacing.value as Pacing }));
  minp.addEventListener('input', () => {
    ex.update({ minPersistence: Number(minp.value) });
    syncMinp();
    syncTopn();
  });
  topn.addEventListener('input', () => {
    ex.update({ topN: Number(topn.value) });
    syncTopn();
  });
  for (const b of unitBtns) {
    b.addEventListener('click', () => {
      const u = b.dataset.exUnits as Units;
      for (const x of unitBtns) x.setAttribute('aria-pressed', String(x === b));
      ex.update({ units: u });
      syncMinp();
      syncTable();
      sync({
        playing: ex.playing,
        progress: ex.progress,
        level: ex.level,
        units: u,
        selected: ex.selected,
      });
    });
  }
  for (const b of viewBtns) {
    b.addEventListener('click', () => {
      for (const x of viewBtns) x.setAttribute('aria-pressed', String(x === b));
      ex.update({ view: b.dataset.exView as StripView });
    });
  }
  for (const b of lakeBtns) {
    b.disabled = false;
    b.addEventListener('click', () => {
      const cell = Number(b.dataset.lakeCell);
      if (!ex.selectCell(cell)) return;
      const r = ex.els.stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }
  for (const el of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    '[data-ex-control]',
  )) {
    el.disabled = false;
  }
  syncMinp();
  syncTopn();
  sync({
    playing: ex.playing,
    progress: ex.progress,
    level: ex.level,
    units: units(),
    selected: ex.selected,
  });
}

function fail(root: HTMLElement, err: unknown): void {
  console.error(`${LOG} could not start the explorer`, err);
  root.dataset.match = 'error';
  setStatus(
    root,
    'The elevation data could not be loaded, so the live map and barcode are not shown. The table and the sections below come from the published files.',
    'error',
  );
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-explorer]');
  if (!root) return;
  const start = () => {
    load(root).catch((e) => fail(root, e));
  };
  // Off the critical path: after the page (and the hillshade) has loaded, when the browser is idle.
  if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', () => idle(start), { once: true });
}

init();
