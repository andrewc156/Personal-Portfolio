// F10 checker tool: per-mode frame-time p95 (rAF deltas, 1280×800) and main-thread cost of the
// mode's own frame work (wrapping the sim's step/draw), plus grid sizing and DPR cap at several
// viewports and DPRs, plus third-party request audit.
// usage: node docs/checks/tools/f10-perf-size.mjs http://localhost:4321
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
const modes = ['rising', 'dye', 'pond', 'rivers', 'collatz'];
const p = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(q * (s.length - 1))];
};
console.log('--- frame time @1280×800 (dpr 1)');
for (const mode of modes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const foreign = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url());
  });
  await page.goto(`${base}/?seed=42&mode=${mode}`);
  await page.waitForFunction((m) => {
    const r = document.querySelector('[data-hero]');
    return r?.dataset.mode === m && r.dataset.running === 'true';
  }, mode);
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    const root = document.querySelector('[data-hero]');
    const sim = root.__heroMode?.sim;
    const work = [];
    if (sim) {
      const os = sim.step.bind(sim);
      const od = sim.draw.bind(sim);
      let acc = 0;
      sim.step = () => {
        const t = performance.now();
        os();
        acc += performance.now() - t;
      };
      sim.draw = (...a) => {
        const t = performance.now();
        od(...a);
        work.push(acc + performance.now() - t);
        acc = 0;
      };
    }
    const d = [];
    await new Promise((res) => {
      let last = performance.now();
      const f = (t) => {
        d.push(t - last);
        last = t;
        if (d.length < 300) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    const m = root.querySelector('[data-hero-map]');
    const rect = m.getBoundingClientRect();
    return { d: d.slice(1), work, state: root.dataset.state, cw: m.width, ch: m.height, css: [rect.width, rect.height] };
  });
  console.log(
    mode,
    `p95 ${p(r.d, 0.95).toFixed(1)} ms, p50 ${p(r.d, 0.5).toFixed(1)}, max ${Math.max(...r.d).toFixed(1)}`,
    r.work.length ? `| sim step+draw p95 ${p(r.work, 0.95).toFixed(2)} ms max ${Math.max(...r.work).toFixed(2)}` : '',
    `| state ${r.state} | foreign requests ${foreign.length}`,
  );
  await page.close();
}
console.log('--- sizing');
for (const [w, h, dpr] of [
  [320, 700, 3],
  [375, 812, 3],
  [768, 1024, 2],
  [1280, 800, 1],
  [1920, 1080, 2],
  [2560, 1440, 1],
]) {
  for (const mode of ['dye', 'pond', 'rivers', 'collatz']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.goto(`${base}/?seed=42&mode=${mode}`);
    await page.waitForFunction(() => document.querySelector('[data-hero]')?.__heroMode);
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const a = document.querySelector('[data-hero]').__heroMode;
      const m = a.els.map;
      const r = m.getBoundingClientRect();
      const sim = a.sim;
      const W = sim.field?.W ?? sim.W ?? null;
      const H = sim.field?.H ?? sim.H ?? null;
      return { css: [Math.round(r.width), Math.round(r.height)], dev: [m.width, m.height], W, H };
    });
    const ratio = s.dev[0] / s.css[0];
    const cells = s.W && s.H ? s.W * s.H : null;
    const px = s.W ? [(s.css[0] / s.W).toFixed(2), (s.css[1] / s.H).toFixed(2)] : null;
    console.log(`${w}×${h}@${dpr} ${mode}: css ${s.css} dev ${s.dev} (×${ratio.toFixed(2)}) grid ${s.W}×${s.H} = ${cells} cells, px/cell ${px}`);
    await ctx.close();
  }
}
await browser.close();
