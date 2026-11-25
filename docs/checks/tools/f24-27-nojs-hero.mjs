// F26 checker: no-JS hero figure at narrow widths (does the readout note fit its box?)
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
for (const w of [320, 375]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage(); await p.goto('http://localhost:4321/');
  const m = await p.evaluate(() => { const r = document.querySelector('[data-hero-readout]'); const bar = r.closest('.hero__bar') ?? r.parentElement; const fig = document.querySelector('.hero__figure'); const box = document.querySelector('[data-hero]'); const rr = r.getBoundingClientRect(), br = box.getBoundingClientRect(); return { readout: [Math.round(rr.top), Math.round(rr.bottom)], heroBox: [Math.round(br.top), Math.round(br.bottom)], overflowY: r.scrollHeight - r.clientHeight, insideBox: rr.bottom <= br.bottom + 1, barH: Math.round(bar.getBoundingClientRect().height) }; });
  await p.locator('.hero__figure').screenshot({ path: `docs/checks/F26/attempt-1/nojs-hero-figure-${w}.png` });
  console.log(w, JSON.stringify(m));
  await ctx.close();
}
await browser.close();
