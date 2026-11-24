/** Pure formatting helpers for work items (no Astro imports, so they are unit-testable). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-03" or "2025-03-14" → "Mar 2025". Empty or malformed → "". */
export function formatMonth(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return '';
  const month = Number(m[2]);
  if (month < 1 || month > 12) return '';
  return `${MONTHS[month - 1]} ${m[1]}`;
}

/** Machine-readable value for <time datetime>. */
export function isoDate(date: string): string {
  return /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? date : '';
}

export interface DateRange {
  /** Start, as "Mon YYYY" (empty when the item has no date). */
  start: string;
  /** End, as "Mon YYYY", "Present" for ongoing work, or "" for a single date. */
  end: string;
}

/**
 * Display parts of a date or date range: `("2026-01", "2026-05")` → Jan 2026 – May 2026,
 * `("2026-11", "", true)` → Nov 2026 – Present, `("2025-03")` → Mar 2025.
 * No start date → both parts empty (an end or "ongoing" alone is never shown).
 */
export function formatRange(date: string, end = '', ongoing = false): DateRange {
  const start = formatMonth(date);
  if (!start) return { start: '', end: '' };
  if (ongoing) return { start, end: 'Present' };
  const e = formatMonth(end);
  return { start, end: e && e !== start ? e : '' };
}

/**
 * One piece of content text. `math` pieces render in italics (<i>), `sup` pieces as
 * superscript (<sup>); everything else is plain text.
 */
export interface TextSegment {
  text: string;
  math: boolean;
  sup?: boolean;
}

/** `$…$` inline math, or `^…^` superscript (no spaces), e.g. "$k$^th^". */
const MARKUP_RE = /\$([^$\n]+)\$|\^([^\^\s]+)\^/g;

/**
 * Split content text on `$…$` inline math and `^…^` superscript, e.g.
 * "Largest $k$^th^-Power" → ["Largest ", k (math), th (sup), "-Power"].
 * Text without markup is one plain segment.
 */
export function mathSegments(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKUP_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), math: false });
    if (m[1] !== undefined) out.push({ text: m[1], math: true });
    else out.push({ text: m[2], math: false, sup: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), math: false });
  return out;
}

/** The same text with the `$` and `^` delimiters removed (for meta tags and labels). */
export function plainText(text: string): string {
  return text.replace(MARKUP_RE, (_m, math?: string, sup?: string) => math ?? sup ?? '');
}

/**
 * Newest first. Undated items (e.g. submitted manuscripts) come first, then by date descending,
 * then by title, then by id so the order is stable.
 */
export function compareWork(
  a: { id: string; title: string; date: string },
  b: { id: string; title: string; date: string },
): number {
  if (!a.date !== !b.date) return a.date ? 1 : -1;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** True when `name` is Andrew (display or full name), compared case-insensitively. */
export function isAndrewName(name: string, names: readonly string[]): boolean {
  const n = name.trim().toLowerCase();
  return names.some((x) => x.trim().toLowerCase() === n);
}
