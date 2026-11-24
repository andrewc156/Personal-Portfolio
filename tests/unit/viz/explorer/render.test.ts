import { describe, expect, it } from 'vitest';
import { Flood, isEssential } from '../../../../src/lib/tda/index.ts';
import {
  basinMask,
  lakeMask,
  traceOutline,
  WaterPainter,
} from '../../../../src/lib/viz/explorer/map.ts';
import {
  identitySlots,
  indexLakes,
  nextDown,
  selectRows,
} from '../../../../src/lib/viz/explorer/model.ts';
import {
  barcodeHit,
  diagramHit,
  diagramPoint,
  drawStrip,
  levelToX,
  niceTicks,
  rowPitch,
  stripLayout,
  type StripCtx,
  type StripState,
} from '../../../../src/lib/viz/explorer/strip.ts';
import { heights, liveResult, meta } from './helpers.ts';

const res = liveResult();
const index = indexLakes(res.bars);
const W = meta.width;
const H = meta.height;
const n = W * H;

describe('water overlay = engine state', () => {
  it('a pixel is coloured iff its cell is wet, with its lake’s identity colour', () => {
    const slots = identitySlots(index, n);
    const cols = Uint32Array.from({ length: 12 }, (_, k) => 0x1000 + k);
    const neutral = 0xabcdef;
    const painter = new WaterPainter(W, H);
    painter.setColors(cols, neutral);
    const flood = new Flood(heights, W, H, { order: res.order });
    for (const level of [0, 900, 1671.4, 2400, 3500, 1200]) {
      flood.advanceTo(level);
      painter.paint(flood, slots);
      for (let i = 0; i < n; i += 7) {
        const wet = heights[i] <= level;
        const px = painter.pixels[i];
        if (!wet) {
          expect(px).toBe(0);
          continue;
        }
        const s = slots[flood.componentOf(i)];
        expect(px).toBe(s >= 0 ? cols[s] : neutral);
      }
    }
  });
});

describe('outline and basin', () => {
  it('traceOutline length equals a brute-force perimeter count', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let t = 0; t < 20; t++) {
      const w = 1 + Math.floor(rnd() * 12);
      const h = 1 + Math.floor(rnd() * 12);
      const mask = Uint8Array.from({ length: w * h }, () => (rnd() < 0.5 ? 1 : 0));
      let brute = 0;
      const at = (x: number, y: number) =>
        x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue;
          brute += (at(x - 1, y) ? 0 : 1) + (at(x + 1, y) ? 0 : 1);
          brute += (at(x, y - 1) ? 0 : 1) + (at(x, y + 1) ? 0 : 1);
        }
      }
      let segLen = 0;
      const total = traceOutline(mask, w, h, (x0, y0, x1, y1) => {
        expect(x0 === x1 || y0 === y1).toBe(true);
        segLen += Math.abs(x1 - x0) + Math.abs(y1 - y0);
      });
      expect(total).toBe(brute);
      expect(segLen).toBe(brute);
    }
  });

  it('the basin just before the spill equals the live lake just below the death level', () => {
    const flood = new Flood(heights, W, H, { order: res.order });
    const a = new Uint8Array(n);
    const b = new Uint8Array(n);
    const queue = new Int32Array(n);
    for (const bar of index.ranked.slice(0, 15)) {
      flood.advanceTo(nextDown(bar.death));
      const na = lakeMask(flood, bar.birthCell, a);
      const nb = basinMask(bar.birthCell, res.rank[bar.deathCell], res.rank, W, H, b, queue);
      expect(nb).toBe(na);
      expect(a).toEqual(b);
    }
  });
});

/** Records the calls the strip makes. */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; fill: string; alpha: number }[] = [];
  const arcs: { x: number; y: number }[] = [];
  const ctx: StripCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    clearRect() {},
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: String(ctx.fillStyle), alpha: ctx.globalAlpha });
    },
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc(x, y) {
      arcs.push({ x, y });
    },
    stroke() {},
    fill() {},
    fillText() {},
    setLineDash() {},
  };
  return { ctx, rects, arcs };
}

describe('barcode strip draws the engine bars', () => {
  const rows = selectRows(index, 10, 40, res.rank);
  const fills = rows.map((_, k) => `#00${String(k).padStart(2, '0')}00`);
  const L = stripLayout(480, 272, 2);
  const minH = res.bars.reduce((m, b) => Math.min(m, b.birth), Infinity);
  const maxH = heights[meta.max.cell];
  const state = (level: number, view: 'barcode' | 'diagram'): StripState => ({
    L,
    view,
    rows,
    fills,
    level,
    minH,
    maxH,
    colors: { axis: '#000', text: '#000', level: '#000', highlight: '#000' },
    selected: -1,
    ticks: niceTicks(minH, maxH, 'm'),
    tickText: niceTicks(minH, maxH, 'm').map(String),
    levelText: '',
    font: '',
  });

  it('each born row is drawn from birth to min(death, level); ghosts span the whole lifetime', () => {
    const level = 1800;
    const { ctx, rects } = recorder();
    drawStrip(ctx, state(level, 'barcode'));
    rows.forEach((b, k) => {
      const mine = rects.filter((r) => r.fill === fills[k]);
      const ghost = mine.find((r) => r.alpha < 1)!;
      expect(ghost.x).toBeCloseTo(levelToX(b.birth, minH, maxH, L), 6);
      const solid = mine.filter((r) => r.alpha === 1);
      if (level < b.birth) {
        expect(solid).toHaveLength(0);
        return;
      }
      expect(solid).toHaveLength(1);
      const end = levelToX(Math.min(b.death, level), minH, maxH, L);
      expect(solid[0].x + solid[0].w).toBeCloseTo(Math.max(end, solid[0].x + L.dpr), 6);
    });
  });

  it('a click on a row picks that row', () => {
    const pitch = rowPitch(rows.length, L);
    for (const k of [0, 5, rows.length - 1]) {
      expect(barcodeHit(L.top + (k + 0.5) * pitch, rows.length, L)).toBe(k);
    }
    expect(barcodeHit(L.top - 5, rows.length, L)).toBe(-1);
  });

  it('diagram: finished lakes sit at (birth, death); the lowest lake on the ∞ line; hits pick them', () => {
    const { ctx, arcs } = recorder();
    drawStrip(ctx, state(maxH, 'diagram'));
    const p = new Float64Array(2);
    for (let k = 0; k < rows.length; k++) {
      diagramPoint(rows[k], rows[k].death, minH, maxH, L, p);
      expect(arcs.some((a) => Math.abs(a.x - p[0]) < 1e-6 && Math.abs(a.y - p[1]) < 1e-6)).toBe(
        true,
      );
      if (!isEssential(rows[k])) {
        const hit = diagramHit(p[0], p[1], 0.5, rows, minH, maxH, L);
        expect(rows[hit].death).toBe(rows[k].death);
      }
    }
  });

  it('niceTicks covers the range in either unit', () => {
    const m = niceTicks(minH, maxH, 'm');
    const ft = niceTicks(minH, maxH, 'ft');
    expect(m.length).toBeGreaterThanOrEqual(3);
    expect(ft.length).toBeGreaterThanOrEqual(3);
    for (const v of [...m, ...ft]) {
      expect(v).toBeGreaterThanOrEqual(minH - 1e-9);
      expect(v).toBeLessThanOrEqual(maxH + 1e-9);
    }
    // Feet ticks are round numbers of feet.
    for (const v of ft) expect(Math.abs(v / 0.3048 - Math.round(v / 0.3048))).toBeLessThan(1e-6);
  });
});
