import { chromium } from 'playwright';
const B = 'http://localhost:4321', D = process.argv[2];
const b = await chromium.launch();
const pages = [['home', '/'], ['garden', '/garden/'], ['garden-poster', '/garden/?type=poster'], ['about', '/about/']];
for (const theme of ['light', 'dark']) for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
  const c = await b.newContext({ colorScheme: theme, viewport: { width: w, height: h } });
  const p = await c.newPage();
  for (const [name, u] of pages) {
    await p.goto(B + u); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const f = `${D}/${name}-${w}x${h}-${theme}.png`;
    await p.screenshot({ path: f, fullPage: true });
    console.log(f, 'overflowX=' + ov);
  }
  await c.close();
}
await b.close();
