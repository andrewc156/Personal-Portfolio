// F10 checker tool: attribute the extra draw seen after the hero goes off-screen. Logs every
// setTimeout callback (delay, fire time) and every hero-map drawImage, relative to off-screen.
// usage: node docs/checks/tools/f10-offscreen-cause.mjs http://localhost:4321
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__ev = [];
  const oST = window.setTimeout.bind(window);
  window.setTimeout = (cb, ms, ...a) => oST(() => { window.__ev.push(['timer', ms, performance.now()]); cb(...a); }, ms);
  const RO = window.ResizeObserver;
  window.ResizeObserver = class extends RO { constructor(cb) { super((e, o) => { window.__ev.push(['resizeObserver', 0, performance.now()]); cb(e, o); }); } };
  const o = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...x) {
    if (this.canvas?.matches?.('[data-hero-map]')) window.__ev.push(['draw', 0, performance.now()]);
    return o.apply(this, x);
  };
});
await page.goto(`${base}/?seed=42&mode=dye`);
await page.waitForFunction(() => document.querySelector('[data-hero]')?.dataset.running === 'true');
const ev = await page.evaluate(async () => {
  const root = document.querySelector('[data-hero]');
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, document.body.scrollHeight);
  while (root.dataset.running !== 'false') await new Promise((r) => requestAnimationFrame(r));
  const t0 = performance.now();
  window.__ev.push(['OFFSCREEN', 0, t0]);
  await new Promise((r) => setTimeout(r, 600));
  return window.__ev.map(([k, ms, t]) => `${k}${ms ? `(${ms}ms)` : ''} @ ${Math.round(t - t0)}`);
});
console.log(ev.join('\n'));
await browser.close();
