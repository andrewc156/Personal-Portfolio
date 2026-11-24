// F6 attempt-2: why are bottom-row corner cells reported hidden at 1280×800 by f6_cornercount?
// Hit-test and real-mouse hover each bottom-row cell (y = 413) near both corners, plus top row.
import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w, hh] of [[1280, 800], [1280, 1000], [768, 1024], [375, 812]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: hh } })).newPage();
  await p.goto('http://localhost:4321/rising-water/');
  await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
  await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
  const out = [];
  for (const [x, y] of [[0, 0], [325, 0], [0, 413], [4, 413], [8, 413], [325, 413], [321, 413], [0, 412], [325, 412]]) {
    const info = await p.evaluate(([x, y]) => {
      const m = document.querySelector('[data-ex-map]');
      m.scrollIntoView({ block: y < 10 ? 'start' : 'end', behavior: 'instant' });
      const r = m.getBoundingClientRect();
      // cell centre in my own geometry: 326 cols over r.width, 414 rows over r.height (uniform cells)
      const px = r.left + ((x + 0.5) / 326) * r.width, py = r.top + ((y + 0.5) / 414) * r.height;
      const el = document.elementFromPoint(px, py);
      return { px, py, rect: [r.top, r.bottom, r.height], vh: innerHeight, scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight, el: el ? el.className : null };
    }, [x, y]);
    await p.mouse.move(info.px, info.py);
    await p.waitForTimeout(60);
    const hov = await p.evaluate(() => document.querySelector('[data-ex-hover]').textContent.trim());
    out.push(`(${x},${y}) pt ${info.px.toFixed(1)},${info.py.toFixed(1)} rect ${info.rect.map((v) => v.toFixed(1)).join('/')} vh ${info.vh} el ${info.el} | ${hov}`);
  }
  console.log(`${w}×${hh}\n  ` + out.join('\n  '));
}
await b.close();
