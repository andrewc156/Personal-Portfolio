// F9 attempt 4: find missing spaces in rendered text (e.g. "does.With") on every page. Checker-owned.
import { chromium } from '@playwright/test';
const routes = ['/', '/garden/', '/research/', '/research/water-quality/', '/research/number-theory/', '/research/spectral-fractals/', '/rising-water/', '/cv/', '/about/', '/no-such-page/'];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
for (const r of routes) {
  await p.goto('http://localhost:4418' + r, { waitUntil: 'networkidle' });
  const hits = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('p, li, dd, dt, td, th, figcaption, h1, h2, h3, h4, label, summary, small, blockquote')) {
      const t = el.innerText || '';
      for (const m of t.matchAll(/([A-Za-z0-9)\]”’"])([.,;:!?])([A-Za-z(“‘"])/g)) {
        const ctx = t.slice(Math.max(0, m.index - 25), m.index + 25).replace(/\n/g, '⏎');
        out.push(ctx);
      }
    }
    return [...new Set(out)];
  });
  const filtered = hits.filter((h) => !/(\.json|\.md|\.py|\.f32|\.bin|\.webp|\.ts|\.tif|\.com|\.edu|\.org|\.eu|\.io|\.dev|e\.V|U\.S|i\.e|e\.g|www\.|https?:|GLO-90|\d\.\d|:\/\/|N\d|ESA-|@)/.test(h));
  console.log(r, JSON.stringify(filtered, null, 0));
}
await b.close();
