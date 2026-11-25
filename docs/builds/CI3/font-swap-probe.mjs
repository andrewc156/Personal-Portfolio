// CI3 builder probe: with place labels already on, swap the placard face to a webfont that
// arrives late (DejaVu Sans Bold, served after 800 ms) and check the placards are laid out
// again from the newly drawn text, without toggling the checkbox. This exercises the
// document.fonts 'loadingdone' relayout path (a font swap doesn't fire the ResizeObserver).
// Usage: dev server running, then
//   BASE=http://localhost:44NN DEJAVU_DIR=/path/to/dejavu-fonts-ttf-2.37/ttf node docs/builds/CI3/font-swap-probe.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4417';
const ttf = readFileSync(`${process.env.DEJAVU_DIR}/DejaVuSans-Bold.ttf`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
await page.route('**/ci3-probe-font.ttf', async (route) => {
  await new Promise((r) => setTimeout(r, 800));
  await route.fulfill({ body: ttf, contentType: 'font/ttf' });
});
await page.goto(`${BASE}/rising-water/`);
await page.locator('[data-explorer]').waitFor();
await page.getByRole('checkbox', { name: 'Basin mask' }).check();
await page.getByRole('checkbox', { name: 'Place labels' }).check();
const sample = () =>
  page.evaluate(() => {
    const svg = document.querySelector('[data-ex-place-layer]');
    const nodes = [...svg.querySelectorAll('[data-place-id][data-placed]')];
    return {
      placed: nodes.length,
      p1: nodes.filter((n) => n.dataset.priority === '1').length,
      stale: nodes.filter(
        (n) =>
          Math.abs(
            n.querySelector('rect').width.baseVal.value -
              (Math.ceil(n.querySelector('text').getComputedTextLength()) + 8),
          ) > 0.01,
      ).length,
      sumRect: Math.round(nodes.reduce((s, n) => s + n.querySelector('rect').width.baseVal.value, 0)),
    };
  });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
console.log('Plex          ', JSON.stringify(await sample()));
await page.addStyleTag({
  content: `@font-face{font-family:'CI3Probe';font-weight:600;src:url(/ci3-probe-font.ttf) format('truetype')}
.ex-place-labels text{font-family:'CI3Probe',var(--font-sans) !important}`,
});
await page.waitForTimeout(100);
console.log('font in flight', JSON.stringify(await sample()));
await page.waitForTimeout(1500);
console.log('DejaVu loaded ', JSON.stringify(await sample()));
await browser.close();
