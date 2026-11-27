// F28 check: §11.5 screenshots of the current build or the base (HEAD) build.
// Usage (preview on 4321): node docs/checks/tools/f28-check-shots.mjs <cur|base>
// 375 and 768 use touch emulation (coarse pointer, so the approved 16 px rule shows);
// 1280 uses a mouse. Reduced motion holds the hero at its static frame for stable shots.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const LABEL = process.argv[2] ?? 'cur';
const OUT = path.resolve('docs/checks/F28b/attempt-1/shots');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const VPS = [
  [375, 812, true],
  [768, 1024, true],
  [1280, 800, false],
];
const meta = [];
for (const scheme of ['light', 'dark']) {
  for (const [w, h, touch] of VPS) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h },
      colorScheme: scheme,
      reducedMotion: 'reduce',
      ...(touch ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    for (const url of ['/', '/garden/', '/rising-water/']) {
      await page.goto('http://localhost:4321' + url);
      if (url === '/rising-water/')
        await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 60000 });
      await page.waitForTimeout(800);
      const name = `${LABEL}-${url.replace(/\//g, '') || 'home'}-${w}-${scheme}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      meta.push({ name, overflowPx: ov });
      if (url === '/rising-water/') {
        // explorer controls row (Play / Speed / Pacing)
        const box = await page.locator('.ex-controls').first().boundingBox();
        if (box) {
          await page.locator('.ex-controls').first().scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          const nb = await page.locator('.ex-controls').first().boundingBox();
          await page.screenshot({ path: path.join(OUT, `${LABEL}-excontrols-${w}-${scheme}.png`), clip: { x: 0, y: Math.max(0, nb.y - 10), width: w, height: Math.min(h - Math.max(0, nb.y - 10), nb.height + 20) } });
        }
      }
      if (url === '/') {
        const g = page.locator('[data-settings-toggle]');
        await g.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, `${LABEL}-settings-${w}-${scheme}.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, `${LABEL}-meta.json`), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));
await b.close();
