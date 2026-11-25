// F9 attempt 4: stretch-feature screenshots — hero modes (F10), islands view (F11b), settings
// panel/toolbar (F14), explorer basin mask + place labels (F12b/F13b) and a selected lake.
// Needs preview on :4321. Checker-owned. Run: node docs/checks/tools/f9a4-stretch-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = 'http://localhost:4321';
const OUT = 'docs/checks/F9/attempt-4/stretch';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const log = [];
for (const [w, h] of [[375, 812], [1280, 800]])
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    for (const mode of ['dye', 'pond', 'rivers', 'collatz']) {
      await p.goto(`${BASE}/?seed=42&mode=${mode}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `${OUT}/hero-${mode}-${w}-${scheme}.png` });
    }
    // islands view via settings panel
    await p.goto(`${BASE}/?seed=42`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Animation settings' }).click();
    await p.waitForTimeout(400);
    await p.selectOption('#hero-view', 'islands');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/hero-islands-panel-${w}-${scheme}.png` });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/hero-islands-${w}-${scheme}.png` });
    const focusOk = await p.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute('aria-label'));
    // explorer with mask + labels and a selected lake
    await p.goto(`${BASE}/rising-water/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);
    await p.getByRole('checkbox', { name: 'Basin mask' }).check();
    await p.getByRole('checkbox', { name: 'Place labels' }).check();
    await p.getByRole('button', { name: /Show/ }).nth(3).click();
    await p.waitForTimeout(1200);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: `${OUT}/explorer-mask-labels-${w}-${scheme}.png`, fullPage: false });
    await p.locator('[data-explorer]').screenshot({ path: `${OUT}/explorer-panel-${w}-${scheme}.png` });
    const card = await p.evaluate(() => document.querySelector('[data-ex-card], .card, [data-explorer] [aria-live]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300));
    log.push({ w, scheme, errs, focusAfterEsc: focusOk, card });
    await ctx.close();
  }
writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
await b.close();
