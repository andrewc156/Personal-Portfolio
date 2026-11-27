/**
 * Settings panel shell behaviour (spec §4.1) plus helpers for the generic rows.
 * Feature code (e.g. HeroSettings) may import the exported helpers.
 */

export const SETTINGS_STORAGE_KEY = 'settings-open';
/** Fired on the panel element whenever it opens or closes. detail: { open: boolean } */
export const SETTINGS_TOGGLE_EVENT = 'settings:toggle';

let opener: HTMLButtonElement | undefined;

/** Same breakpoint as the bottom-sheet layout in SettingsPanel.astro. */
const SHEET_QUERY = '(max-width: 40rem)';
/** Marks background elements this module made inert, so only those are restored. */
const INERT_MARK = 'data-settings-inert';

function sheetMedia(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(SHEET_QUERY) : null;
}

/** The bottom sheet covers most of a narrow screen, so there it is modal. */
function isSheet(): boolean {
  return sheetMedia()?.matches === true;
}

/**
 * Modal bottom sheet (narrow screens, QA-03): the covered page is inert (no focus, no
 * pointer, hidden from assistive tech) and the panel is exposed as a modal dialog. On wider
 * screens the drawer stays a non-modal aside next to the art, as before.
 */
function syncModal(panel: HTMLElement): void {
  const modal = !panel.hidden && isSheet();
  document.documentElement.toggleAttribute('data-settings-modal', modal);
  if (modal) {
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
  } else {
    // Wide drawer: the non-modal complementary landmark it has always been.
    panel.setAttribute('role', 'complementary');
    panel.removeAttribute('aria-modal');
  }
  if (modal) {
    // Inert every branch of the tree that doesn't contain the panel.
    for (let node: HTMLElement | null = panel; node && node !== document.body;) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sib of Array.from(parent.children)) {
        if (sib === node || !(sib instanceof HTMLElement) || sib.inert) continue;
        if (sib instanceof HTMLScriptElement || sib instanceof HTMLTemplateElement) continue;
        sib.inert = true;
        sib.setAttribute(INERT_MARK, '');
      }
      node = parent;
    }
  } else {
    for (const el of document.querySelectorAll<HTMLElement>(`[${INERT_MARK}]`)) {
      el.inert = false;
      el.removeAttribute(INERT_MARK);
    }
  }
}

/** Keyboard-reachable controls inside the panel, in DOM order. */
function tabbables(panel: HTMLElement): HTMLElement[] {
  const sel = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';
  return Array.from(panel.querySelectorAll<HTMLElement>(sel)).filter(
    (el) =>
      !el.matches(':disabled') &&
      !el.closest('[inert]') &&
      el.tabIndex >= 0 &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility === 'visible',
  );
}

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

function elements(): { panel: HTMLElement; toggles: NodeListOf<HTMLButtonElement> } | null {
  const panel = document.getElementById('settings-panel');
  const toggles = document.querySelectorAll<HTMLButtonElement>(
    'button[aria-controls="settings-panel"]',
  );
  return panel && toggles.length ? { panel, toggles } : null;
}

export function isSettingsOpen(): boolean {
  return document.getElementById('settings-panel')?.hidden === false;
}

/** Move focus into the open panel and return it to its opener on close. */
export function setSettingsOpen(open: boolean, moveFocus = true): void {
  const els = elements();
  if (!els) return;
  const { panel, toggles } = els;
  // The closed panel stays rendered for its exit transition (display allow-discrete), so
  // inert keeps it out of the tab order and the AX tree; cleared before focus moves in.
  panel.inert = !open;
  panel.hidden = !open;
  document.documentElement.toggleAttribute('data-settings-open', open);
  for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(open));
  syncModal(panel);
  store(open);
  if (moveFocus) {
    if (open) panel.querySelector<HTMLElement>('[data-settings-title]')?.focus();
    else (opener?.isConnected ? opener : toggles[0])?.focus();
  }
  if (!open) opener = undefined;
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
  const { panel, toggles } = els;
  // A closed panel is inert from the start, matching what setSettingsOpen(false) leaves.
  panel.inert = panel.hidden !== false;

  for (const toggle of toggles) {
    toggle.disabled = false;
    toggle.addEventListener('click', () => {
      const open = !isSettingsOpen();
      if (open) opener = toggle;
      setSettingsOpen(open);
    });
  }
  panel
    .querySelector<HTMLButtonElement>('[data-settings-close]')
    ?.addEventListener('click', () => setSettingsOpen(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSettingsOpen()) {
      e.preventDefault();
      setSettingsOpen(false);
      return;
    }
    if (
      e.key !== 'Tab' ||
      e.defaultPrevented ||
      e.ctrlKey ||
      e.metaKey ||
      !isSettingsOpen() ||
      !isSheet()
    ) {
      return;
    }
    // WebKit can skip buttons in its native Tab order, including the wrap points.
    // Move focus on each Tab so every visible control is reachable in the modal sheet.
    e.preventDefault();
    const items = tabbables(panel);
    const active = document.activeElement;
    const index = items.findIndex((item) => item === active);
    const next = e.shiftKey ? (items[index - 1] ?? items.at(-1)) : (items[index + 1] ?? items[0]);
    (next ?? panel.querySelector<HTMLElement>('[data-settings-title]'))?.focus();
  });

  // Modal sheet: a tap or click on the covered page (the backdrop) dismisses it and
  // returns focus to the opener. Inert content can't be the target, so such clicks
  // land on <body>/<html> or another non-inert node outside the panel.
  document.addEventListener('click', (e) => {
    if (!isSettingsOpen() || !isSheet()) return;
    const t = e.target;
    if (!(t instanceof Node) || panel.contains(t)) return;
    if (t instanceof Element && t.closest('[aria-controls="settings-panel"]')) return;
    setSettingsOpen(false);
  });

  // Rotating or resizing across the breakpoint switches between sheet and drawer.
  sheetMedia()?.addEventListener('change', () => {
    syncModal(panel);
    if (isSettingsOpen() && isSheet() && !panel.contains(document.activeElement)) {
      panel.querySelector<HTMLElement>('[data-settings-title]')?.focus();
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
  // A remembered open drawer is restored beside the art on wide screens. On a narrow
  // screen it would be a modal sheet over a page the visitor hasn't seen yet, so it
  // starts closed there (the remembered value is kept for the next wide visit).
  if (stored() && !isSheet()) setSettingsOpen(true, false);
}
