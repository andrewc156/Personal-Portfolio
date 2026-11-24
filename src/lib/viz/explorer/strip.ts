import type { Bar } from '../../tda/index.ts';
import type { StripView, Units } from './model.ts';
import { fmt, M_PER_FT, NBSP } from './text.ts';

/**
 * The explorer's barcode strip and persistence diagram. Geometry and hit testing are pure; the
 * draw functions take any object with the 2-D canvas methods they use, so tests can record what
 * is drawn. Coordinates are device pixels. Each row is an engine Bar object, drawn from birth to
 * min(death, level); the full lifetime is drawn faintly behind it so every lake can be clicked.
 */

export interface StripLayout {
  w: number;
  h: number;
  dpr: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface StripCtx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
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
  view: StripView;
  rows: readonly Bar[];
  fills: readonly string[];
  level: number;
  minH: number;
  maxH: number;
  colors: StripColors;
  /** Selected row index, or −1. */
  selected: number;
  ticks: readonly number[];
  tickText: readonly string[];
  levelText: string;
  font: string;
}

const PAD = { left: 10, right: 16, top: 8, bottom: 22 } as const;
const MAX_PITCH = 10;
const GHOST_ALPHA = 0.22;
const NO_DASH: number[] = [];
const DASH: number[] = [4, 3];

export function stripFont(dpr: number): string {
  return `${11 * dpr}px "IBM Plex Mono", ui-monospace, monospace`;
}

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

export function rowPitch(nRows: number, L: StripLayout): number {
  return Math.min((L.bottom - L.top) / Math.max(1, nRows), MAX_PITCH * L.dpr);
}

export function rowAtY(y: number, nRows: number, L: StripLayout): number {
  if (nRows === 0) return -1;
  const k = Math.floor((y - L.top) / rowPitch(nRows, L));
  return k >= 0 && k < nRows ? k : -1;
}

/** "Nice" axis ticks (values in metres) for [minH, maxH] shown in `units`. */
export function niceTicks(minH: number, maxH: number, units: Units, target = 5): number[] {
  const f = units === 'ft' ? 1 / M_PER_FT : 1;
  const lo = minH * f;
  const hi = maxH * f;
  const raw = (hi - lo) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v / f);
  return out;
}

export function tickLabel(m: number, units: Units): string {
  const v = units === 'ft' ? m / M_PER_FT : m;
  return `${fmt(Math.round(v), 0)}${NBSP}${units}`;
}

// ---- barcode ---------------------------------------------------------------------------------

export function drawStrip(ctx: StripCtx, s: StripState): void {
  if (s.view === 'diagram') drawDiagram(ctx, s);
  else drawBarcode(ctx, s);
}

export function drawBarcode(ctx: StripCtx, s: StripState): void {
  const { L, rows, fills, level, minH, maxH, colors } = s;
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.globalAlpha = 1;
  drawAxis(ctx, s);
  const pitch = rowPitch(rows.length, L);
  const thick = Math.max(L.dpr, pitch * 0.66);
  for (let k = 0; k < rows.length; k++) {
    const b = rows[k];
    const y = L.top + k * pitch + (pitch - thick) / 2;
    const x0 = levelToX(b.birth, minH, maxH, L);
    const xEnd = Number.isFinite(b.death) ? levelToX(b.death, minH, maxH, L) : L.right;
    ctx.fillStyle = fills[k];
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.fillRect(x0, y, Math.max(L.dpr, xEnd - x0), thick);
    ctx.globalAlpha = 1;
    if (level >= b.birth) {
      const top = Math.min(b.death, level);
      const x1 =
        !Number.isFinite(b.death) && level >= maxH ? L.right : levelToX(top, minH, maxH, L);
      ctx.fillRect(x0, y, Math.max(L.dpr, x1 - x0), thick);
    }
    if (k === s.selected) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5 * L.dpr;
      ctx.strokeRect(
        x0 - 1.5 * L.dpr,
        y - 1.5 * L.dpr,
        Math.max(L.dpr, xEnd - x0) + 3 * L.dpr,
        thick + 3 * L.dpr,
      );
    }
    if (!Number.isFinite(b.death)) {
      ctx.fillStyle = colors.text;
      ctx.font = s.font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('∞', L.right + 3 * L.dpr, y + thick / 2);
    }
  }
  const xl = levelToX(level, minH, maxH, L);
  ctx.strokeStyle = colors.level;
  ctx.lineWidth = 1.5 * L.dpr;
  ctx.setLineDash(NO_DASH);
  ctx.beginPath();
  ctx.moveTo(xl, L.top - 4 * L.dpr);
  ctx.lineTo(xl, L.bottom);
  ctx.stroke();
}

