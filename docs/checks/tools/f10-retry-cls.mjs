import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
const modes = ['rising', 'dye', 'pond', 'rivers', 'collatz'];
try {
  for (const [width, height] of [[375, 812], [768, 1024], [1280, 800]]) {
    for (const mode of modes) {
      const readings = [];
      for (let run = 0; run < 3; run++) {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.addInitScript(() => {
          window.__clsShifts = [];
          new PerformanceObserver((list) => {
            for (const shift of list.getEntries()) {
              if (shift.hadRecentInput) continue;
              window.__clsShifts.push({
                value: shift.value,
                at: shift.startTime,
                sources: shift.sources.map((entry) => entry.node?.nodeName),
              });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(`${base}/?mode=${mode}&seed=42`);
        await page.waitForFunction((m) => {
          const root = document.querySelector('[data-hero]');
          return root?.dataset.mode === m && (m === 'rising' ? root.__hero : root.__heroMode);
        }, mode);
        await page.waitForTimeout(1250);
        readings.push(await page.evaluate(() => {
          let max = 0;
          let sum = 0;
          let start = -Infinity;
          let previous = -Infinity;
          for (const { value, at } of window.__clsShifts) {
            if (at - start >= 5000 || at - previous >= 1000) {
              sum = 0;
              start = at;
            }
            sum += value;
            max = Math.max(max, sum);
            previous = at;
          }
          return { cls: max, shifts: window.__clsShifts };
        }));
        await page.close();
      }
      console.log(JSON.stringify({ width, mode, readings }));
    }
  }
} finally {
  await browser.close();
}
