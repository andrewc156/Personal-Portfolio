import { isEssential } from '../../tda/index.ts';
import type { Bar } from '../../tda/index.ts';
import { cellCenter, edgeOf, type GridGeo } from './geo.ts';
import type { LakeIndex, Pacing, StripView, Units } from './model.ts';

/**
 * Every string the explorer shows that contains a number. Numbers are formatted from the data
 * (engine bars, barcode.json, meta.json); nothing is typed by hand. A no-break space joins each
 * number to its unit so they never wrap apart.
 */

export const NBSP = ' ';
export const MINUS = '−';
/** International foot (exact). */
export const M_PER_FT = 0.3048;

export function toFeet(m: number): number {
  return m / M_PER_FT;
}

/** en-US grouping, a real minus sign, fixed decimals. */
export function fmt(v: number, decimals: number): string {
  const s = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  // Don't print "−0.0".
  const zero = Number(Math.abs(v).toFixed(decimals)) === 0;
  return v < 0 && !zero ? MINUS + s : s;
}

/** A length in metres shown in `units`: 1 decimal in metres, whole feet. */
export function length(m: number, units: Units): string {
  return units === 'ft' ? `${fmt(toFeet(m), 0)}${NBSP}ft` : `${fmt(m, 1)}${NBSP}m`;
}

/** "1,671.5 m (5,484 ft)": both units, the chosen one first. */
export function lengthBoth(m: number, units: Units): string {
  const other: Units = units === 'm' ? 'ft' : 'm';
  return `${length(m, units)} (${length(m, other)})`;
}

