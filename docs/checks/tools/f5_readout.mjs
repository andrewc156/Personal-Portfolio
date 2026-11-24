// F5 checker: is the visible readout correct once scrubbing stops? (key repeat ~33 ms, mouse drag)
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4321/?seed=42');
await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
const truth = () => p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; h.t.flood.advanceTo(h.level()); return { expect: `Level ${Math.round(h.level())} m · ${h.t.flood.alive() === 1 ? '1 lake' : h.t.flood.alive() + ' lakes'}`, shown: document.querySelector('[data-hero-readout]').textContent, strip: Math.round(h.level()) + ' m (strip label)' }; });
await p.focus('[data-hero]');
await p.keyboard.press('Space'); // pause
await p.keyboard.press('End');
let stale = 0;
for (let trial = 0; trial < 6; trial++) {
  const n = 3 + trial * 2;
  for (let i = 0; i < n; i++) { await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(33); }
  await p.waitForTimeout(1000);
  const t = await truth();
  if (t.expect !== t.shown) stale++;
  console.log(`hero ←×${n} (33 ms apart), 1 s later: readout "${t.shown}" vs truth "${t.expect}"`);
}
// mouse drag on level slider
await p.getByRole('button', { name: 'Art settings', exact: true }).click();
await p.waitForTimeout(400);
const bb = await p.locator('#hero-level').boundingBox();
for (const [from, to] of [[0.9, 0.3], [0.2, 0.75], [0.8, 0.55]]) {
  await p.mouse.move(bb.x + bb.width * from, bb.y + bb.height / 2);
  await p.mouse.down();
  for (let k = 1; k <= 20; k++) { await p.mouse.move(bb.x + bb.width * (from + ((to - from) * k) / 20), bb.y + bb.height / 2); await p.waitForTimeout(16); }
  await p.mouse.up();
  await p.waitForTimeout(1000);
  const t = await truth();
  if (t.expect !== t.shown) stale++;
  console.log(`slider drag ${from}→${to}, 1 s later: readout "${t.shown}" vs truth "${t.expect}"`);
}
console.log(`stale readouts: ${stale}/9`);
await b.close();
