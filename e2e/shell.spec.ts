import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** F1 site shell: theme, header/nav, skip link, settings panel, 404, requests, layout. */

const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
const WIDTHS = [375, 768, 1280];
const THEMES = ['light', 'dark'] as const;

async function bgColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function iconInkBounds(svg: Locator) {
  return svg.evaluate((icon: SVGSVGElement) => {
    const button = icon.closest('button')!.getBoundingClientRect();
    const matrix = icon.getScreenCTM()!;
    const shapes = [...icon.querySelectorAll<SVGGeometryElement>('path, circle')];
    const ink = shapes.map((shape) => {
      const box = shape.getBBox();
      // getBBox measures geometry. Round strokes extend its edges by half the stroke width.
      const radius = parseFloat(getComputedStyle(shape).strokeWidth) / 2;
      return {
        left: box.x - radius,
        right: box.x + box.width + radius,
        top: box.y - radius,
        bottom: box.y + box.height + radius,
      };
    });
    const left = Math.min(...ink.map((box) => box.left));
    const right = Math.max(...ink.map((box) => box.right));
    const top = Math.min(...ink.map((box) => box.top));
    const bottom = Math.max(...ink.map((box) => box.bottom));
    const centerX = ((left + right) / 2) * matrix.a + matrix.e;
    const centerY = ((top + bottom) / 2) * matrix.d + matrix.f;
    return {
      width: (right - left) * matrix.a,
      height: (bottom - top) * matrix.d,
      offsetX: centerX - (button.left + button.width / 2),
      offsetY: centerY - (button.top + button.height / 2),
      centerY,
    };
  });
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

/**
 * F28: open, close mid-open, then reopen mid-close. Each running transform transition is
 * paused and seeked (Web Animations API), so the sample points don't depend on frame timing
 * (headless Chromium can skip ~80 ms between frames). Offsets are read synchronously right
 * after each interrupting click: a retargeting transition starts from where the panel was,
 * a keyframe restart would jump back to the off-screen start.
 */
async function sampleInterrupt(page: Page, axis: 'x' | 'y') {
  return page.evaluate(async (axis) => {
    const p = document.getElementById('settings-panel')!;
    const g = document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!;
    const off = () => {
      const m = new DOMMatrix(getComputedStyle(p).transform);
      return axis === 'x' ? m.m41 : m.m42;
    };
    const moving = () =>
      p
        .getAnimations()
        .find(
          (a): a is CSSTransition =>
            a instanceof CSSTransition && a.transitionProperty === 'transform',
        );
    g.click(); // open
    const kinds = p.getAnimations().map((a) => a.constructor.name);
    const opening = moving();
    if (!opening) return { kinds, error: 'no transform transition on open' };
    const enterMs = Number(opening.effect?.getTiming().duration ?? NaN);
    opening.pause();
    opening.currentTime = 100;
    const midOpen = off();
    g.click(); // close mid-open
    const afterClose = off();
    const shownWhileClosing = getComputedStyle(p).display !== 'none';
    const closing = moving();
    if (!closing) return { kinds, error: 'no transform transition on close' };
    closing.pause();
    closing.currentTime = 60;
    const midClose = off();
    g.click(); // reopen mid-close
    const afterReopen = off();
    const size = axis === 'x' ? p.offsetWidth : p.offsetHeight;
    await moving()?.finished;
    const openEnd = off();
    g.click(); // a full close from rest uses the exit duration
    const exitMs = Number(moving()?.effect?.getTiming().duration ?? NaN);
    return {
      kinds,
      error: '',
      midOpen,
      afterClose,
      shownWhileClosing,
      midClose,
      afterReopen,
      size,
      openEnd,
      exitMs,
      enterMs,
    };
  }, axis);
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
  test('switching theme starts no transitions (F28)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toBeEnabled();
    const n = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!.click();
      return document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length;
    });
    expect(n).toBe(0);
    // Transitions come back afterwards (hover colour fades still work).
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.hasAttribute('data-theme-switching')),
      )
      .toBe(false);
  });
});

