// CI3 checker: load /rising-water/ from preview (:4321) with the built dist/_headers CSP injected on
// the document, toggle place labels (light/dark, 320/375/1280), collect CSP violations, console
// errors, and all request origins/font files.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const csp = readFileSync('dist/_headers', 'utf8').match(/Content-Security-Policy: (.*)/)[1].replace(/; upgrade-insecure-requests/, '');
const b = await chromium.launch();
for (const width of [320, 375, 1280]) for (const colorScheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width, height: 800 }, colorScheme });
  const p = await ctx.newPage();
  const msgs = [], origins = new Set(), fonts = [];
  p.on('console', (m) => m.type() === 'error' && msgs.push(m.text()));
  p.on('pageerror', (e) => msgs.push(String(e)));
  p.on('request', (r) => { origins.add(new URL(r.url()).origin); if (r.resourceType() === 'font') fonts.push(r.url().split('/').pop()); });
  await p.route('**/rising-water/', async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } }); });
  await p.addInitScript(() => { window.__v = []; document.addEventListener('securitypolicyviolation', (e) => window.__v.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await p.goto('http://localhost:4321/rising-water/');
  await p.locator('[data-explorer]').waitFor();
  await p.getByRole('checkbox', { name: 'Place labels' }).check();
  await p.waitForTimeout(800);
  const st = await p.evaluate(() => ({ v: window.__v, status: document.querySelector('[data-ex-place-status]').textContent, ff: getComputedStyle(document.querySelector('[data-place-placards] text')).fontFamily }));
  console.log(JSON.stringify({ width, colorScheme, violations: st.v, errors: msgs, origins: [...origins], fonts, status: st.status, fontFamily: st.ff }));
  await ctx.close();
}
await b.close();
