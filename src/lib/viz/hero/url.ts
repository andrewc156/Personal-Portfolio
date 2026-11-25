import { DEFAULT_MODE, type HeroModeId } from './modes/meta.ts';

/**
 * Address-bar sync for the hero (F26, QA-15; DECISIONS #88: history.replaceState, no new
 * history entries). Pure: takes the current href and returns the href describing `mode` and
 * `seed`. Only `mode` and `seed` are touched; every other parameter and the hash are kept.
 * The default mode (Rising water) drops `mode`, so `/?seed=42` stays the canonical form; any
 * existing `?mode=&seed=` deep link still opens the same state.
 */
export function heroHref(href: string, mode: HeroModeId, seed: number): string {
  const url = new URL(href);
  const params = url.searchParams;
  if (mode === DEFAULT_MODE) params.delete('mode');
  else params.set('mode', mode);
  params.set('seed', String(seed));
  url.search = params.toString();
  return url.href;
}
