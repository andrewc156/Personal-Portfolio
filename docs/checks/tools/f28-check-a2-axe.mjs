// F28b attempt-2 check: axe (all impacts reported, serious/critical counted) on /, /garden/
// with Settings closed and open (/ only), light + dark, 1280 and 375, Chromium and WebKit.
// Usage: bash docs/checks/tools/f28-check-run.sh . docs/checks/tools/f28-check-a2-axe.mjs
import fs from 'node:fs';
import { chromium, webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const rows = [];
for (const [en, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await bt.launch();
  for (const scheme of ['light', 'dark'])
    for (const [w, h] of [[1280, 800], [375, 812]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const [url, open] of [['/', false], ['/', true], ['/garden/', false]]) {
        await page.goto('http://localhost:4321' + url);
        await page.waitForTimeout(400);
        if (open) {
          await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
          await page.click('[data-settings-toggle]');
          await page.waitForTimeout(400);
        }
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        const r = await new AxeBuilder({ page }).analyze();
        const v = r.violations.map((x) => `${x.id}(${x.impact})x${x.nodes.length}`);
        const serious = r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').length;
        rows.push({ en, scheme, theme, w, url, open, serious, all: v });
        console.log(en, scheme, theme, w, url, open ? 'open' : 'closed', 'serious/critical=' + serious, v.join(' '));
      }
      await ctx.close();
    }
  await b.close();
}
fs.writeFileSync('docs/checks/F28b/attempt-2/axe.json', JSON.stringify(rows, null, 2));
