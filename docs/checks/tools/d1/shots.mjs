import { chromium } from '@playwright/test';
const O = 'http://localhost:4321', B = '/Personal-Portfolio/';
const OUT = new URL('../../D1/attempt-1/', import.meta.url).pathname;
const b = await chromium.launch();
for (const w of [375, 1280]) for (const [name, p] of [['home', ''], ['garden', 'garden/'], ['rising-water', 'rising-water/']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w === 375 ? 812 : 800 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(O + B + p, { waitUntil: 'networkidle' });
  if (name === 'rising-water') await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.screenshot({ path: `${OUT}${name}-${w}-light.png`, fullPage: true });
  console.log(name, w, 'overflowX', ov, page.url());
  await ctx.close();
}
await b.close();
