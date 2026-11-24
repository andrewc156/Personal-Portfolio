import { chromium } from '@playwright/test';
const OUT = new URL('../../D1/attempt-1/', import.meta.url).pathname;
const b = await chromium.launch();
for (const w of [375, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w === 375 ? 812 : 800 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4321/Personal-Portfolio/rising-water/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}rising-water-${w}-light-viewport.png` });
  await ctx.close();
}
await b.close();
