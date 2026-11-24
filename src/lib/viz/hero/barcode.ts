import type { Bar } from '../../tda/index.ts';
import { barExtent, isAlive } from './model.ts';

/**
 * Barcode strip and persistence diagram under the hero map (spec §6.3). Geometry helpers are
 * pure; the draw functions take any object with the 2-D canvas methods they use, so tests can
 * record exactly what gets drawn. Coordinates are device pixels.
 */

export type BarcodeView = 'barcode' | 'diagram';

export interface StripLayout {
  /** Canvas size in device px. */
  w: number;
  h: number;
  dpr: number;
  /** Plot box (device px). */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The subset of CanvasRenderingContext2D the strip uses. */
export interface StripCtx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  setLineDash(segments: number[]): void;
}

export interface StripColors {
  axis: string;
  text: string;
  level: string;
  highlight: string;
}

export interface StripState {
  L: StripLayout;
  rows: readonly Bar[];
  /** Fill colour per row (same length as rows). */
  fills: readonly string[];
  level: number;
  minH: number;
  maxH: number;
  colors: StripColors;
  /** Index into rows of the highlighted bar, or −1. */
  highlight: number;
  /** Axis tick labels: values (m) and their text, precomputed per terrain. */
  ticks: readonly number[];
  tickText: readonly string[];
  /** Text for the current-level marker, e.g. "412 m". */
  levelText: string;
  /** Canvas font for labels (precomputed so frames don't build strings). */
  font: string;
}

