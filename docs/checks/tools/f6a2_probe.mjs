// F6 checker probe: TDA / readout / click / hover / controls checks against my own reference
// (docs/checks/tools/f6_ref.py output + my own BFS below). No import from src/ or builder helpers.
// Usage: node docs/checks/tools/f6_probe.mjs <ref.json>   (preview must be on :4321)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const ref = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const buf = fs.readFileSync(ROOT + 'public/data/colorado/grid.f32');
const meta = JSON.parse(fs.readFileSync(ROOT + 'public/data/colorado/meta.json', 'utf8'));
const file = JSON.parse(fs.readFileSync(ROOT + 'public/data/colorado/barcode.json', 'utf8'));
const W = ref.W, H = ref.H, n = W * H;
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const h = new Float32Array(n);
for (let i = 0; i < n; i++) h[i] = dv.getFloat32(4 * i, true);
const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => (h[a] - h[b]) || (a - b));
const sortedH = ord.map((i) => h[i]);
const areas = ref.areas; const totA = areas.reduce((a, b) => a + b, 0);

let fails = 0; const log = [];
const ok = (cond, msg) => { if (!cond) fails++; log.push(`${cond ? 'OK  ' : 'FAIL'} ${msg}`); };

function myNextDown(x) { const f = new Float64Array([x]); const u = new BigInt64Array(f.buffer); u[0] += x > 0 ? -1n : 1n; return f[0]; }
// components of {h <= t}; label = ≺-min cell (seeded in my order)
function components(t) {
  const lab = new Int32Array(n).fill(-1); const q = new Int32Array(n); let count = 0, wet = 0, area = 0;
  for (const s of ord) {
    if (h[s] > t) break;
    if (lab[s] >= 0) continue;
    count++; let hd = 0, tl = 0; q[tl++] = s; lab[s] = s;
    while (hd < tl) {
      const u = q[hd++]; wet++; area += areas[u];
      const x = u % W, y = (u - x) / W;
      const nb = [y > 0 ? u - W : -1, y < H - 1 ? u + W : -1, x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1];
      for (const v of nb) if (v >= 0 && lab[v] < 0 && h[v] <= t) { lab[v] = s; q[tl++] = v; }
    }
  }
  return { lab, count, wet, area: (100 * area) / totA };
}
// my identity slots: essential 0, ranks 1..11
const slot = new Map(); slot.set(ref.essential[2], 0); ref.ranked.slice(0, 11).forEach((b, k) => slot.set(b[2], k + 1));
const rankOf = new Map(ref.ranked.map((b, k) => [b[2], k + 1])); rankOf.set(ref.essential[2], 0);
const west = meta.native.extent[0], north = meta.native.extent[3], NW = meta.native.width, NH = meta.native.height;
function center(i) { const y = Math.floor(i / W), x = i % W; const c0 = Math.min(30 * x, NW), c1 = Math.min(30 * x + 30, NW), r0 = Math.min(30 * y, NH), r1 = Math.min(30 * y + 30, NH); return [north - ((r0 + r1) / 2) / 1200, west + ((c0 + c1) / 2) / 1200]; }
const num = (s) => parseFloat(s.replace(/,/g, '').replace('−', '-'));
const ll = (lat, lon) => `${Math.abs(lat).toFixed(4)}° N, ${Math.abs(lon).toFixed(4)}° W`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = []; const offsite = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4321')) offsite.push(r.url()); });
await page.goto('http://localhost:4321/rising-water/');
await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 15000 });
const status = await page.textContent('[data-ex-status]');
ok(/matches barcode\.json \(600 of 600/.test(status), `status: ${status.trim()}`);
ok((await page.getAttribute('[data-explorer]', 'data-match')) === 'true', 'data-match=true');
ok((await page.textContent('h1')).trim() === 'Colorado River Basin study area (RiverNets coverage)', 'h1 label exact');

// --- 1. live bars vs barcode.json vs my reference
const live = await page.evaluate(() => {
  const e = document.querySelector('[data-explorer]').__explorer;
  return e.result.bars.map((b) => [b.birth, Number.isFinite(b.death) ? b.death : null, b.birthCell, b.deathCell, b.mergedInto]);
});
ok(live.length === ref.bars.length, `live bars ${live.length} = my ref ${ref.bars.length} (all positive + essential)`);
let same = 0; for (let k = 0; k < Math.min(live.length, ref.bars.length); k++) if (JSON.stringify(live[k]) === JSON.stringify(ref.bars[k])) same++;
ok(same === ref.bars.length, `live == my ref, tuple-by-tuple in order: ${same}/${ref.bars.length}`);
const exp = live.filter((b) => b[1] === null || b[1] - b[0] >= 1);
let sf = 0; for (let k = 0; k < file.b.length; k++) { const e = exp[k]; if (e && e[0] === file.b[k] && e[1] === file.d[k] && e[2] === file.bi[k] && e[3] === file.di[k] && e[4] === file.mi[k]) sf++; }
ok(exp.length === file.b.length && sf === file.b.length, `live ≥1 m == barcode.json: ${sf}/${file.b.length} (exact b,d,bi,di,mi)`);

const api = (fn, arg) => page.evaluate(fn, arg);
const ex = 'document.querySelector("[data-explorer]").__explorer';
await api(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));

