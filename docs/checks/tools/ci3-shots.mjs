// CI3 checker: screenshots (320/375 × light/dark × mask on/off, plus DejaVu-forced), late-font
// relayout check (Plex woff2 delayed 2.5 s, labels on before it lands), CLS + GNIS attribution.
// Usage: preview on :4321, DEJAVU=/path/DejaVuSans-Bold.ttf node docs/checks/tools/ci3-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = 'docs/checks/CI3/attempt-1';
mkdirSync(OUT, { recursive: true });
const dj = readFileSync(process.env.DEJAVU).toString('base64');
const djCss = `@font-face{font-family:'CKDejaVu';font-weight:600;src:url(data:font/ttf;base64,${dj}) format('truetype')}[data-ex-place-layer] text{font-family:'CKDejaVu' !important}`;
const browser = await chromium.launch();

async function open(width, colorScheme, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 812 }, colorScheme });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  if (opts.delayPlex)
    await page.route(/ibm-plex-sans-latin-600-normal.*\.woff2$/, async (r) => {
      await new Promise((res) => setTimeout(res, opts.delayPlex));
      await r.continue();
    });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/rising-water/`, { waitUntil: opts.delayPlex ? 'commit' : 'load' });
  await page.locator('[data-explorer]').waitFor();
  return { ctx, page, errors };
}

const lines = [];
for (const width of [320, 375])
  for (const colorScheme of ['light', 'dark'])
    for (const mask of [true, false])
      for (const font of ['plex', ...(colorScheme === 'light' && mask ? ['dejavu'] : [])]) {
        const { ctx, page, errors } = await open(width, colorScheme);
        if (font === 'dejavu') await page.addStyleTag({ content: djCss });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(800);
        const box = page.getByRole('checkbox', { name: 'Basin mask' });
        if (mask) await box.check();
        else await box.uncheck();
        await page.getByRole('checkbox', { name: 'Place labels' }).check();
        if (font === 'dejavu') {
          await page.getByRole('checkbox', { name: 'Place labels' }).uncheck();
          await page.getByRole('checkbox', { name: 'Place labels' }).check();
        }
        await page.waitForTimeout(600);
        const map = page.locator('[data-ex-place-layer]');
        const file = `${OUT}/labels-${width}-${colorScheme}-${mask ? 'mask' : 'nomask'}-${font}.png`;
        await map.screenshot({ path: file });
        const info = await page.evaluate(() => ({
          cls: window.__cls,
          status: document.querySelector('[data-ex-place-status]')?.textContent,
          overflowX: document.documentElement.scrollWidth > innerWidth,
        }));
        lines.push(`${file} cls=${info.cls.toFixed(4)} overflowX=${info.overflowX} errors=${errors.length} | ${info.status}`);
        await ctx.close();
      }

// Late webfont: labels enabled while Plex 600 is still loading.
for (const width of [320, 375]) {
  const { ctx, page, errors } = await open(width, 'light', { delayPlex: 2500 });
  await page.getByRole('checkbox', { name: 'Place labels' }).check({ timeout: 15000 });
  const early = await page.evaluate(() => ({
    loaded: document.fonts.check("600 11px 'IBM Plex Sans'"),
    sum: [...document.querySelectorAll('[data-place-placards] [data-place-id][data-placed] rect')].reduce((s, r) => s + +r.getAttribute('width'), 0),
  }));
  await page.waitForFunction(() => document.fonts.check("600 11px 'IBM Plex Sans'"), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const late = await page.evaluate(() => {
    const g = [...document.querySelectorAll('[data-place-placards] [data-place-id]')];
    const placed = g.filter((x) => x.hasAttribute('data-placed'));
    const stale = placed.filter((x) => Math.abs(+x.querySelector('rect').getAttribute('width') - (Math.ceil(x.querySelector('text').getComputedTextLength()) + 8)) > 0.01).length;
    return {
      placed: placed.length,
      p1: placed.filter((x) => x.dataset.priority === '1').length,
      stale,
      sum: placed.reduce((s, x) => s + +x.querySelector('rect').getAttribute('width'), 0),
      cls: window.__cls,
    };
  });
  lines.push(`late-font ${width}: before load loaded=${early.loaded} sumW=${early.sum}; after: ${JSON.stringify(late)} errors=${errors.length}`);
  await ctx.close();
}

// GNIS attribution + About-the-data list.
{
  const { ctx, page } = await open(375, 'light');
  const t = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      gnis: /GNIS|Geographic Names Information System/.test(txt),
      links: [...document.querySelectorAll('a')].filter((a) => /GNIS|geonames|usgs/i.test(a.textContent + a.href)).map((a) => `${a.textContent.trim()} -> ${a.href}`),
      credit: [...document.querySelectorAll('*')].map((e) => e.childNodes).flatMap((n) => [...n]).filter((n) => n.nodeType === 3 && /Geographic Names/.test(n.textContent)).map((n) => n.textContent.trim()).slice(0, 3),
    };
  });
  lines.push(`attribution: ${JSON.stringify(t)}`);
  await ctx.close();
}
await browser.close();
console.log(lines.join('\n'));
