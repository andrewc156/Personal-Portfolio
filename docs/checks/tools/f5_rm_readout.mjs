// F5 checker: visible readout text in the reduced-motion static frame (no interaction).
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const opts of [{ reducedMotion: 'reduce' }, { reducedMotion: 'reduce', viewport: { width: 375, height: 812 }, isMobile: true }]) {
  const c = await b.newContext(opts); const p = await c.newPage();
  await p.goto('http://localhost:4321/?seed=42');
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.waitForTimeout(2000);
  console.log(JSON.stringify(opts), 'readout after 2 s:', JSON.stringify(await p.locator('[data-hero-readout]').textContent()), 'summary:', await p.locator('[data-hero-summary]').textContent());
  await c.close();
}
await b.close();
