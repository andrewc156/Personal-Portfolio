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
    await expect(cap).toContainText(
      "Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime.",
    );
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
    const a = await heroState(page);
    expect(a.state).toBe('paused');
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

const RISING_CAPTION =
  "Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime.";

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

/** Pick a mode with the real settings-panel select. */
async function chooseMode(page: Page, id: string): Promise<void> {
  const panel = page.locator('#settings-panel');
  if (!(await panel.isVisible())) {
    await page.getByRole('button', { name: 'Art settings', exact: true }).click();
    await expect(panel).toBeVisible();
  }
  await panel.getByLabel('Animation', { exact: true }).selectOption(id);
  await waitForMode(page, id);
}

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
    const select = panel.getByLabel('Animation', { exact: true });
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
      const a = await modeState(page);
      expect(a.state).toBe('paused');
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
