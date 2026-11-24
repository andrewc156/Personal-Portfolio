// F5 a2 checker: readout fit for the worst-case highlight text at narrow widths (320, 360, 375).
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [320, 360, 375]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 700 }, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://localhost:4321/');
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.evaluate(() => document.querySelector('[data-hero]').__hero.scrubTo(0.8));
  await p.waitForTimeout(100);
  const r = await p.evaluate(() => {
    const el = document.querySelector('[data-hero-readout]'); const bar = document.querySelector('.hero__bar');
    const h0 = bar.getBoundingClientRect().height;
    const real = el.textContent;
    el.textContent = 'Lake 30 · born 1000 m · spills into Lake 29 at 1000 m · persistence 1000 m';
    const fit = { sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, h1: bar.getBoundingClientRect().height };
    el.textContent = real;
    return { h0, ...fit, ovx: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(w, JSON.stringify(r));
}
await b.close();
