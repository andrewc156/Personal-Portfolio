import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** F6 Colorado explorer (spec §6.4, §10/F6). */

const URL = '/rising-water/';
const meta = JSON.parse(readFileSync('public/data/colorado/meta.json', 'utf8')) as {
  label: string;
  width: number;
  min: { cell: number };
  derived: { displayAspect: number };
};
const barcode = JSON.parse(readFileSync('public/data/colorado/barcode.json', 'utf8')) as {
  b: number[];
  d: (number | null)[];
  bi: number[];
  di: number[];
  mi: number[];
  count: number;
};
const NBSP = ' ';
const plain = (s: string | null) => (s ?? '').replaceAll(NBSP, ' ');

/** Lake 3 of docs/data.md: the third-longest bar in barcode.json (computed, not typed). */
function rankedFromFile(r: number) {
  const ks = barcode.b
    .map((_, k) => k)
    .filter((k) => barcode.d[k] !== null)
    .sort((a, b) => barcode.d[b]! - barcode.b[b] - (barcode.d[a]! - barcode.b[a]));
  const k = ks[r - 1];
  return {
    b: barcode.b[k],
    d: barcode.d[k]!,
    bi: barcode.bi[k],
    di: barcode.di[k],
    mi: barcode.mi[k],
  };
}

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('[data-explorer]')?.dataset.ready === 'true',
    null,
    { timeout: 20_000 },
  );
}

async function state(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('[data-explorer]')!;
    const e = r.__explorer!;
    return {
      state: r.dataset.state ?? '',
      running: r.dataset.running ?? '',
      match: r.dataset.match ?? '',
      selected: r.dataset.selected ?? '',
      frames: e.frames,
      level: e.level,
      progress: e.progress,
      lakes: e.lakeCount,
    };
  });
}

async function pause(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.setPlaying(false),
  );
}

/** Let CSS transitions finish (DECISIONS #41) before axe or screenshots. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const running = document.getAnimations().filter((a) => a.playState !== 'finished');
    await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
  });
}

test.describe('explorer: load and verification', () => {
  test('loads, shows the exact label, live barcode matches barcode.json, no console errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await expect(
      page
        .getByText('Colorado River Basin study area (RiverNets coverage)', { exact: true })
        .first(),
    ).toBeVisible();
    expect(meta.label).toBe('Colorado River Basin study area (RiverNets coverage)');
    await ready(page);
    const s = await state(page);
    expect(s.match).toBe('true');
    await expect(page.locator('[data-ex-status]')).toContainText(
      `${barcode.count} of ${barcode.count} bars identical`,
    );
    const ms = Number(await page.locator('[data-explorer]').getAttribute('data-compute-ms'));
    expect(ms).toBeLessThan(500);
    // The drawn rows are the engine's bars, and the live exported bars equal the file.
    const live = await page.evaluate(() => {
      const e = document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!;
      const bars = e.result.bars.filter((b) => b.death === Infinity || b.death - b.birth >= 1);
      return {
        bi: bars.map((b) => b.birthCell),
        di: bars.map((b) => b.deathCell),
        b: bars.map((b) => b.birth),
        rowsAreEngine: e.rows.every((r) => e.result.bars.includes(r)),
      };
    });
    expect(live.bi).toEqual(barcode.bi);
    expect(live.di).toEqual(barcode.di);
    expect(live.b).toEqual(barcode.b);
    expect(live.rowsAreEngine).toBe(true);
    expect(errors).toEqual([]);
  });

  test('data transferred ≤ 3 MB and no third-party requests', async ({ page }) => {
    let bytes = 0;
    const offsite: string[] = [];
    page.on('requestfinished', async (r) => {
      if (!r.url().startsWith('http://localhost:4321')) offsite.push(r.url());
      const s = await r.sizes();
      bytes += s.responseBodySize + s.responseHeadersSize;
    });
    await page.goto(URL);
    await ready(page);
    await page.waitForTimeout(500);
    expect(offsite).toEqual([]);
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});

/** Index in barcode.json of the r-th longest-lived finite lake. */
function rankedIndex(r: number): number {
  const c = rankedFromFile(r);
  return barcode.bi.indexOf(c.bi);
}

