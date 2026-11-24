import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4321/rising-water/');
await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
console.log(await p.evaluate(() => {
  const q = (s) => { const r = document.querySelector(s).getBoundingClientRect(); const cs = getComputedStyle(document.querySelector(s)); return `${s}: ${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)} pad ${cs.padding} border ${cs.borderWidth} pos ${cs.position} inset ${cs.inset}`; };
  const m = document.querySelector('[data-ex-map]').getBoundingClientRect();
  const pts = [[m.left + 1, m.top + 1], [m.left + 3, m.top + 3], [m.left + 6, m.top + 6], [m.right - 1, m.top + 1], [m.right - 6, m.bottom - 6]];
  return [q('.ex-stage'), q('.ex-map'), q('.ex-map__shade'), q('[data-ex-map]'), ...pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)} -> ` + document.elementsFromPoint(x, y).slice(0, 3).map((e) => e.className || e.tagName).join(' > '))].join('\n');
}));
await b.close();
