// Checker mutation test: the attempt-2 anchor loop (copied verbatim) must FAIL
// when nav clicks only change the hash without scrolling (MUTATE=1) and PASS otherwise.
import { test, expect } from '@playwright/test';
const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
test('anchor loop', async ({ page }) => {
  if (process.env.MUTATE === '1') {
    await page.addInitScript(() => {
      document.addEventListener('click', (e) => {
        const a = (e.target as Element).closest('a[href^="/#"]');
        if (a) { e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); }
      }, true);
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  type SettleWindow = Window & { __settleY?: number; __settleT?: number };
  const scrollSettled = async () => {
    await page.evaluate(() => { (window as SettleWindow).__settleY = undefined; });
    await page.waitForFunction(() => {
      const w = window as SettleWindow; const now = performance.now();
      if (w.__settleY !== window.scrollY) { w.__settleY = window.scrollY; w.__settleT = now; return false; }
      return now - (w.__settleT ?? now) >= 150;
    }, undefined, { polling: 50 });
  };
  const log: string[] = [];
  for (const id of SECTION_ANCHORS) {
    await scrollSettled();
    const link = page.locator(`nav[aria-label="Main"] a[href="/#${id}"]`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    const target = page.locator(`#${id}`);
    await expect(target).toBeInViewport({ timeout: 3000 });
    await scrollSettled();
    await expect(target).toBeInViewport();
    const r = await target.evaluate((el) => ({ top: Math.round(el.getBoundingClientRect().top), y: Math.round(scrollY) }));
    log.push(`${id}: top=${r.top} scrollY=${r.y}`);
  }
  console.log(log.join('\n'));
});
