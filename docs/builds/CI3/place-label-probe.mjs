// CI3 builder probe: how many priority-1 place labels the explorer places when the label
// face is forced to different fonts. Also dumps the layout candidates for offline tests.
// Usage: dev server on :4417 (npx astro dev --port 4417), then
//   DEJAVU_DIR=/path/to/dejavu-fonts-ttf-2.37/ttf node docs/builds/CI3/place-label-probe.mjs [--dump file.json]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4417';
const dj = process.env.DEJAVU_DIR;
const djBold = dj ? readFileSync(`${dj}/DejaVuSans-Bold.ttf`).toString('base64') : null;
const dumpAt = process.argv.indexOf('--dump');
const dumpFile = dumpAt > 0 ? process.argv[dumpAt + 1] : null;

const variants = [
  { name: 'default (site stack)', css: '' },
  { name: 'Arial', css: `.ex-place-labels text{font-family:Arial !important}` },
  ...(djBold
    ? [
        {
          name: 'DejaVu Sans Bold',
          css: `@font-face{font-family:'DJProbe';font-weight:600;src:url(data:font/ttf;base64,${djBold}) format('truetype')}
.ex-place-labels text{font-family:'DJProbe' !important}`,
        },
      ]
    : []),
  { name: 'Verdana', css: `.ex-place-labels text{font-family:Verdana !important}` },
];

const browser = await chromium.launch();
const out = [];
const dump = {};
for (const width of (process.env.WIDTHS ?? '320,375').split(',').map(Number)) {
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
      await page.waitForTimeout(400);
      // Re-run layout after the forced face is definitely in use.
      await page.getByRole('checkbox', { name: 'Place labels' }).uncheck();
      await page.getByRole('checkbox', { name: 'Place labels' }).check();
      await page.waitForTimeout(300);
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
        const { width: w, height: h } = svg.getBoundingClientRect();
        const groups = [...svg.querySelectorAll('[data-place-placards] [data-place-id]')];
        const p1 = groups.filter((g) => g.dataset.priority === '1');
        const candidates = groups.map((g) => ({
          id: Number(g.dataset.placeId),
          name: g.textContent,
          priority: Number(g.dataset.priority),
          x: Number(g.dataset.x) * w,
          y: Number(g.dataset.y) * h,
          textWidth: g.querySelector('text').getComputedTextLength(),
        }));
        return {
          layer: [w, h],
          total: groups.length,
          placed: groups.filter((g) => g.hasAttribute('data-placed')).length,
          p1: p1.length,
          p1Placed: p1.filter((g) => g.hasAttribute('data-placed')).length,
          p1Missing: p1.filter((g) => !g.hasAttribute('data-placed')).map((g) => g.textContent),
          sumTextWidth: Math.round(candidates.reduce((s, c) => s + c.textWidth, 0)),
          candidates,
        };
      });
      const { candidates, ...summary } = r;
      if (colorScheme === 'light') dump[`${width}:${v.name}`] = { layer: r.layer, candidates };
      out.push({ width, colorScheme, font: v.name, platformFont: fonts.map((f) => f.familyName).join('+'), ...summary });
      await ctx.close();
    }
  }
}
await browser.close();
if (dumpFile) writeFileSync(dumpFile, JSON.stringify(dump));
console.log(JSON.stringify(out, null, 1));
