// F28b attempt-2 check: screenshots of / with Settings open and /garden/ (which has no
// Settings panel; shot plain and with a type chip active) at 375 (touch) and 1280 (mouse),
// light + dark. Reduced motion so the hero and panel are static.
// Usage: bash docs/checks/tools/f28-check-run.sh . docs/checks/tools/f28-check-a2-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = path.resolve('docs/checks/F28b/attempt-2/shots');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const meta = [];
for (const scheme of ['light', 'dark']) {
  for (const [w, h, touch] of [[375, 812, true], [1280, 800, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce', ...(touch ? { hasTouch: true, isMobile: true } : {}) });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4321/');
    await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
    await page.click('[data-settings-toggle]');
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? getComputedStyle(document.body).backgroundColor, inert: document.getElementById('settings-panel').inert, overflow: document.documentElement.scrollWidth - innerWidth, selectFont: getComputedStyle(document.querySelector('#settings-panel select')).fontSize }));
    let name = `home-settings-${w}-${scheme}.png`;
    await page.screenshot({ path: path.join(OUT, name) });
    meta.push({ name, ...st });
    await page.goto('http://localhost:4321/garden/');
    await page.waitForTimeout(500);
    name = `garden-${w}-${scheme}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
    const chip = page.locator('.chip').nth(1);
    if (await chip.count()) { await chip.click(); await page.waitForTimeout(300); }
    const g = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
    const name2 = `garden-chip-${w}-${scheme}.png`;
    await page.screenshot({ path: path.join(OUT, name2) });
    meta.push({ name, name2, ...g });
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 1));
await b.close();
