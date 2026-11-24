/**
 * Settings panel shell behaviour (spec §4.1) plus helpers for the generic rows.
 * Feature code (e.g. HeroSettings) may import the exported helpers.
 */

export const SETTINGS_STORAGE_KEY = 'settings-open';
/** Fired on the panel element whenever it opens or closes. detail: { open: boolean } */
export const SETTINGS_TOGGLE_EVENT = 'settings:toggle';

function store(open: boolean): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* storage unavailable: state is simply not remembered */
  }
}

function stored(): boolean {
  try {
    return localStorage.getItem(SETTINGS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function elements(): { panel: HTMLElement; gear: HTMLButtonElement } | null {
  const panel = document.getElementById('settings-panel');
  const gear = document.querySelector<HTMLButtonElement>('[data-settings-toggle]');
  return panel && gear ? { panel, gear } : null;
}

export function isSettingsOpen(): boolean {
  const els = elements();
  return !!els && els.panel.hidden !== true;
}

/** Open or close the panel. `moveFocus` sends focus into the panel on open, or back to the gear on close. */
export function setSettingsOpen(open: boolean, moveFocus = true): void {
  const els = elements();
  if (!els) return;
  const { panel, gear } = els;
  panel.hidden = !open;
  document.documentElement.toggleAttribute('data-settings-open', open);
  gear.setAttribute('aria-expanded', String(open));
  store(open);
  if (moveFocus) {
    if (open) panel.querySelector<HTMLElement>('[data-settings-title]')?.focus();
    else gear.focus();
  }
  panel.dispatchEvent(new CustomEvent(SETTINGS_TOGGLE_EVENT, { detail: { open }, bubbles: true }));
}

/** Format a slider value with a fixed number of decimals and an optional unit. */
export function formatSliderValue(value: number, decimals = 0, unit = ''): string {
  if (!Number.isFinite(value)) return '';
  return `${value.toFixed(Math.max(0, decimals))}${unit}`;
}

/** Update the mono readout next to a SliderRow input. Call after setting `input.value` from code. */
export function syncSliderOutput(input: HTMLInputElement): void {
  const out = input.form
    ? input.form.querySelector<HTMLOutputElement>(`output[for="${input.id}"]`)
    : document.querySelector<HTMLOutputElement>(`output[for="${input.id}"]`);
  if (!out) return;
  const decimals = Number(input.dataset.decimals ?? '0');
  const text = formatSliderValue(Number(input.value), decimals, input.dataset.unit ?? '');
  out.value = text;
  input.setAttribute('aria-valuetext', text);
}

function syncAllSliders(root: ParentNode): void {
  root
    .querySelectorAll<HTMLInputElement>('input[type="range"][data-live-value]')
    .forEach(syncSliderOutput);
}

/** Expose the header's height as --shell-header-h so the drawer can start below it. */
function trackHeaderHeight(): void {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;
  const root = document.documentElement;
  const update = () =>
    root.style.setProperty('--shell-header-h', `${header.getBoundingClientRect().height}px`);
  update();
  new ResizeObserver(update).observe(header);
}

export function initSettingsPanel(): void {
  const els = elements();
  if (!els) return;
  const { panel, gear } = els;

  gear.addEventListener('click', () => setSettingsOpen(!isSettingsOpen()));
  panel
    .querySelector<HTMLButtonElement>('[data-settings-close]')
    ?.addEventListener('click', () => setSettingsOpen(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSettingsOpen()) {
      e.preventDefault();
      setSettingsOpen(false);
    }
  });

  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'range' && 'liveValue' in t.dataset) {
      syncSliderOutput(t);
    }
  });
  panel.addEventListener('reset', (e) => {
    const form = e.target;
    if (form instanceof HTMLFormElement) setTimeout(() => syncAllSliders(form), 0);
  });

  trackHeaderHeight();
  syncAllSliders(panel);
  if (stored()) setSettingsOpen(true, false);
}
