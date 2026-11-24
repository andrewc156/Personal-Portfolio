// F9: reproduce CI CLS on / . Lighthouse-like mobile (412×823, DPR 1.75), with variants:
// fonts normal / delayed / blocked, CPU throttle, and a "wide fallback" font (simulates Linux DejaVu).
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:4321';
const url = process.argv[2] || '/';
const b = await chromium.launch({ args: ['--disable-gpu'] });
async function run(label, { fontDelay = 0, blockFonts = false, cpu = 1, wideFallback = false, width = 412, height = 823 } = {}) {
  const c = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await p.route('**/*.woff2', async (r) => { if (blockFonts) return r.abort(); if (fontDelay) await new Promise((s) => setTimeout(s, fontDelay)); return r.continue(); });
  await p.route('**/*.woff', (r) => (blockFonts ? r.abort() : r.continue()));
  if (wideFallback) await p.addInitScript(() => { const s = document.createElement('style'); s.textContent = '@font-face{font-family:"WideFallback";src:local("Verdana");}'; document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.setProperty('--font-sans', "'IBM Plex Sans', Verdana, sans-serif"); }); document.head?.append(s); });
  await p.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: Math.round(e.startTime), src: e.sources.map((s) => { const n = s.node; const d = n && n.nodeType === 1 ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}.${[...n.classList].join('.')}` : n ? n.nodeName : '?'; return `${d} y ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h ${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`; }) }); }).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.waitForTimeout(fontDelay + 3000);
  const s = await p.evaluate(() => window.__shifts);
  const cls = s.reduce((a, x) => a + x.v, 0);
  console.log(`\n== ${label}: CLS ${cls.toFixed(4)} (${s.length} shifts)`);
  for (const x of s.filter((x) => x.v > 0.001)) console.log(`  ${x.v.toFixed(4)} @${x.t}ms  ${x.src.join(' ; ')}`);
  await c.close();
}
await run('baseline');
await run('cpu4x', { cpu: 4 });
await run('fonts delayed 1500ms', { fontDelay: 1500 });
await run('fonts delayed 1500ms + cpu4x', { fontDelay: 1500, cpu: 4 });
await run('fonts blocked', { blockFonts: true });
await run('fonts delayed + wide fallback (Verdana ~ DejaVu)', { fontDelay: 1500, wideFallback: true });
await b.close();