// --- 2. readouts + overlay at several levels, both pacings (via the real slider)
async function readRO() {
  return page.evaluate(() => ({
    level: document.querySelector('[data-ro-level]').textContent, alt: document.querySelector('[data-ro-level-alt]').textContent,
    pct: document.querySelector('[data-ro-pct]').textContent, lakes: document.querySelector('[data-ro-lakes]').textContent,
    area: document.querySelector('[data-ro-area]').textContent, lv: document.querySelector('[data-explorer]').__explorer.level,
  }));
}
const colourOfSlot = new Map(); let neutralCol = null; let overlayChecks = 0;
for (const pacing of ['percentile', 'linear']) {
  await page.selectOption('#ex-pacing', pacing);
  for (const v of [0, 37, 150, 333, 500, 641, 777, 900, 999, 1000]) {
    await page.evaluate((v) => { const s = document.querySelector('#ex-level'); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    await page.waitForTimeout(60);
    const ro = await readRO();
    const p = v / 1000;
    const expLevel = pacing === 'percentile' ? sortedH[Math.round(p * (n - 1))] : p >= 1 ? sortedH[n - 1] : sortedH[0] + p * (sortedH[n - 1] - sortedH[0]);
    const c = components(ro.lv);
    const ft = ro.lv / 0.3048;
    const good = Math.abs(ro.lv - expLevel) < 1e-9 && num(ro.level) === Number(ro.lv.toFixed(1)) && num(ro.alt) === Math.round(ft)
      && num(ro.pct) === Number(((100 * c.wet) / n).toFixed(1)) && num(ro.lakes) === c.count && num(ro.area) === Number(c.area.toFixed(1));
    ok(good, `${pacing} slider ${v}: level ${ro.lv.toFixed(3)} (exp ${expLevel.toFixed(3)}) RO "${ro.level} / ${ro.alt} / pct ${ro.pct} / lakes ${ro.lakes} / ${ro.area}" vs mine pct ${((100 * c.wet) / n).toFixed(1)} lakes ${c.count} area ${c.area.toFixed(1)}`);
    // overlay buffer and the drawn canvas
    const img = await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; return Array.from(new Uint32Array(e.image.data.buffer)); });
    let wetBad = 0, compBad = 0, slotBad = 0; const compCol = new Map();
    for (let i = 0; i < n; i++) {
      const wetI = h[i] <= ro.lv; const a = img[i] >>> 24;
      if (wetI !== a > 0) wetBad++;
      if (!wetI) continue;
      const L = c.lab[i]; const col = img[i];
      if (!compCol.has(L)) compCol.set(L, col); else if (compCol.get(L) !== col) compBad++;
    }
    for (const [L, col] of compCol) {
      const s = slot.get(L);
      if (s === undefined) { if (neutralCol === null) neutralCol = col; if (col !== neutralCol) slotBad++; }
      else { if (!colourOfSlot.has(s)) colourOfSlot.set(s, col); if (colourOfSlot.get(s) !== col) slotBad++; }
    }
    overlayChecks++;
    ok(wetBad === 0 && compBad === 0 && slotBad === 0, `  overlay: wet≠{h≤t} ${wetBad}, multi-colour comps ${compBad}, slot/elder colour errors ${slotBad} (${compCol.size} comps)`);
  }
}
const cols = [...colourOfSlot.values()];
ok(new Set(cols).size === cols.length && !cols.includes(neutralCol), `identity colours distinct per slot (${cols.length} slots seen) and ≠ neutral`);
await page.selectOption('#ex-pacing', 'percentile');

