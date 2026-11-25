/**
 * Content access for pages. Drafts are included only in `astro dev`; production
 * builds never see them (spec §7).
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { compareWork } from './format';
import type { ResearchSlug } from './constants';
import { withBase } from '../../lib/url';

export type WorkEntry = CollectionEntry<'work'>;
export type ResearchEntry = CollectionEntry<'research'>;

export const SHOW_DRAFTS: boolean = import.meta.env.DEV;

export async function getWork(): Promise<WorkEntry[]> {
  const all = await getCollection('work', (e) => SHOW_DRAFTS || !e.data.draft);
  return all.sort((a, b) => compareWork({ id: a.id, ...a.data }, { id: b.id, ...b.data }));
}

export async function getResearch(): Promise<ResearchEntry[]> {
  const all = await getCollection('research');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export function researchHref(slug: string): string {
  return withBase(`/research/${slug}/`);
}

export function gardenTagHref(slug: string): string {
  return withBase(`/garden/?tag=${encodeURIComponent(slug)}`);
}

/** Where a Garden row goes: the item's own page if it has one, else its first topic page. */
export function primaryHref(item: WorkEntry): string | undefined {
  const l = item.data.links;
  const own = l.site ?? l.preprint ?? l.pdf ?? l.doi ?? l.poster ?? l.slides ?? l.code ?? l.data;
  if (own) return withBase(own);
  const tag = item.data.tags[0] as ResearchSlug | undefined;
  return tag ? researchHref(tag) : undefined;
}

export async function getCopy(
  id: 'mission' | 'about_bio' | 'open_science' | 'contact',
): Promise<{ text: string; confirmed: boolean }> {
  const entries = await getCollection('copy');
  const e = entries.find((x) => x.id === id);
  return e ? e.data : { text: '', confirmed: false };
}

export async function getRepos(): Promise<{ label: string; url: string }[]> {
  const entries = await getCollection('repos');
  return entries.map((e) => e.data).filter((r) => r.url);
}
