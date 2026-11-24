// F6 attempt-2: what element does f6_cornercount's point for bottom-row cells hit at 1280?
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await p.goto('http://localhost:4321/rising-water/');
await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
console.log(await p.evaluate(() => {
  const m = document.querySelector('[data-ex-map]'); m.scrollIntoView({ block: 'end', behavior: 'instant' });
  const r = m.getBoundingClientRect(); const out = [];
  for (const x of [0, 8, 325]) { const y = 413;
    const fx = (Math.min(30 * x + 15, (30 * x + 9769) / 2)) / 9769, fy = (Math.min(30 * y + 15, (30 * y + 12408) / 2)) / 12408;
    const px = r.left + fx * r.width, py = r.top + fy * r.height; const el = document.elementFromPoint(px, py);
    out.push({ x, px, py, rTop: r.top, rBot: r.bottom, vh: innerHeight, el: el && (el.tagName + '.' + el.className), parent: el && el.parentElement && el.parentElement.className, cs: el && getComputedStyle(el).position });
  }
  return JSON.stringify(out, null, 1);
}));
await b.close();