test.describe('explorer: corrupted data are rejected', () => {
  const gridFile = () => readFileSync('public/data/colorado/grid.f32');
  const flip = (byte: number, mask: number) => () => {
    const bad = Buffer.from(gridFile());
    bad[byte] ^= mask;
    return bad;
  };
  const cases: {
    name: string;
    file: 'grid.f32' | 'barcode.json';
    body: () => Buffer | string;
    reason: RegExp;
  }[] = [
    // A low mantissa bit: every bar still matches, only the SHA-256 differs.
    {
      name: 'low mantissa bit (hash only)',
      file: 'grid.f32',
      body: flip(4 * 70000, 0x01),
      reason: /SHA-256 checksum/,
    },
    // An exponent byte of lake 3's pit: its height (and bars) change.
    {
      name: 'exponent byte of a top lake’s pit',
      file: 'grid.f32',
      body: () => flip(4 * rankedFromFile(3).bi + 3, 0x40)(),
      reason: /SHA-256 checksum/,
    },
    // Truncated by one float: rejected by the size check, before any hashing.
    {
      name: 'grid truncated by 4 bytes (size check)',
      file: 'grid.f32',
      body: () => gridFile().subarray(0, gridFile().length - 4),
      reason: /wrong size/,
    },
    // Intact grid, but one bar's death cell in barcode.json is altered: the live comparison fails.
    {
      name: 'barcode.json with one bar’s di altered (barcode comparison)',
      file: 'barcode.json',
      body: () => {
        const k = rankedIndex(3);
        const di = barcode.di.slice();
        di[k] = di[k] + 1;
        return JSON.stringify({ ...barcode, di });
      },
      reason: new RegExp(
        `does not match barcode\\.json \\(${barcode.count - 1} of ${barcode.count} bars identical\\)`,
      ),
    },
  ];
  for (const c of cases) {
    test(`${c.name}: visible error, one console.error, nothing drawn`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      const body = c.body();
      await page.route(`**/data/colorado/${c.file}`, (route) =>
        route.fulfill({
          status: 200,
          contentType: c.file === 'grid.f32' ? 'application/octet-stream' : 'application/json',
          body,
        }),
      );
      await page.goto(URL);
      await page.waitForFunction(
        () => document.querySelector<HTMLElement>('[data-explorer]')?.dataset.match === 'false',
        null,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(500);
      const status = page.locator('[data-ex-status]');
      await expect(status).toBeVisible();
      await expect(status).toHaveAttribute('data-kind', 'error');
      await expect(status).toContainText('failed its integrity check');
      await expect(status).toContainText(c.reason);
      await expect(status).toHaveAttribute('role', 'status');
      expect(errors).toHaveLength(1);
      await expect(page.locator('[data-ex-play]')).toBeDisabled();
      await expect(page.locator('#ex-level')).toBeDisabled();
      for (const el of await page.locator('[data-ex-control]').all())
        await expect(el).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Show lake 1 on the map', exact: true }),
      ).toBeDisabled();
      for (const sel of ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]']) {
        await expect(page.locator(sel)).toHaveText('–');
      }
      // Nothing implies the map can be used: no hint, no focus stop, no crosshair.
      await expect(page.locator('[data-ex-hover]')).toBeHidden();
      await expect(page.locator('[data-ex-hover]')).toHaveText('');
      await expect(page.getByText('Point at or tap the map')).toHaveCount(0);
      await expect(page.locator('[data-ex-stage]')).not.toHaveAttribute('tabindex', /.*/);
      expect(
        await page.locator('[data-ex-map]').evaluate((el) => getComputedStyle(el).cursor),
      ).toBe('default');
      const info = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-explorer]')!;
        const c = document.querySelector<HTMLCanvasElement>('[data-ex-map]')!;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let painted = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) painted++;
        return { painted, started: !!root.__explorer, ready: root.dataset.ready };
      });
      expect(info).toEqual({ painted: 0, started: false, ready: 'false' });
    });
  }
});

