/** Pure URL-state helpers for the Garden filters (garden-client.ts). DOM-free for unit tests. */

export type GardenKey = 'type' | 'tag';
export interface GardenState {
  type: string;
  tag: string;
}
export type GardenValid = Record<GardenKey, ReadonlySet<string>>;

const KEYS: readonly GardenKey[] = ['type', 'tag'];

/** Read `?type=` / `?tag=`; values outside the known sets are ignored. */
export function readGardenState(search: string, valid: GardenValid): GardenState {
  const p = new URLSearchParams(search);
  const pick = (k: GardenKey) => {
    const v = (p.get(k) ?? '').trim();
    return valid[k].has(v) ? v : '';
  };
  return { type: pick('type'), tag: pick('tag') };
}

/** Query string (with `?`, or '') for a filter state. */
export function gardenQuery(s: GardenState): string {
  const p = new URLSearchParams();
  if (s.type) p.set('type', s.type);
  if (s.tag) p.set('tag', s.tag);
  const q = p.toString();
  return q ? `?${q}` : '';
}

/**
 * The search string with ignored (unknown or empty) filter parameters removed, so the
 * address bar describes what is shown. Other parameters are kept. Returns null when
 * nothing needs to change.
 */
export function normalizedGardenSearch(search: string, valid: GardenValid): string | null {
  const p = new URLSearchParams(search);
  const state = readGardenState(search, valid);
  let changed = false;
  for (const k of KEYS) {
    if (!p.has(k)) continue;
    const all = p.getAll(k);
    if (state[k] === '' || all.length !== 1 || all[0] !== state[k]) {
      p.delete(k);
      if (state[k]) p.set(k, state[k]);
      changed = true;
    }
  }
  if (!changed) return null;
  const q = p.toString();
  return q ? `?${q}` : '';
}
