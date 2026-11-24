// F6 checker: performance — compute time, rAF frame intervals during play (≥600 frames × 2 runs,
// plus 4× CPU throttle), bytes over the wire on a cold cache, third-party requests. Preview :4321.
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const [label, rate, frames] of [['run1', 1, 700], ['run2', 1, 700], ['4x-a', 4, 650], ['4x-b', 4, 650]]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  let bytes = 0; const per = {}; const urls = new Map(); const third = [];
  cdp.on('Network.requestWillBeSent', (e) => { urls.set(e.requestId, e.request.url); if (!e.request.url.startsWith('http://localhost:4321') && !e.request.url.startsWith('data:')) third.push(e.request.url); });
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; const u = (urls.get(e.requestId) || '').replace('http://localhost:4321', ''); per[u] = (per[u] || 0) + e.encodedDataLength; });
  await page.goto('http://localhost:4321/rising-water/');
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 30000 });
  const t = await page.evaluate(() => { const r = document.querySelector('[data-explorer]'); return { compute: r.dataset.computeMs, setup: r.dataset.setupMs, fetch: r.dataset.fetchMs, readyAt: performance.now() }; });
  await page.waitForTimeout(500);
  const res = await page.evaluate((N) => new Promise((done) => { const e = document.querySelector('[data-explorer]').__explorer; e.scrubTo(0); e.update({ speed: 0.25 }); e.setPlaying(true);
    const ts = []; const f = (now) => { ts.push(now); if (ts.length < N + 1) requestAnimationFrame(f); else done({ ts, render: e.renderTimes(), running: document.querySelector('[data-explorer]').dataset.running }); }; requestAnimationFrame(f); }), frames);
  const iv = res.ts.slice(1).map((v, k) => v - res.ts[k]);
  const rt = res.render.slice(-frames);
  console.log(`${label} (CPU ${rate}×): compute ${t.compute} ms, setup ${t.setup} ms, fetch ${t.fetch} ms, ready at ${t.readyAt.toFixed(0)} ms | rAF n=${iv.length} p50 ${q(iv, 0.5).toFixed(1)} p95 ${q(iv, 0.95).toFixed(1)} max ${Math.max(...iv).toFixed(1)} | render p50 ${q(rt, 0.5).toFixed(2)} p95 ${q(rt, 0.95).toFixed(2)} max ${Math.max(...rt).toFixed(2)} | bytes ${bytes} | third-party ${third.length}`);
  if (label === 'run1') console.log('  per-resource bytes:', JSON.stringify(per));
  await ctx.close();
}
await browser.close();
