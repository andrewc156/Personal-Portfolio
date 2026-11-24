// F5 checker: hero renderer data model vs my own brute-force H0 (f5_brute.mjs).
// Input: the builder's terrain generator (not under test). Under test: selectBars / drawBarcode /
// drawDiagram / MapPainter colour assignment (renderer data model).
// Usage: node docs/checks/tools/f5_hero_tda.mjs
import { bruteH0, componentsAt } from './f5_brute.mjs';
import { generateTerrain, heightRange } from '../../../src/lib/viz/hero/terrain.ts';
import { selectBars, buildLakeTable } from '../../../src/lib/viz/hero/model.ts';
import { drawBarcode, drawDiagram, stripLayout } from '../../../src/lib/viz/hero/barcode.ts';
import { MapPainter } from '../../../src/lib/viz/hero/render-map.ts';
import { computeH0, Flood } from '../../../src/lib/tda/index.ts';
import { getPalette } from '../../../src/lib/viz/common/palettes.ts';

const cases = [
  [42, 141, 71],
  [1, 141, 71],
  [7, 176, 88],
  [123456, 85, 43],
  [999999, 141, 71],
  [31337, 120, 60],
];
const LEVEL_P = [0.1, 0.3, 0.45, 0.7, 1];
let fails = 0;
const fail = (m) => {
  fails++;
  console.log('FAIL', m);
};

function recCtx() {
  const rects = [];
  const arcs = [];
  const noop = () => {};
  return {
    rects,
    arcs,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    clearRect: noop,
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: this.fillStyle });
    },
    strokeRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arc(x, y, r) {
      arcs.push({ x, y, r });
    },
    stroke: noop,
    fill: noop,
    fillText: noop,
    setLineDash: noop,
  };
}

function expectedRows(bf, minP, maxBars) {
  const pos = bf.finite.filter((b) => b.death > b.birth);
  const ess = bf.essential.map((e) => ({ birth: e.birth, death: Infinity, birthCell: e.birthCell, deathCell: -1 }));
  const keep = ess.concat(pos.filter((b) => b.death - b.birth >= minP));
  keep.sort((a, b) => {
    const ea = Number.isFinite(a.death) ? 0 : 1,
      eb = Number.isFinite(b.death) ? 0 : 1;
    if (ea !== eb) return eb - ea;
    const d = b.death - b.birth - (a.death - a.birth);
    if (d !== 0) return d;
    return bf.rank[a.birthCell] - bf.rank[b.birthCell];
  });
  return keep.slice(0, maxBars).sort((a, b) => bf.rank[a.birthCell] - bf.rank[b.birthCell]);
}

let rowChecks = 0,
  rectChecks = 0,
  compChecks = 0,
  merges = 0;
