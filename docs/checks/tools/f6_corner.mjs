import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:4321/rising-water/');
await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
for (const [fx, fy, name] of [[15/9769, 15/12408, 'cell0'], [(9750+9.5)/9769, 15/12408, 'cell325'], [(9750+9.5)/9769, (12390+9)/12408, 'cell134963'], [0.5, 0.5, 'mid'], [0.01, 0.01, '1%'], [0.03, 0.03, '3%']]) {
  const r = await p.evaluate(([fx, fy]) => { const m = document.querySelector('[data-ex-map]'); const r = m.getBoundingClientRect(); window.scrollBy({ top: r.top + fy * r.height - 400, behavior: 'instant' }); const r2 = m.getBoundingClientRect();
    const x = r2.left + fx * r2.width, y = r2.top + fy * r2.height; const el = document.elementFromPoint(x, y); return { x, y, el: el && (el.className || el.tagName), radius: getComputedStyle(m.parentElement).borderRadius, ov: getComputedStyle(m.parentElement).overflow }; }, [fx, fy]);
  await p.mouse.move(r.x, r.y); await p.waitForTimeout(60);
  console.log(name, JSON.stringify(r), (await p.textContent('[data-ex-hover]')).slice(0, 70));
}
// pointerdown (tap) at corner via touch emulation-free dispatch
await b.close();
