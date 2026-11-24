import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** F1 site shell: theme, header/nav, skip link, settings panel, 404, requests, layout. */

const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
const WIDTHS = [375, 768, 1280];
const THEMES = ['light', 'dark'] as const;

async function bgColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** Resolve once every CSS animation/transition on the element (and its subtree) has finished. */
async function animationsSettled(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate(async (el) => {
    // Two frames so style changes from the last action have produced their animations.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0; i < 5; i++) {
      const running = el.getAnimations({ subtree: true }).filter((a) => a.playState !== 'finished');
      if (running.length === 0) return;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    }
  });
}

async function expectNoSeriousAxe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
}

test.describe('theme', () => {
  test('follows the OS preference by default', async ({ browser }) => {
    for (const colorScheme of THEMES) {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      await page.goto('/');
      expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
      const pressed = await page.locator('[data-theme-toggle]').getAttribute('aria-pressed');
      expect(pressed).toBe(String(colorScheme === 'dark'));
      await ctx.close();
    }
  });

  test('light and dark themes use different backgrounds', async ({ browser }) => {
    const colors: string[] = [];
    for (const colorScheme of THEMES) {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      await page.goto('/');
      colors.push(await bgColor(page));
      await ctx.close();
    }
    expect(colors[0]).not.toBe(colors[1]);
  });

  test('toggle switches theme and persists across reloads and pages', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('/');
    const lightBg = await bgColor(page);
    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await bgColor(page)).not.toBe(lightBg);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto('/this-page-does-not-exist/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await ctx.close();
  });

  test('no flash: stored theme is applied before the body is parsed', async ({ browser }) => {
    for (const [os, stored] of [
      ['light', 'dark'],
      ['dark', 'light'],
    ] as const) {
      const ctx = await browser.newContext({ colorScheme: os });
      await ctx.addInitScript((theme) => {
        try {
          localStorage.setItem('theme', theme);
        } catch {
          /* ignore */
        }
        const w = window as unknown as { __themeAtBody?: string | null };
        const obs = new MutationObserver(() => {
          if (document.body && w.__themeAtBody === undefined) {
            w.__themeAtBody = document.documentElement.getAttribute('data-theme');
            obs.disconnect();
          }
        });
        obs.observe(document, { childList: true, subtree: true });
      }, stored);
      const page = await ctx.newPage();
      await page.goto('/');
      const atBody = await page.evaluate(
        () => (window as unknown as { __themeAtBody?: string | null }).__themeAtBody,
      );
      expect(atBody).toBe(stored);
      await ctx.close();
    }
  });

  test('theme bootstrap is an inline script in <head> before any stylesheet', async ({ page }) => {
    await page.goto('/');
    const order = await page.evaluate(() => {
      const els = Array.from(
        document.head.querySelectorAll('script, link[rel="stylesheet"], style'),
      );
      const first = els[0];
      return first ? `${first.tagName}:${first.hasAttribute('src') ? 'src' : 'inline'}` : '';
    });
    expect(order).toBe('SCRIPT:inline');
  });
});

