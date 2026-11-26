// F9 attempt 4: full visual sweep — every route × 375/768/1280 × light/dark, full-page PNGs,
// plus per-shot geometry/console/network facts. Needs preview on :4321. Checker-owned.
// Run: node docs/checks/tools/f9a4-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = 'http://localhost:4321';
const feature = process.argv[2];
const OUT = `docs/checks/${feature}/attempt-2`;
mkdirSync(OUT, { recursive: true });
const allRoutes = [
  ['home', '/'], ['garden', '/garden/'], ['research', '/research/'],
  ['research-water-quality', '/research/water-quality/'], ['research-number-theory', '/research/number-theory/'],
  ['research-spectral-fractals', '/research/spectral-fractals/'], ['rising-water', '/rising-water/'],
  ['cv', '/cv/'], ['about', '/about/'],
];
const routes = allRoutes.filter(([name]) => feature === 'F19a' ? name !== 'rising-water' : ['home','rising-water'].includes(name));
const widths = [[375, 812], [768, 1024], [1280, 800]];
const b = await chromium.launch();
const facts = [];
for (const [name, path] of routes)
  for (const [w, hgt] of widths)
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: { width: w, height: hgt }, colorScheme: scheme });
      const p = await ctx.newPage();
      const errors = [], third = [], failed = [];
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) third.push(r.url()); });
      p.on('requestfailed', (r) => failed.push(r.url()));
      const resp = await p.goto(BASE + path + (name === "home" ? "?seed=42" : ""), { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      if (name === 'home') {
        await p.waitForFunction(() => document.querySelector('[data-hero]')?.__hero);
        await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; h.setPlaying(false); if (Number.isFinite(h.startAt)) h.scrubTo(h.startAt); });
        await p.waitForTimeout(250);
      }
      if (name === 'rising-water') await p.waitForTimeout(300);
      const f = await p.evaluate(() => {
        const de = document.documentElement;
        const canv = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.getBoundingClientRect().width > 0).map((c) => {
          try {
            const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return { w: c.width, note: 'no2d' };
            const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, k = 0;
            for (let i = 0; i < d.length; i += 4 * 37) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; k++; }
            return { w: c.width, h: c.height, variance: Math.round(s2 / k - (s / k) ** 2) };
          } catch (e) { return { err: String(e) }; }
        });
        // elements whose content is clipped horizontally
        const clipped = [...document.querySelectorAll('body *')].filter((el) => {
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (el.closest('.sr-only, .visually-hidden, [data-sr]')) return false;
          const r = el.getBoundingClientRect(); if (r.width === 0) return false;
          return (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 20;
        }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`).slice(0, 8);
        const outside = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, .skip-link, [hidden]'); }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`).slice(0, 8);
        return {
          theme: de.dataset.theme ?? de.getAttribute('data-theme') ?? '', overflowX: de.scrollWidth > innerWidth, scrollW: de.scrollWidth,
          fonts: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => `${x.family} ${x.weight}`).sort(),
          canvases: canv, clipped, outside, title: document.title, height: de.scrollHeight,
        };
      });
      const dir = OUT;
      mkdirSync(dir,{recursive:true});
      const file = `${dir}/${name}-${w}-${scheme}.png`;
      await p.screenshot({ path: file, fullPage: true });
      facts.push({ name, path, w, scheme, status: resp?.status(), errors, third, failed, ...f, file });
      await ctx.close();
    }
writeFileSync(`${OUT}/pages.json`, JSON.stringify(facts, null, 1));
for (const x of facts) console.log(x.name, x.w, x.scheme, x.status, 'theme=' + x.theme, 'ovf=' + x.overflowX, 'err=' + x.errors.length, '3p=' + x.third.length, 'fail=' + x.failed.length, 'canv=' + JSON.stringify(x.canvases.map((c) => c.variance)), 'clip=' + x.clipped.join(','), 'out=' + x.outside.join(','));
await b.close();
