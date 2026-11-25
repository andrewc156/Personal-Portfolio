import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** F5 synthetic hero (spec §6.3, §10/F5). Deterministic terrain via ?seed=. */

const URL = '/?seed=42';

interface HeroState {
  state: string;
  running: string;
  frames: number;
  progress: number;
  seed: string;
}

async function heroState(page: Page): Promise<HeroState> {
  return page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('[data-hero]')!;
    const h = r.__hero!;
    return {
      state: r.dataset.state ?? '',
      running: r.dataset.running ?? '',
      frames: h.frames,
      progress: h.progress,
      seed: r.dataset.seed ?? '',
    };
  });
}

/** Rising water's caption (src/lib/viz/hero/modes/meta.ts, RISING_CAPTION). */
const RISING_CAPTION =
  'Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on. The barcode gives each lake a bar from the level where it forms to the level where it merges.';

/**
 * Wait until a frame counter stops moving (two equal reads 250 ms apart, up to 5 s). Startup
 * can paint a few settle frames (first paint, resize, theme) after the controller exists; tests
 * that prove "no autoplay" measure only after these.
 */
async function framesSettled(page: Page, read: () => Promise<number>): Promise<void> {
  let prev = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const cur = await read();
    if (cur === prev) return;
    prev = cur;
  }
  throw new Error('Reduced-motion startup frames did not settle within 5 seconds');
}

async function waitForHero(page: Page): Promise<void> {
  await page.waitForFunction(() => !!document.querySelector<HTMLElement>('[data-hero]')?.__hero);
}

/** Luminance variance of the map canvas, sampled at 64×32. */
async function mapVariance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-hero-map]')!;
    const x = document.createElement('canvas');
    x.width = 64;
    x.height = 32;
    const g = x.getContext('2d')!;
    g.drawImage(c, 0, 0, 64, 32);
    const d = g.getImageData(0, 0, 64, 32).data;
    let m = 0;
    let m2 = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] + d[i + 1] + d[i + 2];
      m += v;
      m2 += v * v;
      n++;
    }
    return m2 / n - (m / n) ** 2;
  });
}

/** The readout's true text when no bar or map cell is highlighted. */
async function expectedLevelReadout(page: Page): Promise<string> {
  return page.evaluate(() => {
    const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
    const n = h.lakeCount;
    return `Level ${Math.round(h.level())}\u00a0m · ${n === 1 ? '1 lake' : `${n} lakes`}`;
  });
}

async function readout(page: Page): Promise<string> {
  return (await page.locator('[data-hero-readout]').textContent()) ?? '';
}

async function noSmoothScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });
}

async function animationsSettled(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate(async (el) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0; i < 5; i++) {
      const running = el.getAnimations({ subtree: true }).filter((a) => a.playState !== 'finished');
      if (running.length === 0) return;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
    }
  });
}

