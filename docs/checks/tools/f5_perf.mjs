// F5 checker: rAF frame-time sampling at 1280×800 during play (≥ 600 frames), plus the hero's own
// frame work (wrapping its rAF callback), unthrottled ×2 and with 4× CPU throttling (CDP).
import { chromium } from 'playwright';
const b = await chromium.launch();
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; };
for (const [label, rate, seed] of [['run1', 1, 42], ['run2', 1, 7], ['run3', 1, 0], ['4x-throttle', 4, 42], ['4x-throttle-b', 4, 7]]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(`http://localhost:4321/?seed=${seed}`);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const r = await p.evaluate(() => new Promise((res) => {
    const h = document.querySelector('[data-hero]').__hero;
    h.update({ loop: true, speed: 1 });
    const work = [];
    const orig = h.frame;
    h.frame = (now) => { const t = performance.now(); orig(now); work.push(performance.now() - t); };
    const d = []; let last = -1;
    const f = (t) => { if (last >= 0) d.push(t - last); last = t; if (d.length < 700) requestAnimationFrame(f); else res({ d, work, state: document.querySelector('[data-hero]').dataset.state, running: document.querySelector('[data-hero]').dataset.running }); };
    setTimeout(() => requestAnimationFrame(f), 300);
  }));
  console.log(`${label} seed ${seed}: ${r.d.length} frames, rAF Δ median ${q(r.d, 0.5).toFixed(2)} p95 ${q(r.d, 0.95).toFixed(2)} max ${Math.max(...r.d).toFixed(2)} ms; hero work (${r.work.length} cb) median ${q(r.work, 0.5).toFixed(2)} p95 ${q(r.work, 0.95).toFixed(2)} max ${Math.max(...r.work).toFixed(2)} ms; state ${r.state}/${r.running}`);
  await ctx.close();
}
await b.close();
