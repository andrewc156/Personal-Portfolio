// F25 attempt-2 checker: what happens if the visitor presses Tab DURING the smooth Back restore
// (before focus is reconciled)? Informational only. Usage: node docs/checks/tools/f25-a2-qa11-earlytab.mjs [base]
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const settle = (p) => p.evaluate(() => new Promise((res) => { let l = scrollY, s = 0; const t = () => { s = scrollY === l ? s + 1 : 0; l = scrollY; s >= 12 ? res() : requestAnimationFrame(t); }; requestAnimationFrame(t); }));
const browser = await chromium.launch();
for (const delay of [100, 300, 600]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  await p.goto(B + '/');
  await p.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Research', exact: true }).focus();
  await p.keyboard.press('Enter'); await settle(p);
  await p.keyboard.press('Tab'); await settle(p);
  await p.evaluate(() => history.back());
  await p.waitForTimeout(delay);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(1500); await settle(p);
  const r = await p.evaluate(() => { const a = document.activeElement; return { url: location.pathname + location.hash, y: Math.round(scrollY), focus: (a.textContent || a.tagName).trim().slice(0, 30), top: Math.round(a.getBoundingClientRect().top) }; });
  console.log(`Tab ${delay} ms after Back:`, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