test.describe('hero canvas', () => {
  test('non-blank within 500 ms of hydration, and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    // From document start, poll the map canvas every frame and record when it first has
    // non-trivial pixel variance (performance.now() is measured from navigation start).
    await page.addInitScript(() => {
      const w = window as unknown as { __firstNonBlank?: number };
      const probe = document.createElement('canvas');
      probe.width = 32;
      probe.height = 16;
      const poll = () => {
        const c = document.querySelector<HTMLCanvasElement>('[data-hero-map]');
        if (c && c.width > 0 && c.height > 0) {
          const g = probe.getContext('2d')!;
          g.clearRect(0, 0, 32, 16);
          g.drawImage(c, 0, 0, 32, 16);
          const d = g.getImageData(0, 0, 32, 16).data;
          let m = 0;
          let m2 = 0;
          for (let i = 0; i < d.length; i += 4) {
            const v = d[i] + d[i + 1] + d[i + 2];
            m += v;
            m2 += v * v;
          }
          const n = d.length / 4;
          if (m2 / n - (m / n) ** 2 > 50) {
            w.__firstNonBlank = performance.now();
            return;
          }
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    await page.goto(URL);
    await page.waitForFunction(
      () => (window as unknown as { __firstNonBlank?: number }).__firstNonBlank !== undefined,
      undefined,
      { timeout: 5000 },
    );
    const t = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        // Hydration (module scripts) starts once the document is parsed: domInteractive.
        hydration: nav.domInteractive,
        firstNonBlank: (window as unknown as { __firstNonBlank: number }).__firstNonBlank,
      };
    });
    expect(t.firstNonBlank - t.hydration).toBeLessThan(500);
    expect(await mapVariance(page)).toBeGreaterThan(50);
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('canvas has role="img" and a label; caption and link are exact', async ({ page }) => {
    await page.goto(URL);
    const map = page.locator('[data-hero-map]');
    await expect(map).toHaveAttribute('role', 'img');
    expect((await map.getAttribute('aria-label'))?.length).toBeGreaterThan(20);
    const cap = page.locator('.hero__caption');
    await expect(cap).toContainText(RISING_CAPTION);
    await expect(
      cap.getByRole('link', { name: 'See it on the Colorado River Basin →' }),
    ).toHaveAttribute('href', '/rising-water/');
  });

  test('same seed gives the same terrain and barcode', async ({ page }) => {
    const grab = async () => {
      await page.goto(URL);
      await waitForHero(page);
      return page.evaluate(() => {
        const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
        return JSON.stringify(h.drawnRows.map((b) => [b.birthCell, b.deathCell, b.birth, b.death]));
      });
    };
    expect(await grab()).toBe(await grab());
  });

  for (const { seed, width, height } of [
    { seed: 42, width: 1280, height: 800 },
    { seed: 25, width: 375, height: 812 },
  ]) {
    test(`first frame has several lakes for seed ${seed} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          const root = document.querySelector<HTMLElement>('[data-hero]');
          const h = root?.__hero;
          if (!root || !h) return;
          // The controller paints synchronously. Observe its state mutation before rAF can
          // advance the water, rather than checking after navigation has settled.
          const level = h.level();
          const meaningful = h.drawnRows.filter((b) => b.birth + 15 <= level && level < b.death);
          root.dataset.testFirstFrame = JSON.stringify({
            frames: h.frames,
            progress: h.progress,
            lakes: h.lakeCount,
            meaningful: meaningful.length,
          });
          observer.disconnect();
        });
        observer.observe(document, {
          attributes: true,
          attributeFilter: ['data-state'],
          subtree: true,
        });
      });
      const start = async () => {
        await page.goto(`/?seed=${seed}`);
        const root = page.locator('[data-hero]');
        await expect(root).toHaveAttribute('data-test-first-frame', /.+/);
        return JSON.parse((await root.getAttribute('data-test-first-frame'))!) as {
          frames: number;
          progress: number;
          lakes: number;
          meaningful: number;
        };
      };
      const first = await start();
      expect(first.frames).toBe(1);
      expect(first.progress).toBeGreaterThan(0);
      expect(first.progress).toBeLessThan(1);
      expect(first.lakes).toBeGreaterThanOrEqual(3);
      expect(first.meaningful).toBeGreaterThanOrEqual(seed === 25 ? 3 : 2);
      expect(await start()).toEqual(first);
    });
  }
});

test.describe('controls', () => {
  test('mouse: Play/Pause and New terrain buttons', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    const bar = page.locator('.hero__bar');
    expect((await heroState(page)).state).toBe('playing');
    await bar.getByRole('button', { name: 'Pause', exact: true }).click();
    expect((await heroState(page)).state).toBe('paused');
    await expect(bar.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const before = (await heroState(page)).seed;
    await bar.getByRole('button', { name: 'New terrain', exact: true }).click();
    expect((await heroState(page)).seed).not.toBe(before);
  });

  test('mouse: hovering a bar highlights its lake (readout names the lake)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-hero]')!.__hero!.scrubTo(1),
    );
    const box = (await page.locator('[data-hero-strip]').boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 10);
    await expect(page.locator('[data-hero-readout]')).toContainText(/^Lake \d+ · born/);
    const map = (await page.locator('[data-hero-map]').boundingBox())!;
    await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2);
    await expect(page.locator('[data-hero-readout]')).toContainText(/^Height \d+\u00a0m · /);
  });

  test('mouse: the hovered lake highlights its bar, including after a merge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    // Find a drawn lake that will merge (the essential lake is row 0), then hover it.
    const target = await page.evaluate(() => {
      const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
      h.scrubTo(0.2);
      const { W, H } = h.grid;
      for (let i = 0; i < W * H; i++) {
        const k = h.lakeRowAt(i);
        if (k > 0) return { fx: ((i % W) + 0.5) / W, fy: (Math.floor(i / W) + 0.5) / H, k };
      }
      return null;
    });
    expect(target).not.toBeNull();
    const map = (await page.locator('[data-hero-map]').boundingBox())!;
    await page.mouse.move(map.x + target!.fx * map.width, map.y + target!.fy * map.height);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector<HTMLElement>('[data-hero]')!.__hero!.highlightedRow,
        ),
      )
      .toBe(target!.k);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-hero]')!.__hero!.scrubTo(1),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector<HTMLElement>('[data-hero]')!.__hero!.highlightedRow,
        ),
      )
      .toBe(0);
    await page.mouse.move(map.x - 20, map.y - 20);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector<HTMLElement>('[data-hero]')!.__hero!.highlightedRow,
        ),
      )
      .toBe(-1);
  });

  test('keyboard: Space, arrows and N act only when the hero is focused', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await noSmoothScroll(page);
    const hero = page.locator('[data-hero]');
    await hero.focus();
    await page.keyboard.press('Space');
    expect((await heroState(page)).state).toBe('paused');
    const p0 = (await heroState(page)).progress;
    await page.keyboard.press('ArrowRight');
    expect((await heroState(page)).progress).toBeGreaterThan(p0);
    await page.keyboard.press('ArrowLeft');
    expect((await heroState(page)).progress).toBeCloseTo(p0, 6);
    const seed = (await heroState(page)).seed;
    await page.keyboard.press('n');
    expect((await heroState(page)).seed).not.toBe(seed);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press('Space');
    expect((await heroState(page)).state).toBe('playing');
    // The summary for screen readers updates on pause.
    await page.keyboard.press('Space');
    await expect(page.locator('[data-hero-summary]')).toContainText('Paused.');

    // Typing in a form control must not trigger hero shortcuts.
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    const seedInput = page.locator('#hero-seed');
    const s1 = (await heroState(page)).seed;
    await seedInput.focus();
    await page.keyboard.press('n');
    await page.keyboard.press('Space');
    expect((await heroState(page)).seed).toBe(s1);
    expect((await heroState(page)).state).toBe('paused');
  });

  test('touch: tap Play and tap a bar', async ({ browser }) => {
    const ctx = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await waitForHero(page);
    await page.locator('.hero__bar [data-hero-play]').tap();
    expect((await heroState(page)).state).toBe('paused');
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-hero]')!.__hero!.scrubTo(1),
    );
    const box = (await page.locator('[data-hero-strip]').boundingBox())!;
    await page.touchscreen.tap(box.x + 30, box.y + 10);
    await expect(page.locator('[data-hero-readout]')).toContainText(/^Lake \d+ · born/);
    await ctx.close();
  });

  test('settings live in the F1 panel and drive the hero', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    const panel = page.locator('#settings-panel');
    await expect(panel).toBeVisible();
    for (const g of ['Terrain', 'Water', 'Barcode', 'Color']) {
      await expect(panel.getByRole('group', { name: g, exact: true })).toBeVisible();
    }
    await panel.locator('#hero-seed').fill('777');
    await panel.locator('#hero-seed').press('Enter');
    expect((await heroState(page)).seed).toBe('777');
    await panel.getByRole('button', { name: /^(Play|Pause)$/ }).click();
    const st = (await heroState(page)).state;
    await panel.getByRole('button', { name: /^(Play|Pause)$/ }).click();
    expect((await heroState(page)).state).not.toBe(st);
    await panel.locator('#hero-level').fill('50');
    await expect.poll(async () => (await heroState(page)).progress).toBeCloseTo(0.5, 3);
    expect((await heroState(page)).state).toBe('paused');
    const rows = () =>
      page.evaluate(
        () => document.querySelector<HTMLElement>('[data-hero]')!.__hero!.drawnRows.length,
      );
    await panel.locator('#hero-max-bars').fill('5');
    expect(await rows()).toBeLessThanOrEqual(5);
    await panel.locator('#hero-view').selectOption('diagram');
    await panel.locator('#hero-palette').selectOption('mono');
    await panel.locator('#hero-color-by').selectOption('depth');
    await panel.locator('#hero-show-barcode').uncheck();
    await expect(page.locator('[data-hero-strip-box]')).toBeHidden();
    await panel.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('[data-hero-strip-box]')).toBeVisible();
    expect((await heroState(page)).seed).toBe('777');
  });
});

test('islands barcode shares the strip and supports keyboard inspection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  await waitForHero(page);
  const strip = page.locator('[data-hero-strip]');
  const originalHeight = await strip.evaluate((el) => el.getBoundingClientRect().height);
  await expect(strip).toHaveAttribute('aria-label', /^Barcode:/);

  await page.getByRole('button', { name: 'Art settings', exact: true }).click();
  const panel = page.locator('#settings-panel');
  const view = panel.getByLabel('View', { exact: true });
  await view.selectOption('islands');
  await panel.locator('#hero-min-persistence').fill('0');
  await panel.locator('#hero-max-bars').fill('5');
  await expect(panel.locator('[data-hero-islands-copy]')).toBeVisible();
  await expect(strip).toHaveAttribute('aria-label', 'Islands barcode');
  await expect(strip).toHaveAttribute('aria-describedby', 'hero-islands-explainer');
  expect(await strip.evaluate((el) => el.getBoundingClientRect().height)).toBe(originalHeight);
  const shown = await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-hero]')!.__hero!.drawnIslandRows.map((bar) => ({
      birth: bar.birth,
      death: bar.death,
    })),
  );
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.length).toBeLessThanOrEqual(5);
  expect(shown.every((bar) => bar.death > bar.birth)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  const hero = page.locator('[data-hero]');
  await hero.focus();
  await hero.press('End');
  await expect(page.locator('[data-hero-summary]')).toContainText(
    `0 islands are present. The islands barcode shows ${shown.length} of ${shown.length} bars so far.`,
  );
  await hero.press('ArrowDown');
  await expect(page.locator('[data-hero-readout]')).toContainText(
    `Island · appears at ${Math.round(shown[0].birth)}\u00a0m · goes underwater at ${Math.round(shown[0].death)}\u00a0m`,
  );
  await hero.press('Escape');
  await expect(page.locator('[data-hero-readout]')).toContainText('0 islands');

  await page.getByRole('button', { name: 'Art settings', exact: true }).click();
  await view.selectOption('diagram');
  await expect(panel.locator('[data-hero-islands-copy]')).toBeHidden();
  await expect(strip).toHaveAttribute('aria-label', /^Persistence diagram:/);
  await view.selectOption('barcode');
  await expect(strip).toHaveAttribute('aria-label', /^Barcode:/);
});

test('islands barcode caption follows the visible strip across settings and modes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  await waitForHero(page);
  const caption = page.locator('[data-hero-caption]');
  const link = page.locator('[data-hero-caption-link]').getByRole('link');
  const islands =
    'An island appears when rising water cuts a hill off from land connected to the edge of the grid. It disappears when its last dry cell goes underwater. Each bar spans those two water levels.';
  const settings = page.getByRole('button', { name: 'Art settings', exact: true });
  const panel = page.locator('#settings-panel');
  const view = panel.getByLabel('View', { exact: true });
  const show = panel.getByLabel('Show barcode', { exact: true });
  await expect(caption).toHaveText(RISING_CAPTION);

  await settings.click();
  await view.selectOption('islands');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(caption).toBeVisible();
  await expect(caption).toHaveText(islands);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\/rising-water\/$/);

  await settings.click();
  await show.uncheck();
  await expect(caption).toHaveText(RISING_CAPTION);
  await show.check();
  await expect(caption).toHaveText(islands);
  await chooseMode(page, 'pond');
  await expect(caption).toHaveText(/^Ripples spread across a pond/);
  await expect(link).toBeHidden();
  await chooseMode(page, 'rising');
  await expect(view).toHaveValue('islands');
  await expect(caption).toHaveText(islands);

  await view.selectOption('diagram');
  await expect(caption).toHaveText(RISING_CAPTION);
  await view.selectOption('barcode');
  await expect(caption).toHaveText(RISING_CAPTION);
  await view.selectOption('islands');
  await panel.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(view).toHaveValue('barcode');
  await expect(caption).toHaveText(RISING_CAPTION);
});

test.describe('readout', () => {
  test('matches the true level and lake count after rapid ← presses', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await noSmoothScroll(page);
    const hero = page.locator('[data-hero]');
    await hero.focus();
    await page.keyboard.press('End');
    for (let i = 0; i < 13; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(33);
    }
    expect((await heroState(page)).state).toBe('paused');
    const want = await expectedLevelReadout(page);
    await expect.poll(() => readout(page), { timeout: 1000 }).toBe(want);
    // And it stays correct (no stale trailing update overwrites it).
    await page.waitForTimeout(400);
    expect(await readout(page)).toBe(want);
  });

  test('matches the truth after dragging the level slider', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    await animationsSettled(page, '#settings-panel');
    const slider = page.locator('#hero-level');
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.9, y);
    await page.mouse.down();
    for (let i = 0; i <= 12; i++) {
      await page.mouse.move(box.x + box.width * (0.9 - (0.6 * i) / 12), y);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const p = (await heroState(page)).progress;
    expect(p).toBeGreaterThan(0.2);
    expect(p).toBeLessThan(0.4);
    const want = await expectedLevelReadout(page);
    await expect.poll(() => readout(page), { timeout: 1000 }).toBe(want);
    await page.waitForTimeout(400);
    expect(await readout(page)).toBe(want);
  });

  test('reduced-motion static frame has a correct, non-empty readout', async ({ browser }) => {
    for (const width of [375, 1280]) {
      const ctx = await browser.newContext({
        reducedMotion: 'reduce',
        viewport: { width, height: 800 },
      });
      const page = await ctx.newPage();
      await page.goto(URL);
      await waitForHero(page);
      const want = await expectedLevelReadout(page);
      expect(want).toMatch(/^Level 450\u00a0m · /);
      await expect.poll(() => readout(page), { timeout: 1000 }).toBe(want);
      await page.waitForTimeout(1000);
      expect(await readout(page)).toBe(want);
      await ctx.close();
    }
  });

  for (const width of [375, 768, 1280]) {
    test(`bar highlight readout is not clipped at ${width}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(URL);
      await waitForHero(page);
      await page.evaluate(() =>
        document.querySelector<HTMLElement>('[data-hero]')!.__hero!.scrubTo(0.62),
      );
      const before = (await page.locator('.hero__bar').boundingBox())!.height;
      // Pick the longest-text case: a finite bar ("… spills into Lake N at … · persistence …").
      await page.locator('[data-hero]').focus();
      let text = '';
      for (let i = 0; i < 12 && !text.includes('spills into'); i++) {
        await page.keyboard.press('ArrowDown');
        text = await readout(page);
      }
      expect(text).toMatch(/^Lake \d+ · born .* · persistence \d+\u00a0m$/);
      const fit = await page.locator('[data-hero-readout]').evaluate((el) => ({
        sw: el.scrollWidth,
        cw: el.clientWidth,
        sh: el.scrollHeight,
        ch: el.clientHeight,
      }));
      expect(fit.sw).toBeLessThanOrEqual(fit.cw);
      expect(fit.sh).toBeLessThanOrEqual(fit.ch);
      // Reserved height: highlighting doesn't change the control row's height.
      expect((await page.locator('.hero__bar').boundingBox())!.height).toBe(before);
      await ctx.close();
    });
  }
});

test.describe('motion and pausing', () => {
  test('reduced motion: no autoplay, static frame at ~45 %, Play button', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(URL);
    await waitForHero(page);
    await framesSettled(page, async () => (await heroState(page)).frames);
    const a = await heroState(page);
    expect(a.state).toBe('paused');
    expect(a.running).toBe('false');
    expect(a.progress).toBeCloseTo(0.45, 6);
    await page.waitForTimeout(800);
    const b = await heroState(page);
    expect(b.running).toBe('false');
    expect(b.frames - a.frames).toBeLessThanOrEqual(2);
    expect(b.progress).toBeCloseTo(0.45, 6);
    expect(await mapVariance(page)).toBeGreaterThan(50);
    await expect(
      page.locator('.hero__bar').getByRole('button', { name: 'Play', exact: true }),
    ).toBeVisible();
    await ctx.close();
  });

  test('pauses when off-screen and resumes when back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await noSmoothScroll(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await heroState(page)).running).toBe('false');
    const f0 = (await heroState(page)).frames;
    await page.waitForTimeout(600);
    expect((await heroState(page)).frames).toBe(f0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
  });

  test('pauses in a hidden tab', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    const setVis = (v: string) =>
      page.evaluate((vis) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
        document.dispatchEvent(new Event('visibilitychange'));
      }, v);
    await setVis('hidden');
    await expect.poll(async () => (await heroState(page)).running).toBe('false');
    const f0 = (await heroState(page)).frames;
    await page.waitForTimeout(400);
    expect((await heroState(page)).frames).toBe(f0);
    await setVis('visible');
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
  });

  test('p95 frame time ≤ 22 ms during play at 1280×800', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await page.waitForTimeout(500);
    const deltas = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const d: number[] = [];
          let last = performance.now();
          const f = (t: number) => {
            d.push(t - last);
            last = t;
            if (d.length < 240) requestAnimationFrame(f);
            else resolve(d);
          };
          requestAnimationFrame(f);
        }),
    );
    expect((await heroState(page)).state).toBe('playing');
    const sorted = deltas.slice(1).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))];
    expect(p95).toBeLessThanOrEqual(22);
  });
});