export function latLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${NBSP}${ns}, ${Math.abs(lon).toFixed(4)}°${NBSP}${ew}`;
}

export function cellLatLon(i: number, g: GridGeo): string {
  const c = cellCenter(i, g);
  return latLon(c.lat, c.lon);
}

/** "Lake 3", or "The lowest lake" for the essential bar (rank 0). */
export function lakeTitle(rank: number): string {
  return rank === 0 ? 'The lowest lake' : `Lake${NBSP}${rank}`;
}

export function lakeRef(rank: number | undefined, cell: number): string {
  if (rank === undefined) return `the lake born at cell${NBSP}${cell}`;
  return rank === 0
    ? `the lowest lake (cell${NBSP}${cell})`
    : `lake${NBSP}${rank} (cell${NBSP}${cell})`;
}

export interface InfoCard {
  title: string;
  text: string;
}

/**
 * Info card for a selected bar (spec §6.4): "born at X m near (lat, lon), merged at Y m at
 * (lat, lon) into lake Z, persistence P m". The lowest lake's card says it never merges.
 */
export function infoCard(bar: Bar, index: LakeIndex, g: GridGeo, units: Units): InfoCard {
  const rank = index.rankOf.get(bar.birthCell);
  const title = `${lakeTitle(rank ?? -1)} · birth cell${NBSP}${bar.birthCell}`;
  const born = `Born at ${length(bar.birth, units)} near ${cellLatLon(bar.birthCell, g)}`;
  if (isEssential(bar)) {
    return {
      title,
      text: `${born}. It never merges: its bar is infinite, because it eventually holds all the water.`,
    };
  }
  const into = lakeRef(index.rankOf.get(bar.mergedInto), bar.mergedInto);
  return {
    title,
    text:
      `${born}, merged at ${length(bar.death, units)} at ${cellLatLon(bar.deathCell, g)} ` +
      `into ${into}, persistence ${length(bar.death - bar.birth, units)}.`,
  };
}

export interface Readouts {
  level: string;
  levelAlt: string;
  percentile: string;
  lakes: string;
  area: string;
}

export function readouts(
  level: number,
  percentile: number,
  lakes: number,
  areaPct: number,
  units: Units,
): Readouts {
  const other: Units = units === 'm' ? 'ft' : 'm';
  return {
    level: length(level, units),
    levelAlt: length(level, other),
    percentile: fmt(percentile, 1),
    lakes: fmt(lakes, 0),
    area: `${fmt(areaPct, 1)}${NBSP}%`,
  };
}

/** Map hover: elevation and lat/lon of the cell centre, and the lake if the cell is under water. */
export function hoverText(
  cell: number,
  elevation: number,
  g: GridGeo,
  lake: { rank: number | undefined; cell: number } | null,
  units: Units,
): string {
  const where = cellLatLon(cell, g);
  const base = `Elevation ${lengthBoth(elevation, units)} at ${where}`;
  if (!lake) return `${base} · dry`;
  if (lake.rank === undefined) return `${base} · under water`;
  return `${base} · under water, ${lake.rank === 0 ? 'the lowest lake' : `lake${NBSP}${lake.rank}`}`;
}

export interface SummaryInput {
  playing: boolean;
  level: number;
  percentile: number;
  lakes: number;
  areaPct: number;
  units: Units;
  pacing: Pacing;
  view: StripView;
  rows: number;
  selected: InfoCard | null;
  /** The basin mask's label (F12b) when it is shown, e.g. "USGS Watershed Boundary Dataset regions 14–15". */
  basin?: string | null;
}

/** Hidden live summary; updated on pause, scrub and selection, never every frame. */
export function summaryText(s: SummaryInput): string {
  const state = s.playing ? 'Playing' : 'Paused';
  const parts = [
    `${state}. Water level ${lengthBoth(s.level, s.units)}, percentile ${fmt(s.percentile, 1)}.`,
    `${fmt(s.lakes, 0)} ${s.lakes === 1 ? 'lake' : 'lakes'}; ${fmt(s.areaPct, 1)}${NBSP}% of the area flooded.`,
    `${s.view === 'diagram' ? 'Persistence diagram' : 'Barcode'} showing ${s.rows} ${s.rows === 1 ? 'lake' : 'lakes'}, paced by ${s.pacing === 'percentile' ? 'percentile' : 'metres'}.`,
  ];
  if (s.basin) {
    parts.push(
      `Basin mask on: cells outside ${s.basin} are hatched; the lakes and the barcode still cover the whole rectangle.`,
    );
  }
  if (s.selected) parts.push(`Selected: ${s.selected.title}. ${s.selected.text}`);
  return parts.join(' ');
}

export interface LakeRow {
  rank: number;
  birthCell: number;
  persistence: string;
  birth: string;
  birthWhere: string;
  death: string;
  deathWhere: string;
  into: string;
  edge: string;
}

/** Rows of the "Longest-lived lakes" table: the lowest lake, then the top `n` finite lakes. */
export function lakeRows(index: LakeIndex, g: GridGeo, n: number, units: Units): LakeRow[] {
  const out: LakeRow[] = [];
  const bars = (index.essential ? [index.essential] : []).concat(index.ranked.slice(0, n));
  for (const b of bars) {
    const rank = index.rankOf.get(b.birthCell) ?? -1;
    const ess = isEssential(b);
    out.push({
      rank,
      birthCell: b.birthCell,
      persistence: ess ? 'infinite' : length(b.death - b.birth, units),
      birth: length(b.birth, units),
      birthWhere: cellLatLon(b.birthCell, g),
      death: ess ? 'never' : length(b.death, units),
      deathWhere: ess ? '' : cellLatLon(b.deathCell, g),
      into: ess ? '' : lakeRef(index.rankOf.get(b.mergedInto), b.mergedInto),
      edge: edgeOf(b.birthCell, g.W, g.H),
    });
  }
  return out;
}

/** Accessible name of the strip canvas for the current view (§6.6 items 3–5). */
export function stripLabel(view: StripView): string {
  return view === 'diagram'
    ? 'Persistence diagram: one point per lake, birth level across and death level up. Height above the diagonal is persistence. The lowest lake never dies, so its point sits on the infinity line.'
    : 'Barcode: one bar per lake, from the water level where it is born to the level where it spills into an older lake. The lowest lake’s bar never ends.';
}
