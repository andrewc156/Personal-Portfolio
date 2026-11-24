// F5 attempt-2 checker probe: readout correctness against my own brute force (f5_brute.mjs),
// during play (lag), after pause, after each kind of scrub, after N, after Reset, pacing change,
// and map hover after a scrub. Run against preview on 4321.
import { chromium } from 'playwright';
import { myOrder, componentsAt } from './f5_brute.mjs';

const BASE = 'http://localhost:4321/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(BASE + '?seed=42');
await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);

let cache = { seed: null };
async function terrain() {
  const info = await p.evaluate(() => {
    const h = document.querySelector('[data-hero]').__hero;
    return { seed: h.settings.seed, W: h.grid.W, H: h.grid.H };
  });
  if (cache.seed !== info.seed || cache.W !== info.W) {
    const hs = await p.evaluate(() => Array.from(document.querySelector('[data-hero]').__hero.t.heights));
    const h = Float32Array.from(hs);
    cache = { ...info, h, rank: myOrder(h).rank };
  }
  return cache;
}
const fmtLakes = (n) => (n === 1 ? '1 lake' : `${n} lakes`);
async function truthLevel() {
  const T = await terrain();
  const level = await p.evaluate(() => document.querySelector('[data-hero]').__hero.level());
  const { count } = componentsAt(T.h, T.W, T.H, level, T.rank);
  return `Level ${Math.round(level)} m · ${fmtLakes(count)}`;
}
async function truthCell(cell) {
  const T = await terrain();
  const level = await p.evaluate(() => document.querySelector('[data-hero]').__hero.level());
  const { lab } = componentsAt(T.h, T.W, T.H, level, T.rank);
  const hgt = Math.round(T.h[cell]);
  if (lab[cell] < 0) return `Height ${hgt} m · dry land`;
  const label = await p.evaluate((r) => document.querySelector('[data-hero]').__hero.t.lakes.labelOf[r], lab[cell]);
  return `Height ${hgt} m · Lake ${label}`;
}
const shown = () => p.evaluate(() => document.querySelector('[data-hero-readout]').textContent.trim());
let fails = 0;
async function check(name, truthFn) {
  await p.waitForTimeout(60);
  const a = await shown();
  const t1 = await truthFn();
  await p.waitForTimeout(500);
  const c = await shown();
  const t2 = await truthFn();
  const ok = a === t1 && c === t2;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: shown@60ms "${a}" truth "${t1}"; shown@560ms "${c}" truth "${t2}"`);
}

// 1. During play: in-page per-frame log of readout vs builder's truth; compute max lag.
const lag = await p.evaluate(async () => {
  const h = document.querySelector('[data-hero]').__hero;
  if (!h.playing) h.setPlaying(true);
  const el = document.querySelector('[data-hero-readout]');
  const log = [];
  await new Promise((res) => {
    const t0 = performance.now();
    const f = () => {
      const lv = Math.round(h.level());
      const n = h.lakeCount;
      log.push({ t: performance.now(), truth: `Level ${lv} m · ${n === 1 ? '1 lake' : n + ' lakes'}`, shown: el.textContent.trim() });
      if (performance.now() - t0 < 4000) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
  // For each frame, the shown text must equal the truth at some frame within the previous W ms.
  let maxLag = 0, bad = 0, changes = 0;
  for (let i = 0; i < log.length; i++) {
    if (i && log[i].shown !== log[i - 1].shown) changes++;
    let j = i;
    while (j >= 0 && log[j].truth !== log[i].shown) j--;
    if (j < 0) { bad++; continue; }
    // lag = time since truth last stopped equalling shown, i.e. since the truth moved on
    let k = j;
    while (k + 1 <= i && log[k + 1].truth === log[i].shown) k++;
    const l = k === i ? 0 : log[i].t - log[k + 1].t;
    maxLag = Math.max(maxLag, l);
  }
  return { frames: log.length, maxLag: Math.round(maxLag), unmatched: bad, changes, playing: h.playing };
});
console.log(`PLAY: ${JSON.stringify(lag)} (want maxLag ≲ 170 ms, unmatched 0, changes ≈ 4000/150)`);
if (lag.maxLag > 200 || lag.unmatched > 0) fails++;

// 2. Pause via Space mid-play
await p.focus('[data-hero]');
await p.keyboard.press('Space');
await check('pause (Space) during play', truthLevel);
// 3. Keyboard scrubs
for (const [k, n] of [['ArrowLeft', 7], ['ArrowRight', 5], ['Shift+ArrowLeft', 2], ['Home', 1], ['End', 1], ['Shift+ArrowLeft', 3]]) {
  for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(30); }
  await check(`${k} ×${n}`, truthLevel);
}
// 4. Play then pause quickly with the hero's Play button (mouse)
await p.click('[data-hero] [data-hero-play]');
await p.waitForTimeout(700);
await p.click('[data-hero] [data-hero-play]');
await check('Play/Pause button click', truthLevel);
// 5. N new terrain (paused)
await p.focus('[data-hero]');
await p.keyboard.press('n');
await check('N new terrain (paused)', truthLevel);
await p.click('[data-hero] [data-hero-new]');
await check('New terrain button (paused)', truthLevel);
// 6. Settings panel: slider drag, slider keyboard, pacing change, Reset
await p.getByRole('button', { name: 'Art settings', exact: true }).click();
await p.waitForTimeout(400);
const bb = await p.locator('#hero-level').boundingBox();
await p.mouse.move(bb.x + bb.width * 0.15, bb.y + bb.height / 2);
await p.mouse.down();
for (let k = 1; k <= 15; k++) { await p.mouse.move(bb.x + bb.width * (0.15 + 0.6 * k / 15), bb.y + bb.height / 2); await p.waitForTimeout(16); }
await p.mouse.up();
await check('slider drag 0.15→0.75', truthLevel);
await p.focus('#hero-level');
for (let i = 0; i < 9; i++) { await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(30); }
await check('slider keyboard ←×9', truthLevel);
await p.selectOption('#hero-pacing', { index: 1 }).catch(async () => { await p.click('#hero-pacing'); });
await check('pacing changed', truthLevel);
await p.getByRole('button', { name: 'Reset', exact: true }).click();
await check('Reset', truthLevel);
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
// 7. N while playing, then pause
await p.focus('[data-hero]');
await p.keyboard.press('Space');
await p.waitForTimeout(300);
await p.keyboard.press('n');
await p.waitForTimeout(400);
await p.keyboard.press('Space');
await check('N during play then pause', truthLevel);

// 8. Map hover after scrub: put mouse on map cell, then scrub with keyboard (mouse stays)
const st = await p.evaluate(() => {
  const h = document.querySelector('[data-hero]').__hero;
  const r = document.querySelector('[data-hero-map]').getBoundingClientRect();
  return { W: h.grid.W, H: h.grid.H, r: { x: r.x, y: r.y, w: r.width, h: r.height }, playing: h.playing };
});
for (const [fx, fy] of [[0.3, 0.4], [0.7, 0.6], [0.5, 0.2]]) {
  const x = st.r.x + st.r.w * fx, y = st.r.y + st.r.h * fy;
  await p.mouse.move(x, y);
  const cell = Math.floor(fy * st.H) * st.W + Math.floor(fx * st.W);
  await check(`map hover (${fx},${fy})`, () => truthCell(cell));
  await p.focus('[data-hero]');
  for (const k of ['End', 'Shift+ArrowLeft', 'Shift+ArrowLeft', 'Shift+ArrowLeft', 'ArrowLeft']) { await p.keyboard.press(k); await p.waitForTimeout(30); }
  await check(`map hover (${fx},${fy}) after keyboard scrub`, () => truthCell(cell));
  await p.keyboard.press('Home');
  for (let i = 0; i < 20; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(20); }
  await check(`map hover (${fx},${fy}) after scrub up`, () => truthCell(cell));
}
// hover during play: readout follows level changes for the hovered cell (lag check)
await p.keyboard.press('Home');
await p.keyboard.press('Space');
await p.waitForTimeout(1500);
await p.keyboard.press('Space');
{
  const x = st.r.x + st.r.w * 0.5, y = st.r.y + st.r.h * 0.2;
  const cell = Math.floor(0.2 * st.H) * st.W + Math.floor(0.5 * st.W);
  await check('map hover after play→pause', () => truthCell(cell));
}
await p.mouse.move(5, 5);
await check('pointer left map', truthLevel);
console.log(`console errors: ${errors.length} ${errors.join(' | ')}`);
console.log(`FAILS: ${fails}`);
await b.close();
