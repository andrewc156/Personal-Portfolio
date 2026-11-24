// F5 checker: level slider dragged down (backward) → state vs my BFS; summary after debounce.
import { chromium } from 'playwright';
import { bruteH0, componentsAt } from './f5_brute.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4321/?seed=42');
await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
await p.getByRole('button', { name: 'Art settings', exact: true }).click();
await p.waitForTimeout(400);
const g = await p.evaluate(() => { const t = document.querySelector('[data-hero]').__hero.t; return { W: t.W, H: t.H, h: Array.from(t.heights) }; });
const h = Float32Array.from(g.h); const bf = bruteH0(h, g.W, g.H);
await p.locator('#hero-level').fill('90');
await p.locator('#hero-level').focus();
let bad = 0;
for (const steps of [10, 30, 40, 60, 39]) {
  for (let i = 0; i < steps; i++) await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(450);
  const s = await p.evaluate(async () => { const h = document.querySelector('[data-hero]').__hero; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return { prog: h.progress, level: h.level(), alive: h.t.flood.alive(), comp: Array.from(h.t.painter.comp), slider: document.getElementById('hero-level').value, summary: document.querySelector('[data-hero-summary]').textContent, readout: document.querySelector('[data-hero-readout]').textContent }; });
  const { lab, count } = componentsAt(h, g.W, g.H, s.level, bf.rank);
  const ok = count === s.alive && s.comp.every((c, i) => c === lab[i]);
  if (!ok) bad++;
  console.log(`slider ${s.slider}% prog ${s.prog.toFixed(3)} level ${s.level.toFixed(1)}: alive ${s.alive} vs BFS ${count}, comp match ${ok}\n   readout: ${s.readout}\n   summary: ${s.summary}`);
}
console.log(bad ? 'FAIL ' + bad : 'ALL OK');
await b.close();
