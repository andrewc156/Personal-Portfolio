// F19b: screenshot of the map-to-barcode link (hover a lake, its bar is outlined). Builder-owned.
import { chromium } from '@playwright/test';
const port = process.argv[2] ?? '4418';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto(`http://localhost:${port}/?seed=42`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
const t = await p.evaluate(() => {
  const h = document.querySelector('[data-hero]').__hero;
  h.scrubTo(0.2);
  const { W, H } = h.grid;
  let best = null;
  for (let i = 0; i < W * H; i++) {
    const k = h.lakeRowAt(i);
    if (k > 0) { best = { fx: ((i % W) + 0.5) / W, fy: (Math.floor(i / W) + 0.5) / H, k }; if (i % W > W * 0.4) break; }
  }
  return best;
});
const m = await p.locator('[data-hero-map]').boundingBox();
await p.mouse.move(m.x + t.fx * m.width, m.y + t.fy * m.height);
await p.waitForTimeout(300);
const hl = await p.evaluate(() => document.querySelector('[data-hero]').__hero.highlightedRow);
await p.locator('.hero__figure').screenshot({ path: new URL('after-1280-hover.png', import.meta.url).pathname });
console.log(JSON.stringify({ target: t, highlightedRow: hl, readout: await p.locator('[data-hero-readout]').textContent() }));
await b.close();
