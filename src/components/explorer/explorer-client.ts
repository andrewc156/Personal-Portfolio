/**
 * /rising-water/ client: loads grid.f32, meta.json and barcode.json after the first paint, checks
 * the grid (byte length, SHA-256), runs the F3 engine on it in the browser, compares the live
 * barcode with barcode.json, then starts ExplorerController and wires the page's controls.
 * The basin mask (F12b) is fetched only when its toggle is first switched on (or the URL hash asks
 * for it), and is verified against meta.json before it is shown.
 */
import { computeH0 } from '../../lib/tda/index.ts';
import {
  checkMaskFiles,
  checkMaskHashes,
  checkPlanes,
  decodeMask,
  maskHash,
  parseMaskHash,
  regionsLabel,
  type BasinMask,
} from '../../lib/viz/explorer/basin.ts';
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
import type { BarcodeFile, BasinMaskFile, ColoradoMeta } from '../../lib/viz/explorer/types.ts';

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

/**
 * Error state: besides the status message, drop everything that implies the map is interactive:
 * the "Point at or tap the map…" hint (emptied and hidden by CSS, keeping its box so nothing
 * shifts), the crosshair cursor, and the map's focus stop and keyboard shortcuts.
 */
function markInert(root: HTMLElement): void {
  const hint = root.querySelector<HTMLElement>('[data-ex-hover]');
  if (hint) hint.textContent = '';
  const stage = root.querySelector<HTMLElement>('[data-ex-stage]');
  if (stage) {
    stage.removeAttribute('tabindex');
    stage.removeAttribute('aria-keyshortcuts');
    stage.removeAttribute('aria-describedby');
  }
  root.dataset.inert = 'true';
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
  wireBasin(root, ex, meta);
  root.dataset.ready = 'true';
}

/**
 * A check failed: one console.error and a polite visible message. Nothing from the grid is drawn
 * or shown, the controls stay disabled and the readouts stay at "–" (as for a load error).
 */
