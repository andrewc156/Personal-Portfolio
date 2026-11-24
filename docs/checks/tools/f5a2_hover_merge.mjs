// F5 a2 checker: map-hover readout across a merge (elder rule) after scrubbing, vs my brute force.
import { chromium } from 'playwright';
import { myOrder, componentsAt, bruteH0 } from './f5_brute.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4321/');
await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
await p.focus('[data-hero]'); await p.keyboard.press('Space');
const d = await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; const r = document.querySelector('[data-hero-map]').getBoundingClientRect();
  return { W: h.grid.W, H: h.grid.H, hs: Array.from(h.t.heights), labelOf: Array.from(h.t.lakes.labelOf), r: { x: r.x, y: r.y, w: r.width, h: r.height }, minH: h.t.minH, maxH: h.t.maxH, pacing: h.settings.pacing }; });
const h = Float32Array.from(d.hs); const { rank } = myOrder(h);
const { finite } = bruteH0(h, d.W, d.H);
const big = finite.filter((f) => f.death - f.birth > 30 && d.labelOf[f.birthCell] > 0).sort((a, b) => (b.death - b.birth) - (a.death - a.birth)).slice(0, 4);
let fails = 0;
for (const bar of big) {
  const cell = bar.birthCell; const gx = cell % d.W, gy = Math.floor(cell / d.W);
  await p.mouse.move(d.r.x + (gx + 0.5) * d.r.w / d.W, d.r.y + (gy + 0.5) * d.r.h / d.H);
  for (const lv of [bar.birth + 0.3 * (bar.death - bar.birth), bar.death + 1]) {
    const prog = (lv - d.minH) / (d.maxH - d.minH);
    await p.evaluate((q) => document.querySelector('[data-hero]').__hero.scrubTo(q), prog);
    await p.waitForTimeout(80);
    const level = await p.evaluate(() => document.querySelector('[data-hero]').__hero.level());
    const { lab } = componentsAt(h, d.W, d.H, level, rank);
    const want = lab[cell] < 0 ? `Height ${Math.round(h[cell])} m · dry land` : `Height ${Math.round(h[cell])} m · Lake ${d.labelOf[lab[cell]]}`;
    const shown = await p.evaluate(() => document.querySelector('[data-hero-readout]').textContent.trim());
    const ok = shown === want; if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} lake ${d.labelOf[cell]} (survivor ${d.labelOf[bar.survivor] ?? '?'}) level ${Math.round(level)}: "${shown}" vs "${want}"`);
  }
}
console.log('FAILS', fails, 'pacing', d.pacing);
await b.close();