test.describe('explorer: interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL);
    await ready(page);
    await pause(page);
  });

  test('clicking a bar jumps below its death level, highlights it and fills the card', async ({
    page,
  }) => {
    const lake = rankedFromFile(3);
    const { y } = await page.evaluate((cell) => {
      const e = document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!;
      const k = e.rows.findIndex((r) => r.birthCell === cell);
      return { y: e.rowCenterCss(k) };
    }, lake.bi);
    const strip = page.locator('[data-ex-strip]');
    await strip.scrollIntoViewIfNeeded();
    const box = (await strip.boundingBox())!;
    await strip.click({ position: { x: box.width / 2, y } });
    const s = await state(page);
    expect(s.selected).toBe(String(lake.bi));
    expect(s.level).toBeLessThan(lake.d);
    expect(s.level).toBeGreaterThan(lake.d - 1e-9);
    expect(s.state).toBe('paused');
    // The lake is still alive (its own component) just below the spill level.
    const alive = await page.evaluate(
      (cell) =>
        document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.flood.componentOf(cell),
      lake.bi,
    );
    expect(alive).toBe(lake.bi);
    await expect(page.locator('[data-ex-card-title]')).toHaveText(
      `Lake${NBSP}3 · birth cell${NBSP}${lake.bi}`,
    );
    const text = plain(await page.locator('[data-ex-card-text]').textContent());
    const f = (v: number) =>
      v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    expect(text).toContain(`Born at ${f(lake.b)} m near`);
    expect(text).toContain(`merged at ${f(lake.d)} m at`);
    expect(text).toContain(`into the lowest lake (cell ${lake.mi})`);
    expect(text).toContain(`persistence ${f(lake.d - lake.b)} m.`);
  });

  test('table buttons do the same as a bar click; the lowest lake never merges', async ({
    page,
  }) => {
    const lake = rankedFromFile(1);
    await page.getByRole('button', { name: 'Show lake 1 on the map', exact: true }).click();
    let s = await state(page);
    expect(s.selected).toBe(String(lake.bi));
    expect(s.level).toBeLessThan(lake.d);
    await expect(page.locator('[data-ex-card-text]')).toContainText('merged at');
    await page.getByRole('button', { name: 'Show lowest lake on the map', exact: true }).click();
    s = await state(page);
    expect(s.selected).toBe(String(meta.min.cell));
    await expect(page.locator('[data-ex-card-text]')).toContainText('never merges');
    await expect(page.locator('[data-lake-row]')).toHaveCount(21);
  });

  test('hovering the map shows elevation and lat/lon', async ({ page }) => {
    const map = page.locator('[data-ex-map]');
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
    const hover = plain(await page.locator('[data-ex-hover]').textContent());
    expect(hover).toMatch(/^Elevation [\d,.−]+ m \([\d,−]+ ft\) at \d+\.\d{4}° N, \d+\.\d{4}° W/);
    const cell = Number(await page.locator('[data-explorer]').getAttribute('data-hover-cell'));
    const h = await page.evaluate(
      (c) => document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.heights[c],
      cell,
    );
    expect(hover).toContain(
      `${h.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('-', '−')} m`,
    );
  });

  test('units toggle switches readouts, card and table to feet', async ({ page }) => {
    await page.getByRole('button', { name: 'Show lake 3 on the map', exact: true }).click();
    await page.getByRole('button', { name: 'ft', exact: true }).click();
    await expect(page.locator('[data-ro-level]')).toHaveText(/ft$/);
    await expect(page.locator('[data-ro-level-alt]')).toHaveText(/m$/);
    await expect(page.locator('[data-ex-card-text]')).toContainText(`${NBSP}ft`);
    const lake = rankedFromFile(3);
    const ft = Math.round((lake.d - lake.b) / 0.3048).toLocaleString('en-US');
    await expect(page.locator(`[data-lake-row="${lake.bi}"] td`).first()).toHaveText(
      `${ft}${NBSP}ft`,
    );
    await page.getByRole('button', { name: 'm', exact: true }).click();
    await expect(page.locator('[data-ro-level]')).toHaveText(/m$/);
  });

  test('view toggle switches barcode and diagram, and the strip label follows', async ({
    page,
  }) => {
    const strip = page.locator('[data-ex-strip]');
    await expect(strip).toHaveAttribute('aria-label', /^Barcode:/);
    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    await expect(strip).toHaveAttribute('aria-label', /^Persistence diagram:/);
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Barcode', exact: true }).click();
    await expect(strip).toHaveAttribute('aria-label', /^Barcode:/);
  });

  test('keyboard on the focused map: Space, arrows, Home/End, Up/Down, Escape; scoped', async ({
    page,
  }) => {
    await page.locator('body').press('Space'); // not focused: page scroll, no play
    expect((await state(page)).state).toBe('paused');
    await page.evaluate(() => window.scrollTo(0, 0));
    const stage = page.locator('[data-ex-stage]');
    await stage.focus();
    await page.keyboard.press('Home');
    expect((await state(page)).progress).toBe(0);
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).progress).toBeGreaterThan(0);
    await page.keyboard.press('End');
    expect((await state(page)).progress).toBe(1);
    await page.keyboard.press('ArrowDown');
    expect((await state(page)).selected).not.toBe('');
    await page.keyboard.press('Escape');
    expect((await state(page)).selected).toBe('');
    await page.keyboard.press('Home');
    await page.keyboard.press('Space');
    expect((await state(page)).state).toBe('playing');
    await page.keyboard.press('Space');
    expect((await state(page)).state).toBe('paused');
  });

  test('the hidden summary updates on pause and scrub', async ({ page }) => {
    const summary = page.locator('[data-ex-summary]');
    await page.locator('#ex-level').fill('300');
    await expect(summary).toContainText('Paused. Water level');
    const lvl = await page.locator('[data-ro-level]').textContent();
    await expect(summary).toContainText(lvl!.split(NBSP)[0]);
  });
});