test.describe('lifecycle', () => {
  test('destroy() clears every pending timer: no callback runs afterwards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    const r = await page.evaluate(async () => {
      const root = document.querySelector<HTMLElement>('[data-hero]')!;
      const h = root.__hero!;
      const readoutEl = root.querySelector<HTMLElement>('[data-hero-readout]')!;
      const summaryEl = root.querySelector<HTMLElement>('[data-hero-summary]')!;
      const raf = () => new Promise<void>((res) => requestAnimationFrame(() => res()));
      // While playing (so the readout's trailing timer is usually pending): the summary debounce
      // (300 ms, from a view change), then the resize-settle timer (200 ms, from a size change).
      h.setPlaying(true);
      await raf();
      await raf();
      h.update({ view: 'diagram' });
      root.style.setProperty('max-width', '40rem');
      await raf();
      await raf();
      const before = h.pendingTimers;
      const grid = h.grid;
      h.destroy();
      const after = h.pendingTimers;
      // Sentinels: any summary, readout or rebuild callback would overwrite or change these.
      readoutEl.textContent = 'sentinel-readout';
      summaryEl.textContent = 'sentinel-summary';
      const frames = h.frames;
      await new Promise((res) => setTimeout(res, 700));
      return {
        before,
        after,
        readout: readoutEl.textContent,
        summary: summaryEl.textContent,
        framesDelta: h.frames - frames,
        gridSame: h.grid.W === grid.W && h.grid.H === grid.H,
        running: root.dataset.running,
      };
    });
    expect(r.before).toBeGreaterThanOrEqual(2);
    expect(r.after).toBe(0);
    expect(r.readout).toBe('sentinel-readout');
    expect(r.summary).toBe('sentinel-summary');
    expect(r.framesDelta).toBe(0);
    expect(r.gridSame).toBe(true);
    expect(r.running).toBe('false');
  });
});

