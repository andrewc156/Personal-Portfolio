// Checker throwaway probe (F16/F17 attempt 1, CI3 observation).
// Measures how many priority-1 place labels the explorer places at 375 px when the label
// font (PlaceLabels.astro: `600 11px system-ui, sans-serif`) resolves to different faces.
// Usage: preview running on :4321, then
//   DEJAVU_DIR=/path/to/dejavu-fonts-ttf-2.37/ttf node docs/checks/tools/place-label-font-probe.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const dj = process.env.DEJAVU_DIR;
const djBold = dj ? readFileSync(`${dj}/DejaVuSans-Bold.ttf`).toString('base64') : null;

const variants = [
  { name: 'default (system-ui)', css: '' },
  { name: 'Arial', css: `.ex-place-labels text{font-family:Arial !important}` },
  ...(djBold
    ? [
        {
          name: 'DejaVu Sans Bold (Ubuntu default sans)',
          css: `@font-face{font-family:'DJProbe';font-weight:600;src:url(data:font/ttf;base64,${djBold}) format('truetype')}
.ex-place-labels text{font-family:'DJProbe' !important}`,
        },
      ]
    : []),
  { name: 'Verdana', css: `.ex-place-labels text{font-family:Verdana !important}` },
];

const browser = await chromium.launch();
const out = [];
for (const width of [375]) {
  for (const v of variants) {
    for (const colorScheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/rising-water/`);
      await page.locator('[data-explorer]').waitFor();
      if (v.css) await page.addStyleTag({ content: v.css });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('checkbox', { name: 'Basin mask' }).check();
      await page.getByRole('checkbox', { name: 'Place labels' }).check();
      await page.waitForTimeout(300);
      // Re-run layout after the font is definitely in use.
      await page.getByRole('checkbox', { name: 'Place labels' }).uncheck();
      await page.getByRole('checkbox', { name: 'Place labels' }).check();
      await page.waitForTimeout(200);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '[data-place-placards] text',
      });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      const r = await page.evaluate(() => {
        const svg = document.querySelector('[data-ex-place-layer]');
        const groups = [...svg.querySelectorAll('[data-place-placards] [data-place-id]')];
        const p1 = groups.filter((g) => g.dataset.priority === '1');
        const textW = groups.reduce((s, g) => s + g.querySelector('text').getComputedTextLength(), 0);
        return {
          layer: svg.getBoundingClientRect().width.toFixed(1) + 'x' + svg.getBoundingClientRect().height.toFixed(1),
          total: groups.length,
          placed: groups.filter((g) => g.hasAttribute('data-placed')).length,
          p1: p1.length,
          p1Placed: p1.filter((g) => g.hasAttribute('data-placed')).length,
          p1Missing: p1.filter((g) => !g.hasAttribute('data-placed')).map((g) => g.textContent),
          sumTextWidth: Math.round(textW),
        };
      });
      out.push({ width, colorScheme, font: v.name, platformFont: fonts.map((f) => f.familyName).join('+'), ...r });
      await ctx.close();
    }
  }
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
