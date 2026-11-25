import { describe, expect, it } from 'vitest';
import {
  CURSOR_BIG_STEP,
  CURSOR_PAGE_STEP,
  cellPosition,
  clampCell,
  isCursorKey,
  moveCursor,
  startCell,
} from '../../../../src/lib/viz/explorer/cursor.ts';
import { gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import { hoverText, NBSP } from '../../../../src/lib/viz/explorer/text.ts';
import { heights, meta } from './helpers.ts';

/** The real grid size from meta.json (F27, QA-08). */
const W = meta.width;
const H = meta.height;
const at = (x: number, y: number) => y * W + x;

describe('keyboard cell cursor: movement and clamping', () => {
  it('recognises only the movement keys', () => {
    for (const k of [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]) {
      expect(isCursorKey(k)).toBe(true);
    }
    for (const k of ['Enter', 'Escape', ' ', 'a', 'Tab']) expect(isCursorKey(k)).toBe(false);
  });

  it('arrows move one cell; north is row 0', () => {
    const c = at(100, 200);
    expect(moveCursor(c, 'ArrowRight', false, W, H)).toBe(at(101, 200));
    expect(moveCursor(c, 'ArrowLeft', false, W, H)).toBe(at(99, 200));
    expect(moveCursor(c, 'ArrowUp', false, W, H)).toBe(at(100, 199));
    expect(moveCursor(c, 'ArrowDown', false, W, H)).toBe(at(100, 201));
  });

  it('Shift moves ten cells; Page Up / Down move 50 rows', () => {
    const c = at(100, 200);
    expect(CURSOR_BIG_STEP).toBe(10);
    expect(moveCursor(c, 'ArrowRight', true, W, H)).toBe(at(110, 200));
    expect(moveCursor(c, 'ArrowUp', true, W, H)).toBe(at(100, 190));
    expect(moveCursor(c, 'PageUp', false, W, H)).toBe(at(100, 200 - CURSOR_PAGE_STEP));
    expect(moveCursor(c, 'PageDown', false, W, H)).toBe(at(100, 200 + CURSOR_PAGE_STEP));
  });

  it('Home / End go to the row ends; with Shift, to the corners', () => {
    const c = at(100, 200);
    expect(moveCursor(c, 'Home', false, W, H)).toBe(at(0, 200));
    expect(moveCursor(c, 'End', false, W, H)).toBe(at(W - 1, 200));
    expect(moveCursor(c, 'Home', true, W, H)).toBe(0);
    expect(moveCursor(c, 'End', true, W, H)).toBe(W * H - 1);
  });

  it('never wraps across a row or leaves the grid', () => {
    expect(moveCursor(at(0, 5), 'ArrowLeft', false, W, H)).toBe(at(0, 5));
    expect(moveCursor(at(W - 1, 5), 'ArrowRight', false, W, H)).toBe(at(W - 1, 5));
    expect(moveCursor(at(W - 3, 5), 'ArrowRight', true, W, H)).toBe(at(W - 1, 5));
    expect(moveCursor(at(4, 0), 'ArrowUp', false, W, H)).toBe(at(4, 0));
    expect(moveCursor(at(4, 3), 'PageUp', false, W, H)).toBe(at(4, 0));
    expect(moveCursor(at(4, H - 1), 'ArrowDown', true, W, H)).toBe(at(4, H - 1));
    expect(moveCursor(at(4, H - 20), 'PageDown', false, W, H)).toBe(at(4, H - 1));
    expect(clampCell(-5, H + 5, W, H)).toBe(at(0, H - 1));
    expect(clampCell(W + 5, -1, W, H)).toBe(at(W - 1, 0));
  });

  it('walks every column of a row and back without skipping', () => {
    let c = at(0, 7);
    for (let x = 1; x < W; x++) {
      c = moveCursor(c, 'ArrowRight', false, W, H);
      expect(c).toBe(at(x, 7));
    }
    expect(moveCursor(c, 'ArrowRight', false, W, H)).toBe(c);
  });
});

describe('keyboard cell cursor: start cell and readout', () => {
  it('starts at the last inspected cell, else the selected pit, else the centre', () => {
    expect(startCell(42, 7, W, H)).toBe(42);
    expect(startCell(-1, meta.min.cell, W, H)).toBe(meta.min.cell);
    expect(startCell(-1, -1, W, H)).toBe(at(Math.floor(W / 2), Math.floor(H / 2)));
    expect(startCell(W * H, -1, W, H)).toBe(at(Math.floor(W / 2), Math.floor(H / 2)));
  });

  it('position is 1-based and uses the grid size from meta.json', () => {
    expect(cellPosition(0, W, H)).toBe(`column 1 of ${W}, row 1 of ${H}`);
    expect(cellPosition(W * H - 1, W, H)).toBe(`column ${W} of ${W}, row ${H} of ${H}`);
    expect(cellPosition(at(11, 39), W, H)).toBe(`column 12 of ${W}, row 40 of ${H}`);
  });

  it('the readout for a cursor cell is the hover readout from grid.f32 and meta.json', () => {
    const g = gridGeo(meta);
    const m = meta.max;
    const text = hoverText(m.cell, heights[m.cell], g, null, 'm').replaceAll(NBSP, ' ');
    const elev = heights[m.cell].toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    expect(text).toContain(`Elevation ${elev} m`);
    expect(text).toContain(`${m.lat.toFixed(4)}° N, ${Math.abs(m.lon).toFixed(4)}° W`);
    expect(text.endsWith('· dry')).toBe(true);
  });
});