// visible canvas sample: at level slider 641, sample cell centres on the drawn map
await page.evaluate(() => { const s = document.querySelector('#ex-level'); s.value = '641'; s.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(100);
const drawn = await page.evaluate(() => {
  const e = document.querySelector('[data-explorer]').__explorer; const cv = e.els.map; const g = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const out = []; for (let k = 0; k < 3000; k++) { const i = Math.floor((k * 7919) % e.heights.length); const x = i % 326, y = Math.floor(i / 326);
    const px = Math.floor(((x * 30 + 15) / 9769) * cv.width), py = Math.floor(((y * 30 + 15) / 12408) * cv.height);
    if (px < cv.width && py < cv.height) out.push([i, g[4 * (py * cv.width + px) + 3]]); }
  return { out, level: e.level };
});
let drawnBad = 0; for (const [i, a] of drawn.out) if ((h[i] <= drawn.level) !== a > 0) drawnBad++;
ok(drawnBad <= 15, `drawn map canvas alpha at ${drawn.out.length} sampled cell centres vs {h≤t}: ${drawnBad} mismatches (labels may cover a few dry cells)`);

// --- 3. bar clicks and table buttons
async function checkSelection(L, how) {
  const st = await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer;
    return { lv: e.level, sel: e.selected && e.selected.birthCell, mask: Array.from(e.mask).reduce((a, v, i) => (v && a.push(i), a), []),
      title: document.querySelector('[data-ex-card-title]').textContent, text: document.querySelector('[data-ex-card-text]').textContent,
      lakes: document.querySelector('[data-ro-lakes]').textContent }; });
  const expLv = myNextDown(L.d);
  const basin = L.basin; const sameMask = st.mask.length === basin.length && st.mask.every((v, k) => v === basin[k]);
  const [bl, bo] = center(L.bi), [dl, dlo] = center(L.di);
  const into = L.miRank === 0 ? `the lowest lake (cell ${L.mi})` : `lake ${L.miRank} (cell ${L.mi})`;
  const want = `Born at ${fmt1(L.b)} m near ${ll(bl, bo)}, merged at ${fmt1(L.d)} m at ${ll(dl, dlo)} into ${into}, persistence ${fmt1(L.d - L.b)} m.`;
  const text = st.text.replace(/ /g, ' ');
  ok(st.sel === L.bi && st.lv === expLv && sameMask && text === want && st.title.replace(/ /g, ' ') === `Lake ${L.rank} · birth cell ${L.bi}`,
    `${how} lake rank ${L.rank} (bi ${L.bi}): level ${st.lv === expLv ? '=nextDown(d)' : st.lv + '≠' + expLv}, highlight ${st.mask.length} cells vs my BFS basin ${basin.length} ${sameMask ? 'identical' : 'DIFFERENT'}; card ${text === want ? 'matches' : `\n      got:  ${text}\n      want: ${want}`}`);
  // highlighted region must equal the live lake (component) in the overlay
  const c = components(st.lv); const comp = []; for (let i = 0; i < n; i++) if (c.lab[i] === c.lab[L.bi] && h[i] <= st.lv) comp.push(i);
  ok(comp.length === basin.length, `  BFS component of pit at that level = ${comp.length} cells (basin ${basin.length})`);
}
function fmt1(v) { const t = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); return (v < 0 ? '−' : '') + t; }
// table buttons: ranks 1,2,3,5,8,13,17,20
for (const r of [1, 2, 3, 5, 8, 13, 17, 20]) {
  const L = ref.lakes.find((x) => x.rank === r);
  await page.click(`button[data-lake-cell="${L.bi}"]`);
  await page.waitForTimeout(150);
  await checkSelection(L, 'table button');
}
// lowest lake button
await page.click(`button[data-lake-cell="${ref.essential[2]}"]`); await page.waitForTimeout(100);
const ess = await page.evaluate(() => ({ lv: document.querySelector('[data-explorer]').__explorer.level, t: document.querySelector('[data-ex-card-text]').textContent }));
const [el, elo] = center(ref.essential[2]);
ok(ess.lv === sortedH[n - 1] && ess.t.replace(/ /g, ' ').startsWith(`Born at ${fmt1(ref.essential[0])} m near ${ll(el, elo)}. It never merges`), `lowest lake button: level max ${ess.lv}, card "${ess.t}"`);
// bar clicks on the strip canvas: pick rows for ranks 4, 6, 7, 9, 10, 11, 14, 22 among drawn rows
await page.evaluate(() => document.querySelector('[data-explorer]').scrollIntoView({behavior:'instant'})); await page.waitForTimeout(1200);
for (const r of [4, 6, 7, 9, 10, 11, 14, 22]) {
  const L = ref.lakes.find((x) => x.rank === r);
  const pos = await page.evaluate((bi) => { const e = document.querySelector('[data-explorer]').__explorer; const k = e.rows.findIndex((b) => b.birthCell === bi);
    const rc = e.els.strip.getBoundingClientRect(); const pitch = 0; const L = e.L; const range = e.scale.maxH - e.scale.minH; const b = e.rows[k];
    const xb = (L.left + ((b.birth - e.scale.minH) / range) * (L.right - L.left)) / e.dpr, xd = (L.left + ((b.death - e.scale.minH) / range) * (L.right - L.left)) / e.dpr;
    return { k, x: rc.left + (xb + xd) / 2, y: rc.top + e.rowCenterCss(k) }; }, L.bi);
  if (pos.k < 0) { ok(false, `rank ${r} not drawn`); continue; }
  const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el && el.matches('[data-ex-strip]'); }, [pos.x, pos.y]);
  if (!hit) log.push(`    (click point not on strip for rank ${r})`);
  await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(150);
  await checkSelection(L, `bar click (row ${pos.k})`);
}

