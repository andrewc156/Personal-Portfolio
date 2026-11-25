// CI3 checker: with labels already on, swap the placard face to a late-loading webfont (DejaVu Bold
// via @font-face data URL) WITHOUT toggling, and check the layout follows (no stale widths, P1 kept).
// Note: the explorer keeps its controls disabled until the page's Plex 600 has loaded, so a
// real Plex late swap can't be staged (route-held woff2 => checkbox stays disabled).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const dj = readFileSync(process.env.DEJAVU).toString('base64');
const browser = await chromium.launch();
for (const width of [320, 375]) {
  const ctx = await browser.newContext({ viewport: { width, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4321/rising-water/');
  await page.locator('[data-explorer]').waitFor();
  await page.getByRole('checkbox', { name: 'Basin mask' }).check();
  await page.getByRole('checkbox', { name: 'Place labels' }).check();
  await page.waitForTimeout(500);
  const snap = () => page.evaluate(() => {
    const placed = [...document.querySelectorAll('[data-place-placards] [data-place-id][data-placed]')];
    return { placed: placed.length, p1: placed.filter((x) => x.dataset.priority === '1').length,
      sum: placed.reduce((s, x) => s + +x.querySelector('rect').getAttribute('width'), 0),
      stale: placed.filter((x) => Math.abs(+x.querySelector('rect').getAttribute('width') - (Math.ceil(x.querySelector('text').getComputedTextLength()) + 8)) > 0.01).length };
  });
  const before = await snap();
  await page.addStyleTag({ content: `@font-face{font-family:'CKLate';font-weight:600;src:url(data:font/ttf;base64,${dj}) format('truetype')}[data-ex-place-layer] text{font-family:'CKLate' !important}` });
  await page.waitForTimeout(1500);
  console.log(width, 'before', JSON.stringify(before), 'after swap (no toggle)', JSON.stringify(await snap()));
  await ctx.close();
}
await browser.close();
