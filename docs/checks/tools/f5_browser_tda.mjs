// F5 checker: in-browser drawn bars and lake colours vs my brute force (f5_brute.mjs).
// Needs `astro preview --port 4321` running. Usage: node docs/checks/tools/f5_browser_tda.mjs
import { chromium } from 'playwright';
import { bruteH0, componentsAt } from './f5_brute.mjs';
import { generateTerrain } from '../../../src/lib/viz/hero/terrain.ts';

const B = 'http://localhost:4321';
let fails = 0;
const fail = (m) => (fails++, console.log('FAIL', m));
const b = await chromium.launch();
const errors = [];
const offsite = [];

for (const [vw, vh, seed] of [
  [1280, 800, 42],
  [768, 1024, 7],
  [375, 812, 123456],
  [1280, 800, 2024],
]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('request', (r) => !r.url().startsWith(B) && !r.url().startsWith('data:') && offsite.push(r.url()));
  await p.goto(`${B}/?seed=${seed}`);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  // Pause, install a fillRect recorder on the strip context.
  const info = await p.evaluate(() => {
    const h = document.querySelector('[data-hero]').__hero;
    h.setPlaying(false);
    const sc = h.stripCtx;
    window.__rects = [];
    const orig = sc.fillRect.bind(sc);
    sc.fillRect = (x, y, w, hh) => (window.__rects.push([x, y, w, hh]), orig(x, y, w, hh));
    return {
      W: h.t.W,
      H: h.t.H,
      heights: Array.from(h.t.heights),
      rows: h.drawnRows.map((r) => [r.birthCell, r.deathCell, r.birth, r.death]),
      minH: h.t.minH,
      maxH: h.t.maxH,
      L: h.L,
      settings: h.settings,
    };
  });
  const hNode = generateTerrain(info.W, info.H, { seed, scale: info.settings.scale, roughness: info.settings.roughness });
  if (hNode.some((v, i) => v !== Math.fround(info.heights[i]))) fail(`seed ${seed}: browser terrain != generateTerrain`);
  const h = Float32Array.from(info.heights);
  const bf = bruteH0(h, info.W, info.H);
  const pos = bf.finite.filter((x) => x.death > x.birth);
  // expected rows: persistence ≥ 10, cap 30, most persistent kept, ordered by birth rank
  const ess = bf.essential.map((e) => ({ birth: e.birth, death: Infinity, birthCell: e.birthCell, deathCell: -1 }));
  const keep = ess.concat(pos.filter((x) => x.death - x.birth >= info.settings.minPersistence));
  keep.sort((a, c) => {
    const ea = Number.isFinite(a.death) ? 0 : 1, ec = Number.isFinite(c.death) ? 0 : 1;
    if (ea !== ec) return ec - ea;
    const d = c.death - c.birth - (a.death - a.birth);
    return d !== 0 ? d : bf.rank[a.birthCell] - bf.rank[c.birthCell];
  });
  const exp = keep.slice(0, info.settings.maxBars).sort((a, c) => bf.rank[a.birthCell] - bf.rank[c.birthCell]);
  const expJ = JSON.stringify(exp.map((x) => [x.birthCell, x.deathCell, x.birth, x.death === Infinity ? null : x.death]));
  const gotJ = JSON.stringify(info.rows.map((r) => [r[0], r[1], r[2], r[3] === null || r[3] === Infinity ? null : r[3]]));
  if (expJ !== gotJ) fail(`seed ${seed} ${vw}: __hero.drawnRows != brute rows\n got ${gotJ.slice(0, 200)}\n exp ${expJ.slice(0, 200)}`);
  // Drawn rects at several levels (scrub forward then BACKWARD), and lake labels vs BFS.
  let rectN = 0;
  for (const prog of [0.2, 0.6, 1, 0.45, 0.1]) {
    const st = await p.evaluate(async (q) => {
      const h = document.querySelector('[data-hero]').__hero;
      window.__rects = [];
      h.scrubTo(q);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { level: h.level(), rects: window.__rects, comp: Array.from(h.t.painter.comp), alive: h.t.flood.alive() };
    }, prog);
    const { L, minH, maxH } = info;
    const x2l = (x) => minH + ((x - L.left) / (L.right - L.left)) * (maxH - minH);
    const born = exp.filter((x) => x.birth <= st.level);
    if (st.rects.length !== born.length) fail(`seed ${seed} p ${prog}: drew ${st.rects.length} bars, expected ${born.length}`);
    const sorted = st.rects.slice().sort((a, c) => a[1] - c[1]);
    const tol = (maxH - minH) * 1e-6;
    sorted.forEach((r, k) => {
      rectN++;
      const e = born[k];
      if (!e) return;
      const lo = x2l(r[0]), hi = x2l(r[0] + r[2]);
      if (Math.abs(lo - e.birth) > tol || Math.abs(hi - Math.min(e.death, st.level)) > tol)
        fail(`seed ${seed} p ${prog} row ${k}: [${lo.toFixed(3)},${hi.toFixed(3)}] vs [${e.birth},${Math.min(e.death, st.level)}]`);
    });
    const { lab, count } = componentsAt(h, info.W, info.H, st.level, bf.rank);
    if (count !== st.alive) fail(`seed ${seed} p ${prog}: alive ${st.alive} vs BFS ${count}`);
    const bad = st.comp.findIndex((c, i) => c !== lab[i]);
    if (bad >= 0) fail(`seed ${seed} p ${prog}: comp[${bad}] ${st.comp[bad]} vs BFS ${lab[bad]}`);
    if (prog === 1) {
      const right = sorted.find((r) => Math.abs(r[0] + r[2] - L.right) < 1e-6);
      if (!right) fail(`seed ${seed}: no bar reaches right edge at the top`);
    }
  }
  // Elder-rule colour at a merge event, on the actual map canvas pixels: find the most persistent
  // finite bar whose lake and survivor have different identity slots.
  const cand = pos.sort((a, c) => c.death - c.birth - (a.death - a.birth));
  const ev = await p.evaluate(async (cands) => {
    const h = document.querySelector('[data-hero]').__hero;
    h.update({ shoreline: false, colorBy: 'lake' });
    const t = h.t;
    const pr = (lev) => (lev - t.minH) / (t.maxH - t.minH);
    for (const [bc, sv, birth, death] of cands) {
      const sb = t.painter.slot(bc), ss = t.painter.slot(sv);
      if (sb === ss) continue;
      const sample = async (lev) => {
        h.scrubTo(pr(lev));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const c = h.els.map, g = c.getContext('2d');
        const x = Math.floor(((bc % t.W) + 0.5) * (c.width / t.W)), y = Math.floor((Math.floor(bc / t.W) + 0.5) * (c.height / t.H));
        const d = g.getImageData(x, y, 1, 1).data;
        const id = t.image.data;
        return { canvas: [d[0], d[1], d[2]], buf: [id[bc * 4], id[bc * 4 + 1], id[bc * 4 + 2]], comp: t.painter.comp[bc] };
      };
      const before = await sample(death - 0.01);
      const after = await sample(death + 0.01);
      const step = (lev) => Math.min(31, Math.max(0, ((lev - t.heights[bc]) * (31 / 220)) | 0));
      const lut = t.painter.waterLut;
      const unpack = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255];
      return {
        bc, sv, sb, ss, before, after,
        expBefore: unpack(lut[sb * 32 + step(death - 0.01)]),
        expAfter: unpack(lut[ss * 32 + step(death + 0.01)]),
        survivorOwn: unpack(lut[ss * 32 + step(death + 0.01)]),
      };
    }
    return null;
  }, cand.slice(0, 10).map((x) => [x.birthCell, x.survivor, x.birth, x.death]));
  if (!ev) console.log(`seed ${seed}: no merge with distinct slots in top 10`);
  else {
    const close = (a, c, tol = 6) => a.every((v, i) => Math.abs(v - c[i]) <= tol);
    const ok = ev.before.comp === ev.bc && ev.after.comp === ev.sv && close(ev.before.buf, ev.expBefore, 0) && close(ev.after.buf, ev.expAfter, 0);
    const okCanvas = close(ev.before.canvas, ev.expBefore, 12) && close(ev.after.canvas, ev.expAfter, 12);
    if (!ok) fail(`seed ${seed}: elder colour at merge ${JSON.stringify(ev)}`);
    console.log(`seed ${seed}: merge lake@${ev.bc} (slot ${ev.sb}) into older lake@${ev.sv} (slot ${ev.ss}); pit pixel before ${ev.before.canvas} (exp ${ev.expBefore}), after ${ev.after.canvas} (exp ${ev.expAfter}); buffer exact ${ok}, canvas within 12: ${okCanvas}`);
  }
  console.log(`seed ${seed} @${vw}x${vh}: grid ${info.W}x${info.H} (${info.W * info.H} cells, ${(info.L.w / info.L.dpr / info.W).toFixed(2)} css px strip/cell), rows ${info.rows.length}, rects checked ${rectN}`);
  await ctx.close();
}
await b.close();
console.log('console errors:', errors.length ? errors : 'none');
console.log('off-site requests:', offsite.length ? offsite : 'none');
console.log(fails ? `FAILURES ${fails}` : 'ALL OK');
