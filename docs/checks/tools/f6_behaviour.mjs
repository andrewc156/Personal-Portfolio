// F6 checker: behaviour probe (play readouts vs my BFS, corrupted grid, keyboard scoping, reduced
// motion, off-screen / hidden pause, DPR cap, summary cadence, CLS). Preview on :4321.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const ROOT = new URL('../../../', import.meta.url).pathname;
const buf = fs.readFileSync(ROOT + 'public/data/colorado/grid.f32');
const ref = JSON.parse(fs.readFileSync(ROOT + 'docs/checks/F6/attempt-1/ref.json', 'utf8'));
const W = 326, H = 414, n = W * H;
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const h = new Float32Array(n); for (let i = 0; i < n; i++) h[i] = dv.getFloat32(4 * i, true);
const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => (h[a] - h[b]) || (a - b));
const areas = ref.areas; const totA = areas.reduce((a, b) => a + b, 0);
function comps(t) { const lab = new Int32Array(n).fill(-1); const q = new Int32Array(n); let c = 0, wet = 0, ar = 0;
  for (const s of ord) { if (h[s] > t) break; if (lab[s] >= 0) continue; c++; let hd = 0, tl = 0; q[tl++] = s; lab[s] = s;
    while (hd < tl) { const u = q[hd++]; wet++; ar += areas[u]; const x = u % W, y = (u - x) / W;
      for (const v of [y > 0 ? u - W : -1, y < H - 1 ? u + W : -1, x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1]) if (v >= 0 && lab[v] < 0 && h[v] <= t) { lab[v] = s; q[tl++] = v; } } }
  return { c, pct: ((100 * wet) / n).toFixed(1), area: ((100 * ar) / totA).toFixed(1) }; }
const log = []; let fails = 0; const ok = (c, m) => { if (!c) fails++; log.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); };
const nb = (s) => s.replace(/ /g, ' ');
const browser = await chromium.launch();
async function open(opts = {}, route) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  if (route) await page.route('**/data/colorado/grid.f32', route);
  await page.goto('http://localhost:4321/rising-water/');
  return { ctx, page, errors };
}
const ready = (page) => page.waitForFunction(() => ['true'].includes(document.querySelector('[data-explorer]')?.dataset.ready) || document.querySelector('[data-explorer]')?.dataset.match === 'error', null, { timeout: 15000 });

// A. play readouts, both pacings: in-page logger of (level, readout texts) on every mutation
for (const pacing of ['percentile', 'linear']) {
  const { ctx, page, errors } = await open();
  await ready(page);
  await page.selectOption('#ex-pacing', pacing);
  await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; e.scrubTo(0.3); e.update({ speed: 4 }); e.setPlaying(true);
    window.__lv = []; const f = () => { window.__lv.push([performance.now(), e.level]); if (e.playing) requestAnimationFrame(f); }; requestAnimationFrame(f);
    window.__ro = []; const rd = () => ['level', 'pct', 'lakes', 'area'].map((k) => document.querySelector(`[data-ro-${k}]`).textContent).join('|');
    new MutationObserver(() => window.__ro.push([performance.now(), rd()])).observe(document.querySelector('.ex-readouts'), { subtree: true, characterData: true, childList: true }); });
  await page.waitForTimeout(3000);
  await page.click('[data-ex-play]'); // pause
  await page.waitForTimeout(50);
  const d = await page.evaluate(() => ({ lv: window.__lv, ro: window.__ro, now: document.querySelector('[data-explorer]').__explorer.level, txt: ['level', 'pct', 'lakes', 'area'].map((k) => document.querySelector(`[data-ro-${k}]`).textContent).join('|') }));
  // collapse readout mutations to final text per burst
  const bursts = []; for (const r of d.ro) { if (bursts.length && r[0] - bursts[bursts.length - 1][0] < 2) bursts[bursts.length - 1] = r; else bursts.push(r); }
  let good = 0, maxLag = 0;
  for (const [t, txt] of bursts) {
    // find a level in the previous 250 ms whose expected text equals txt
    const cands = d.lv.filter(([tt]) => tt <= t + 1 && tt >= t - 250).reverse();
    let hit = false;
    for (const [tt, lv] of cands) { const c = comps(lv); const e = `${lv.toFixed(1)}`; const want = [Math.abs(lv) >= 1000 ? Number(e).toLocaleString('en-US', { minimumFractionDigits: 1 }) : e, c.pct, String(c.c), c.area];
      const got = nb(txt).split('|'); if (got[0].replace(/ m$/, '') === want[0] && got[1] === want[1] && got[2] === want[2] && got[3].replace(/ %$/, '') === want[3]) { hit = true; maxLag = Math.max(maxLag, t - tt); break; } }
    if (hit) good++;
  }
  const c = comps(d.now);
  const fin = nb(d.txt).split('|');
  ok(good === bursts.length && fin[2] === String(c.c) && fin[1] === c.pct && fin[3] === `${c.area} %`, `${pacing} play: ${good}/${bursts.length} readout updates equal my BFS at a level shown ≤ ${maxLag.toFixed(0)} ms earlier; after pause "${nb(d.txt)}" = mine lakes ${c.c} pct ${c.pct} area ${c.area}`);
  ok(errors.length === 0, `${pacing} console errors ${errors.length}`);
  await ctx.close();
}

