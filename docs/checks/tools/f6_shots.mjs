// F6 checker screenshots: /rising-water/ at 375×812, 768×1024, 1280×800 × light/dark.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const D = new URL('../F6/attempt-1/', import.meta.url).pathname; fs.mkdirSync(D, { recursive: true });
const b = await chromium.launch();
const overflow = [];
for (const theme of ['light', 'dark'])
  for (const [w, hh] of [[375, 812], [768, 1024], [1280, 800]]) {
    const c = await b.newContext({ colorScheme: theme, viewport: { width: w, height: hh }, ...(w < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const p = await c.newPage(); const errs = []; p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('http://localhost:4321/rising-water/');
    await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
    const ex = (fn, a) => p.evaluate(fn, a);
    await ex(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
    await ex(() => document.querySelector('[data-explorer]').__explorer.scrubTo(0.4));
    await p.waitForTimeout(400);
    const tag = `${w}-${theme}`;
    await p.screenshot({ path: `${D}initial-${tag}.png` });
    await p.screenshot({ path: `${D}initial-full-${tag}.png`, fullPage: true });
    // bar click: lake 3 row on the strip
    const pos = await ex(() => { const e = document.querySelector('[data-explorer]').__explorer; const k = e.rows.findIndex((b) => b.birthCell === 17991); const r = e.els.strip.getBoundingClientRect();
      const L = e.L, rg = e.scale.maxH - e.scale.minH, bb = e.rows[k]; const x = (L.left + (((bb.birth + bb.death) / 2 - e.scale.minH) / rg) * (L.right - L.left)) / e.dpr;
      e.els.strip.scrollIntoView({ block: 'center', behavior: 'instant' }); const r2 = e.els.strip.getBoundingClientRect(); return { x: r2.left + x, y: r2.top + e.rowCenterCss(k) }; });
    await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(300);
    const sel = await ex(() => document.querySelector('[data-explorer]').dataset.selected);
    await ex(() => window.scrollTo(0, document.querySelector('[data-explorer]').getBoundingClientRect().top + scrollY - 10)); await p.waitForTimeout(200);
    await p.screenshot({ path: `${D}barclick-${tag}.png` });
    await ex(() => document.querySelector('.explorer__side').scrollIntoView({ block: 'start', behavior: 'instant' })); await p.waitForTimeout(150);
    await p.screenshot({ path: `${D}barclick-side-${tag}.png` });
    // diagram + ft units
    await p.click('[data-ex-view="diagram"]'); await p.click('[data-ex-units="ft"]'); await p.waitForTimeout(300);
    await ex(() => document.querySelector('.ex-strip').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(150);
    await p.screenshot({ path: `${D}diagram-ft-${tag}.png` });
    await p.click('[data-ex-view="barcode"]'); await p.click('[data-ex-units="m"]');
    // east-edge label cluster at high water: clear selection, level where lakes 1,2,8,9 alive (just below 1957.7 = lake 2's death)
    await ex(() => { const e = document.querySelector('[data-explorer]').__explorer; e.select(null); e.setLevel(1950); });
    await p.waitForTimeout(250);
    await ex(() => document.querySelector('.ex-stage').scrollIntoView({ block: 'start', behavior: 'instant' })); await p.waitForTimeout(150);
    const box = await p.locator('.ex-stage').boundingBox();
    await p.screenshot({ path: `${D}east-labels-${tag}.png` });
    await p.screenshot({ path: `${D}east-labels-zoom-${tag}.png`, clip: { x: box.x + box.width * 0.6, y: Math.max(0, box.y), width: box.width * 0.4, height: Math.min(hh - Math.max(0, box.y), box.height) } });
    await ex(() => { const e = document.querySelector('[data-explorer]').__explorer; e.setLevel(3000); }); await p.waitForTimeout(250);
    await p.screenshot({ path: `${D}high-water-${tag}.png` });
    // table and about
    await ex(() => document.querySelector('#lakes').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(200);
    await p.screenshot({ path: `${D}table-${tag}.png` });
    await ex(() => document.querySelector('#about-data').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(200);
    await p.screenshot({ path: `${D}about-${tag}.png` });
    await ex(() => document.querySelector('#how-to-read').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(200);
    await p.screenshot({ path: `${D}howto-${tag}.png` });
    const ov = await ex(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    overflow.push(`${tag}: scrollWidth ${ov[0]} clientWidth ${ov[1]} selected ${sel} errors ${errs.length}`);
    await c.close();
  }
console.log(overflow.join('\n'));
await b.close();
