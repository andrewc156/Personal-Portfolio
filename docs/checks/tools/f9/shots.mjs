// F9 checker: full visual review. Every page × 3 widths × 2 themes (viewport + full-page),
// plus key states. Needs a server on BASE (default preview on 4321). Output → docs/checks/F9/attempt-1/.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:4321';
const D = new URL('../../F9/attempt-1/', import.meta.url).pathname;
fs.mkdirSync(D, { recursive: true });
const pages = [
  ['home', '/'], ['garden', '/garden/'], ['research', '/research/'],
  ['rs-water-quality', '/research/water-quality/'], ['rs-tda-rivernets', '/research/tda-rivernets/'],
  ['rs-number-theory', '/research/number-theory/'], ['rs-spectral-fractals', '/research/spectral-fractals/'],
  ['cv', '/cv/'], ['about', '/about/'], ['rising-water', '/rising-water/'], ['404', '/no-such-page/'],
];
const sizes = [[375, 812], [768, 1024], [1280, 800]];
const b = await chromium.launch();
const log = [];
const ctx = async (theme, w, h) => b.newContext({ colorScheme: theme, viewport: { width: w, height: h }, ...(w < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
const settle = async (p) => {
  await p.evaluate(() => document.fonts.ready);
  if (await p.$('[data-hero]')) {
    await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
    await p.evaluate(async () => { const h = document.querySelector('[data-hero]').__hero; h.setPlaying?.(false); h.scrubTo(0.5); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  }
  if (await p.$('[data-explorer]')) {
    await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 15000 });
    await p.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; e.setPlaying(false); e.scrubTo(0.4); });
  }
  await p.waitForTimeout(400);
};
for (const theme of ['light', 'dark'])
  for (const [w, h] of sizes) {
    const c = await ctx(theme, w, h);
    for (const [name, url] of pages) {
      const p = await c.newPage(); const errs = [];
      p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      p.on('pageerror', (e) => errs.push(e.message));
      const resp = await p.goto(BASE + url);
      await settle(p);
      const tag = `${name}-${w}-${theme}`;
      await p.screenshot({ path: `${D}${tag}.png` });
      await p.screenshot({ path: `${D}${tag}-full.png`, fullPage: true });
      const m = await p.evaluate(() => {
        const de = document.documentElement;
        // clipped text: elements whose content overflows horizontally with overflow hidden
        const clipped = [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'visible' && s.display !== 'inline' && !e.closest('.visually-hidden') && e.clientWidth > 0; }).map((e) => `${e.tagName}.${e.className}`.slice(0, 60));
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`);
        return { sw: de.scrollWidth, cw: de.clientWidth, clipped, fonts: fonts.length, theme: getComputedStyle(de).colorScheme };
      });
      log.push(`${tag}: status ${resp.status()} overflowX ${m.sw - m.cw} fontsLoaded ${m.fonts} clipped [${m.clipped.join(', ')}] errors ${errs.length}${errs.length ? ' ' + errs.join(' | ') : ''}`);
      await p.close();
    }
    // key states
    const p = await c.newPage(); const errs = []; p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto(BASE + '/'); await settle(p);
    const tag = `${w}-${theme}`;
    // hero bar highlight
    await p.evaluate(async () => { const h = document.querySelector('[data-hero]').__hero; h.scrubTo(0.7); const k = h.drawnRows.findIndex((r) => Number.isFinite(r.death) && r.death <= h.level()); h.highlightRow(Math.max(0, k)); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${D}state-hero-highlight-${tag}.png` });
    // hero diagram view via settings panel
    await p.getByRole('button', { name: 'Art settings', exact: true }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}state-settings-open-${tag}.png` });
    await p.selectOption('#hero-view', { index: 1 }); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const focusOk = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await p.screenshot({ path: `${D}state-hero-diagram-${tag}.png` });
    await p.close();
    const q = await c.newPage(); q.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await q.goto(BASE + '/rising-water/'); await settle(q);
    // explorer: click lake 3 row's Show button (same as clicking its bar), then screenshot card
    await q.getByRole('button', { name: 'Show lake 3 on the map' }).click(); await q.waitForTimeout(400);
    const card = await q.evaluate(() => [document.querySelector('[data-explorer]').dataset.selected, document.querySelector('[data-ex-card], .ex-card')?.textContent.replace(/\s+/g, ' ').trim()]);
    await q.evaluate(() => window.scrollTo(0, document.querySelector('[data-explorer]').getBoundingClientRect().top + scrollY - 10)); await q.waitForTimeout(250);
    await q.screenshot({ path: `${D}state-explorer-card-${tag}.png` });
    await q.click('[data-ex-view="diagram"]'); await q.waitForTimeout(300);
    await q.evaluate(() => document.querySelector('.ex-strip')?.scrollIntoView({ block: 'center', behavior: 'instant' })); await q.waitForTimeout(200);
    await q.screenshot({ path: `${D}state-explorer-diagram-${tag}.png` });
    log.push(`states ${tag}: focus after Esc → ${focusOk}; explorer selected ${card[0]} card "${card[1]}"; errors ${errs.length}`);
    await c.close();
  }
fs.writeFileSync(`${D}shots-log.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
await b.close();