// --- 4. hover elevation + lat/lon
await page.evaluate(() => { const s = document.querySelector('#ex-level'); s.value = '500'; s.dispatchEvent(new Event('input', { bubbles: true })); });
const box = await page.locator('[data-ex-map]').boundingBox();
let hovBad = 0; const hovCells = [981, 1300, 133025, 56383, 17991, 133686, 70000, 12345, 99999, 4925, 58027, 1, 2*326+325, 413*326+5];
for (const i of hovCells) {
  const x = i % W, y = Math.floor(i / W);
  const yy = ((y * 30 + Math.min(15, (NH - 30 * y) / 2)) / NH);
  await page.evaluate(([yy]) => { const r = document.querySelector('[data-ex-map]').getBoundingClientRect(); window.scrollBy({ top: r.top + yy * r.height - 400, behavior: 'instant' }); }, [yy]);
  await page.waitForTimeout(80);
  const box = await page.locator('[data-ex-map]').boundingBox();
  await page.mouse.move(box.x + ((x * 30 + Math.min(15, (NW - 30 * x) / 2)) / NW) * box.width, box.y + ((y * 30 + Math.min(15, (NH - 30 * y) / 2)) / NH) * box.height);
  await page.waitForTimeout(40);
  const t = (await page.textContent('[data-ex-hover]')).replace(/ /g, ' ');
  const [la, lo] = center(i); const lv = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
  const want = `Elevation ${fmt1(h[i]).replace('-', '−')} m (${Math.round(h[i] / 0.3048).toLocaleString('en-US').replace('-', '−')} ft) at ${ll(la, lo)}`;
  const wetOk = h[i] <= lv ? t.includes('under water') : t.endsWith('dry');
  if (!t.startsWith(want) || !wetOk) { hovBad++; log.push(`    hover ${i}: "${t}" want "${want}…"`); }
}
ok(hovBad === 0, `hover readout exact at ${hovCells.length} cells (incl. corners, min, max)`);

