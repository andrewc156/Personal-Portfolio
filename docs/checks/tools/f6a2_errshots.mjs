// F6 attempt-2: error-state screenshots (grid exponent byte of lake-3 pit flipped) at 3 widths × 2 themes.
import { chromium } from '@playwright/test';
const D = 'docs/checks/F6/attempt-2/';
const b = await chromium.launch();
for (const theme of ['light', 'dark']) for (const [w, hh] of [[375, 812], [768, 1024], [1280, 800]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: hh }, colorScheme: theme });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**/data/colorado/grid.f32', async (route) => { const r = await route.fetch(); const buf = Buffer.from(await r.body()); buf[4 * 17991 + 3] ^= 0x40; await route.fulfill({ response: r, body: buf }); });
  await p.goto('http://localhost:4321/rising-water/');
  await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.match === 'false');
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-explorer]').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await p.screenshot({ path: `${D}error-${w}-${theme}.png` });
  await p.screenshot({ path: `${D}error-full-${w}-${theme}.png`, fullPage: true });
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  console.log(`${w}-${theme}: errors ${errs.length} scroll ${sw}`);
  await ctx.close();
}
await b.close();
