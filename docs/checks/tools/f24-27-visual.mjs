// F24–F27 checker: visual matrix (viewport shots), axe in both themes, reduced motion, no-JS.
// Usage: node docs/checks/tools/f24-27-visual.mjs   (preview on :4321)
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const B = 'http://localhost:4321';
const D = 'docs/checks/F25/attempt-1/visual'; mkdirSync(D, { recursive: true });
const browser = await chromium.launch();
const errors = []; const axe = {}; const overflow = {};
const pages = { home: '/', rw: '/rising-water/', garden: '/garden/' };
for (const theme of ['light', 'dark']) {
  for (const w of [320, 375, 768, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 812 : 800 }, colorScheme: theme, hasTouch: w < 800, isMobile: w < 500 });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${theme}/${w} ${p.url()}: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`${theme}/${w} ${p.url()}: ${e.message}`));
    for (const [k, path] of Object.entries(pages)) {
      await p.goto(B + path);
      if (k === 'rw') await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 25000 });
      if (k === 'home') await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
      await p.waitForTimeout(700);
      overflow[`${k}-${w}-${theme}`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await p.screenshot({ path: `${D}/${k}-${w}-${theme}.png` });
      if (k === 'rw') { await p.locator('[data-ex-stage]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${D}/${k}-map-${w}-${theme}.png` }); }
      if (w === 1280 || w === 375) {
        const r = await new AxeBuilder({ page: p }).analyze();
        axe[`${k}-${w}-${theme}`] = r.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`);
      }
    }
    if (w === 1280) { // settings drawer open at wide width
      await p.goto(B + '/'); await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
      await p.locator('header button[aria-controls="settings-panel"]').click(); await p.waitForTimeout(500);
      await p.screenshot({ path: `${D}/home-drawer-${w}-${theme}.png` });
      const r = await new AxeBuilder({ page: p }).analyze(); axe[`home-drawer-${w}-${theme}`] = r.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`);
    }
    if (w === 375) { // narrow sheet open + axe
      await p.goto(B + '/'); await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
      await p.locator('.hero__toolbar button[aria-controls="settings-panel"]').click(); await p.waitForTimeout(500);
      await p.screenshot({ path: `${D}/home-sheet-${w}-${theme}.png` });
      const r = await new AxeBuilder({ page: p }).analyze(); axe[`home-sheet-${w}-${theme}`] = r.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`);
    }
    await ctx.close();
  }
}
// no-JS and reduced motion
for (const [name, opts] of [['nojs', { javaScriptEnabled: false }], ['reduced', { reducedMotion: 'reduce' }]]) {
  for (const w of [375, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 812 }, ...opts });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}/${w} ${p.url()}: ${m.text()}`); });
    for (const [k, path] of Object.entries(pages)) {
      await p.goto(B + path); await p.waitForTimeout(name === 'reduced' && k === 'rw' ? 2500 : 600);
      overflow[`${k}-${w}-${name}`] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await p.screenshot({ path: `${D}/${k}-${w}-${name}.png` });
      if (k === 'rw' && name === 'nojs') { await p.locator('[data-ex-stage]').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${k}-map-${w}-${name}.png` }); }
    }
    await ctx.close();
  }
}
writeFileSync(`${D}/../visual-axe.json`, JSON.stringify({ axe, overflow, errors }, null, 1));
console.log(JSON.stringify({ axe, overflowNonZero: Object.fromEntries(Object.entries(overflow).filter(([, v]) => v > 0)), errors }, null, 1));
await browser.close();
