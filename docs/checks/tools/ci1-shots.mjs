// CI1 checker tool: header screenshots at 320/375/412/768/1280, light/dark, rest/focused.
// usage: node ci1-shots.mjs <baseURL> <outDir> [fontMode: plex|dejavu] [label]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, out, mode = 'plex', label = ''] = process.argv.slice(2);
const FONT_DIR = process.env.DEJAVU_DIR;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const width of [320, 375, 412, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 400 } });
    const page = await ctx.newPage();
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    if (mode === 'dejavu')
      await page.route('**/__ci1font/**', (r) =>
        r.fulfill({ body: fs.readFileSync(`${FONT_DIR}/${r.request().url().split('/').pop()}`) }),
      );
    await page.goto(base + '/');
    await page.evaluate(() => document.fonts.ready);
    if (mode === 'dejavu') {
      await page.addStyleTag({
        content: `@font-face{font-family:'DejaVu Sans';src:url(/__ci1font/DejaVuSans.ttf)}:root{--font-sans:'DejaVu Sans',sans-serif !important}`,
      });
      await page.evaluate(() => document.fonts.load("16px 'DejaVu Sans'"));
    }
    const header = page.locator('.site-header');
    const tag = `${label}${mode === 'dejavu' ? 'dejavu-' : ''}${width}-${theme}`;
    await header.screenshot({ path: `${out}/${tag}-rest.png` });
    await page.locator('.wordmark').focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab'); // Rising water
    await header.screenshot({ path: `${out}/${tag}-focus-rising.png` });
    await page.keyboard.press('Tab'); // CV
    await header.screenshot({ path: `${out}/${tag}-focus-cv.png` });
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab'); // back to Mission
    await header.screenshot({ path: `${out}/${tag}-focus-mission-back.png` });
    await ctx.close();
  }
}
await browser.close();
console.log('done');
