import { test, expect, type Browser } from '@playwright/test';

/**
 * F9-R1: no layout shift when the webfonts arrive late (spec §7: CLS < 0.05).
 *
 * Every woff2 request (preloads included) is held for FONT_DELAY ms, so the page
 * first paints in the platform fallback (the size-matched 'IBM Plex Sans Fallback'
 * faces in src/styles/fonts.css) and IBM Plex swaps in afterwards. Layout-shift
 * entries are collected from the start with a PerformanceObserver and summed
 * once the fonts have loaded and the page is idle. Lighthouse-like mobile viewport.
 */

const PAGES = ['/', '/garden/', '/cv/', '/rising-water/'];
const FONT_DELAY = 1500;
const VIEWPORT = { width: 412, height: 823 };

interface Probe {
  cls: number;
  shifts: string[];
  fcp: number;
  navBefore: number;
  navAfter: number;
}

async function measure(browser: Browser, path: string): Promise<{ probe: Probe; release: number }> {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  let held = 0;
  let released = 0;
  let firstRelease = Number.POSITIVE_INFINITY;
  await page.route('**/*.woff2', async (route) => {
    held++;
    await new Promise((r) => setTimeout(r, FONT_DELAY));
    firstRelease = Math.min(firstRelease, Date.now());
    await route.continue();
    released++;
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: { v: number; d: string }[] };
    w.__cls = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      }[]) {
        if (e.hadRecentInput) continue;
        const d = (e.sources ?? [])
          .map((s) => (s.node instanceof Element ? s.node.tagName + '.' + s.node.className : '?'))
          .join(', ');
        w.__cls.push({ v: e.value, d });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Before any font is released: record the fallback-font nav row height.
  await page.waitForFunction(() => document.querySelector('.site-nav') !== null);
  const navBefore = await page.evaluate(
    () => document.querySelector('.site-nav')!.getBoundingClientRect().height,
  );
  // Wait until every held font was released and Plex has loaded.
  await expect.poll(() => held > 0 && released === held, { timeout: 15_000 }).toBe(true);
  await page.waitForFunction(
    () =>
      document.fonts.status === 'loaded' &&
      [...document.fonts].some(
        (f) => f.family.replace(/['"]/g, '') === 'IBM Plex Sans' && f.status === 'loaded',
      ),
    undefined,
    { timeout: 15_000 },
  );
  // Settle: no new layout-shift entry for 500 ms (polled synchronously, see DECISIONS #41).
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __cls: unknown[]; __n?: number; __t?: number };
      const now = performance.now();
      if (w.__n !== w.__cls.length) {
        w.__n = w.__cls.length;
        w.__t = now;
        return false;
      }
      return now - (w.__t ?? now) >= 500;
    },
    undefined,
    { polling: 50, timeout: 15_000 },
  );
  const probe = await page.evaluate((): Probe => {
    const w = window as unknown as { __cls: { v: number; d: string }[] };
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      cls: w.__cls.reduce((a, x) => a + x.v, 0),
      shifts: w.__cls.filter((x) => x.v > 0.001).map((x) => `${x.v.toFixed(4)} ${x.d}`),
      fcp: fcp ? performance.timeOrigin + fcp.startTime : Number.NaN,
      navBefore: 0,
      navAfter: document.querySelector('.site-nav')!.getBoundingClientRect().height,
    };
  });
  probe.navBefore = navBefore;
  await ctx.close();
  return { probe, release: firstRelease };
}

test.describe('font swap layout stability (mobile, fonts delayed)', () => {
  test.describe.configure({ timeout: 60_000 });

  for (const path of PAGES) {
    test(`${path}: CLS < 0.05 when IBM Plex arrives after first paint`, async ({ browser }) => {
      const { probe, release } = await measure(browser, path);
      // The test only means something if the page painted before the fonts arrived.
      expect(
        probe.fcp,
        'first contentful paint happened before the fonts were released',
      ).toBeLessThan(release);
      expect(probe.navAfter, 'mobile nav row height does not depend on the font').toBeCloseTo(
        probe.navBefore,
        0,
      );
      expect(probe.cls, `CLS on ${path}; shifts: ${probe.shifts.join(' | ')}`).toBeLessThan(0.05);
    });
  }
});

