// User-like flow: real mouse clicks at the link's coordinates, no Playwright auto-scroll.
import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Desktop Chrome'] });
const p = await ctx.newPage();
await p.setViewportSize({ width: 1280, height: 800 });
await p.goto('http://localhost:4321/');
for (const id of ['mission','work','research','open-science']) {
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(100);
  const bb = await p.locator(`nav[aria-label="Main"] a[href="/#${id}"]`).boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.waitForTimeout(1500);
  const r = await p.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return { y: Math.round(scrollY), top: Math.round(e.top), bottom: Math.round(e.bottom), vh: innerHeight, hash: location.hash }; }, id);
  console.log(id, JSON.stringify(r), r.top < r.vh && r.bottom > 0 ? 'IN VIEW' : 'OUT');
}
// Fast sequence, like the test but with mouse clicks while the previous smooth scroll is running
await p.goto('http://localhost:4321/');
for (const id of ['mission','work','research','open-science']) {
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const bb = await p.locator(`nav[aria-label="Main"] a[href="/#${id}"]`).boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.waitForTimeout(250);
}
await p.waitForTimeout(1500);
console.log('fast seq final', await p.evaluate(() => [scrollY, location.hash, Math.round(document.getElementById('open-science').getBoundingClientRect().top)]));
await b.close();
