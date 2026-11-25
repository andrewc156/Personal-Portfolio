// F25 checker: QA-11 same-document Back (/#research -> /) with focus on a Research card link.
// Usage: node docs/checks/tools/f24-27-qa11-samedoc.mjs [base]
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
for (const w of [1024, 1280, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  await p.goto(B + '/');
  await p.locator('header a[href$="#research"]').first().focus();
  await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  const onCard = await p.evaluate(() => ({ text: document.activeElement?.textContent.trim().slice(0, 30), url: location.hash }));
  await p.evaluate(() => history.back()); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { url: location.pathname + location.hash, scrollY: Math.round(scrollY), focus: a.tagName + ':' + (a.textContent || '').trim().slice(0, 25), top: Math.round(r.top) }; });
  await p.keyboard.press('Tab'); await p.waitForTimeout(600);
  const tab = await p.evaluate(() => ({ scrollY: Math.round(scrollY), focus: (document.activeElement?.textContent || '').trim().slice(0, 25) }));
  const ok = after.scrollY === 0 && (after.focus.startsWith('BODY') || (after.top >= 0 && after.top < 800)) && tab.scrollY < 300;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${w}`, JSON.stringify({ onCard, after, tab }));
  await ctx.close();
}
await browser.close();