test.describe('accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: 0 serious/critical on / (${colorScheme}), settings closed and open`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      await page.goto(URL);
      await waitForHero(page);
      const check = async (label: string) => {
        const r = await new AxeBuilder({ page }).analyze();
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(
          bad.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(', ')}`),
        ).toEqual([]);
      };
      await check('closed');
      await page.getByRole('button', { name: 'Art settings', exact: true }).click();
      await expect(page.locator('#settings-panel')).toBeVisible();
      await animationsSettled(page, '#settings-panel');
      await check('open');
      await ctx.close();
    });
  }
});

/* ---------------------------------------------------------------------------------------------
 * F10 extra hero modes (stretch S1): Dye spill, Fractal pond, Random rivers, Collatz delta.
 * ------------------------------------------------------------------------------------------- */

const EXTRA_MODES = [
  {
    id: 'dye',
    label: 'Dye spill',
    interactive: true,
    caption: /^Dye leaks into a swirling current/,
  },
  {
    id: 'pond',
    label: 'Fractal pond',
    interactive: true,
    caption: /^Ripples spread across a pond/,
  },
  { id: 'rivers', label: 'Random rivers', interactive: false, caption: /^Every cell drains/ },
  { id: 'collatz', label: 'Collatz delta', interactive: false, caption: /^Numbers grow backwards/ },
] as const;

interface ModeState {
  mode: string;
  state: string;
  running: string;
  frames: number;
  seed: string;
  pokes: number;
}

async function modeState(page: Page): Promise<ModeState> {
  return page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('[data-hero]')!;
    const a = r.__art!;
    return {
      mode: r.dataset.mode ?? '',
      state: r.dataset.state ?? '',
      running: r.dataset.running ?? '',
      frames: a.frames,
      seed: r.dataset.seed ?? '',
      pokes: r.__heroMode?.pokes ?? 0,
    };
  });
}

async function waitForMode(page: Page, id: string): Promise<void> {
  await page.waitForFunction(
    (m) => {
      const r = document.querySelector<HTMLElement>('[data-hero]');
      return r?.dataset.mode === m && !!r.__art && (m === 'rising' ? !!r.__hero : !!r.__heroMode);
    },
    id,
    { timeout: 10_000 },
  );
}

/** Pick a mode with the on-page select. */
async function chooseMode(page: Page, id: string): Promise<void> {
  await page.getByLabel('Animation', { exact: true }).selectOption(id);
  await waitForMode(page, id);
}

test('hero toolbar exposes mode selection and settings at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=42&mode=dye');
  await waitForMode(page, 'dye');
  const select = page.getByLabel('Animation', { exact: true });
  const settings = page.getByRole('button', { name: 'Animation settings', exact: true });
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  const panel = page.locator('#settings-panel');
  await expect(panel).toBeHidden();
  await expect(select).toHaveValue('dye');
  await expect(settings).toHaveText('Settings');
  const selectBox = (await select.boundingBox())!;
  const buttonBox = (await settings.boundingBox())!;
  const mapBox = (await page.locator('[data-hero-map]').boundingBox())!;
  expect(selectBox.x + selectBox.width).toBeLessThan(buttonBox.x);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(320);
  expect(Math.abs(selectBox.y - buttonBox.y)).toBeLessThanOrEqual(1);
  expect(buttonBox.y + buttonBox.height).toBeLessThan(mapBox.y);

  await chooseMode(page, 'pond');
  await select.focus();
  await page.keyboard.press('Tab');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(page.locator('#settings-title')).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(gear).toHaveAttribute('aria-expanded', 'true');

  await panel.getByRole('button', { name: 'Reset', exact: true }).click();
  await waitForMode(page, 'rising');
  await expect(select).toHaveValue('rising');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(gear).toHaveAttribute('aria-expanded', 'false');

  await settings.click();
  await panel.getByRole('button', { name: 'Close art settings' }).click();
  await expect(settings).toBeFocused();
});

/** Cheap FNV hash of the map canvas pixels at 128×64 (for determinism checks). */
async function mapHash(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-hero-map]')!;
    const x = document.createElement('canvas');
    x.width = 128;
    x.height = 64;
    const g = x.getContext('2d')!;
    g.drawImage(c, 0, 0, 128, 64);
    const d = g.getImageData(0, 0, 128, 64).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
    return h >>> 0;
  });
}

test.describe('hero modes', () => {
  test('Collatz paints exactly the first complete edge before autoplay can advance', async ({
    page,
  }) => {
    type Paint = { pixels: string; readout: string | null; summary: string | null };
    type Probe = { first?: Paint; captureReference?: boolean; reference?: string };
    type PaintWindow = typeof window & { collatzPaint: Probe };
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const captures: Probe = {};
      (window as PaintWindow).collatzPaint = captures;
      const ctx = CanvasRenderingContext2D.prototype;
      const drawImage = ctx.drawImage;
      ctx.drawImage = new Proxy(drawImage, {
        apply(draw, receiver: CanvasRenderingContext2D, args) {
          Reflect.apply(draw, receiver, args);
          const { canvas } = receiver;
          if (captures.first || !canvas.matches('[data-hero-map]')) return;
          // Capture the first constructor draw, including any overlay, before another frame.
          queueMicrotask(() => {
            captures.first ??= {
              pixels: canvas.toDataURL(),
              readout: document.querySelector('[data-hero-readout]')!.textContent,
              summary: document.querySelector('[data-hero-summary]')!.textContent,
            };
          });
        },
      });

      ctx.stroke = new Proxy(ctx.stroke, {
        apply(draw, receiver: CanvasRenderingContext2D, args) {
          Reflect.apply(draw, receiver, args);
          const { canvas } = receiver;
          if (!captures.captureReference || canvas.isConnected) return;
          captures.captureReference = false;
          // The first stroke of the full, same-depth preview is the single edge 2 → 1.
          // Copy it into a regular canvas so the pixel format matches the visible map.
          const reference = document.createElement('canvas');
          reference.width = canvas.width;
          reference.height = canvas.height;
          Reflect.apply(drawImage, reference.getContext('2d'), [canvas, 0, 0]);
          captures.reference = reference.toDataURL();
        },
      });
    });
    await page.goto('/?seed=42&mode=collatz');
    await waitForMode(page, 'collatz');
    const first = await page.evaluate(() => (window as PaintWindow).collatzPaint.first);
    expect(first?.readout).toBe('2 numbers within 1 step of 1');
    expect(first?.summary).toContain('Playing. Seed 42.');
    expect(first?.summary).toContain('1 of 30 levels are fully drawn');

    await page.locator('.hero__bar').getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Animation settings', exact: true }).click();
    const steps = page.getByRole('slider', { name: 'Steps', exact: true });
    await steps.press('ArrowLeft');
    await expect(steps).toHaveValue('29');
    // Arm and send the return to depth 30 in the same turn, before another frame can draw.
    await steps.evaluate((slider) => {
      (window as PaintWindow).collatzPaint.captureReference = true;
      (slider as HTMLInputElement).value = '30';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('[data-hero-readout]')).toContainText(
      '3,518 numbers within 30 steps',
    );
    await expect
      .poll(() => page.evaluate(() => (window as PaintWindow).collatzPaint.reference))
      .toBe(first?.pixels);
    const visible = await page
      .locator('[data-hero-map]')
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
    expect(visible).not.toBe(first?.pixels);
  });

  test('Collatz Steps reaches 120 by keyboard, survives mode changes and replays, and resets to 30', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?seed=42&mode=collatz');
    await waitForMode(page, 'collatz');
    const readout = page.locator('[data-hero-readout]');
    const summary = page.locator('[data-hero-summary]');
    const panel = page.locator('#settings-panel');
    const steps = panel.getByRole('slider', { name: 'Steps', exact: true });
    const output = panel.locator('output[for="hero-collatz-steps"]');
    await expect(readout).toHaveText('2 numbers within 1 step of 1');
    await expect(summary).toContainText('1 of 30 levels are fully drawn');
    const baseline = await mapHash(page);
    await page.getByRole('button', { name: 'Animation settings', exact: true }).click();
    await expect(steps).toHaveValue('30');
    await expect(output).toHaveText('30');
    await steps.press('Home');
    await expect(steps).toHaveValue('1');
    await expect(readout).toHaveText('2 numbers within 1 step of 1');
    await expect(summary).toContainText('1 of 1 levels are fully drawn');
    await expect.poll(() => mapHash(page)).not.toBe(baseline);
    const shallow = await mapHash(page);
    await steps.press('End');
    await expect(steps).toHaveValue('120');
    await expect(output).toHaveText('120');
    await expect(readout).toHaveText('Sampled branches · 120 steps');
    await expect(summary).toContainText('120 of 120 levels are fully drawn');
    await expect.poll(async () => [baseline, shallow].includes(await mapHash(page))).toBe(false);
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-state', 'paused');

    await chooseMode(page, 'pond');
    await expect(steps).toBeHidden();
    await chooseMode(page, 'collatz');
    await expect(steps).toHaveValue('120');
    await expect(readout).toHaveText('Sampled branches · 1 step');
    await expect(summary).toContainText('1 of 120 levels are fully drawn');
    await panel.getByRole('button', { name: 'New terrain', exact: true }).click();
    await expect(readout).toHaveText('Sampled branches · 1 step');
    await expect(summary).toContainText('1 of 120 levels are fully drawn');
    await steps.press('ArrowLeft');
    await expect(readout).toHaveText('Sampled branches · 119 steps');
    await steps.press('End');
    await expect(readout).toHaveText('Sampled branches · 120 steps');
    await panel.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(summary).toContainText('1 of 120 levels are fully drawn');
    await panel.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(steps).toHaveValue('120');
    await steps.press('ArrowLeft');
    await expect(readout).toHaveText('Sampled branches · 119 steps');
    await panel.getByRole('button', { name: 'Reset', exact: true }).click();
    await waitForMode(page, 'rising');
    await expect(steps).toBeHidden();
    await chooseMode(page, 'collatz');
    await expect(steps).toHaveValue('30');
    await expect(output).toHaveText('30');
    await expect(readout).toHaveText('2 numbers within 1 step of 1');
    await expect(summary).toContainText('1 of 30 levels are fully drawn');
  });

  test('selector: Rising water is the default; each mode swaps chrome and draws; back again', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await waitForHero(page);
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    const panel = page.locator('#settings-panel');
    const select = page.getByLabel('Animation', { exact: true });
    await expect(select).toHaveValue('rising');
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-mode', 'rising');

    for (const m of EXTRA_MODES) {
      await chooseMode(page, m.id);
      const root = page.locator('[data-hero]');
      await expect(root).toHaveAttribute('aria-label', `${m.label} animation`);
      await expect(page.locator('[data-hero-strip-box]')).toBeHidden();
      // Rising-water-only controls are hidden; shared ones stay.
      for (const id of ['#hero-level', '#hero-pacing', '#hero-show-barcode', '#hero-color-by']) {
        await expect(panel.locator(id)).toBeHidden();
      }
      for (const id of ['#hero-seed', '#hero-speed', '#hero-palette']) {
        await expect(panel.locator(id)).toBeVisible();
      }
      await expect(page.locator('[data-hero-caption]')).toHaveText(m.caption);
      await expect(page.locator('[data-hero-caption-link]')).toBeHidden();
      const label = (await page.locator('[data-hero-map]').getAttribute('aria-label')) ?? '';
      expect(label.length).toBeGreaterThan(20);
      expect(label).not.toMatch(/\blakes?\b|barcode|persisten/i);
      await expect(page.locator('[data-hero-summary]')).toContainText(`${m.label}.`);
      await page.waitForTimeout(m.interactive ? 300 : 1200);
      expect(await mapVariance(page), `${m.id} canvas is blank`).toBeGreaterThan(50);
      expect((await modeState(page)).state).toBe('playing');
    }

    await chooseMode(page, 'rising');
    await expect(page.locator('[data-hero-strip-box]')).toBeVisible();
    await expect(page.locator('.hero__caption')).toContainText(RISING_CAPTION);
    await expect(
      page
        .locator('.hero__caption')
        .getByRole('link', { name: 'See it on the Colorado River Basin →' }),
    ).toBeVisible();
    await expect(page.locator('[data-hero]')).toHaveAttribute(
      'aria-label',
      'Rising water animation',
    );
    await expect(panel.locator('#hero-level')).toBeVisible();
    expect(await mapVariance(page)).toBeGreaterThan(50);
    expect(errors).toEqual([]);
  });

  test('switching tears the old mode down: no frames, timers or listeners left', async ({
    page,
  }) => {
    await page.goto('/?seed=42&mode=dye');
    await waitForMode(page, 'dye');
    // Keep handles to the old controllers, switch away, and watch them stay silent.
    await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('[data-hero]')!;
      (window as unknown as { __old: unknown[] }).__old = [r.__heroMode];
    });
    await chooseMode(page, 'pond');
    await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('[data-hero]')!;
      (window as unknown as { __old: unknown[] }).__old.push(r.__heroMode);
    });
    await chooseMode(page, 'rising');
    await page.evaluate(() => {
      const r = document.querySelector<HTMLElement>('[data-hero]')!;
      (window as unknown as { __old: unknown[] }).__old.push(r.__hero);
    });
    await chooseMode(page, 'collatz');
    const r = await page.evaluate(async () => {
      type Old = { frames: number; pendingTimers: number; isRunning: boolean; attached?: number };
      const old = (window as unknown as { __old: Old[] }).__old;
      const f0 = old.map((o) => o.frames);
      // Events the old controllers listened to must no longer reach them.
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((res) => setTimeout(res, 600));
      return old.map((o, i) => ({
        framesDelta: o.frames - f0[i],
        timers: o.pendingTimers,
        running: o.isRunning,
        attached: o.attached ?? 0,
      }));
    });
    for (const o of r) {
      expect(o).toEqual({ framesDelta: 0, timers: 0, running: false, attached: 0 });
    }
    expect((await modeState(page)).mode).toBe('collatz');
  });

  test('extra modes are lazy-loaded: not in the initial scripts, fetched on first switch', async ({
    page,
  }) => {
    const bodies: string[] = [];
    page.on('response', async (res) => {
      const t = res.request().resourceType();
      if (t === 'script' || /\.(m?js|ts)(\?|$)/.test(res.url())) {
        bodies.push(await res.text().catch(() => ''));
      }
    });
    await page.goto(URL);
    await waitForHero(page);
    await page.waitForLoadState('networkidle');
    // A string that only exists in the pond simulation module.
    const marker = 'breaks the 2-D CFL limit';
    expect(bodies.some((b) => b.includes(marker))).toBe(false);
    await chooseMode(page, 'pond');
    await expect.poll(() => bodies.some((b) => b.includes(marker))).toBe(true);
  });

  for (const m of EXTRA_MODES) {
    test(`${m.id}: deterministic per seed, N regenerates, Space pauses`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'reduce',
        viewport: { width: 1280, height: 800 },
      });
      const page = await ctx.newPage();
      await page.goto(`/?seed=42&mode=${m.id}`);
      await waitForMode(page, m.id);
      const h1 = await mapHash(page);
      await page.reload();
      await waitForMode(page, m.id);
      expect(await mapHash(page)).toBe(h1);
      await page.goto(`/?seed=43&mode=${m.id}`);
      await waitForMode(page, m.id);
      expect(await mapHash(page)).not.toBe(h1);

      await noSmoothScroll(page);
      await page.locator('[data-hero]').focus();
      const s0 = (await modeState(page)).seed;
      await page.keyboard.press('n');
      expect((await modeState(page)).seed).not.toBe(s0);
      await page.keyboard.press('Space');
      expect((await modeState(page)).state).toBe('playing');
      await page.keyboard.press('Space');
      expect((await modeState(page)).state).toBe('paused');
      await expect(page.locator('[data-hero-summary]')).toContainText(`${m.label}. Paused.`);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await ctx.close();
    });

    test(`${m.id}: reduced motion shows a static frame and a Play button`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto(`/?seed=42&mode=${m.id}`);
      await waitForMode(page, m.id);
      // Let the startup settle frames finish first (F9 attempt 4, note 1); autoplay would keep
      // counting through the whole window below, so this doesn't weaken the check.
      await framesSettled(page, async () => (await modeState(page)).frames);
      const a = await modeState(page);
      expect(a.state).toBe('paused');
      expect(a.running).toBe('false');
      await page.waitForTimeout(800);
      const b = await modeState(page);
      expect(b.running).toBe('false');
      expect(b.frames - a.frames).toBeLessThanOrEqual(2);
      expect(await mapVariance(page)).toBeGreaterThan(50);
      await expect(
        page.locator('.hero__bar').getByRole('button', { name: 'Play', exact: true }),
      ).toBeVisible();
      await ctx.close();
    });
  }

  for (const id of ['dye', 'pond'] as const) {
    test(`${id}: click/tap and Enter act at the canvas`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/?seed=42&mode=${id}`);
      await waitForMode(page, id);
      await noSmoothScroll(page);
      const box = (await page.locator('[data-hero-map]').boundingBox())!;
      const before = await mapHash(page);
      // Pause first, so any change in the picture comes from the click alone.
      await page.locator('.hero__bar').getByRole('button', { name: 'Pause', exact: true }).click();
      const paused = await mapHash(page);
      await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2);
      await expect.poll(async () => (await modeState(page)).pokes).toBe(1);
      await expect.poll(() => mapHash(page)).not.toBe(paused);
      await expect(page.locator('[data-hero-readout]')).toContainText(
        id === 'dye' ? '1 spill by you' : '1 pebble by you',
      );
      await page.locator('[data-hero]').focus();
      await page.keyboard.press('Enter');
      expect((await modeState(page)).pokes).toBe(2);
      await expect(page.locator('[data-hero-summary]')).toContainText(
        id === 'dye' ? '2 spills were added by clicking' : '2 were dropped by clicking',
      );
      expect(before).not.toBe(0);
    });
  }

  test('touch: tapping the pond drops a pebble', async ({ browser }) => {
    const ctx = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto('/?seed=42&mode=pond');
    await waitForMode(page, 'pond');
    const box = (await page.locator('[data-hero-map]').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(async () => (await modeState(page)).pokes).toBe(1);
    await ctx.close();
  });

  test('extra modes pause off-screen and in a hidden tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?seed=42&mode=dye');
    await waitForMode(page, 'dye');
    await noSmoothScroll(page);
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await modeState(page)).running).toBe('false');
    const f0 = (await modeState(page)).frames;
    await page.waitForTimeout(500);
    expect((await modeState(page)).frames).toBe(f0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await modeState(page)).running).toBe('true');

    const setVis = (v: string) =>
      page.evaluate((vis) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => vis });
        document.dispatchEvent(new Event('visibilitychange'));
      }, v);
    await setVis('hidden');
    await expect.poll(async () => (await modeState(page)).running).toBe('false');
    const f1 = (await modeState(page)).frames;
    await page.waitForTimeout(400);
    expect((await modeState(page)).frames).toBe(f1);
    await setVis('visible');
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
  });

  for (const m of EXTRA_MODES) {
    test(`${m.id}: p95 frame time ≤ 22 ms at 1280×800`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/?seed=42&mode=${m.id}`);
      await waitForMode(page, m.id);
      await expect.poll(async () => (await modeState(page)).running).toBe('true');
      await page.waitForTimeout(400);
      const deltas = await page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const d: number[] = [];
            let last = performance.now();
            const f = (t: number) => {
              d.push(t - last);
              last = t;
              if (d.length < 240) requestAnimationFrame(f);
              else resolve(d);
            };
            requestAnimationFrame(f);
          }),
      );
      const sorted = deltas.slice(1).sort((a, b) => a - b);
      expect(sorted[Math.floor(0.95 * (sorted.length - 1))]).toBeLessThanOrEqual(22);
    });
  }

  for (const width of [375, 768, 1280]) {
    test(`no horizontal overflow in any mode at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const m of EXTRA_MODES) {
        await page.goto(`/?seed=42&mode=${m.id}`);
        await waitForMode(page, m.id);
        const fit = await page.evaluate(() => {
          const ro = document.querySelector<HTMLElement>('[data-hero-readout]')!;
          return {
            doc: document.documentElement.scrollWidth,
            win: window.innerWidth,
            sw: ro.scrollWidth,
            cw: ro.clientWidth,
            sh: ro.scrollHeight,
            ch: ro.clientHeight,
          };
        });
        expect(fit.doc, m.id).toBeLessThanOrEqual(fit.win);
        expect(fit.sw, m.id).toBeLessThanOrEqual(fit.cw);
        expect(fit.sh, m.id).toBeLessThanOrEqual(fit.ch);
      }
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: 0 serious/critical in every extra mode (${colorScheme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme });
      const page = await ctx.newPage();
      for (const m of EXTRA_MODES) {
        await page.goto(`/?seed=42&mode=${m.id}`);
        await waitForMode(page, m.id);
        const r = await new AxeBuilder({ page }).analyze();
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(
          bad.map((v) => `${m.id}: ${v.id} ${v.nodes.map((n) => n.target).join(', ')}`),
        ).toEqual([]);
      }
      await page.getByRole('button', { name: 'Art settings', exact: true }).click();
      await animationsSettled(page, '#settings-panel');
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
        [],
      );
      await ctx.close();
    });
  }
});

