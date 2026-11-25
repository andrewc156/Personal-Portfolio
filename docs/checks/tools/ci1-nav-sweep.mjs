// CI1 checker tool: sweep mobile widths, Tab x6 then Shift+Tab x5 through the header nav,
// record every focus stop where the focused link (optionally +ring) is not fully inside the
// scrolling <ul>. Independent of the builder's test code.
//
// usage: node ci1-nav-sweep.mjs <baseURL> <fontMode: plex|dejavu|verdana> <ring:0|4> [w1,w2,...|from:to:step]
// dejavu mode loads the real DejaVu Sans 2.37 TTFs via @font-face (route-intercepted) and
// forces --font-sans exactly like e2e/cls.spec.ts does.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, mode = 'plex', ringArg = '0', widthsArg = '300:840:4'] = process.argv.slice(2);
const RING = Number(ringArg);
const FONT_DIR = process.env.DEJAVU_DIR;
let widths;
if (widthsArg.includes(':')) {
  const [a, b, s] = widthsArg.split(':').map(Number);
  widths = [];
  for (let w = a; w <= b; w += s) widths.push(w);
} else widths = widthsArg.split(',').map(Number);

const browser = await chromium.launch();
const fails = [];
let stops = 0;
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  if (mode === 'dejavu') {
    await page.route('**/__ci1font/**', (r) =>
      r.fulfill({
        body: fs.readFileSync(`${FONT_DIR}/${r.request().url().split('/').pop()}`),
        contentType: 'font/ttf',
      }),
    );
  }
  await page.goto(base + '/');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  if (mode === 'dejavu') {
    await page.addStyleTag({
      content: `@font-face{font-family:'DejaVu Sans';src:url(/__ci1font/DejaVuSans.ttf);font-weight:400}
@font-face{font-family:'DejaVu Sans';src:url(/__ci1font/DejaVuSans-Bold.ttf);font-weight:600 700}
:root{--font-sans:'DejaVu Sans',sans-serif !important}`,
    });
    await page.evaluate(async () => {
      await document.fonts.load("16px 'DejaVu Sans'");
      await document.fonts.ready;
    });
    const ok = await page.evaluate(() => document.fonts.check("16px 'DejaVu Sans'"));
    if (!ok) throw new Error('DejaVu not loaded');
  } else if (mode === 'verdana') {
    await page.addStyleTag({ content: `:root{--font-sans:Verdana,sans-serif !important}` });
  }
  await page.locator('.wordmark').focus();
  const probe = () =>
    page.evaluate((ring) => {
      const a = document.activeElement;
      const ul = a.closest('ul');
      if (!ul) return { text: a.textContent.trim(), nav: false };
      const b = ul.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      const scrolls = ul.scrollWidth > ul.clientWidth;
      const pad = scrolls ? ring : 0;
      return {
        text: a.textContent.trim(),
        nav: true,
        scrolls,
        sl: ul.scrollLeft,
        clipL: +(b.left - (r.left - pad)).toFixed(2),
        clipR: +(r.right + pad - b.right).toFixed(2),
      };
    }, RING);
  const seq = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    seq.push(['Tab', await probe()]);
  }
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+Tab');
    seq.push(['Shift+Tab', await probe()]);
  }
  const order = seq.map(([, p]) => p.text).join('|');
  const want = 'Mission|Research|Work|Open science|Rising water|CV|Rising water|Open science|Work|Research|Mission';
  if (order !== want) fails.push({ width, order });
  for (const [key, p] of seq) {
    stops++;
    if (!p.nav || p.clipL > 0.5 || p.clipR > 0.5) fails.push({ width, key, ...p });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ base, mode, ring: RING, widths: widths.length, stops, failures: fails.length }));
for (const f of fails.slice(0, 400)) console.log(JSON.stringify(f));