function reject(root: HTMLElement, reason: string, problems: string[]): void {
  console.error(`${LOG} data check failed: ${reason}`, problems);
  root.dataset.match = 'false';
  markInert(root);
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

/** A failed basin-mask check: the reason shown to the reader, plus details for the console. */
class MaskError extends Error {
  constructor(
    readonly reason: string,
    readonly problems: string[] = [],
  ) {
    super(reason);
  }
}

/** Fetch basin-mask.bin and basin-mask.json, verify both against meta.json, decode the planes. */
async function loadBasin(meta: ColoradoMeta): Promise<{ mask: BasinMask; info: BasinMaskFile }> {
  const bm = meta.basinMask;
  if (!bm) throw new MaskError('meta.json does not list a basin mask');
  let bin: ArrayBuffer;
  let raw: ArrayBuffer;
  try {
    [bin, raw] = await Promise.all([
      fetchData(bm.file, 'buffer'),
      fetchData(bm.metaFile, 'buffer'),
    ]);
  } catch (e) {
    throw new MaskError('the mask files could not be downloaded', [String(e)]);
  }
  let info: BasinMaskFile;
  try {
    info = JSON.parse(new TextDecoder().decode(raw)) as BasinMaskFile;
  } catch (e) {
    throw new MaskError(`${bm.metaFile} is not valid JSON`, [String(e)]);
  }
  const files = checkMaskFiles(bin.byteLength, info, meta);
  if (!files.ok) throw new MaskError('the mask does not match the elevation grid', files.problems);
  const [binHash, jsonHash] = await Promise.all([sha256Hex(bin), sha256Hex(raw)]);
  const hashes = checkMaskHashes(binHash, jsonHash, meta);
  if (!hashes.ok) {
    throw new MaskError('the mask’s SHA-256 checksum is not the published one', hashes.problems);
  }
  const bytes = new Uint8Array(bin);
  const planes = checkPlanes(bytes, meta.cells, bm.basinCells);
  if (!planes.ok) throw new MaskError('the mask’s bit planes are inconsistent', planes.problems);
  return { mask: decodeMask(bytes, meta.cells), info };
}

/**
 * The "Basin mask" toggle: off by default; lazy, verified load; URL hash "#mask=basin"; the
 * lakes table's "Pit in basin" column. A failed load is reported next to the toggle and leaves
 * everything else running.
 */
function wireBasin(root: HTMLElement, ex: ExplorerController, meta: ColoradoMeta): void {
  const box = root.querySelector<HTMLInputElement>('[data-ex-basin]');
  const status = root.querySelector<HTMLElement>('[data-ex-basin-status]');
  if (!box || !status) return;
  const cols = document.querySelectorAll<HTMLElement>('[data-basin-col]');
  const cells = document.querySelectorAll<HTMLElement>('[data-basin-cell]');
  // Off unless the hash asks for it (ignore any checked state the browser restores on reload).
  box.checked = false;
  let loaded: Promise<{ mask: BasinMask; info: BasinMaskFile }> | null = null;
  let revision = 0;
  let filled = false;
  const okText = (n: number) => {
    const pct = ((100 * n) / meta.cells).toFixed(1);
    return `Shown: ${n.toLocaleString('en-US')} of ${meta.cells.toLocaleString('en-US')} cells (${pct}\u00a0%) are inside the basin. Hatched cells are outside; the line is the boundary.`;
  };
  const setMsg = (text: string, kind: 'idle' | 'loading' | 'ok' | 'error') => {
    if (status.textContent !== text) status.textContent = text;
    status.dataset.kind = kind;
  };
  const showColumn = (on: boolean) => {
    if (on && !filled) {
      for (const td of cells) {
        const r = ex.basinAt(Number(td.dataset.basinCell));
        td.textContent = r < 0 ? '–' : r ? `yes (region\u00a0${r})` : 'no';
      }
      filled = true;
    }
    for (const el of cols) el.hidden = !on;
    for (const el of cells) el.hidden = !on;
  };
  const writeHash = (on: boolean) => {
    const next = maskHash(on, location.hash);
    if (next === location.hash || (next === '' && location.hash === '')) return;
    history.replaceState(history.state, '', location.pathname + location.search + next);
  };
  const apply = async (on: boolean, fromHash: boolean) => {
    const current = ++revision;
    if (box.checked !== on) box.checked = on;
    root.dataset.basin = on ? 'loading' : 'off';
    if (!fromHash) writeHash(on);
    if (!on) {
      ex.setBasin(null, false);
      showColumn(false);
      setMsg('', 'idle');
      return;
    }
    setMsg('Loading the basin mask…', 'loading');
    const pending = (loaded ??= loadBasin(meta));
    try {
      const { mask, info } = await pending;
      if (current !== revision) return;
      ex.basinLabel = regionsLabel(info.source.regions);
      ex.setBasin(mask, true);
      showColumn(true);
      setMsg(okText(mask.count), 'ok');
    } catch (e) {
      if (loaded === pending) loaded = null; // allow a retry
      if (current !== revision) return;
      const reason = e instanceof MaskError ? e.reason : 'it could not be read';
      console.error(`${LOG} basin mask failed: ${reason}`, e instanceof MaskError ? e.problems : e);
      box.checked = false;
      ex.setBasin(null, false);
      root.dataset.basin = 'error';
      showColumn(false);
      writeHash(false);
      setMsg(
        `The basin mask failed to load (${reason}), so it is not shown. The map, the barcode and the table work as before.`,
        'error',
      );
    }
  };
  box.addEventListener('change', () => void apply(box.checked, false));
  window.addEventListener('hashchange', () => {
    const want = parseMaskHash(location.hash);
    if (want !== null && want !== box.checked) void apply(want, true);
  });
  if (parseMaskHash(location.hash) === true) void apply(true, true);
}

function fail(root: HTMLElement, err: unknown): void {
  console.error(`${LOG} could not start the explorer`, err);
  root.dataset.match = 'error';
  markInert(root);
  setStatus(
    root,
    'The elevation data could not be loaded, so the live map and barcode are not shown. The table and the sections below come from the published files.',
    'error',
  );
}

function init(): void {
  const root = document.querySelector<HTMLElement>('[data-explorer]');
  if (!root) return;
  // The controls form never submits (no inline handler: the CSP has no 'unsafe-hashes', #62).
  root
    .querySelector<HTMLFormElement>('[data-ex-controls]')
    ?.addEventListener('submit', (e) => e.preventDefault());
  const start = () => {
    load(root).catch((e) => fail(root, e));
  };
  // Off the critical path: after the page (and the hillshade) has loaded, when the browser is idle.
  if (document.readyState === 'complete') idle(start);
  else window.addEventListener('load', () => idle(start), { once: true });
}

init();
