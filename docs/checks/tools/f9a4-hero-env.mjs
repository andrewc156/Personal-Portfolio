// F9 attempt 4: environment check for local hero.spec.ts failures (checker-owned).
// 1) blank-page rAF cadence; 2) per-mode rAF deltas during play on the real site;
// 3) reduced-motion: frames rendered across a long idle window after load (no autoplay).
// Needs `astro preview --port 4321` running. Run: node docs/checks/tools/f9a4-hero-env.mjs
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4321';
const b = await chromium.launch();
const pct = (d, q) => { const s = d.slice(1).sort((a, b) => a - b); return +s[Math.floor(q * (s.length - 1))].toFixed(1); };
const sample = (p, N = 180) => p.evaluate((N) => new Promise((res) => { const t = []; const f = (n) => { t.push(n); t.length < N ? requestAnimationFrame(f) : res(t); }; requestAnimationFrame(f); }), N)
  .then((r) => r.slice(1).map((x, i) => x - r[i]));
const out = {};
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.setContent('<body style="margin:0">blank</body>');
  const d = await sample(p);
  out.blank = { median: pct(d, 0.5), p95: pct(d, 0.95) };
  await p.close();
}
out.play = {};
for (const mode of ['rising', 'dye', 'pond', 'rivers', 'collatz']) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto(`${BASE}/?seed=42${mode === 'rising' ? '' : `&mode=${mode}`}`);
  await p.waitForTimeout(1500);
  const running = await p.evaluate(() => document.querySelector('[data-hero]')?.dataset.running);
  const d = await sample(p, 240);
  out.play[mode] = { running, median: pct(d, 0.5), p95: pct(d, 0.95) };
  await p.close();
}
out.reduced = {};
for (const mode of ['dye', 'pond', 'rivers', 'collatz']) {
  const ctx = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?seed=42&mode=${mode}`);
  const st = () => p.evaluate(() => { const r = document.querySelector('[data-hero]'); return { state: r.dataset.state, running: r.dataset.running, frames: r.__art?.frames ?? null }; });
  const s = [];
  for (const t of [300, 700, 1500, 3000, 5000]) { await p.waitForTimeout(t - (s.length ? [300, 700, 1500, 3000, 5000][s.length - 1] : 0)); s.push({ t, ...(await st()) }); }
  out.reduced[mode] = s;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
