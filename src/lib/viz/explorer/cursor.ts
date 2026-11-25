/**
 * Keyboard cell cursor for the explorer map (F27, QA-08): pure key → move mapping and clamping.
 * Cells are numbered i = y·W + x with row 0 in the north (geo.ts). The controller owns the state;
 * these helpers never allocate per call beyond the small result object.
 */

/** Cells moved by Shift + arrow. */
export const CURSOR_BIG_STEP = 10;
/** Rows moved by Page Up / Page Down. */
export const CURSOR_PAGE_STEP = 50;

export type CursorKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

const KEYS: ReadonlySet<string> = new Set<CursorKey>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function isCursorKey(key: string): key is CursorKey {
  return KEYS.has(key);
}

/** Clamp (x, y) into the grid and return its cell index. */
export function clampCell(x: number, y: number, W: number, H: number): number {
  const cx = Math.min(W - 1, Math.max(0, Math.trunc(x)));
  const cy = Math.min(H - 1, Math.max(0, Math.trunc(y)));
  return cy * W + cx;
}

/**
 * The cell the cursor moves to from `cell` for `key`: arrows move one cell (Shift: 10), Page Up /
 * Page Down move 50 rows north / south, Home / End jump to the west / east end of the row (with
 * Shift, to the north-west / south-east corner). Movement stops at the edges of the grid.
 */
export function moveCursor(
  cell: number,
  key: CursorKey,
  shift: boolean,
  W: number,
  H: number,
): number {
  const y0 = Math.floor(cell / W);
  const x0 = cell - y0 * W;
  const step = shift ? CURSOR_BIG_STEP : 1;
  switch (key) {
    case 'ArrowLeft':
      return clampCell(x0 - step, y0, W, H);
    case 'ArrowRight':
      return clampCell(x0 + step, y0, W, H);
    case 'ArrowUp':
      return clampCell(x0, y0 - step, W, H);
    case 'ArrowDown':
      return clampCell(x0, y0 + step, W, H);
    case 'PageUp':
      return clampCell(x0, y0 - CURSOR_PAGE_STEP, W, H);
    case 'PageDown':
      return clampCell(x0, y0 + CURSOR_PAGE_STEP, W, H);
    case 'Home':
      return shift ? 0 : clampCell(0, y0, W, H);
    case 'End':
      return shift ? W * H - 1 : clampCell(W - 1, y0, W, H);
  }
}

/** Where the cursor starts: the last inspected cell, else the selected lake's pit, else the centre. */
export function startCell(
  lastInspected: number,
  selectedPit: number,
  W: number,
  H: number,
): number {
  const n = W * H;
  if (lastInspected >= 0 && lastInspected < n) return lastInspected;
  if (selectedPit >= 0 && selectedPit < n) return selectedPit;
  return clampCell(Math.floor(W / 2), Math.floor(H / 2), W, H);
}

/** "column 12 of 293, row 40 of 461": the cursor's grid position (1-based, from the grid size). */
export function cellPosition(cell: number, W: number, H: number): string {
  const y = Math.floor(cell / W);
  const x = cell - y * W;
  return `column ${x + 1} of ${W}, row ${y + 1} of ${H}`;
}