for (const [seed, W, H] of cases) {
  const t0 = Date.now();
  const h = generateTerrain(W, H, { seed, scale: 1.5, roughness: 0.5 });
  const bf = bruteH0(h, W, H);
  const pos = bf.finite.filter((b) => b.death > b.birth);
  const zero = bf.finite.length - pos.length;
  const result = computeH0(h, W, H); // input to the renderer
  const [minH, maxH] = heightRange(h);
  // (a) selectBars == brute rows, for several threshold/cap settings
  for (const [minP, cap] of [
    [0, 1e9],
    [10, 30],
    [0, 30],
    [50, 60],
    [200, 5],
  ]) {
    const got = selectBars(result, minP, cap).map((b) => [b.birthCell, b.deathCell, b.birth, b.death]);
    const exp = expectedRows(bf, minP, cap).map((b) => [b.birthCell, b.deathCell, b.birth, b.death]);
    rowChecks++;
    if (JSON.stringify(got) !== JSON.stringify(exp))
      fail(`seed ${seed} ${W}x${H} minP ${minP} cap ${cap}: rows differ (${got.length} vs ${exp.length})`);
  }
  // elder: engine mergedInto vs my survivor for every positive bar
  const surv = new Map(bf.finite.map((b) => [b.birthCell, b.survivor]));
  for (const b of result.bars)
    if (Number.isFinite(b.death) && surv.get(b.birthCell) !== b.mergedInto) fail(`seed ${seed}: mergedInto ${b.birthCell}`);
  // (b) drawBarcode rects at levels → invert to [birth, min(death, level)]
  const exp = expectedRows(bf, 10, 30);
  const rows = selectBars(result, 10, 30);
  const L = stripLayout(560, 120, 2);
  const x2l = (x) => minH + ((x - L.left) / (L.right - L.left)) * (maxH - minH);
  const tol = (maxH - minH) * 1e-9;
  for (const p of LEVEL_P) {
    const level = p >= 1 ? maxH : minH + p * (maxH - minH);
    const ctx = recCtx();
    drawBarcode(ctx, {
      L, rows, fills: rows.map(() => '#000'), level, minH, maxH,
      colors: { axis: '', text: '', level: '', highlight: '' }, highlight: -1,
      ticks: [], tickText: [], levelText: '', font: '',
    });
    const born = exp.filter((b) => b.birth <= level);
    if (ctx.rects.length !== born.length) fail(`seed ${seed} p ${p}: ${ctx.rects.length} rects vs ${born.length} born`);
    // rows are drawn top-to-bottom in row order; skip unborn rows
    const pitch = Math.min((L.bottom - L.top) / exp.length, 9 * L.dpr);
    for (const r of ctx.rects) {
      const k = Math.round((r.y - L.top - pitch / 2 + r.h / 2) / pitch);
      const b = exp[k];
      rectChecks++;
      if (!b) { fail(`seed ${seed} p ${p}: rect row ${k} has no bar`); continue; }
      const lo = x2l(r.x), hi = x2l(r.x + r.w);
      if (Math.abs(lo - b.birth) > tol || Math.abs(hi - Math.min(b.death, level)) > tol)
        fail(`seed ${seed} p ${p} row ${k}: drawn [${lo},${hi}] vs [${b.birth},${Math.min(b.death, level)}]`);
    }
    if (p >= 1) {
      const e = ctx.rects.find((r) => Math.abs(r.x + r.w - L.right) < 1e-6 && Math.abs(x2l(r.x) - bf.essential[0].birth) < tol);
      if (!e) fail(`seed ${seed}: essential bar does not reach right edge at top`);
    }
    // diagram: number of points == born rows
    const dctx = recCtx();
    drawDiagram(dctx, {
      L, rows, fills: rows.map(() => '#000'), level, minH, maxH,
      colors: { axis: '', text: '', level: '', highlight: '' }, highlight: -1,
      ticks: [], tickText: [], levelText: '', font: '',
    });
    if (dctx.arcs.length !== born.length) fail(`seed ${seed} p ${p}: diagram ${dctx.arcs.length} pts vs ${born.length}`);
  }
  // (c) renderer colour assignment: painter.comp == my ≺-min (oldest) component label at levels,
  // and slot(comp) is the colour of the oldest lake.
  const pal = getPalette('delta').light;
  const lakes = buildLakeTable(result, pal.identity.length);
  const painter = new MapPainter(W, H);
  painter.setTerrain(h, result.rank, new Float32Array(W * H).fill(0.5), lakes.slotOf, minH, maxH);
  painter.setColors(pal, '#000000', '#ffffff', false);
  const flood = new Flood(h, W, H, { order: result.order });
  const out = new Uint32Array(W * H);
  // levels: forward, then backward (F3 note: backward advanceTo replays from the bottom)
  for (const p of [0.2, 0.5, 0.8, 0.35, 0.05, 0.6]) {
    const level = minH + p * (maxH - minH);
    flood.advanceTo(level);
    painter.paint(out, flood, { level, colorBy: 'lake', shoreline: false, highlight: -1, highlightMask: null });
    const { lab, count } = componentsAt(h, W, H, level, bf.rank);
    if (flood.alive() !== count) fail(`seed ${seed} p ${p}: alive ${flood.alive()} vs ${count}`);
    for (let i = 0; i < W * H; i++) {
      compChecks++;
      if (painter.comp[i] !== lab[i]) { fail(`seed ${seed} p ${p}: comp[${i}] ${painter.comp[i]} vs ${lab[i]}`); break; }
    }
  }
  // (d) at each merge (positive bar), just below vs at death: the dying lake's cells switch to the
  // survivor's identity slot (elder rule), checked on painted pixels classified by nearest LUT colour.
  let checked = 0;
  for (const b of pos.sort((a, c) => c.death - c.birth - (a.death - a.birth)).slice(0, 8)) {
    const sb = painter.slot(b.birthCell), ss = painter.slot(b.survivor);
    if (sb === ss) continue;
    const before = Math.fround(b.death) - 1e-3, after = b.death;
    const colourAt = (lev) => {
      flood.advanceTo(lev);
      painter.paint(out, flood, { level: lev, colorBy: 'lake', shoreline: false, highlight: -1, highlightMask: null });
      return out[b.birthCell];
    };
    const pb = colourAt(before), pa = colourAt(after);
    const ref = new Uint32Array(W * H);
    // reference colours: paint once more at `after`, the survivor's birth cell has slot ss at its own depth;
    // compare by slot via the painter's comp of the dying lake's birth cell
    const compBefore = (flood.advanceTo(before), flood.componentOf(b.birthCell));
    const compAfter = (flood.advanceTo(after), flood.componentOf(b.birthCell));
    merges++;
    checked++;
    if (compBefore !== b.birthCell) fail(`seed ${seed}: before merge comp ${compBefore} != own ${b.birthCell}`);
    if (compAfter !== b.survivor) fail(`seed ${seed}: after merge comp ${compAfter} != survivor ${b.survivor}`);
    if (bf.rank[b.survivor] > bf.rank[b.birthCell]) fail(`seed ${seed}: survivor younger`);
    const lut = painter.waterLut; // runtime-visible private table: identity colour × depth step
    const step = (lev) => Math.min(31, Math.max(0, ((lev - h[b.birthCell]) * (31 / 220)) | 0));
    if (pb !== lut[sb * 32 + step(before)]) fail(`seed ${seed}: before-merge pixel is not the dying lake's own colour`);
    if (pa !== lut[ss * 32 + step(after)]) fail(`seed ${seed}: after-merge pixel is not the survivor's colour`);
    if (pa === pb) fail(`seed ${seed}: pixel unchanged`);
    void ref;
  }
  console.log(
    `seed ${seed} ${W}x${H}: births ${bf.finite.length + bf.essential.length}, positive ${pos.length}, zero-length ${zero}, essential ${bf.essential.length}, engine bars ${result.bars.length}, merges checked ${checked}, ${Date.now() - t0} ms`,
  );
}
console.log(`row-set checks ${rowChecks}, rect checks ${rectChecks}, comp checks ${compChecks}, merge colour checks ${merges}`);
console.log(fails ? `FAILURES: ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
