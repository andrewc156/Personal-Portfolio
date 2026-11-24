// Measure Garden chip-group label/chip alignment and the /about/ "or the CV" gap.
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [375, 640, 641, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('http://localhost:4321/garden/');
  const r = await p.$$eval('.filter-group', (gs) => gs.map((g) => {
    const l = g.querySelector('.filter-group__label').getBoundingClientRect();
    const c = g.querySelector('.chips').getBoundingClientRect();
    const first = g.querySelector('.chips a, .chips li').getBoundingClientRect();
    return { labelX: Math.round(l.x), labelTop: Math.round(l.top), chipsX: Math.round(c.x), chipsTop: Math.round(c.top), firstChipTop: Math.round(first.top), chipsH: Math.round(c.height) };
  }));
  console.log('garden', w, JSON.stringify(r));
  await p.goto('http://localhost:4321/about/');
  const gap = await p.evaluate(() => {
    const a = [...document.querySelectorAll('main a')].find((x) => x.textContent === 'CV');
    const t = a.previousSibling.textContent; return JSON.stringify(t.slice(-6));
  });
  console.log('about text before CV link', w, gap);
  await p.close();
}
await b.close();