test.describe('explorer: motion and pausing', () => {
  test('reduced motion: no autoplay, static frame, Play button', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(URL);
    await ready(page);
    const a = await state(page);
    await page.waitForTimeout(1000);
    const b = await state(page);
    expect(a.state).toBe('paused');
    expect(b.progress).toBe(a.progress);
    expect(b.progress).toBeCloseTo(0.45, 6);
    await expect(page.locator('[data-ex-play]')).toHaveText('Play');
    await ctx.close();
  });

  test('plays by default and pauses off-screen and in a hidden tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await ready(page);
    await expect.poll(async () => (await state(page)).running).toBe('true');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await state(page)).running).toBe('false');
    const f0 = (await state(page)).frames;
    await page.waitForTimeout(600);
    expect((await state(page)).frames).toBe(f0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await state(page)).running).toBe('true');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await state(page)).running).toBe('false');
    const f1 = (await state(page)).frames;
    await page.waitForTimeout(600);
    expect((await state(page)).frames).toBe(f1);
  });
});

test.describe('explorer: layout and accessibility', () => {
  for (const width of [375, 768, 1280]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`no horizontal overflow, map aspect within 1% of meta, axe clean at ${width} ${colorScheme}`, async ({
        browser,
      }) => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        const page = await ctx.newPage();
        await page.goto(URL);
        await ready(page);
        await pause(page);
        await page.getByRole('button', { name: 'Show lake 3 on the map', exact: true }).click();
        await settled(page);
        const m = await page.evaluate(() => {
          const r = document.querySelector('[data-ex-map]')!.getBoundingClientRect();
          return {
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
            ratio: r.width / r.height,
          };
        });
        expect(m.sw).toBeLessThanOrEqual(m.cw);
        expect(Math.abs(m.ratio / meta.derived.displayAspect - 1)).toBeLessThan(0.01);
        const axe = await new AxeBuilder({ page }).analyze();
        const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => v.id)).toEqual([]);
        await ctx.close();
      });
    }
  }

  test('DPR is capped at 2', async ({ browser }) => {
    const ctx = await browser.newContext({
      deviceScaleFactor: 3,
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await ready(page);
    const r = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-ex-map]')!;
      return c.width / c.getBoundingClientRect().width;
    });
    expect(r).toBeLessThanOrEqual(2.01);
    await ctx.close();
  });

  test('About the data is generated from meta.json and ATTRIBUTION.md', async ({ page }) => {
    const m = JSON.parse(readFileSync('public/data/colorado/meta.json', 'utf8')) as {
      licence: { requiredNotice: string };
      processing: string[];
      limitations: string[];
    };
    await page.goto(URL);
    await expect(page.locator('[data-required-notice]')).toHaveText(m.licence.requiredNotice);
    await expect(page.locator('[data-processing] li')).toHaveText(m.processing);
    await expect(page.locator('[data-limitations] li')).toHaveText(m.limitations);
  });
});
