// F28a probe 4: reduced-motion sheet visibility over time (Chromium + WebKit).
import { chromium, webkit } from '@playwright/test';
import { BASE, log, saveResults, compose } from './f28a-lib.mjs';

for (const [name, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await bt.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: name === 'chromium', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]')?.disabled);
  const g = await (await page.$('[data-settings-toggle]')).boundingBox();
  await page.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2);
  const samples = [];
  for (const ms of [0, 50, 300]) {
    await page.waitForTimeout(ms ? ms - (samples.at(-1)?.ms ?? 0) : 0);
    samples.push({
      ms,
      ...(await page.evaluate(() => {
        const p = document.getElementById('settings-panel');
        return { hidden: p.hidden, op: getComputedStyle(p).opacity, tf: getComputedStyle(p).transform, display: getComputedStyle(p).display };
      })),
    });
  }
  log(`${name}-reduced-sheet`, samples);
  await compose(browser, `reduced-sheet-375-${name}`, [{ t: `${name} reduced motion: 300 ms after tap`, b64: (await page.screenshot()).toString('base64') }], (x) => x.t);
  await ctx.close();
  await browser.close();
}
saveResults('probe4');
