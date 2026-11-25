// F19b self-check screenshots (builder-owned). Usage: node docs/builds/F19b/shots.mjs <tag> [port]
// Captures the home page's first viewport at 375 and 1280, light and dark, with and without
// reduced motion, plus a frame 3 s into play. PNGs land next to this file (gitignored).
import { chromium } from '@playwright/test';

const tag = process.argv[2] ?? 'shot';
const port = process.argv[3] ?? '4418';
const base = `http://localhost:${port}`;
const out = new URL('.', import.meta.url).pathname;
const b = await chromium.launch();
const log = [];
for (const width of [375, 1280]) {
  for (const scheme of ['light', 'dark']) {
    for (const rm of ['no-preference', 'reduce']) {
      const ctx = await b.newContext({
        viewport: { width, height: width < 600 ? 812 : 800 },
        colorScheme: scheme,
        reducedMotion: rm,
        deviceScaleFactor: 1,
      });
      const p = await ctx.newPage();
      await p.goto(`${base}/?seed=42`, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
      // First frame: freeze the animation where it started.
      const info = await p.evaluate(() => {
        const h = document.querySelector('[data-hero]').__hero;
        h.setPlaying(false);
        return { progress: h.progress, level: Math.round(h.level()), lakes: h.lakeCount };
      });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(250);
      const name = `${tag}-${width}-${scheme}${rm === 'reduce' ? '-rm' : ''}.png`;
      await p.screenshot({ path: out + name });
      const boxes = await p.evaluate(() => {
        const r = (s) => {
          const e = document.querySelector(s);
          if (!e) return null;
          const b = e.getBoundingClientRect();
          return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
        };
        return {
          text: r('.hero__text'),
          toolbar: r('.hero__toolbar'),
          map: r('.hero__map'),
          strip: r('.hero__strip'),
          bar: r('.hero__bar'),
          caption: r('.hero__caption'),
        };
      });
      log.push({ name, ...info, boxes });
      await ctx.close();
    }
  }
}
// A frame mid-play at 1280 light (what a visitor sees after a few seconds).
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${base}/?seed=42`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.waitForTimeout(3000);
  const info = await p.evaluate(() => {
    const h = document.querySelector('[data-hero]').__hero;
    h.setPlaying(false);
    return { progress: h.progress, level: Math.round(h.level()), lakes: h.lakeCount };
  });
  await p.screenshot({ path: out + `${tag}-1280-light-3s.png` });
  log.push({ name: `${tag}-1280-light-3s.png`, ...info });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(log, null, 1));
