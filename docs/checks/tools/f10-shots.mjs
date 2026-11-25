// F10 checker tool: screenshots of / in every hero mode at 375/768/1280 × light/dark,
// plus the settings panel open in an extra mode, and overflow/clip measurements.
// usage: node docs/checks/tools/f10-shots.mjs http://localhost:4321 docs/checks/F10/attempt-1
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const sizes = [
  [375, 812],
  [768, 1024],
  [1280, 800],
];
const report = [];
for (const mode of ['rising', 'dye', 'pond', 'rivers', 'collatz']) {
  for (const [width, height] of sizes) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
      const page = await ctx.newPage();
      await page.goto(`${base}/?seed=42&mode=${mode}`);
      await page.waitForFunction((m) => {
        const r = document.querySelector('[data-hero]');
        return r?.dataset.mode === m && (m === 'rising' ? !!r.__hero : !!r.__heroMode);
      }, mode);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(mode === 'rivers' || mode === 'collatz' ? 2500 : 1200);
      const m = await page.evaluate(() => {
        const ro = document.querySelector('[data-hero-readout]');
        const cap = document.querySelector('.hero__caption');
        return {
          doc: document.documentElement.scrollWidth,
          win: window.innerWidth,
          readout: ro.textContent,
          roClip: ro.scrollWidth > ro.clientWidth || ro.scrollHeight > ro.clientHeight,
          caption: cap.textContent.replace(/\s+/g, ' ').trim(),
          mapLabel: document.querySelector('[data-hero-map]').getAttribute('aria-label'),
          theme: document.documentElement.dataset.theme ?? getComputedStyle(document.documentElement).colorScheme,
        };
      });
      report.push({ mode, width, theme, ...m });
      await page.screenshot({ path: `${out}/${mode}-${width}-${theme}.png` });
      if (mode !== 'rising' && (mode === 'dye' || width !== 768)) {
        await page.getByRole('button', { name: 'Art settings', exact: true }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${out}/${mode}-${width}-${theme}-panel.png` });
        const pm = await page.evaluate(() => {
          const p = document.getElementById('settings-panel');
          return { doc: document.documentElement.scrollWidth, pw: p.scrollWidth, pcw: p.clientWidth };
        });
        report.push({ mode, width, theme, panel: pm });
      }
      await ctx.close();
    }
  }
}
fs.writeFileSync(`${out}/shots-report.json`, JSON.stringify(report, null, 1));
for (const r of report) console.log(JSON.stringify(r));
await browser.close();
