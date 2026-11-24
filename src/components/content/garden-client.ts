/**
 * Garden filters (spec §4.1, §5). Progressive enhancement: without JS every row is
 * shown and each chip is a plain link. With JS, chips filter in place and keep
 * `?type=` / `?tag=` in the URL so filtered views can be shared and go back/forward.
 */

type Key = 'type' | 'tag';
interface State {
  type: string;
  tag: string;
}

function readState(valid: Record<Key, Set<string>>): State {
  const p = new URLSearchParams(location.search);
  const pick = (k: Key) => {
    const v = (p.get(k) ?? '').trim();
    return valid[k].has(v) ? v : '';
  };
  return { type: pick('type'), tag: pick('tag') };
}

function hrefFor(s: State): string {
  const p = new URLSearchParams();
  if (s.type) p.set('type', s.type);
  if (s.tag) p.set('tag', s.tag);
  const q = p.toString();
  return `${location.pathname}${q ? `?${q}` : ''}`;
}

export function initGarden(root: HTMLElement): void {
  const chips = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-filter]'));
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-work-row]'));
  const status = root.querySelector<HTMLElement>('[data-garden-status]');
  const empty = root.querySelector<HTMLElement>('[data-garden-empty]');
  const valid: Record<Key, Set<string>> = {
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
    for (const chip of chips) {
      const key = chip.dataset.filter as Key;
      const value = chip.dataset.value ?? '';
      const active = s[key] === value;
      if (active) chip.setAttribute('aria-current', 'true');
      else chip.removeAttribute('aria-current');
      chip.href = hrefFor({ ...s, [key]: value });
    }
    if (empty) empty.hidden = shown > 0;
    if (status) {
      const noun = rows.length === 1 ? 'item' : 'items';
      status.textContent =
        s.type || s.tag ? `Showing ${shown} of ${rows.length} ${noun}` : `${rows.length} ${noun}`;
    }
  }

  let state = readState(valid);
  apply(state);

  root.addEventListener('click', (ev) => {
    const target = ev.target as Element | null;
    const chip = target?.closest<HTMLAnchorElement>('a[data-filter]');
    const reset = target?.closest<HTMLAnchorElement>('a[data-garden-reset]');
    if (!chip && !reset) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || (ev as MouseEvent).button > 0)
      return;
    ev.preventDefault();
    if (chip) {
      const key = chip.dataset.filter as Key;
      state = { ...state, [key]: chip.dataset.value ?? '' };
    } else {
      state = { type: '', tag: '' };
    }
    history.pushState(null, '', hrefFor(state));
    apply(state);
    (chip ?? root.querySelector<HTMLAnchorElement>('a[data-filter][aria-current]'))?.focus();
  });

  window.addEventListener('popstate', () => {
    state = readState(valid);
    apply(state);
  });
}

const root = document.querySelector<HTMLElement>('[data-garden]');
if (root) initGarden(root);
