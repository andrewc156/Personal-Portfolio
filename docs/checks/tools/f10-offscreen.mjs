// F10 checker tool: what draws while an extra mode is off-screen or in a hidden tab?
// Records every canvas draw (via the controller's frames counter AND an independent wrap of
// drawImage on the hero map canvas) with timestamps relative to the moment the IntersectionObserver
// reports off-screen, plus whether a sim step ran. Repeats N times per mode, with the scroll
// issued as soon as the mode reports running (the e2e timing) and again after a 1 s settle.
// usage: node docs/checks/tools/f10-offscreen.mjs http://localhost:4321 [reps]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4321';
const reps = Number(process.argv[3] ?? 5);
const browser = await chromium.launch();
const results = [];
for (const mode of ['dye', 'pond', 'rivers', 'collatz']) {
  for (const settleMs of [0, 1000]) {
    for (let r = 0; r < reps; r++) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(() => {
        window.__draws = [];
        const o = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (...a) {
          if (this.canvas?.matches?.('[data-hero-map]')) window.__draws.push(performance.now());
          return o.apply(this, a);
        };
      });
      await page.goto(`${base}/?seed=42&mode=${mode}`);
      await page.waitForFunction(() => document.querySelector('[data-hero]')?.__heroMode);
      await page.evaluate(() => (document.documentElement.style.scrollBehavior = 'auto'));
      await page.waitForFunction(() => document.querySelector('[data-hero]').dataset.running === 'true');
      if (settleMs) await page.waitForTimeout(settleMs);
      const out = await page.evaluate(async () => {
        const root = document.querySelector('[data-hero]');
        const a = root.__heroMode;
        const st0 = a.stepsTaken;
        window.scrollTo(0, document.body.scrollHeight);
        // wait for running=false the way e2e polls
        const t0 = performance.now();
        while (root.dataset.running !== 'false' && performance.now() - t0 < 3000) await new Promise((r) => setTimeout(r, 10));
        const tOff = performance.now();
        const f0 = a.frames;
        const s0 = a.stepsTaken;
        const d0 = window.__draws.length;
        await new Promise((r) => setTimeout(r, 800));
        const late = window.__draws.slice(d0).map((t) => Math.round(t - tOff));
        return {
          framesAtOff: f0,
          framesDelta: a.frames - f0,
          stepsDelta: a.stepsTaken - s0,
          stepsWhileScrolling: s0 - st0,
          lateDrawsMs: late,
          pendingTimers: a.pendingTimers,
        };
      });
      results.push({ mode, settleMs, ...out });
      console.log(mode, `settle=${settleMs}`, JSON.stringify(out));
      await page.close();
    }
  }
}
const bad = results.filter((r) => r.framesDelta !== 0);
const steps = results.filter((r) => r.stepsDelta !== 0);
console.log(`\nruns ${results.length}; runs with a draw after running=false: ${bad.length}; runs with a sim step after running=false: ${steps.length}`);
await browser.close();
