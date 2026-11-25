// F26 checker: CLS on home at narrow widths with JS on (readout note -> live readout swap),
// with the module script delayed so the no-JS note is painted first.
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
for (const w of [320, 360, 375, 390]) {
  for (const delay of [0, 800]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const p = await ctx.newPage();
    if (delay) await p.route(/\/_astro\/.*\.js$/, async (r) => { await new Promise((res) => setTimeout(res, delay)); await r.continue(); });
    await p.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(e.sources?.map((s) => s.node?.className || s.node?.nodeName).join('|') + ':' + e.value.toFixed(4)); } }).observe({ type: 'layout-shift', buffered: true }); });
    await p.goto(B + '/');
    await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero, null, { timeout: 15000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => ({ cls: +window.__cls.toFixed(4), shifts: window.__shifts.slice(0, 4), readoutH: Math.round(document.querySelector('[data-hero-readout]').getBoundingClientRect().height) }));
    console.log(w, `delay=${delay}`, JSON.stringify(r));
    await ctx.close();
  }
}
await browser.close();