function drawAxis(ctx: StripCtx, s: StripState): void {
  const { L, colors, minH, maxH } = s;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = L.dpr;
  ctx.setLineDash(NO_DASH);
  ctx.beginPath();
  ctx.moveTo(L.left, L.bottom + 0.5 * L.dpr);
  ctx.lineTo(L.right, L.bottom + 0.5 * L.dpr);
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = s.font;
  ctx.textBaseline = 'top';
  const xl = levelToX(s.level, minH, maxH, L);
  // Monospace labels: width ≈ 0.6 em per character, so no text measuring per frame.
  const charW = 0.6 * 11 * L.dpr;
  const lw = s.levelText.length * charW;
  const la = xl > L.right - lw / 2 ? 'right' : xl < L.left + lw / 2 ? 'left' : 'center';
  const l0 = la === 'left' ? xl : la === 'right' ? xl - lw : xl - lw / 2;
  const pad = 8 * L.dpr;
  for (let t = 0; t < s.ticks.length; t++) {
    const x = levelToX(s.ticks[t], minH, maxH, L);
    ctx.beginPath();
    ctx.moveTo(x, L.bottom);
    ctx.lineTo(x, L.bottom + 3 * L.dpr);
    ctx.stroke();
    const tw = s.tickText[t].length * charW;
    const ta = x > L.right - tw / 2 ? 'right' : x < L.left + tw / 2 ? 'left' : 'center';
    const t0 = ta === 'left' ? x : ta === 'right' ? x - tw : x - tw / 2;
    if (t0 < l0 + lw + pad && l0 < t0 + tw + pad) continue; // keep clear of the level label
    ctx.textAlign = ta;
    ctx.fillText(s.tickText[t], x, L.bottom + 5 * L.dpr);
  }
  ctx.textAlign = la;
  ctx.fillStyle = colors.level;
  ctx.fillText(s.levelText, xl, L.bottom + 5 * L.dpr);
}

/** Row under (x, y) in the barcode; any row can be picked, born or not. */
export function barcodeHit(y: number, nRows: number, L: StripLayout): number {
  return rowAtY(y, nRows, L);
}

// ---- persistence diagram ---------------------------------------------------------------------

/** Square plot box [x0, y0, size] in device px, plus the ∞-line offset. */
export function diagramBox(L: StripLayout, out: Float64Array): Float64Array {
  const size = Math.max(1, Math.min(L.bottom - L.top, L.right - L.left - 50 * L.dpr));
  out[0] = L.left + 40 * L.dpr;
  out[1] = L.top;
  out[2] = size;
  out[3] = 8 * L.dpr;
  return out;
}

const box = new Float64Array(4);

/** Final position of a bar's point: x = birth, y = death (the ∞ line for the lowest lake). */
export function diagramPoint(
  bar: Bar,
  y: number,
  minH: number,
  maxH: number,
  L: StripLayout,
  out: Float64Array,
): Float64Array {
  diagramBox(L, box);
  const [bx, by, size, inf] = box;
  const span = maxH - minH || 1;
  out[0] = bx + ((bar.birth - minH) / span) * (size - inf);
  out[1] = Number.isFinite(y)
    ? by + inf + (1 - (Math.min(maxH, y) - minH) / span) * (size - inf)
    : by;
  return out;
}

const pt = new Float64Array(2);

export function drawDiagram(ctx: StripCtx, s: StripState): void {
  const { L, rows, fills, level, minH, maxH, colors } = s;
  ctx.clearRect(0, 0, L.w, L.h);
  ctx.globalAlpha = 1;
  diagramBox(L, box);
  const [bx, by, size, inf] = box;
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = L.dpr;
  ctx.setLineDash(NO_DASH);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by + size);
  ctx.lineTo(bx + size - inf, by + size);
  ctx.stroke();
  ctx.beginPath(); // diagonal: death = birth
  ctx.moveTo(bx, by + size);
  ctx.lineTo(bx + size - inf, by + inf);
  ctx.stroke();
  ctx.setLineDash(DASH);
  ctx.beginPath(); // ∞ line
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + size - inf, by);
  ctx.stroke();
  const span = maxH - minH || 1;
  const yl = by + inf + (1 - (Math.min(maxH, Math.max(minH, level)) - minH) / span) * (size - inf);
  ctx.strokeStyle = colors.level;
  ctx.beginPath();
  ctx.moveTo(bx, yl);
  ctx.lineTo(bx + size - inf, yl);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.fillStyle = colors.text;
  ctx.font = s.font;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('∞', bx - 5 * L.dpr, by);
  ctx.fillText('death', bx - 5 * L.dpr, by + size / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('birth →', bx, by + size + 5 * L.dpr);
  const r = 2.8 * L.dpr;
  for (let k = 0; k < rows.length; k++) {
    const b = rows[k];
    diagramPoint(b, b.death, minH, maxH, L, pt);
    const fx = pt[0];
    const fy = pt[1];
    ctx.fillStyle = fills[k];
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (level >= b.birth) {
      if (level >= b.death) {
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Alive: a hollow point riding at the current level.
        diagramPoint(
          b,
          Number.isFinite(b.death) || level < maxH ? level : Infinity,
          minH,
          maxH,
          L,
          pt,
        );
        ctx.strokeStyle = fills[k];
        ctx.lineWidth = 1.5 * L.dpr;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (k === s.selected) {
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.5 * L.dpr;
      ctx.beginPath();
      ctx.arc(fx, fy, r * 2.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const tx = bx + size + 12 * L.dpr;
  if (tx < L.right - 90 * L.dpr) {
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('One point per lake.', tx, by + 4 * L.dpr);
    ctx.fillText('Height above the', tx, by + 22 * L.dpr);
    ctx.fillText('diagonal is', tx, by + 38 * L.dpr);
    ctx.fillText('persistence.', tx, by + 54 * L.dpr);
    ctx.fillStyle = colors.level;
    ctx.fillText(`Level ${s.levelText}`, tx, by + 78 * L.dpr);
  }
}

/** Row whose final diagram point is nearest (x, y) within `radius` device px, or −1. */
export function diagramHit(
  x: number,
  y: number,
  radius: number,
  rows: readonly Bar[],
  minH: number,
  maxH: number,
  L: StripLayout,
): number {
  let best = -1;
  let bestD = radius * radius;
  for (let k = 0; k < rows.length; k++) {
    diagramPoint(rows[k], rows[k].death, minH, maxH, L, pt);
    const d = (pt[0] - x) ** 2 + (pt[1] - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}