/** Label font for a given device-pixel ratio. */
export function stripFont(dpr: number): string {
  return `${11 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
}

const PAD = { left: 8, right: 10, top: 6, bottom: 18 } as const;
/** Max row pitch in CSS px so a few bars don't turn into slabs. */
const MAX_PITCH = 9;
const EMPTY_DASH: number[] = [];
const LEVEL_DASH: number[] = [4, 3];

export function stripLayout(cssW: number, cssH: number, dpr: number): StripLayout {
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  return {
    w,
    h,
    dpr,
    left: PAD.left * dpr,
    right: w - PAD.right * dpr,
    top: PAD.top * dpr,
    bottom: h - PAD.bottom * dpr,
  };
}

export function levelToX(level: number, minH: number, maxH: number, L: StripLayout): number {
  const span = maxH - minH || 1;
  const t = (Math.min(maxH, Math.max(minH, level)) - minH) / span;
  return L.left + t * (L.right - L.left);
}

export function xToLevel(x: number, minH: number, maxH: number, L: StripLayout): number {
  const t = (x - L.left) / (L.right - L.left || 1);
  return minH + Math.min(1, Math.max(0, t)) * (maxH - minH);
}

/** Vertical pitch of one barcode row (device px). */
export function rowPitch(nRows: number, L: StripLayout): number {
  const avail = L.bottom - L.top;
  return Math.min(avail / Math.max(1, nRows), MAX_PITCH * L.dpr);
}

/** Row index under device-px y, or −1. */
export function rowAtY(y: number, nRows: number, L: StripLayout): number {
  if (nRows === 0) return -1;
  const k = Math.floor((y - L.top) / rowPitch(nRows, L));
  return k >= 0 && k < nRows ? k : -1;
}

const ext: [number, number] = [0, 0];

/** Draw the barcode: one bar per row, from birth to min(death, level), plus the level line. */
export function drawBarcode(ctx: StripCtx, s: StripState): void {
  const { L, rows, fills, level, minH, maxH, colors } = s;
  ctx.clearRect(0, 0, L.w, L.h);
  drawAxis(ctx, s);
  const pitch = rowPitch(rows.length, L);
  const thick = Math.max(L.dpr, pitch * 0.62);
  for (let k = 0; k < rows.length; k++) {
    if (!barExtent(rows[k], level, ext)) continue;
    const x0 = levelToX(ext[0], minH, maxH, L);
    const x1 = levelToX(ext[1], minH, maxH, L);
    const y = L.top + k * pitch + (pitch - thick) / 2;
    ctx.fillStyle = fills[k];
    ctx.fillRect(x0, y, x1 - x0, thick);
    if (k === s.highlight) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5 * L.dpr;
      ctx.strokeRect(x0 - L.dpr, y - L.dpr, x1 - x0 + 2 * L.dpr, thick + 2 * L.dpr);
    }
  }
  // Current water level.
  const xl = levelToX(level, minH, maxH, L);
  ctx.strokeStyle = colors.level;
  ctx.lineWidth = L.dpr;
  ctx.setLineDash(EMPTY_DASH);
  ctx.beginPath();
  ctx.moveTo(xl, L.top - 2 * L.dpr);
  ctx.lineTo(xl, L.bottom);
  ctx.stroke();
}

function drawAxis(ctx: StripCtx, s: StripState): void {
  const { L, colors, minH, maxH } = s;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = L.dpr;
  ctx.setLineDash(EMPTY_DASH);
  ctx.beginPath();
  ctx.moveTo(L.left, L.bottom + 0.5 * L.dpr);
  ctx.lineTo(L.right, L.bottom + 0.5 * L.dpr);
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = s.font;
  ctx.textBaseline = 'top';
  const xl = levelToX(s.level, minH, maxH, L);
  for (let t = 0; t < s.ticks.length; t++) {
    const x = levelToX(s.ticks[t], minH, maxH, L);
    ctx.beginPath();
    ctx.moveTo(x, L.bottom);
    ctx.lineTo(x, L.bottom + 3 * L.dpr);
    ctx.stroke();
    // Keep tick text clear of the moving level label.
    if (Math.abs(x - xl) < 44 * L.dpr) continue;
    ctx.textAlign = t === 0 ? 'left' : t === s.ticks.length - 1 ? 'right' : 'center';
    ctx.fillText(s.tickText[t], x, L.bottom + 4 * L.dpr);
  }
  ctx.textAlign =
    xl > L.right - 30 * L.dpr ? 'right' : xl < L.left + 30 * L.dpr ? 'left' : 'center';
  ctx.fillStyle = colors.level;
  ctx.fillText(s.levelText, xl, L.bottom + 4 * L.dpr);
}

/** Square plot box of the persistence diagram (device px): [x0, y0, size]. */
export function diagramBox(
  L: StripLayout,
  out: [number, number, number],
): [number, number, number] {
  const size = L.bottom - L.top;
  out[0] = L.left + 44 * L.dpr;
  out[1] = L.top;
  out[2] = size;
  return out;
}

const box: [number, number, number] = [0, 0, 0];
const pt: [number, number] = [0, 0];

/**
 * Where a bar's point sits in the diagram at `level`: x = birth, y = death once the lake has
 * died; while alive it rides at y = level (drawn hollow). The essential bar sits on the ∞ line.
 * Returns false before birth.
 */
export function diagramPoint(
  bar: Bar,
  level: number,
  minH: number,
  maxH: number,
  L: StripLayout,
  out: [number, number],
): boolean {
  if (level < bar.birth) return false;
  diagramBox(L, box);
  const [bx, by, size] = box;
  const inf = 7 * L.dpr; // the ∞ line sits just above the top of the square
  const span = maxH - minH || 1;
  const sx = (v: number) => bx + ((v - minH) / span) * (size - inf);
  const sy = (v: number) => by + inf + (1 - (v - minH) / span) * (size - inf);
  out[0] = sx(bar.birth);
  out[1] = Number.isFinite(bar.death) ? sy(Math.min(bar.death, level)) : by;
  return true;
}

/** Draw the persistence diagram: birth across, death up, the diagonal, and the ∞ line. */
export function drawDiagram(ctx: StripCtx, s: StripState): void {
  const { L, rows, fills, level, minH, maxH, colors } = s;
  ctx.clearRect(0, 0, L.w, L.h);
  diagramBox(L, box);
  const [bx, by, size] = box;
  const inf = 7 * L.dpr;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = L.dpr;
  ctx.setLineDash(EMPTY_DASH);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by + size);
  ctx.lineTo(bx + size - inf, by + size);
  ctx.stroke();
  // Diagonal (death = birth).
  ctx.beginPath();
  ctx.moveTo(bx, by + size);
  ctx.lineTo(bx + size - inf, by + inf);
  ctx.stroke();
  // ∞ line and level line.
  ctx.setLineDash(LEVEL_DASH);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + size - inf, by);
  ctx.stroke();
  const span = maxH - minH || 1;
  const yl = by + inf + (1 - (Math.min(maxH, level) - minH) / span) * (size - inf);
  ctx.strokeStyle = colors.level;
  ctx.beginPath();
  ctx.moveTo(bx, yl);
  ctx.lineTo(bx + size - inf, yl);
  ctx.stroke();
  ctx.setLineDash(EMPTY_DASH);
  ctx.fillStyle = colors.text;
  ctx.font = s.font;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('∞', bx - 4 * L.dpr, by);
  ctx.fillText('death', bx - 4 * L.dpr, by + size / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('birth →', bx, by + size + 4 * L.dpr);
  const r = 2.6 * L.dpr;
  for (let k = 0; k < rows.length; k++) {
    const b = rows[k];
    if (!diagramPoint(b, level, minH, maxH, L, pt)) continue;
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], k === s.highlight ? r * 1.8 : r, 0, Math.PI * 2);
    if (isAlive(b, level) && Number.isFinite(b.death)) {
      ctx.strokeStyle = fills[k];
      ctx.lineWidth = 1.4 * L.dpr;
      ctx.stroke();
    } else {
      ctx.fillStyle = fills[k];
      ctx.fill();
    }
    if (k === s.highlight) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5 * L.dpr;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], r * 2.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Legend to the right of the square.
  const tx = bx + size + 14 * L.dpr;
  if (tx < L.right - 80 * L.dpr) {
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('One point per lake.', tx, by + 4 * L.dpr);
    ctx.fillText('Height above the diagonal', tx, by + 22 * L.dpr);
    ctx.fillText('is persistence.', tx, by + 38 * L.dpr);
    ctx.fillText('Level', tx, by + 60 * L.dpr);
    ctx.fillText(s.levelText, tx + 44 * L.dpr, by + 60 * L.dpr);
  }
}

/** Row index of the diagram point nearest (x, y) within `radius` device px, or −1. */
export function diagramHit(
  x: number,
  y: number,
  radius: number,
  rows: readonly Bar[],
  level: number,
  minH: number,
  maxH: number,
  L: StripLayout,
): number {
  let best = -1;
  let bestD = radius * radius;
  for (let k = 0; k < rows.length; k++) {
    if (!diagramPoint(rows[k], level, minH, maxH, L, pt)) continue;
    const d = (pt[0] - x) ** 2 + (pt[1] - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** Row index of the barcode bar under (x, y), or −1. Only bars already born can be hit. */
export function barcodeHit(
  _x: number,
  y: number,
  rows: readonly Bar[],
  level: number,
  L: StripLayout,
): number {
  const k = rowAtY(y, rows.length, L);
  if (k < 0 || level < rows[k].birth) return -1;
  return k;
}
