import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const out = 'docs/checks/F15/attempt-1';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[375, 812], [768, 1024], [1280, 800]]) {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce' });
      await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const footer = page.locator('footer.site-footer');
      await footer.scrollIntoViewIfNeeded();
      assert.match(await footer.innerText(), /© \d{4} Andrew Chincea/);
      assert.doesNotMatch(await footer.innerText(), /Built with help from Claude Code/);
      assert.equal(await footer.getByRole('link', { name: 'About', exact: true }).getAttribute('href'), '/about/');
      assert.equal(await footer.getByRole('link', { name: 'Source', exact: true }).getAttribute('href'), 'https://github.com/andrewc156/Personal-Portfolio');
      const metrics = await footer.evaluate(el => {
        const paragraph = el.querySelector('p');
        const spans = [...paragraph.querySelectorAll('span.grp')];
        const lines = spans.map(span => span.getBoundingClientRect().top);
        return {
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
          footerOverflow: el.scrollWidth - el.clientWidth,
          paragraphOverflow: paragraph.scrollWidth - paragraph.clientWidth,
          groups: spans.length,
          lines: new Set(lines).size,
          dark: getComputedStyle(document.body).colorScheme.includes('dark')
        };
      });
      assert.equal(metrics.pageOverflow, 0);
      assert.equal(metrics.footerOverflow, 0);
      assert.equal(metrics.paragraphOverflow, 0);
      assert.equal(metrics.groups, 3);
      assert.equal(metrics.dark, colorScheme === 'dark');
      await footer.screenshot({ path: `${out}/footer-${width}-${colorScheme}.png` });
      console.log(JSON.stringify({ width, colorScheme, ...metrics }));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