test.describe('mobile nav row is font-independent and fully reachable', () => {
  const LABELS = ['Mission', 'Research', 'Work', 'Open science', 'Rising water', 'CV'];
  // Focus ring: 2px outline at 2px offset (global.css :focus-visible).
  const RING = 4;

  for (const width of [320, 375, 412, 768, 832]) {
    test(`${width}px: one row in any font; all 6 links reachable by keyboard`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const row = () =>
        page.evaluate(() => {
          const nav = document.querySelector('.site-nav')!;
          const tops = [...nav.querySelectorAll('li')].map((li) => li.getBoundingClientRect().top);
          return { h: nav.getBoundingClientRect().height, rows: new Set(tops).size };
        });

      // Where the focused link sits inside the nav list, measured synchronously after
      // the key press (the reveal is an instant scrollLeft change, nothing to wait for).
      const focused = () =>
        page.evaluate((ring) => {
          const a = document.activeElement as HTMLElement;
          const ul = a.closest('ul');
          const box = ul?.getBoundingClientRect();
          const ar = a.getBoundingClientRect();
          // When the list scrolls, the link and its focus ring must be inside its box;
          // otherwise (desktop row, nothing clipped) the link itself must be.
          const pad = ul && ul.scrollWidth > ul.clientWidth ? ring : 0;
          return {
            text: a.textContent?.trim() ?? '',
            inNav: !!a.closest('.site-nav'),
            visible: !!box && ar.left - pad >= box.left - 0.5 && ar.right + pad <= box.right + 0.5,
            where: box
              ? `link ${ar.left.toFixed(1)}–${ar.right.toFixed(1)}, list ${box.left.toFixed(1)}–${box.right.toFixed(1)}`
              : 'no list',
          };
        }, RING);

      // Tab from the wordmark visits the 6 links in order, Shift+Tab walks back; every
      // focused link is fully visible inside the scrolling row.
      const walk = async (font: string) => {
        await page.evaluate(() => {
          document.querySelector('.site-nav ul')!.scrollLeft = 0;
        });
        await page.locator('.wordmark').focus();
        const forward: string[] = [];
        for (let i = 0; i < LABELS.length; i++) {
          await page.keyboard.press('Tab');
          const r = await focused();
          expect(r.inNav, `${font}: Tab ${i + 1} lands in the nav`).toBe(true);
          expect(r.visible, `${font}: ${r.text} fully visible when focused (${r.where})`).toBe(
            true,
          );
          forward.push(r.text);
        }
        expect(forward, `${font}: Tab order`).toEqual(LABELS);
        const backward: string[] = [];
        for (let i = LABELS.length - 2; i >= 0; i--) {
          await page.keyboard.press('Shift+Tab');
          const r = await focused();
          expect(r.visible, `${font}: ${r.text} fully visible on Shift+Tab (${r.where})`).toBe(
            true,
          );
          backward.push(r.text);
        }
        expect(backward, `${font}: Shift+Tab order`).toEqual(LABELS.slice(0, -1).reverse());
      };

      const plex = await row();
      expect(plex.rows, 'links sit on one row').toBe(1);
      await walk('IBM Plex Sans');

      // Force a much wider font (DejaVu Sans on Linux, Verdana elsewhere): same height,
      // still one row, still fully reachable.
      await page.addStyleTag({
        content: `:root { --font-sans: 'DejaVu Sans', Verdana, sans-serif !important; }`,
      });
      const wide = await row();
      expect(wide.rows, 'still one row in a wide font').toBe(1);
      expect(wide.h, 'nav height unchanged in a wide font').toBeCloseTo(plex.h, 0);
      await walk('wide font');
      await ctx.close();
    });
  }
});
