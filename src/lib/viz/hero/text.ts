import type { Bar } from '../../tda/index.ts';
import { isEssential, persistence } from '../../tda/index.ts';

/** Text for the hero's readout line and its screen-reader summary. Copy stays within spec §6.6. */

const metreCache: string[] = [];

/** "412 m", cached by whole metre so frames don't build new strings. */
export function metres(v: number): string {
  const r = Math.round(v);
  if (r >= 0 && r <= 5000) return (metreCache[r] ??= `${r} m`);
  return `${r} m`;
}

export function lakesText(n: number): string {
  return n === 1 ? '1 lake' : `${n} lakes`;
}

/** Accessible name of the barcode strip canvas for the current view. */
export function stripLabel(view: 'barcode' | 'diagram'): string {
  return view === 'diagram'
    ? 'Persistence diagram: one point per lake, birth level across and death level up. Height above the diagonal is persistence. The lowest lake never dies, so its point sits on the infinity line.'
    : "Barcode: one bar per lake, from the water level where it is born to the level where it spills into an older lake. The lowest lake's bar never ends.";
}

/** Default readout: level and lake count. */
export function levelReadout(level: number, alive: number): string {
  return `Level ${metres(level)} · ${lakesText(alive)}`;
}

/** Readout for a map cell under the pointer. `label` 0 = dry land. */
export function cellReadout(height: number, label: number): string {
  return label > 0
    ? `Height ${metres(height)} · Lake ${label}`
    : `Height ${metres(height)} · dry land`;
}

/** Readout for a highlighted bar. */
export function barReadout(bar: Bar, label: number, intoLabel: number): string {
  if (isEssential(bar)) {
    return `Lake ${label} · born ${metres(bar.birth)} · never dies (the lowest lake, infinite bar)`;
  }
  return `Lake ${label} · born ${metres(bar.birth)} · spills into Lake ${intoLabel} at ${metres(
    bar.death,
  )} · persistence ${metres(persistence(bar))}`;
}

export interface SummaryInput {
  playing: boolean;
  progress: number;
  level: number;
  alive: number;
  /** Bars currently drawn (born at this level) and in total. */
  shown: number;
  rows: number;
  /** Longest finite bar among the rows, with its lake number. */
  longest: { bar: Bar; label: number } | null;
  seed: number;
}

/** Screen-reader summary, refreshed on pause, scrub and new terrain (not every frame). */
export function summaryText(s: SummaryInput): string {
  const pct = Math.round(s.progress * 100);
  const state = s.playing ? 'Playing' : 'Paused';
  const parts = [
    `${state}. Terrain ${s.seed}. Water level ${metres(s.level)}, ${pct}% of the way up.`,
    `${s.alive === 1 ? '1 lake is' : `${s.alive} lakes are`} present.`,
    `The barcode shows ${s.shown} of ${s.rows} bars so far.`,
  ];
  if (s.longest) {
    parts.push(
      `The longest finite bar is Lake ${s.longest.label}, persistence ${metres(
        persistence(s.longest.bar),
      )}.`,
    );
  }
  return parts.join(' ');
}
