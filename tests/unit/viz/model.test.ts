import { describe, expect, it } from 'vitest';
import {
  computeH0,
  computeH1Islands,
  Flood,
  isEssential,
  persistence,
} from '../../../src/lib/tda/index.ts';
import type { Bar, IslandBar } from '../../../src/lib/tda/index.ts';
import { PALETTES } from '../../../src/lib/viz/common/palettes.ts';
import { packRgb, hexToRgb } from '../../../src/lib/viz/common/color.ts';
import { selectIslandBars } from '../../../src/lib/viz/hero/islands.ts';
import {
  barcodeHit,
  diagramPoint,
  drawBarcode,
  drawDiagram,
  levelToX,
  rowAtY,
  stripFont,
  stripLayout,
  xToLevel,
  type StripCtx,
  type StripState,
} from '../../../src/lib/viz/hero/barcode.ts';
import {
  basinMask,
  buildLakeTable,
  levelAt,
  rankLakes,
  selectBars,
} from '../../../src/lib/viz/hero/model.ts';
import { MapPainter } from '../../../src/lib/viz/hero/render-map.ts';
import { generateTerrain, heightRange, hillshade } from '../../../src/lib/viz/hero/terrain.ts';

const SEEDS = [1, 7, 42, 2026, 99999];

function terrain(seed: number, W = 96, H = 48) {
  const heights = generateTerrain(W, H, { seed, scale: 1.5, roughness: 0.5 });
  const result = computeH0(heights, W, H);
  const [minH, maxH] = heightRange(heights);
  return { W, H, heights, result, minH, maxH };
}

/** Records every canvas call the strip makes. */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  const arcs: { x: number; y: number }[] = [];
  const ctx: StripCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    clearRect() {},
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: String(ctx.fillStyle) });
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

function state(rows: (Bar | IslandBar)[], level: number, minH: number, maxH: number): StripState {
  const L = stripLayout(640, 120, 2);
  return {
    L,
    rows,
    fills: rows.map((_, k) => `#00000${k % 10}`),
    level,
    minH,
    maxH,
    colors: { axis: '#000', text: '#000', level: '#000', highlight: '#000' },
    highlight: -1,
    ticks: [minH, maxH],
    tickText: ['a', 'b'],
    levelText: 'x',
    font: stripFont(2),
  };
}

describe('island barcode', () => {
  it('draws the exact intervals from the H1 engine for the same terrain and level', () => {
    for (const seed of SEEDS) {
      const { W, H, heights, result, minH, maxH } = terrain(seed);
      const { bars } = computeH1Islands(heights, W, H, { order: result.order });
      expect(bars.length).toBeGreaterThan(0);
      const rows = selectIslandBars(bars, 0, bars.length);
      expect(new Set(rows)).toEqual(new Set(bars));
      for (const level of [(minH + maxH) / 2, maxH]) {
        const { ctx, rects } = recorder();
        const s = state(rows, level, minH, maxH);
        drawBarcode(ctx, s);
        const shown = rows.filter((b) => b.birth <= level);
        expect(rects).toHaveLength(shown.length);
        for (const [k, b] of shown.entries()) {
          expect(rects[k].x).toBeCloseTo(levelToX(b.birth, minH, maxH, s.L));
          expect(rects[k].x + rects[k].w).toBeCloseTo(
            levelToX(Math.min(b.death, level), minH, maxH, s.L),
          );
        }
      }
    }
  });

  it('drops zero-length bars and breaks persistence ties by birth level and cutoff cell', () => {
    const bars: IslandBar[] = [
      { birth: 2, death: 6, saddleCell: 8, peakCell: 12, mergedInto: -1 },
      { birth: 3, death: 8, saddleCell: 5, peakCell: 18, mergedInto: -1 },
      { birth: 2, death: 6, saddleCell: 6, peakCell: 11, mergedInto: -1 },
      { birth: 1, death: 1, saddleCell: 7, peakCell: 10, mergedInto: -1 },
    ];
    expect(selectIslandBars(bars, 0, 5)).toEqual([bars[2], bars[0], bars[1]]);
    expect(selectIslandBars(bars, 4, 2)).toEqual([bars[2], bars[1]]);
    expect(selectIslandBars(bars, 5, 5)).toEqual([bars[1]]);
  });
});

describe('selectBars (the bars the barcode draws)', () => {
  it('with no threshold and no cap, the rows are exactly the engine bars', () => {
    for (const seed of SEEDS) {
      const { result } = terrain(seed);
      const rows = selectBars(result, 0, Infinity);
      expect(rows.length).toBe(result.bars.length);
      const key = (b: Bar) => `${b.birthCell}:${b.deathCell}`;
      expect(new Set(rows.map(key))).toEqual(new Set(result.bars.map(key)));
      // Same objects, unmodified.
      for (const r of rows) expect(result.bars.includes(r)).toBe(true);
    }
  });

  it('threshold and cap keep the most persistent engine bars, essential first row', () => {
    for (const seed of SEEDS) {
      const { result } = terrain(seed);
      const minP = 10;
      const cap = 12;
      const rows = selectBars(result, minP, cap);
      const eligible = result.bars.filter((b) => isEssential(b) || persistence(b) >= minP);
      expect(rows.length).toBe(Math.min(cap, eligible.length));
      expect(isEssential(rows[0])).toBe(true);
      const minKept = Math.min(...rows.filter((b) => !isEssential(b)).map(persistence));
      const dropped = eligible.filter((b) => !rows.includes(b));
      for (const d of dropped) expect(persistence(d)).toBeLessThanOrEqual(minKept);
      for (let k = 1; k < rows.length; k++) {
        expect(result.rank[rows[k - 1].birthCell]).toBeLessThan(result.rank[rows[k].birthCell]);
      }
    }
  });
});