test.describe('header and navigation', () => {
  test('has wordmark, nav items and gear on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header .wordmark')).toHaveText('Andrew Chincea');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveText([
      'Mission',
      'Research',
      'Work',
      'Open science',
      'Rising water',
      'CV',
    ]);
    await expect(nav.getByRole('link', { name: 'Rising water' })).toHaveAttribute(
      'href',
      '/rising-water/',
    );
    await expect(nav.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeVisible();
  });

  test('section anchors exist in §4.3 order and nav scrolls to them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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

    for (const id of SECTION_ANCHORS) {
      await scrollSettled();
      const link = page.locator(`nav[aria-label="Main"] a[href="/#${id}"]`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      const target = page.locator(`#${id}`);
      await expect(target).toBeInViewport();
      await scrollSettled();
      await expect(target).toBeInViewport();
    }
  });

  test('nav stays usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/');
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(links).toHaveCount(6);
    for (let i = 0; i < 6; i++) await expect(links.nth(i)).toBeInViewport();
  });

  test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return '';
        const cs = getComputedStyle(el);
        return `${cs.outlineStyle} ${cs.outlineWidth}`;
      });
      expect(outline).not.toMatch(/^none|0px/);
    }
  });

  test('footer line shows © year, name and credit; Source hidden while unset', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Andrew Chincea`);
    await expect(footer).toContainText('Built with help from Claude Code');
    await expect(footer.getByRole('link', { name: 'Source' })).toHaveCount(0);
  });
});

test.describe('settings panel', () => {
  test('opens, closes on Esc, returns focus to the gear', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    const panel = page.locator('#settings-panel');
    await expect(gear).toHaveAttribute('aria-expanded', 'false');
    await expect(gear).toHaveAttribute('aria-controls', 'settings-panel');
    await expect(panel).toBeHidden();

    await gear.click();
    await expect(gear).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('group').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(gear).toHaveAttribute('aria-expanded', 'false');
    await expect(gear).toBeFocused();

    // Esc from a control inside the panel also closes and returns focus.
    await gear.click();
    await panel.locator('input[type="range"]').first().focus();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(gear).toBeFocused();

    // Close button
    await gear.click();
    await panel.getByRole('button', { name: 'Close art settings' }).click();
    await expect(panel).toBeHidden();
    await expect(gear).toBeFocused();
  });

  test('slider readout updates live in monospace', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    const slider = page.locator('#settings-panel input[type="range"]').first();
    const id = await slider.getAttribute('id');
    const out = page.locator(`#settings-panel output[for="${id}"]`);
    const before = await out.textContent();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(out).not.toHaveText(before ?? '');
    const font = await out.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain('IBM Plex Mono');
  });

  test('open/closed state is remembered', async ({ page }) => {
    await page.goto('/');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    await gear.click();
    await page.reload();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('#settings-panel')).toBeHidden();
  });

  test('right drawer on desktop, bottom sheet on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    const panel = page.locator('#settings-panel');
    const clientWidth = () => page.evaluate(() => document.documentElement.clientWidth);
    await animationsSettled(page, '#settings-panel');
    let box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.abs(box.x + box.width - (await clientWidth()))).toBeLessThanOrEqual(1);
      expect(box.width).toBeLessThan(500);
      expect(box.height).toBeGreaterThan(700);
    }

    await page.setViewportSize({ width: 375, height: 740 });
    await animationsSettled(page, '#settings-panel');
    box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(Math.abs(box.width - (await clientWidth()))).toBeLessThanOrEqual(1);
      expect(Math.round(box.y + box.height)).toBe(740);
      expect(box.height).toBeLessThan(740);
    }
  });

  for (const width of [768, 1280]) {
    test(`header tools stay usable while the drawer is open at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const gear = page.getByRole('button', { name: 'Art settings', exact: true });
      const toggle = page.locator('[data-theme-toggle]');
      const panel = page.locator('#settings-panel');
      await gear.click();
      await expect(panel).toBeVisible();
      await animationsSettled(page, '#settings-panel');

      const header = await page.locator('header.site-header').boundingBox();
      const pbox = await panel.boundingBox();
      expect(header && pbox).toBeTruthy();
      if (header && pbox) expect(pbox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);

      // Still pinned and clickable after scrolling the page.
      await page.mouse.wheel(0, 600);
      await expect(gear).toBeInViewport();
      await toggle.click(); // Playwright fails this if anything covers the toggle.
      await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
      await gear.click();
      await expect(panel).toBeHidden();
      await expect(gear).toHaveAttribute('aria-expanded', 'false');
    });
  }

  test('keyboard order runs gear → panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    await gear.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings-title')).toBeFocused();
    await gear.focus();
    await page.keyboard.press('Tab');
    const inPanel = await page.evaluate(() => !!document.activeElement?.closest('#settings-panel'));
    expect(inPanel).toBe(true);
    await page.keyboard.press('Escape');
    await expect(gear).toBeFocused();
  });

  test('gear is absent on pages without settings', async ({ page }) => {
    await page.goto('/this-page-does-not-exist/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toHaveCount(0);
    await expect(page.locator('#settings-panel')).toHaveCount(0);
  });
});

test.describe('404', () => {
  test('unknown route shows the friendly 404 page', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /home/i })).toHaveAttribute(
      'href',
      '/',
    );
    await expect(page.locator('main svg[role="img"]')).toBeVisible();
    await expect(page.locator('main canvas')).toHaveCount(0);
  });
});

test.describe('requests and fonts', () => {
  test('zero third-party requests; fonts are self-hosted', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4321').origin;
    const foreign: string[] = [];
    const fonts: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (new URL(url).origin !== origin) foreign.push(url);
      if (req.resourceType() === 'font') fonts.push(url);
    });
    for (const path of ['/', '/404.html', '/this-page-does-not-exist/']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(foreign).toEqual([]);
    expect(fonts.length).toBeGreaterThan(0);
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts)
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family.replace(/['"]/g, ''));
    });
    expect(families).toContain('IBM Plex Sans');
  });
});

test.describe('layout and accessibility', () => {
  for (const colorScheme of THEMES) {
    for (const width of WIDTHS) {
      test(`no horizontal overflow at ${width}px (${colorScheme})`, async ({ browser }) => {
        const ctx = await browser.newContext({
          colorScheme,
          viewport: { width, height: 900 },
        });
        const page = await ctx.newPage();
        for (const path of ['/', '/this-page-does-not-exist/']) {
          await page.goto(path);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
        }
        await ctx.close();
      });
    }

    test(`axe: 0 serious/critical (${colorScheme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      await page.goto('/');
      await expectNoSeriousAxe(page, `/ ${colorScheme}`);
      await page.getByRole('button', { name: 'Art settings', exact: true }).click();
      await expect(page.locator('#settings-panel')).toBeVisible();
      await animationsSettled(page, '#settings-panel');
      await expectNoSeriousAxe(page, `/ ${colorScheme} with settings open`);
      await page.goto('/this-page-does-not-exist/');
      await expectNoSeriousAxe(page, `404 ${colorScheme}`);
      await ctx.close();
    });
  }

  test('respects prefers-reduced-motion (no smooth scrolling)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    const behavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(behavior).toBe('auto');
    await ctx.close();
  });

  test('body text is 17px with line-height 1.6', async ({ page }) => {
    await page.goto('/');
    const m = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { size: cs.fontSize, lh: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) };
    });
    expect(m.size).toBe('17px');
    expect(m.lh).toBeCloseTo(1.6, 2);
  });
});
