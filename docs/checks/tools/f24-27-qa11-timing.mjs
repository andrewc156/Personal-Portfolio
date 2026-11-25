// F25 checker: instrument QA-11 same-document Back timing (scrollY at popstate and after rAFs).
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const waitAfterEnter = Number(process.argv[3] ?? 1200);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
await p.addInitScript(() => {
  window.__log = [];
  addEventListener('popstate', () => {
    const t0 = performance.now();
    window.__log.push(['popstate', Math.round(scrollY), document.activeElement?.tagName]);
    let n = 0;
    const f = () => { window.__log.push([`raf${n}`, Math.round(scrollY), document.activeElement?.tagName, Math.round(performance.now() - t0)]); if (++n < 8) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, true);
  addEventListener('scroll', () => window.__log.push(['scroll', Math.round(scrollY)]), { passive: true });
});
await p.goto(B + '/');
console.log('scroll-behavior:', await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'scrollRestoration:', await p.evaluate(() => history.scrollRestoration));
await p.locator('header a[href$="#research"]').first().focus();
await p.keyboard.press('Enter'); await p.waitForTimeout(waitAfterEnter);
await p.keyboard.press('Tab'); await p.waitForTimeout(300);
await p.evaluate(() => { window.__log = []; });
await p.evaluate(() => history.back()); await p.waitForTimeout(1500);
const log = await p.evaluate(() => window.__log.filter((e, i, a) => e[0] !== 'scroll' || i === 0 || a[i - 1][0] !== 'scroll' || i === a.length - 1));
console.log(`waitAfterEnter=${waitAfterEnter}`, JSON.stringify(log));
console.log('final', await p.evaluate(() => [Math.round(scrollY), document.activeElement?.tagName, document.activeElement?.textContent.trim().slice(0, 20)]));
await browser.close();
