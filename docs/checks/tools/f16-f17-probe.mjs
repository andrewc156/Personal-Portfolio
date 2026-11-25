// Checker throwaway probe (F16/F17 attempt 1): screenshots + nav/CLS/keyboard measurements.
// Usage: preview running on :4321; node docs/checks/tools/f16-f17-probe.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const D16 = 'docs/checks/F16/attempt-1';
const D17 = 'docs/checks/F17/attempt-1';
mkdirSync(D16, { recursive: true });
mkdirSync(D17, { recursive: true });
const sizes = [
  [375, 812],
  [768, 1024],
  [1280, 800],
];
const browser = await chromium.launch();
const res = { header: [], f16: [], keyboard: [], cls: [], order: null, garden: null };

for (const scheme of ['light', 'dark']) {
  for (const [w, h] of [...sizes, [320, 700], [832, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    for (const path of ['/', '/garden/']) {
      await page.goto(BASE + path);
      await page.evaluate(() => document.fonts.ready);
      const slug = path === '/' ? 'home' : 'garden';
      await page.locator('header.site-header').screenshot({ path: `${D17}/header-${slug}-${w}-${scheme}.png` });
      const m = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Main"]');
        const ul = nav.querySelector('ul');
        const links = [...nav.querySelectorAll('a')];
        const tops = new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)));
        return {
          rows: tops.size,
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          navScrollable: ul.scrollWidth > ul.clientWidth,
          current: links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent.trim()),
        };
      });
      res.header.push({ scheme, w, path, ...m });
    }
    await ctx.close();
  }
  // F16 rows
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    for (const path of ['/garden/', '/cv/']) {
      await page.goto(BASE + path);
      await page.evaluate(() => document.fonts.ready);
      const item = page.locator('[data-id="project-personal-portfolio"]');
      const target = path === '/cv/' ? item.locator('xpath=..') : item;
      await target.scrollIntoViewIfNeeded();
      const slug = path.replaceAll('/', '') || 'home';
      await target.screenshot({ path: `${D16}/${slug}-item-${w}-${scheme}.png` });
      // Context screenshot of the project group.
      await page.screenshot({ path: `${D16}/${slug}-viewport-${w}-${scheme}.png` });
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        text: document.querySelector('[data-id="project-personal-portfolio"]').closest('li').innerText,
      }));
      res.f16.push({ scheme, w, path, ...m });
    }
    await ctx.close();
  }
}

// Keyboard reachability at mobile widths, independent of e2e/cls.spec.ts.
for (const w of [320, 375, 412, 768, 832]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.evaluate(() => document.fonts.ready);
  const seen = [];
  await page.locator('a.wordmark').focus();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    seen.push(
      await page.evaluate(() => {
        const a = document.activeElement;
        const ul = a.closest('ul');
        const r = a.getBoundingClientRect();
        const u = ul ? ul.getBoundingClientRect() : { left: 0, right: innerWidth };
        return {
          label: a.textContent.trim(),
          fullyVisible: r.left >= u.left - 0.5 && r.right <= u.right + 0.5 && r.left >= 0 && r.right <= innerWidth,
        };
      }),
    );
  }
  const back = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab');
    back.push(await page.evaluate(() => document.activeElement.textContent.trim()));
  }
  res.keyboard.push({ w, forward: seen, back });
  await ctx.close();
}

// Homepage section DOM order vs nav order.
{
  const page = await browser.newPage();
  await page.goto(BASE + '/');
  res.order = await page.evaluate(() => {
    const nav = [...document.querySelectorAll('nav[aria-label="Main"] a')].map((a) => [
      a.textContent.trim(),
      a.getAttribute('href'),
    ]);
    const sections = [...document.querySelectorAll('main [id]')]
      .map((e) => e.id)
      .filter((id) => nav.some(([, h]) => h === `/#${id}`));
    return { nav, sectionsInDom: sections };
  });
  await page.close();
}

// CLS on /, /garden/, /cv/ at 375 and 1280 (load + 2 s, including font swap).
for (const [w, h] of [
  [375, 812],
  [1280, 800],
]) {
  for (const path of ['/', '/garden/', '/cv/']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    res.cls.push({ w, path, cls: await page.evaluate(() => window.__cls) });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(res, null, 1));