test.describe('header and navigation', () => {
  for (const colorScheme of THEMES) {
    test(`theme and Settings icon ink aligns in ${colorScheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/');

      const toggle = page.locator('[data-theme-toggle]');
      await expect(toggle).toHaveAttribute('aria-pressed', String(colorScheme === 'dark'));
      const themeIcon = toggle.locator('svg:visible');
      const gearIcon = page
        .getByRole('button', { name: 'Art settings', exact: true })
        .locator('svg');
      await expect(themeIcon).toBeVisible();
      await expect(gearIcon).toBeVisible();

      const [theme, gear] = await Promise.all([iconInkBounds(themeIcon), iconInkBounds(gearIcon)]);
      for (const measure of ['width', 'height', 'offsetX', 'offsetY', 'centerY'] as const) {
        expect(
          Math.abs(theme[measure] - gear[measure]),
          `${measure} difference in CSS px`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test('has wordmark, nav items and gear on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header .wordmark')).toHaveText('Andrew Chincea');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveText([
      'Mission',
      'Work',
      'Research',
      'Open science',
      'Garden',
      'Rising water',
      'CV',
    ]);
    await expect(nav.getByRole('link', { name: 'Rising water' })).toHaveAttribute(
      'href',
      '/rising-water/',
    );
    await expect(nav.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeVisible();
    const garden = nav.getByRole('link', { name: 'Garden', exact: true });
    await expect(garden).toHaveAttribute('href', '/garden/');
    await garden.click();
    await expect(page).toHaveURL('/garden/');
    await expect(garden).toHaveAttribute('aria-current', 'page');
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

  test('nav stays usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/');
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(links).toHaveCount(7);
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // wordmark
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      await expect(links.nth(i)).toBeFocused();
      // ratio 1: fully visible, not just a sliver at the clipped edge of the row.
      await expect(links.nth(i)).toBeInViewport({ ratio: 1 });
    }
    expect(
      await page
        .getByRole('navigation', { name: 'Main' })
        .locator('ul')
        .evaluate((list) => list.scrollLeft),
    ).toBeGreaterThan(0);
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

  test('footer shows © year, name and Source without the Claude Code credit', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Andrew Chincea`);
    await expect(footer).not.toContainText('Built with help from Claude Code');
    await expect(footer.getByRole('link', { name: 'Source', exact: true })).toHaveAttribute(
      'href',
      'https://github.com/andrewc156/Personal-Portfolio',
    );
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

  // QA-03: on narrow screens the bottom sheet is modal.
  for (const opener of ['header gear', 'hero Settings'] as const) {
    test(`narrow sheet keeps focus inside, background inert, focus returns (${opener})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      const panel = page.locator('#settings-panel');
      const button =
        opener === 'header gear'
          ? page.getByRole('button', { name: 'Art settings', exact: true })
          : page.getByRole('button', { name: 'Animation settings', exact: true });
      await expect(button).toBeEnabled();
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(panel).toBeVisible();
      await expect(page.locator('#settings-title')).toBeFocused();
      await expect(panel).toHaveAttribute('aria-modal', 'true');
      await expect(panel).toHaveAttribute('role', 'dialog');
      // The dialog role is allowed on the panel element (axe aria-allowed-role, any impact).
      const roles = await new AxeBuilder({ page })
        .include('#settings-panel')
        .withRules(['aria-allowed-role'])
        .analyze();
      expect(roles.violations.map((v) => v.id)).toEqual([]);
      // Everything outside the sheet is inert.
      const inert = await page.evaluate(() =>
        ['header.site-header', 'main', 'footer', '.skip-link'].map(
          (s) => (document.querySelector(s) as HTMLElement | null)?.inert ?? null,
        ),
      );
      expect(inert).toEqual([true, true, true, true]);

      // Tab forward and backward past both edges: focus never leaves the sheet.
      const inside = () =>
        page.evaluate(() => !!document.activeElement?.closest('#settings-panel'));
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        expect(await inside(), `Tab ${i + 1}`).toBe(true);
      }
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Shift+Tab');
        expect(await inside(), `Shift+Tab ${i + 1}`).toBe(true);
      }
      // Shift+Tab from the first control wraps to the last one.
      await panel.getByRole('button', { name: 'Close art settings' }).focus();
      await page.keyboard.press('Shift+Tab');
      expect(await inside()).toBe(true);

      // Esc closes, restores the background and returns focus to the opener.
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();
      // Only the closed panel itself stays inert; nothing in the background does.
      expect(
        await page.evaluate(() => document.querySelectorAll('[inert]:not(#settings-panel)').length),
      ).toBe(0);
      await expect(page.locator('#settings-panel')).toHaveJSProperty('inert', true);
      await expect(panel).not.toHaveAttribute('aria-modal', 'true');

      // Close button.
      await button.click();
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: 'Close art settings' }).click();
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();

      // Backdrop: a tap on the covered page above the sheet dismisses it.
      await button.click();
      await expect(panel).toBeVisible();
      await animationsSettled(page, '#settings-panel');
      const box = await panel.boundingBox();
      expect(box && box.y > 40).toBeTruthy();
      await page.mouse.click(195, Math.max(5, Math.round((box?.y ?? 100) / 2)));
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();
      // Only the closed panel itself stays inert; nothing in the background does.
      expect(
        await page.evaluate(() => document.querySelectorAll('[inert]:not(#settings-panel)').length),
      ).toBe(0);
      await expect(page.locator('#settings-panel')).toHaveJSProperty('inert', true);
    });
  }

  test('wide drawer stays non-modal: page not inert, background click keeps it open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    const panel = page.locator('#settings-panel');
    await gear.click();
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveAttribute('aria-modal', 'true');
    await expect(page.getByRole('complementary', { name: 'Art settings' })).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    await page.mouse.click(100, 400);
    await expect(panel).toBeVisible();
    // Crossing into the sheet breakpoint makes it modal; back out restores the page.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(page.locator('main')).toHaveJSProperty('inert', true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(panel).not.toHaveAttribute('aria-modal', 'true');
    await expect(panel).toHaveAttribute('role', 'complementary');
    await expect(page.locator('main')).toHaveJSProperty('inert', false);
  });

  test('a remembered open drawer does not reopen as a sheet on narrow screens', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator('#settings-panel')).toBeHidden();
    // Only the closed panel itself stays inert; nothing in the background does.
    expect(
      await page.evaluate(() => document.querySelectorAll('[inert]:not(#settings-panel)').length),
    ).toBe(0);
    await expect(page.locator('#settings-panel')).toHaveJSProperty('inert', true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await expect(page.locator('#settings-panel')).toBeVisible();
  });

  for (const [w, h, axis] of [
    [1280, 800, 'x'],
    [375, 812, 'y'],
  ] as const) {
    test(`enter/exit are interruptible transitions, no jumps (${w}px, F28)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
      const r = await sampleInterrupt(page, axis);
      expect(r.error).toBe('');
      expect(r.kinds).not.toContain('CSSAnimation');
      expect(r.kinds).toContain('CSSTransition');
      expect(r.shownWhileClosing).toBe(true);
      const midOpen = r.midOpen!;
      const midClose = r.midClose!;
      // Genuinely mid-travel when interrupted.
      expect(midOpen).toBeGreaterThan(0);
      expect(midOpen).toBeLessThan(r.size!);
      expect(midClose).toBeGreaterThan(r.afterClose!);
      // An interruption continues from where the panel was: no jump.
      expect(Math.abs(r.afterClose! - midOpen)).toBeLessThan(1);
      expect(Math.abs(r.afterReopen! - midClose)).toBeLessThan(1);
      expect(r.openEnd).toBe(0);
      // Exit is a little faster than enter (200 ms vs 260 ms).
      expect(r.exitMs).toBe(200);
      expect(r.enterMs).toBeCloseTo(260, 6);
      expect(r.exitMs!).toBeLessThan(r.enterMs!);
      await animationsSettled(page, '#settings-panel');
    });
  }

  test('reduced motion: the panel never moves (F28)', async ({ browser }) => {
    for (const [w, h] of [
      [1280, 800],
      [375, 812],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
      const t = await page.evaluate(async () => {
        const p = document.getElementById('settings-panel')!;
        document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!.click();
        const out: string[] = [];
        for (let i = 0; i < 3; i++) {
          out.push(getComputedStyle(p).transform);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return out;
      });
      expect(
        t.every((v) => v === 'none'),
        `${w}px: ${t.join(' | ')}`,
      ).toBe(true);
      await ctx.close();
    }
  });

  test('touch: Settings selects are at least 16px (no iOS focus zoom) (F28)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto('/');
    // The 16px rule is keyed on (pointer: coarse); make sure the emulation provides it.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const sizes = await page.$$eval('#settings-panel .select-row select', (els) =>
      els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
    await ctx.close();
  });

  test('desktop: Settings selects keep the small control size (F28)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const sizes = await page.$$eval('#settings-panel .select-row select', (els) =>
      els.map((e) => getComputedStyle(e).fontSize),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBe('14px');
  });

  test('modal sheet dims the page; the wide drawer does not (F28)', async ({ page }) => {
    const scrim = () => page.evaluate(() => getComputedStyle(document.body, '::after').opacity);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    await expect(gear).toBeEnabled();
    expect(await scrim()).toBe('0');
    await gear.click();
    await animationsSettled(page, 'body');
    await expect.poll(scrim).toBe('1');
    // Backdrop tap still closes it (F25) and the scrim goes away.
    await page.mouse.click(187, 40);
    await expect(page.locator('#settings-panel')).toBeHidden();
    await expect.poll(scrim).toBe('0');

    await page.setViewportSize({ width: 1280, height: 800 });
    await gear.click();
    await animationsSettled(page, '#settings-panel');
    expect(await scrim()).toBe('0');
  });

  test('gear is absent on pages without settings', async ({ page }) => {
    await page.goto('/this-page-does-not-exist/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toHaveCount(0);
    await expect(page.locator('#settings-panel')).toHaveCount(0);
  });
});

// QA-11: history traversal keeps focus where the visitor can see it.
test.describe('focus after history navigation', () => {
  const offscreenFocus = (page: Page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return false;
      const r = a.getBoundingClientRect();
      return r.bottom <= 0 || r.top >= innerHeight;
    });

  /** Resolve once scrollY has been unchanged for several frames (smooth scrolling done). */
  const scrollSettled = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let last = window.scrollY;
          let stable = 0;
          const tick = () => {
            stable = window.scrollY === last ? stable + 1 : 0;
            last = window.scrollY;
            if (stable >= 10) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );

  // Default motion animates both the fragment scroll and the Back scroll restoration
  // (`scroll-behavior: smooth`), which is the case that broke attempt 1; reduced motion jumps.
  for (const motion of ['no-preference', 'reduce'] as const) {
    test.describe(`${motion} motion`, () => {
      test.use({ reducedMotion: motion });

      for (const width of [1024, 1280, 1440]) {
        test(`Back to the top of home leaves no offscreen focus (${width}px, ${motion})`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto('/');
          expect(
            await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
          ).toBe(motion === 'reduce' ? 'auto' : 'smooth');
          const nav = page.getByRole('navigation', { name: 'Main' });
          await nav.getByRole('link', { name: 'Research', exact: true }).focus();
          await page.keyboard.press('Enter');
          await expect(page).toHaveURL(/#research$/);
          // The QA steps: wait for the scroll to Research to settle, then Tab.
          await scrollSettled(page);
          expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
          // Focus the first article link, as a keyboard user would with Tab.
          const article = page.locator('#research a[href*="/research/"]').first();
          await page.keyboard.press('Tab');
          await expect(article).toBeFocused();
          await scrollSettled(page);

          // Same-document Back (/#research → /), the step that left focus offscreen in D01;
          // bfcache restores of the article round trip end in this same state.
          await page.goBack();
          await expect(page).toHaveURL(/\/$/);
          await page.waitForFunction(() => window.scrollY <= 1);
          await scrollSettled(page);
          await expect.poll(() => offscreenFocus(page)).toBe(false);
          // The next Tab stays near the top instead of jumping back to Research.
          await page.keyboard.press('Tab');
          await scrollSettled(page);
          const after = await page.evaluate(() => ({
            y: window.scrollY,
            top: document.activeElement?.getBoundingClientRect().top ?? 0,
          }));
          expect(after.y).toBeLessThan(200);
          expect(after.top).toBeLessThan(800);

          // Full D01 path: Research → article → Back twice.
          await page.keyboard.press('Shift+Tab');
          await nav.getByRole('link', { name: 'Research', exact: true }).focus();
          await page.keyboard.press('Enter');
          await expect(page).toHaveURL(/#research$/);
          await scrollSettled(page);
          await page.keyboard.press('Tab');
          await expect(article).toBeFocused();
          await page.keyboard.press('Enter');
          await expect(page).toHaveURL(/\/research\/[^#]+$/);
          await page.goBack();
          await expect(page).toHaveURL(/\/#research$/);
          await scrollSettled(page);
          await page.goBack();
          await expect(page).toHaveURL(/\/$/);
          await page.waitForFunction(() => window.scrollY <= 1);
          await scrollSettled(page);
          await expect.poll(() => offscreenFocus(page)).toBe(false);
        });
      }
    });
  }

  test('in-page link navigation still continues from the section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Research', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#research$/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.querySelector('[data-focus-restore]'))).toBeNull();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#research'))).toBe(true);
  });
});

// QA-16: script-only shell controls are not dead tab stops without JavaScript.
test.describe('no-JS shell controls', () => {
  test('theme toggle and gear are disabled without JS and enabled with it', async ({
    browser,
    page,
  }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    for (const path of ['/', '/garden/']) {
      await nojs.goto(path);
      await expect(nojs.locator('[data-theme-toggle]')).toBeDisabled();
      // Looks unavailable without JS.
      expect(
        Number(
          await nojs.locator('[data-theme-toggle]').evaluate((el) => getComputedStyle(el).opacity),
        ),
      ).toBeLessThan(1);
    }
    await nojs.goto('/');
    await expect(nojs.locator('[data-settings-toggle]')).toBeDisabled();
    // Tabbing through the header never lands on either control.
    const stops: string[] = [];
    for (let i = 0; i < 12; i++) {
      await nojs.keyboard.press('Tab');
      stops.push(
        await nojs.evaluate(
          () =>
            (document.activeElement?.getAttribute('aria-label') ??
              document.activeElement?.textContent ??
              '') + '',
        ),
      );
    }
    expect(stops).not.toContain('Dark theme');
    expect(stops).not.toContain('Art settings');
    await ctx.close();

    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/(^|\s)js(\s|$)/);
    await expect(page.locator('[data-theme-toggle]')).toBeEnabled();
    await expect(page.locator('[data-settings-toggle]')).toBeEnabled();
    expect(
      await page.locator('[data-theme-toggle]').evaluate((el) => getComputedStyle(el).opacity),
    ).toBe('1');
  });

  test('with JS the toggles are never dimmed while loading', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      const w = window as unknown as { __dimmed?: boolean };
      w.__dimmed = false;
      const check = () => {
        const btn = document.querySelector('[data-theme-toggle]');
        if (btn && getComputedStyle(btn).opacity !== '1') w.__dimmed = true;
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', check);
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('[data-theme-toggle]')).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { __dimmed?: boolean }).__dimmed)).toBe(
      false,
    );
    await ctx.close();
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

  test('motion tokens exist (F28)', async ({ page }) => {
    await page.goto('/');
    const v = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [
        '--ease-out',
        '--ease-drawer',
        '--dur-press',
        '--dur-drawer-in',
        '--dur-drawer-out',
      ].map((n) => s.getPropertyValue(n).trim());
    });
    // Compare values, not strings: the production build minifies `160ms` to `.16s` and
    // `cubic-bezier(0.23, 1, 0.32, 1)` to `cubic-bezier(.23, 1, .32, 1)`.
    const ms = (d: string) => {
      const m = /^(-?[\d.]+)(ms|s)$/.exec(d);
      return m ? parseFloat(m[1]!) * (m[2] === 's' ? 1000 : 1) : NaN;
    };
    const bezier = (e: string) => {
      const m = /^cubic-bezier\(([^)]*)\)$/.exec(e);
      return m ? m[1]!.split(',').map((n) => parseFloat(n)) : [];
    };
    const close = (got: number[], want: number[]) => {
      expect(got).toHaveLength(want.length);
      got.forEach((g, i) => expect(g).toBeCloseTo(want[i]!, 6));
    };
    close(bezier(v[0]!), [0.23, 1, 0.32, 1]);
    close(bezier(v[1]!), [0.32, 0.72, 0, 1]);
    close(v.slice(2).map(ms), [160, 260, 200]);
  });

  test('every :hover rule is gated by (hover: hover) and (pointer: fine) (F28)', async ({
    page,
  }) => {
    for (const path of ['/', '/garden/', '/research/', '/rising-water/']) {
      await page.goto(path);
      const ungated = await page.evaluate(() => {
        const bad: string[] = [];
        const walk = (rules: CSSRuleList, gated: boolean) => {
          for (const r of Array.from(rules)) {
            if (r instanceof CSSMediaRule) {
              const c = r.conditionText.replace(/\s+/g, ' ');
              walk(
                r.cssRules,
                gated || (c.includes('hover: hover') && c.includes('pointer: fine')),
              );
            } else if (r instanceof CSSStyleRule) {
              if (r.selectorText.includes(':hover') && !gated) bad.push(r.selectorText);
              if (r.cssRules?.length) walk(r.cssRules, gated);
            } else if ('cssRules' in r) {
              walk((r as CSSGroupingRule).cssRules, gated);
            }
          }
        };
        for (const s of Array.from(document.styleSheets)) {
          try {
            walk(s.cssRules, false);
          } catch {
            /* cross-origin: none expected */
          }
        }
        return bad;
      });
      expect(ungated, path).toEqual([]);
    }
  });

  test('a tapped button keeps no hover fill on touch (F28)', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto('/');
    const btn = page.locator('.hero__btn[data-hero-new]');
    await expect(btn).toBeEnabled();
    await btn.scrollIntoViewIfNeeded();
    const before = await btn.evaluate((b) => getComputedStyle(b).backgroundColor);
    await btn.tap();
    await page.waitForTimeout(300);
    expect(await btn.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(before);
    await ctx.close();
  });

  test('press feedback: no tap flash, buttons scale on press, not under reduced motion (F28)', async ({
    browser,
  }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion,
      });
      const page = await ctx.newPage();
      await page.goto('/');
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue(
            '-webkit-tap-highlight-color',
          ),
        ),
      ).toBe('rgba(0, 0, 0, 0)');
      const btn = page.locator('.hero__btn[data-hero-new]');
      await expect(btn).toBeEnabled();
      const box = (await btn.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // Wait for the press transition to finish instead of a fixed delay (slow hosts can
      // be mid-transition after 250 ms), then compare the scale with a tolerance.
      const t = await btn.evaluate(async (b) => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await Promise.all(b.getAnimations().map((a) => a.finished.catch(() => undefined)));
        return getComputedStyle(b).transform;
      });
      await page.mouse.up();
      if (reducedMotion === 'reduce') expect(t).toBe('none');
      else {
        expect(t).toMatch(/^matrix\(/);
        const m = t
          .slice(7, -1)
          .split(',')
          .map((n) => parseFloat(n));
        expect(m[0]).toBeCloseTo(0.97, 2);
        expect(m[3]).toBeCloseTo(0.97, 2);
        expect(m[1]).toBeCloseTo(0, 6);
        expect(m[2]).toBeCloseTo(0, 6);
      }
      await ctx.close();
    }
  });

  test('reduced motion: opening Settings and switching theme start no transitions (F28)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
    const n = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!.click();
      document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!.click();
      return document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length;
    });
    expect(n).toBe(0);
    await ctx.close();
  });

  test('body min-height uses small-viewport units (F28)', async ({ page }) => {
    await page.goto('/'); // site CSS (note: `astro preview` serves its own page for a bare /404)
    const ok = await page.evaluate(() =>
      Array.from(document.styleSheets).some((s) => {
        try {
          return Array.from(s.cssRules).some(
            (r) =>
              r instanceof CSSStyleRule &&
              r.selectorText === 'body' &&
              r.cssText.includes('100svh'),
          );
        } catch {
          return false;
        }
      }),
    );
    expect(ok).toBe(true);
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
