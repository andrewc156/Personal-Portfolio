import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w, hh] of [[1280, 800], [375, 812]]) {
const p = await (await b.newContext({ viewport: { width: w, height: hh } })).newPage();
await p.goto('http://localhost:4321/rising-water/');
await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
console.log(w, await p.evaluate(() => {
  const m = document.querySelector('[data-ex-map]'); const W = 326, H = 414; let hidden = 0, tot = 0; const ex = [];
  const rad = getComputedStyle(document.querySelector('.ex-stage')).borderRadius;
  for (const [y0, y1] of [[0, 8], [H - 8, H]]) for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (x > 8 && x < W - 9) continue;
    m.scrollIntoView({ block: y < 10 ? 'start' : 'end', behavior: 'instant' });
    const r = m.getBoundingClientRect();
    const fx = (Math.min(30 * x + 15, (30 * x + 9769) / 2)) / 9769, fy = (Math.min(30 * y + 15, (30 * y + 12408) / 2)) / 12408;
    const el = document.elementFromPoint(r.left + fx * r.width, r.top + fy * r.height); tot++;
    if (el !== m) { hidden++; ex.push(y * W + x); }
  }
  return { rad, hidden, tot, ex: ex.slice(0, 40) };
}));
}
await b.close();