// --- 5. units toggle
await page.click(`button[data-lake-cell="${ref.lakes[2].bi}"]`); await page.waitForTimeout(100);
await page.click('[data-ex-units="ft"]'); await page.waitForTimeout(100);
const ftS = await page.evaluate(() => ({ lv: document.querySelector('[data-ro-level]').textContent, alt: document.querySelector('[data-ro-level-alt]').textContent, card: document.querySelector('[data-ex-card-text]').textContent, tab: document.querySelector('[data-lake-row] [data-m]').textContent, l: document.querySelector('[data-explorer]').__explorer.level }));
const L3 = ref.lakes[2];
ok(ftS.lv.replace(/ /g, ' ') === `${Math.round(ftS.l / 0.3048).toLocaleString('en-US')} ft` && ftS.alt.includes('\u00a0m') && ftS.card.replace(/ /g, ' ').includes(`Born at ${Math.round(L3.b / 0.3048).toLocaleString('en-US')} ft`) && ftS.card.includes(`${Math.round((L3.d - L3.b) / 0.3048).toLocaleString('en-US')} ft.`),
  `units ft: level "${ftS.lv}" alt "${ftS.alt}"; card "${ftS.card}"; table first cell "${ftS.tab}"`);
await page.click('[data-ex-units="m"]');

// --- 6. min persistence and top-N controls
async function setRange(sel, v) { await page.evaluate(([sel, v]) => { const s = document.querySelector(sel); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]); await page.waitForTimeout(50); }
const allRanked = ref.bars.filter((b) => b[1] !== null).map((b, k) => ({ b, k })).sort((a, c) => (c.b[1] - c.b[0]) - (a.b[1] - a.b[0]) || a.k - c.k).map((x) => x.b);
for (const [mp, tn] of [[10, 40], [1, 600], [50, 600], [100, 5], [200, 100], [400, 600], [1, 5]]) {
  await setRange('#ex-minp', mp); await setRange('#ex-topn', tn);
  const st = await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; return { rows: e.rows.map((b) => b.birthCell), mp: e.settings.minPersistence, tn: e.settings.topN, out: document.querySelector('[data-ex-topn-out]').textContent }; });
  const want = [ref.essential[2]]; for (const b of allRanked) { if (want.length >= st.tn) break; if (b[1] - b[0] < st.mp) break; want.push(b[2]); }
  const a = [...st.rows].sort((x, y) => x - y), w = [...want].sort((x, y) => x - y);
  ok(JSON.stringify(a) === JSON.stringify(w), `minP ${st.mp} topN ${st.tn}: rows ${st.rows.length} vs mine ${want.length}; output "${st.out}"`);
}
await setRange('#ex-minp', 10); await setRange('#ex-topn', 40);

ok(errors.length === 0, `console errors: ${errors.length} ${errors.join(' | ')}`);
ok(offsite.length === 0, `third-party requests: ${offsite.length}`);
await browser.close();
fs.writeFileSync(ROOT + 'docs/checks/F6/attempt-2/probe.txt', log.join('\n') + `\nFAILS ${fails}\n`);
console.log(log.join('\n')); console.log('FAILS', fails);
