import { chromium } from 'playwright';
const B = 'http://localhost:4321', D = process.argv[2];
const b = await chromium.launch();
const sizes = [[375, 812], [768, 1024], [1280, 800]];
const report = [];
for (const theme of ['light', 'dark']) for (const [w, h] of sizes) {
  const c = await b.newContext({ colorScheme: theme, viewport: { width: w, height: h } });
  const p = await c.newPage();
  for (const [name, path, open] of [['home', '/', false], ['home-settings', '/', true], ['404', '/404.html', false]]) {
    await p.goto(B + path); await p.evaluate(() => document.fonts.ready);
    if (open) { await p.locator('[data-settings-toggle]').click(); await p.waitForTimeout(500); }
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const f = `${D}/${name}-${w}x${h}-${theme}.png`;
    await p.screenshot({ path: f, fullPage: !open });
    report.push(`${f} overflowX=${ov}`);
    if (open) await p.evaluate(() => localStorage.clear());
  }
  await c.close();
}
await b.close(); console.log(report.join('\n'));
