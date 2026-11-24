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

/**
 * Newest first. Undated items (ongoing projects) come first, then by date descending,
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
