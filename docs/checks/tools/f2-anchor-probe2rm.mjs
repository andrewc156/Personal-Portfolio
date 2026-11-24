// Mimics e2e/shell.spec.ts:150 step by step and logs scrollY over time.
import { chromium, devices } from 'playwright';
import { expect } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Desktop Chrome'], reducedMotion: process.env.RM || 'no-preference' });
const p = await ctx.newPage();
await p.setViewportSize({ width: 1280, height: 800 });
await p.goto('http://localhost:4321/');
await p.evaluate(() => { window.__s = []; const t0 = performance.now(); const f = () => { window.__s.push([Math.round(performance.now()-t0), Math.round(scrollY)]); requestAnimationFrame(f); }; f(); });
for (const id of ['mission','work','research','open-science']) {
  await p.evaluate((id) => window.__s.push(['click', id]), id);
  await p.locator(`nav[aria-label="Main"] a[href="/#${id}"]`).click();
  await expect(p).toHaveURL(new RegExp(`#${id}$`));
  try { await expect(p.locator(`#${id}`)).toBeInViewport({ timeout: 3000 }); console.log(id, 'in viewport'); } catch { console.log(id, 'NOT in viewport'); }
}
const s = await p.evaluate(() => window.__s);
let last = null; for (const x of s) { const k = JSON.stringify(x[1]); if (k !== last) { console.log(x.join(' ')); last = k; } }
const hdr = await p.evaluate(() => getComputedStyle(document.querySelector('header')).position);
console.log('header position', hdr);
await b.close();