// B. corrupted grid: flip one byte (two variants: a byte that changes the barcode, and one in a low-order mantissa bit)
for (const [off, mask, label] of [[4 * 17991 + 3, 0x40, 'exponent byte of lake-3 pit'], [4 * 70000, 0x01, 'low mantissa bit of cell 70000']]) {
  const { ctx, page, errors } = await open({}, async (route) => { const r = await route.fetch(); const b = Buffer.from(await r.body()); b[off] ^= mask; await route.fulfill({ response: r, body: b }); });
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.match !== 'pending', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => { const r = document.querySelector('[data-explorer]'); const st = r.querySelector('[data-ex-status]'); return { match: r.dataset.match, ready: r.dataset.ready, kind: st.dataset.kind, role: st.getAttribute('role'), live: st.getAttribute('aria-live'), text: st.textContent, vis: st.getBoundingClientRect().height > 0 && getComputedStyle(st).visibility !== 'hidden', hasEx: !!r.__explorer, lakes: r.querySelector('[data-ro-lakes]').textContent, playDisabled: r.querySelector('[data-ex-play]').disabled }; });
  const mapPainted = await page.evaluate(() => { const c = document.querySelector('[data-ex-map]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) a++; return a; });
  log.push(`     corrupted (${label}): ${JSON.stringify(s)}; painted map px ${mapPainted}; console.error: ${errors.map((e) => e.slice(0, 120)).join(' | ')}`);
  ok(s.match === 'false' && s.kind === 'error' && s.role === 'status' && s.vis && errors.length === 1, `corrupted grid (${label}): visible polite error state + exactly 1 console.error`);
  ok(!s.hasEx || s.playDisabled, `corrupted grid (${label}): explorer NOT started on unverified data (hasEx=${s.hasEx}, play disabled=${s.playDisabled}, lakes readout "${s.lakes}", painted px ${mapPainted})`);
  await ctx.close();
}

// C. keyboard scoping
{
  const { ctx, page, errors } = await open(); await ready(page);
  const st = () => page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; return { playing: e.playing, p: e.progress, sel: e.selected && e.selected.birthCell, y: scrollY }; });
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
  await page.evaluate(() => document.activeElement.blur()); await page.evaluate(() => scrollTo(0, 0));
  const s0 = await st(); await page.keyboard.press('Space'); await page.waitForTimeout(400); const s1 = await st();
  ok(!s1.playing && s1.y > s0.y, `Space on body: no play (playing=${s1.playing}), page scrolled ${s0.y}→${s1.y}`);
  await page.focus('[data-ex-stage]'); const a = await st();
  await page.keyboard.press('Space'); await page.waitForTimeout(100); const b = await st();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); const c = await st();
  await page.keyboard.press('Shift+ArrowRight'); const d = await st();
  await page.keyboard.press('ArrowLeft'); const e = await st();
  await page.keyboard.press('End'); const f = await st();
  await page.keyboard.press('Home'); const g = await st();
  await page.keyboard.press('ArrowDown'); const i = await st();
  await page.keyboard.press('Escape'); const j = await st();
  ok(b.playing && !c.playing && Math.abs(c.p - b.p - 0.005) < 0.02 && Math.abs(d.p - c.p - 0.05) < 1e-6 && Math.abs(e.p - (d.p - 0.005)) < 1e-6 && f.p === 1 && g.p === 0 && i.sel !== null && j.sel === null,
    `stage keys: Space play ${b.playing}, →${(c.p - b.p).toFixed(4)}, Shift+→ ${(d.p - c.p).toFixed(3)}, ← ${(e.p - d.p).toFixed(4)}, End ${f.p}, Home ${g.p}, ↓ sel ${i.sel}, Esc ${j.sel}`);
  await page.focus('#ex-level'); const k0 = await st(); await page.keyboard.press('ArrowRight'); const k1 = await st();
  ok(!k1.playing && k1.p > k0.p, `slider arrow scrubs (${k0.p}→${k1.p})`);
  await page.focus('[data-ex-units="ft"]'); await page.keyboard.press('Space'); const u = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.settings.units); const k2 = await st();
  ok(u === 'ft' && !k2.playing, `Space on units button toggles units only (units ${u}, playing ${k2.playing})`);
  ok(errors.length === 0, `keyboard console errors ${errors.length}`);
  // summary cadence
  await page.evaluate(() => { window.__sum = 0; new MutationObserver(() => window.__sum++).observe(document.querySelector('[data-ex-summary]'), { subtree: true, characterData: true, childList: true }); });
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(true)); await page.waitForTimeout(50);
  const s_a = await page.evaluate(() => window.__sum); await page.waitForTimeout(2000); const s_b = await page.evaluate(() => window.__sum);
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false)); await page.waitForTimeout(100); const s_c = await page.evaluate(() => window.__sum);
  for (let q = 0; q < 5; q++) await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.scrubBy(0.01));
  await page.waitForTimeout(100); const s_d = await page.evaluate(() => window.__sum); await page.waitForTimeout(400); const s_e = await page.evaluate(() => window.__sum);
  const live = await page.evaluate(() => { const s = document.querySelector('[data-ex-summary]'); return [s.getAttribute('aria-live'), s.className, s.textContent]; });
  ok(s_b - s_a === 0 && s_c - s_b === 1 && s_d === s_c && s_e - s_d === 1, `summary cadence: during 2 s play +${s_b - s_a}, on pause +${s_c - s_b}, 5 scrubs → +${s_d - s_c} within 100 ms, +${s_e - s_d} after debounce; ${JSON.stringify(live).slice(0, 300)}`);
  // off-screen + hidden
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(true)); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#about-data').scrollIntoView({ behavior: 'instant' })); await page.waitForTimeout(400);
  const o1 = await page.evaluate(() => [document.querySelector('[data-explorer]').__explorer.frames, document.querySelector('[data-explorer]').dataset.running]); await page.waitForTimeout(800);
  const o2 = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.frames);
  await page.evaluate(() => document.querySelector('[data-explorer]').scrollIntoView({ behavior: 'instant' })); await page.waitForTimeout(500);
  const o3 = await page.evaluate(() => [document.querySelector('[data-explorer]').__explorer.frames, document.querySelector('[data-explorer]').dataset.running]);
  ok(o1[1] === 'false' && o2 === o1[0] && o3[0] > o2 && o3[1] === 'true', `off-screen: running ${o1[1]}, frames ${o1[0]}→${o2} in 0.8 s, back on-screen running ${o3[1]} frames ${o3[0]}`);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200); const v1 = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.frames); await page.waitForTimeout(800);
  const v2 = await page.evaluate(() => [document.querySelector('[data-explorer]').__explorer.frames, document.querySelector('[data-explorer]').dataset.running]);
  ok(v2[0] === v1 && v2[1] === 'false', `hidden tab (emulated): frames ${v1}→${v2[0]}, running ${v2[1]}`);
  await ctx.close();
}
// D. reduced motion
for (const w of [1280, 375]) {
  const { ctx, page, errors } = await open({ reducedMotion: 'reduce', viewport: { width: w, height: 800 } }); await ready(page);
  const a = await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; return [e.playing, e.progress, e.frames, document.querySelector('[data-ex-play]').textContent.trim()]; });
  await page.waitForTimeout(1500); const b = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.frames);
  ok(!a[0] && a[1] === 0.45 && b === a[2] && a[3] === 'Play' && errors.length === 0, `reduced motion ${w}: playing ${a[0]}, progress ${a[1]}, frames ${a[2]}→${b}, button "${a[3]}"`);
  await ctx.close();
}
// E. DPR cap + CLS (incl. after data load)
for (const [dpr, w] of [[3, 1280], [3, 375], [1, 768]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: dpr }); const page = await ctx.newPage();
  await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await page.goto('http://localhost:4321/rising-water/'); await ready(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const c = document.querySelector('[data-ex-map]'); const r = c.getBoundingClientRect(); return { ratio: c.width / r.width, cls: window.__cls, aspect: r.width / r.height }; });
  ok(r.ratio <= 2.01 && r.cls < 0.05 && Math.abs(r.aspect - 0.6289) < 0.002, `DPR ${dpr} @${w}: canvas px/css ${r.ratio.toFixed(3)}, CLS through load+1.5 s ${r.cls.toFixed(5)}, map aspect ${r.aspect.toFixed(5)}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(ROOT + 'docs/checks/F6/attempt-1/behaviour.txt', log.join('\n') + `\nFAILS ${fails}\n`);
console.log(log.join('\n')); console.log('FAILS', fails);
