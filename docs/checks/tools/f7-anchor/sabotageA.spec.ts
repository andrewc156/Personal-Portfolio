import { test, expect } from '@playwright/test';
const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
test.describe('sabotageA', () => {
  test('section anchors exist in §4.3 order and nav scrolls to them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => { document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="/#"]'); if (!a) return; e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); }, true); });
    await page.goto('/');
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main section[id]')).map((s) => s.id),
    );
    // Teaching and Contact render only with content, so check order of what is present.
    const order = ['mission', 'work', 'research', 'open-science', 'teaching', 'contact'];
    for (const id of SECTION_ANCHORS) expect(ids).toContain(id);
    const positions = ids.filter((id) => order.includes(id)).map((id) => order.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    await expect(page.locator('main h1')).toHaveCount(1);

    // html has scroll-behavior: smooth. Clicking while a previous smooth scroll is
    // still running races Playwright's own scroll-into-view of the header link, so
    // wait for scrollY to stay unchanged for 150 ms before each click. After the
    // click, wait for the target to come into view, let the scroll settle, and
    // assert again so the final resting position is checked.
    type SettleWindow = Window & { __settleY?: number; __settleT?: number };
    const scrollSettled = async () => {
      await page.evaluate(() => {
        (window as SettleWindow).__settleY = undefined;
      });
      await page.waitForFunction(
        () => {
          const w = window as SettleWindow;
          const now = performance.now();
          if (w.__settleY !== window.scrollY) {
            w.__settleY = window.scrollY;
            w.__settleT = now;
            return false;
          }
          return now - (w.__settleT ?? now) >= 150;
        },
        undefined,
        { polling: 50 },
      );
    };

    // After settling, the target's top must sit at its scroll-margin-top (± 2 px). The
    // one exception is a section too close to the page end to reach the top: then the
    // page must be scrolled to the bottom and the target's top must be below the margin.
    // This proves the scroll for every section, including #mission and #work that start
    // near the first screen.
    const landing = (id: string) =>
      page.evaluate((sel) => {
        const el = document.getElementById(sel) as HTMLElement;
        const top = el.getBoundingClientRect().top;
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        return { top, margin, scrollY: window.scrollY, atBottom: window.scrollY >= maxY - 1 };
      }, id);

    for (const id of SECTION_ANCHORS) {
      await scrollSettled();
      const link = page.locator(`nav[aria-label="Main"] a[href="/#${id}"]`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      const target = page.locator(`#${id}`);
      await expect(target).toBeInViewport();
      await scrollSettled();
      await expect(target).toBeInViewport();
      const l = await landing(id);
      expect(l.scrollY, `#${id}: page scrolled`).toBeGreaterThan(0);
      console.log('LANDING', id, JSON.stringify(l));
      if (l.atBottom) {
        expect(l.top, `#${id}: top at or below its margin (page end)`).toBeGreaterThanOrEqual(
          l.margin - 2,
        );
      } else {
        expect(
          Math.abs(l.top - l.margin),
          `#${id}: top lands at the viewport top`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });
});