describe('criterion 2: drawn bars equal the engine bars for the same seed', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: every fillRect is one engine bar, birth → min(death, level)`, () => {
      const { result, minH, maxH } = terrain(seed);
      const rows = selectBars(result, 0, Infinity);
      for (const p of [0.1, 0.45, 0.8, 1]) {
        const level = minH + p * (maxH - minH);
        const { ctx, rects } = recorder();
        const s = state(rows, level, minH, maxH);
        drawBarcode(ctx, s);
        const born = result.bars.filter((b) => b.birth <= level);
        expect(rects.length).toBe(born.length);
        const span = maxH - minH;
        const tol = span * 1e-9 + 1e-9;
        rects.forEach((r) => {
          const k = rowAtY(r.y + r.h / 2, rows.length, s.L);
          const bar = rows[k];
          expect(result.bars.includes(bar)).toBe(true);
          expect(r.fill).toBe(s.fills[k]);
          expect(Math.abs(xToLevel(r.x, minH, maxH, s.L) - bar.birth)).toBeLessThan(tol);
          const end = xToLevel(r.x + r.w, minH, maxH, s.L);
          expect(Math.abs(end - Math.min(bar.death, level))).toBeLessThan(tol);
        });
      }
    });
  }

  it('at the top level, finite bars are complete and the essential bar reaches the right edge', () => {
    const { result, minH, maxH } = terrain(42);
    const rows = selectBars(result, 0, Infinity);
    const { ctx, rects } = recorder();
    const s = state(rows, maxH, minH, maxH);
    drawBarcode(ctx, s);
    const ess = rects[rowsIndex(rows, isEssential)];
    expect(ess.x + ess.w).toBeCloseTo(s.L.right, 6);
    for (const r of rects) {
      const bar = rows[rowAtY(r.y + r.h / 2, rows.length, s.L)];
      if (!isEssential(bar)) {
        expect(xToLevel(r.x + r.w, minH, maxH, s.L)).toBeCloseTo(bar.death, 6);
      }
    }
  });

  it('persistence diagram: one point per born bar at (birth, death); essential on the ∞ line', () => {
    const { result, minH, maxH } = terrain(7);
    const rows = selectBars(result, 0, Infinity);
    const { ctx, arcs } = recorder();
    const s = state(rows, maxH, minH, maxH);
    drawDiagram(ctx, s);
    expect(arcs.length).toBe(rows.length);
    const pt: [number, number] = [0, 0];
    rows.forEach((b, k) => {
      diagramPoint(b, maxH, minH, maxH, s.L, pt);
      expect(arcs[k]).toEqual({ x: pt[0], y: pt[1] });
      if (isEssential(b)) expect(pt[1]).toBe(s.L.top);
    });
    // Death above birth: every finite point sits above the diagonal (smaller y than birth's).
    const a: [number, number] = [0, 0];
    for (const b of rows.filter((r) => !isEssential(r))) {
      diagramPoint({ ...b, death: b.birth }, maxH, minH, maxH, s.L, a);
      diagramPoint(b, maxH, minH, maxH, s.L, pt);
      expect(pt[1]).toBeLessThan(a[1]);
    }
  });

  it('hit testing returns only born bars', () => {
    const { result, minH, maxH } = terrain(1);
    const rows = selectBars(result, 0, 20);
    const L = stripLayout(640, 120, 1);
    const k = rows.length - 1;
    const y = rowAtY(0, rows.length, L); // above plot → −1
    expect(y).toBe(-1);
    const pitch = Math.min((L.bottom - L.top) / rows.length, 9);
    const yk = L.top + k * pitch + pitch / 2;
    expect(barcodeHit(0, yk, rows, rows[k].birth - 1, L)).toBe(-1);
    expect(barcodeHit(0, yk, rows, maxH, L)).toBe(k);
    expect(levelToX(minH, minH, maxH, L)).toBe(L.left);
  });
});

function rowsIndex(rows: Bar[], f: (b: Bar) => boolean): number {
  return rows.findIndex(f);
}

describe('lake identity colours (elder rule)', () => {
  it('every lake born gets a slot and label; top-K lakes have distinct colours', () => {
    const { result } = terrain(2026);
    const K = 6;
    const t = buildLakeTable(result, K);
    const ranked = rankLakes(result);
    expect(ranked.length).toBe(result.stats.births);
    expect(isEssential(ranked[0])).toBe(true);
    const top = ranked.slice(0, K).map((b) => t.slotOf[b.birthCell]);
    expect(new Set(top).size).toBe(Math.min(K, ranked.length));
    for (const b of ranked) expect(t.slotOf[b.birthCell]).toBeGreaterThanOrEqual(0);
  });

  it('when lakes merge, the merged region is painted in the older lake’s colour', () => {
    const W = 96;
    const H = 48;
    const { heights, result, minH, maxH } = terrain(42, W, H);
    const pal = PALETTES[0].light;
    const lakes = buildLakeTable(result, pal.identity.length);
    const painter = new MapPainter(W, H);
    painter.setTerrain(heights, result.rank, hillshade(heights, W, H), lakes.slotOf, minH, maxH);
    painter.setColors(pal, '#000000', '#ffffff', false);
    const flood = new Flood(heights, W, H, { order: result.order });
    const out = new Uint32Array(W * H);
    const opts = { colorBy: 'lake' as const, shoreline: false, highlight: -1, highlightMask: null };
    const idColor = (lake: number) => lakes.slotOf[lake];
    let checked = 0;
    for (const bar of result.bars
      .filter((b) => !isEssential(b) && persistence(b) > 5)
      .slice(0, 10)) {
      // Just before the merge, the dying lake has its own colour slot …
      const before = bar.death - 1e-3;
      if (before < bar.birth) continue;
      flood.advanceTo(before);
      painter.paint(out, flood, { ...opts, level: before });
      const into = painter.comp[bar.mergedInto] >= 0 ? painter.comp[bar.mergedInto] : -1;
      if (into < 0) continue;
      const elderSlot = idColor(into);
      const youngCells: number[] = [];
      for (let i = 0; i < W * H; i++) if (painter.comp[i] === bar.birthCell) youngCells.push(i);
      // … just after, all its cells belong to the elder lake and take the elder's colour.
      flood.advanceTo(bar.death);
      painter.paint(out, flood, { ...opts, level: bar.death });
      for (const i of youngCells) {
        expect(painter.comp[i]).toBe(painter.comp[bar.mergedInto]);
        expect(painter.slot(painter.comp[i])).toBe(painter.slot(into));
      }
      expect(lakes.slotOf[painter.comp[bar.mergedInto]]).toBe(elderSlot);
      checked++;
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('paints dry cells as land and wet cells in water colours; highlight draws a ring', () => {
    const W = 40;
    const H = 20;
    const { heights, result, minH, maxH } = terrain(5, W, H);
    const pal = PALETTES[0].light;
    const lakes = buildLakeTable(result, pal.identity.length);
    const painter = new MapPainter(W, H);
    painter.setTerrain(heights, result.rank, hillshade(heights, W, H), lakes.slotOf, minH, maxH);
    painter.setColors(pal, '#000000', '#ffffff', false);
    const flood = new Flood(heights, W, H, { order: result.order });
    const level = minH + 0.4 * (maxH - minH);
    flood.advanceTo(level);
    const out = new Uint32Array(W * H);
    const ess = result.bars.find(isEssential)!;
    painter.paint(out, flood, {
      level,
      colorBy: 'lake',
      shoreline: true,
      highlight: ess.birthCell,
      highlightMask: null,
    });
    const black = packRgb(0, 0, 0);
    const white = packRgb(255, 255, 255);
    expect(out.includes(black)).toBe(true);
    expect(out.includes(white)).toBe(true);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
  });
});

describe('levels and basins', () => {
  it('levelAt: linear and percentile pacing share the endpoints', () => {
    const { heights, W, H, minH, maxH } = terrain(3);
    const f = new Flood(heights, W, H);
    const pct = (p: number) => f.levelAtPercentile(p);
    expect(levelAt(0, 'linear', minH, maxH, pct)).toBe(minH);
    expect(levelAt(0, 'percentile', minH, maxH, pct)).toBe(minH);
    expect(levelAt(1, 'linear', minH, maxH, pct)).toBe(maxH);
    expect(levelAt(1, 'percentile', minH, maxH, pct)).toBe(maxH);
    expect(levelAt(0.5, 'linear', minH, maxH, pct)).toBeCloseTo((minH + maxH) / 2, 6);
    expect(levelAt(0.5, 'percentile', minH, maxH, pct)).toBe(f.levelAtPercentile(50));
  });

  it('basinMask equals the dying lake just before its death cell is added', () => {
    const { heights, W, H, result } = terrain(11);
    const mask = new Uint8Array(W * H);
    const queue = new Int32Array(W * H);
    const f = new Flood(heights, W, H, { order: result.order });
    for (const bar of result.bars.filter((b) => !isEssential(b)).slice(0, 8)) {
      const dr = result.rank[bar.deathCell];
      basinMask(bar.birthCell, dr, result.rank, W, H, mask, queue);
      // Replay to exactly dr cells added by flooding to the height of the previous cell in order.
      f.reset();
      const prevH = heights[result.order[dr - 1]];
      f.advanceTo(prevH);
      if (f.wetCount !== dr) continue; // ties straddle the death cell; skip
      for (let i = 0; i < W * H; i++) {
        expect(mask[i] === 1).toBe(f.componentOf(i) === bar.birthCell);
      }
    }
  });
});
