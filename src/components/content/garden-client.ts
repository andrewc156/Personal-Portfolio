/**
 * Garden filters (spec §4.1, §5). Progressive enhancement: without JS every row is
 * shown and each chip is a plain link. With JS, chips filter in place and keep
 * `?type=` / `?tag=` in the URL so filtered views can be shared and go back/forward.
 *
 * Types with no listed work have no visible chip. A deep link to one of them (QA-17)
 * reveals its chip as the active filter, with a clear action and a plain empty state.
 * Unknown values are ignored and dropped from the address bar.
 */
import {
  gardenQuery,
  normalizedGardenSearch,
  readGardenState,
  type GardenKey as Key,
  type GardenState as State,
  type GardenValid,
} from './garden-state';

function hrefFor(s: State): string {
  return `${location.pathname}${gardenQuery(s)}`;
}

export function initGarden(root: HTMLElement): void {
  const chips = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-filter]'));
  const clears = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-garden-clear]'));
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-work-row]'));
  const status = root.querySelector<HTMLElement>('[data-garden-status]');
  const empty = root.querySelector<HTMLElement>('[data-garden-empty]');
  const emptyText = root.querySelector<HTMLElement>('[data-garden-empty-text]');
  const emptyDefault = emptyText?.textContent ?? '';
  const unlisted = Array.from(root.querySelectorAll<HTMLElement>('[data-unlisted-type]'));
  const valid: GardenValid = {
    type: new Set((root.dataset.types ?? '').split(' ').filter(Boolean)),
    tag: new Set((root.dataset.tags ?? '').split(' ').filter(Boolean)),
  };

  function apply(s: State): void {
    let shown = 0;
    for (const row of rows) {
      const tags = (row.dataset.tags ?? '').split(' ');
      const ok = (!s.type || row.dataset.type === s.type) && (!s.tag || tags.includes(s.tag));
      row.hidden = !ok;
      if (ok) shown++;
    }
    // A type with nothing listed shows its chip only while it is the active filter.
    let unlistedLabel = '';
    for (const li of unlisted) {
      const active = li.dataset.unlistedType === s.type;
      li.hidden = !active;
      if (active) unlistedLabel = li.dataset.label ?? '';
    }
    for (const chip of chips) {
      const key = chip.dataset.filter as Key;
      const value = chip.dataset.value ?? '';
      const active = s[key] === value;
      if (active) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
      chip.href = hrefFor({ ...s, [key]: value });
    }
    for (const clear of clears) {
      const key = clear.dataset.gardenClear as Key;
      clear.href = hrefFor({ ...s, [key]: '' });
    }
    if (empty) empty.hidden = shown > 0;
    if (emptyText) {
      emptyText.textContent =
        unlistedLabel && !s.tag ? `Nothing is listed under ${unlistedLabel} yet.` : emptyDefault;
    }
    if (status) {
      const noun = rows.length === 1 ? 'item' : 'items';
      status.textContent =
        s.type || s.tag ? `Showing ${shown} of ${rows.length} ${noun}` : `${rows.length} ${noun}`;
    }
  }

  let state = readGardenState(location.search, valid);
  // Keep the address bar consistent with what is shown: drop ignored filter values.
  const normal = normalizedGardenSearch(location.search, valid);
  if (normal !== null) {
    history.replaceState(history.state, '', `${location.pathname}${normal}${location.hash}`);
  }
  apply(state);

  root.addEventListener('click', (ev) => {
    const target = ev.target as Element | null;
    const chip = target?.closest<HTMLAnchorElement>('a[data-filter]');
    const reset = target?.closest<HTMLAnchorElement>('a[data-garden-reset]');
    const clear = target?.closest<HTMLAnchorElement>('a[data-garden-clear]');
    if (!chip && !reset && !clear) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || (ev as MouseEvent).button > 0)
      return;
    ev.preventDefault();
    let key: Key = 'type';
    if (chip) {
      key = chip.dataset.filter as Key;
      state = { ...state, [key]: chip.dataset.value ?? '' };
    } else if (clear) {
      key = clear.dataset.gardenClear as Key;
      state = { ...state, [key]: '' };
    } else {
      state = { type: '', tag: '' };
    }
    history.pushState(null, '', hrefFor(state));
    apply(state);
    // Keep focus on the chip; if the change hid it, use that group's active chip.
    const stay = chip && chip.getClientRects().length > 0 ? chip : null;
    (
      stay ?? root.querySelector<HTMLAnchorElement>(`a[data-filter="${key}"][aria-current="true"]`)
    )?.focus();
  });

  window.addEventListener('popstate', () => {
    state = readGardenState(location.search, valid);
    apply(state);
  });
}

const root = document.querySelector<HTMLElement>('[data-garden]');
if (root) initGarden(root);
