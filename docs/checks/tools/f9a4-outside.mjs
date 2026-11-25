// F9 attempt 4: what sits outside the viewport at 375/768 (nav items, lakes table)? Checker-owned.
import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w, path] of [[375, '/'], [375, '/rising-water/'], [768, '/rising-water/']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 812 } })).newPage();
  await p.goto('http://localhost:4321' + path, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 6).map((el) => {
    let a = el, scroller = null; while ((a = a.parentElement)) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = `${a.tagName}.${a.className} ${o} cw=${a.clientWidth} sw=${a.scrollWidth}`; break; } }
    const rr = el.getBoundingClientRect();
    return { el: `${el.tagName}.${el.className} "${(el.textContent || '').trim().slice(0, 20)}"`, left: Math.round(rr.left), right: Math.round(rr.right), vis: getComputedStyle(el).visibility, scroller };
  }));
  console.log(w, path, JSON.stringify(r, null, 1));
}
await b.close();