/* -------------------------------------------------------------------------------------------
 * F26 hero playback and accessibility fixes (docs/qa/f23-production/report.md, QA-04 … QA-16).
 * ------------------------------------------------------------------------------------------- */

async function heroIntentPaused(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('[data-hero]')!.__heroIntent!.userPaused,
  );
}

const heroPlay = (page: Page) => page.locator('.hero__bar [data-hero-play]');

test.describe('F26 playback and accessibility', () => {
  test('QA-04: turning on reduced motion mid-play pauses; Play still works', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await heroState(page)).state).toBe('paused');
    await expect(heroPlay(page)).toHaveText('Play');
    await framesSettled(page, async () => (await heroState(page)).frames);
    const a = await heroState(page);
    await page.waitForTimeout(600);
    const b = await heroState(page);
    expect(b.frames).toBe(a.frames);
    expect(b.progress).toBe(a.progress);
    // A system pause is not a manual pause.
    expect(await heroIntentPaused(page)).toBe(false);
    // Explicit Play opts in.
    await heroPlay(page).click();
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await expect(heroPlay(page)).toHaveText('Pause');
  });

  test('QA-04: an extra mode also pauses when reduced motion turns on', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await chooseMode(page, 'collatz');
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await modeState(page)).state).toBe('paused');
    await expect(heroPlay(page)).toHaveText('Play');
    // Later switches under reduced motion don't autoplay either.
    await chooseMode(page, 'rising');
    await framesSettled(page, async () => (await heroState(page)).frames);
    expect((await heroState(page)).state).toBe('paused');
  });

  test('QA-05: a manual pause survives mode switches and keeps the held level', async ({
    page,
  }) => {
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await heroPlay(page).click();
    await expect(heroPlay(page)).toHaveText('Play');
    const held = (await heroState(page)).progress;
    expect(await heroIntentPaused(page)).toBe(true);

    for (const id of ['dye', 'pond', 'collatz']) {
      await chooseMode(page, id);
      await framesSettled(page, async () => (await modeState(page)).frames);
      const m = await modeState(page);
      expect(m.state, id).toBe('paused');
      expect(m.running, id).toBe('false');
      await expect(heroPlay(page)).toHaveText('Play');
    }
    await chooseMode(page, 'rising');
    await framesSettled(page, async () => (await heroState(page)).frames);
    const back = await heroState(page);
    expect(back.state).toBe('paused');
    expect(back.progress).toBeCloseTo(held, 6);

    // Play clears the manual pause: the next mode autoplays again.
    await heroPlay(page).click();
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    expect(await heroIntentPaused(page)).toBe(false);
    await chooseMode(page, 'dye');
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
  });

  test('QA-05: a keyboard pause (Space) and a scrub also count as manual pauses', async ({
    page,
  }) => {
    await page.goto(URL);
    await waitForHero(page);
    const hero = page.locator('[data-hero]');
    await hero.focus();
    await hero.press(' ');
    await expect.poll(async () => (await heroState(page)).state).toBe('paused');
    await chooseMode(page, 'rivers');
    await framesSettled(page, async () => (await modeState(page)).frames);
    expect((await modeState(page)).state).toBe('paused');
    await hero.focus();
    await hero.press(' ');
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
    await chooseMode(page, 'rising');
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await hero.focus();
    await hero.press('ArrowRight');
    expect((await heroState(page)).state).toBe('paused');
    await chooseMode(page, 'dye');
    await framesSettled(page, async () => (await modeState(page)).frames);
    expect((await modeState(page)).state).toBe('paused');
  });

  test('QA-05: reaching the end is not a manual pause', async ({ page }) => {
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    await page.evaluate(() => {
      const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
      h.update({ loop: false });
      h.progress = 0.995;
    });
    // Holds about 2.5 s at the top, then stops by itself.
    await expect
      .poll(async () => (await heroState(page)).state, { timeout: 10_000 })
      .toBe('paused');
    expect((await heroState(page)).progress).toBe(1);
    expect(await heroIntentPaused(page)).toBe(false);
    await chooseMode(page, 'pond');
    await expect.poll(async () => (await modeState(page)).running).toBe('true');
  });

  test('QA-09: the live summary follows playback at milestones, not every frame', async ({
    page,
  }) => {
    await page.goto(URL);
    await waitForHero(page);
    await expect.poll(async () => (await heroState(page)).running).toBe('true');
    const summary = page.locator('[data-hero-summary]');
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-hero]')!;
      const el = root.querySelector<HTMLElement>('[data-hero-summary]')!;
      const w = window as unknown as { __summaryChanges: string[] };
      w.__summaryChanges = [];
      new MutationObserver((recs) => {
        // One record per textContent assignment.
        for (let i = 0; i < recs.length; i++) w.__summaryChanges.push(el.textContent ?? '');
      }).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      const h = root.__hero!;
      h.update({ loop: false, speed: 3 });
      h.progress = 0.05;
    });
    // While still playing, the summary reports a level past the start.
    await expect
      .poll(
        async () => {
          const t = (await summary.textContent()) ?? '';
          const pct = Number(/(\d+)% of the way up/.exec(t)?.[1] ?? -1);
          return t.startsWith('Playing.') && pct >= 25;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    // Ends with an accurate paused summary.
    await expect
      .poll(async () => (await heroState(page)).state, { timeout: 15_000 })
      .toBe('paused');
    await expect(summary).toContainText('Paused.');
    await expect(summary).toContainText('100% of the way up');
    const changes = await page.evaluate(
      () => (window as unknown as { __summaryChanges: string[] }).__summaryChanges,
    );
    // A run at 3× takes ~4.4 s of frames: a handful of updates, not one per frame.
    expect(changes.length).toBeGreaterThanOrEqual(2);
    expect(changes.length).toBeLessThanOrEqual(8);
  });

  test('QA-09: keyboard and pointer selection of a bar is announced', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    await waitForHero(page);
    const hero = page.locator('[data-hero]');
    const summary = page.locator('[data-hero-summary]');
    await hero.focus();
    await hero.press('End');
    await hero.press('ArrowDown');
    await hero.press('ArrowDown');
    const label = await page.evaluate(() => {
      const t = document.querySelector('[data-hero-readout]')!.textContent ?? '';
      return /^Lake (\d+)/.exec(t)?.[1] ?? '';
    });
    expect(label).not.toBe('');
    await expect(summary).toHaveText(new RegExp(`^Selected Lake ${label}: born at \\d+`));
    // Escape returns to the level summary.
    await hero.press('Escape');
    await expect(summary).toContainText('Paused.');

    // A click on a drawn bar is announced too.
    const box = (await page.locator('[data-hero-strip]').boundingBox())!;
    const r = await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-hero]')!.__hero!.barRect(0),
    );
    await page.mouse.click(box.x + r!.x + r!.w / 2, box.y + r!.y + r!.h / 2);
    await expect(summary).toHaveText(/^Selected Lake \d+: born at/);

    // Islands view: the island is announced.
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-hero]')!.__hero!.update({
        view: 'islands',
        minPersistence: 0,
      }),
    );
    await hero.focus();
    await hero.press('ArrowDown');
    await expect(summary).toHaveText(/^Selected island: appears at \d+/);
  });

  test('QA-14: blank barcode space does not select a distant bar', async ({ browser }) => {
    for (const touch of [false, true]) {
      const ctx = await browser.newContext({
        viewport: touch ? { width: 390, height: 950 } : { width: 1200, height: 1000 },
        hasTouch: touch,
        isMobile: touch,
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await page.goto('/?seed=123456');
      await waitForHero(page);
      await page.evaluate(() => {
        const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
        h.update({ maxBars: 32 });
        h.scrubTo(1);
      });
      const strip = page.locator('[data-hero-strip]');
      await strip.scrollIntoViewIfNeeded();
      const box = (await strip.boundingBox())!;
      // A finite bar that ends well before the right edge.
      const target = await page.evaluate(() => {
        const h = document.querySelector<HTMLElement>('[data-hero]')!.__hero!;
        const w = h.stripSize.w;
        for (let k = 0; k < h.drawnRows.length; k++) {
          const r = h.barRect(k);
          if (r && Number.isFinite(h.drawnRows[k].death) && r.x + r.w < w - 80) return { k, r };
        }
        return null;
      });
      expect(target).not.toBeNull();
      const { k, r } = target!;
      const yMid = box.y + r.y + r.h / 2;
      const hl = () =>
        page.evaluate(
          () => document.querySelector<HTMLElement>('[data-hero]')!.__hero!.highlightedRow,
        );
      const act = async (x: number) =>
        touch ? page.touchscreen.tap(x, yMid) : page.mouse.move(x, yMid);
      await act(box.x + r.x + r.w / 2);
      await expect.poll(hl).toBe(k);
      // Far to the right of the bar, same row: clears (mouse) or leaves no distant pick (touch).
      await act(box.x + r.x + r.w + 60);
      await expect.poll(hl).toBe(-1);
      await act(box.x + r.x + r.w + 4); // within the small tolerance
      await expect.poll(hl).toBe(k);
      await ctx.close();
    }
  });

  test('QA-15: the address bar follows mode and seed without new history entries', async ({
    page,
  }) => {
    await page.goto('/?x=1&mode=collatz&seed=123456#hero-title');
    await waitForMode(page, 'collatz');
    const len = await page.evaluate(() => history.length);
    const url = () => new globalThis.URL(page.url());
    expect(url().searchParams.get('seed')).toBe('123456');

    await chooseMode(page, 'rising');
    await expect.poll(() => url().searchParams.get('mode')).toBe(null);
    expect(url().searchParams.get('seed')).toBe('123456');
    expect(url().searchParams.get('x')).toBe('1');
    expect(url().hash).toBe('#hero-title');

    await page.locator('.hero__bar [data-hero-new]').click();
    const seed = await page.evaluate(
      () => document.querySelector<HTMLElement>('[data-hero]')!.dataset.seed,
    );
    await expect.poll(() => url().searchParams.get('seed')).toBe(seed);

    await chooseMode(page, 'dye');
    await expect.poll(() => url().searchParams.get('mode')).toBe('dye');
    expect(url().searchParams.get('seed')).toBe(seed);
    expect(url().hash).toBe('#hero-title');
    expect(await page.evaluate(() => history.length)).toBe(len);

    // The written URL reopens the same state (drop the hash so this is a real navigation).
    const reopen = url();
    reopen.hash = '';
    await page.goto(reopen.href);
    await waitForMode(page, 'dye');
    expect(
      await page.evaluate(() => document.querySelector<HTMLElement>('[data-hero]')!.dataset.seed),
    ).toBe(seed);
  });

  test('QA-15: a bare / load leaves the address alone until the state changes', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForHero(page);
    await page.waitForTimeout(300);
    expect(new globalThis.URL(page.url()).search).toBe('');
    await chooseMode(page, 'pond');
    await expect.poll(() => new globalThis.URL(page.url()).searchParams.get('mode')).toBe('pond');
  });

  test('QA-16: with JavaScript off the hero has no dead tab stops', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(URL);
    const fig = page.locator('.hero__figure');
    for (const sel of [
      '#hero-mode',
      '[data-hero-play]',
      '[data-hero-new]',
      '.hero__toolbar button',
    ]) {
      await expect(fig.locator(sel).first(), sel).toBeDisabled();
    }
    expect(await page.locator('[data-hero]').getAttribute('tabindex')).toBeNull();
    await expect(page.locator('[data-hero-readout]')).toContainText('needs JavaScript');
    // Tab through the page: focus never lands on the hero's toolbar or animation box (the
    // caption's Colorado link is a real link and may take focus).
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const inHero = await page.evaluate(
        () => !!document.activeElement?.closest('.hero__toolbar, [data-hero]'),
      );
      expect(inHero, `Tab ${i + 1}`).toBe(false);
    }
    await ctx.close();
  });

  test('QA-16: with JavaScript the controls are enabled, and nothing shifts', async ({
    browser,
  }) => {
    const boxes = async (js: boolean) => {
      const ctx = await browser.newContext({
        javaScriptEnabled: js,
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await page.goto(URL);
      if (js) await waitForHero(page);
      // Relative to the hero figure, so header changes elsewhere don't matter here.
      const out = await page.evaluate(() => {
        const f = document.querySelector('.hero__figure')!.getBoundingClientRect();
        return ['.hero__toolbar', '#hero-mode', '.hero__map', '.hero__bar', '.hero__caption'].map(
          (s) => {
            const r = document.querySelector(s)!.getBoundingClientRect();
            return [r.x - f.x, r.y - f.y, r.width, r.height].map(Math.round);
          },
        );
      });
      if (js) {
        await expect(page.locator('.hero__bar [data-hero-play]')).toBeEnabled();
        await expect(page.locator('.hero__bar [data-hero-new]')).toBeEnabled();
        await expect(page.locator('#hero-mode')).toBeEnabled();
        await expect(page.locator('[data-hero]')).toHaveAttribute('tabindex', '0');
      }
      await ctx.close();
      return out;
    };
    expect(await boxes(true)).toEqual(await boxes(false));
  });

  for (const width of [320, 375, 768, 1280]) {
    test(`QA-13: the closed mode selector shows the longest mode name at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(URL);
      await waitForHero(page);
      const r = await page.evaluate(() => {
        const s = document.querySelector<HTMLSelectElement>('#hero-mode')!;
        const cs = getComputedStyle(s);
        const g = document.createElement('canvas').getContext('2d')!;
        g.font = cs.font;
        const text = Math.max(...[...s.options].map((o) => g.measureText(o.text).width));
        const inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const settings = document.querySelector('.hero__toolbar button')!.getBoundingClientRect();
        return {
          text,
          inner,
          right: settings.right,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      // Room for the text plus the native arrow (~20 px).
      expect(r.inner - r.text).toBeGreaterThanOrEqual(20);
      expect(r.right).toBeLessThanOrEqual(width);
      expect(r.overflow).toBeLessThanOrEqual(0);
    });
  }
});
