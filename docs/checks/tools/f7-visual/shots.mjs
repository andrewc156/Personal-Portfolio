// F7 checker screenshots: footer on / and /about/ at 375/768/1280 light/dark, Garden list.
import { chromium } from '@playwright/test';
const base = 'http://localhost:4321';
const out = process.argv[2];
const browser = await chromium.launch();
const sizes = [[375, 812], [768, 1024], [1280, 800]];
const report = [];
for (const theme of ['light', 'dark']) {
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    const page = await ctx.newPage();
    for (const [name, path] of [['home', '/'], ['about', '/about/']]) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const footer = page.locator('footer.site-footer');
      await footer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const box = await footer.boundingBox();
      const info = await page.evaluate(() => {
        const p = document.querySelector('footer.site-footer p');
        const a = document.querySelector('footer.site-footer a[href="/about/"]');
        const cs = getComputedStyle(a);
        return { text: p.innerText, pHeight: p.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(p).lineHeight),
          overflow: document.documentElement.scrollWidth > window.innerWidth, linkDeco: cs.textDecorationLine, linkColor: cs.color,
          bg: getComputedStyle(document.body).backgroundColor };
      });
      report.push({ theme, w, name, ...info });
      await page.screenshot({ path: `${out}/footer-${name}-${w}-${theme}.png`, clip: { x: 0, y: Math.max(0, box.y - 120), width: w, height: Math.min(h, box.height + 160) } });
    }
    await page.goto(base + '/garden/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${out}/garden-${w}-${theme}.png`, fullPage: true });
    await ctx.close();
  }
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
