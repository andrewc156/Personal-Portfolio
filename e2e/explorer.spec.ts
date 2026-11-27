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

  test('data transferred ≤ 3 MB, no third-party requests, basin mask not fetched', async ({
    page,
    baseURL,
  }) => {
    let bytes = 0;
    const offsite: string[] = [];
    const masks: string[] = [];
    const origin = new globalThis.URL(baseURL ?? 'http://localhost:4321').origin;
    page.on('request', (r) => {
      if (r.url().includes('basin-mask')) masks.push(r.url());
    });
    page.on('requestfinished', async (r) => {
      if (!r.url().startsWith(origin)) offsite.push(r.url());
      const s = await r.sizes();
      bytes += s.responseBodySize + s.responseHeadersSize;
    });
    await page.goto(URL);
    await ready(page);
    await page.waitForTimeout(500);
    expect(offsite).toEqual([]);
    expect(bytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    // The basin mask (F12b) is off by default and is not on the critical path.
    expect(masks).toEqual([]);
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

  // F28c plan 12 (DECISIONS #90): readouts and slider outputs are continuous functional data, so
  // they change as plain text at once. A CSS/WAAPI animation or a custom element (e.g.
  // <number-flow>) on any of them fails here.
  test('readouts and slider outputs update as plain text with no animation (F28)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    await ready(page);
    const r = await page.evaluate(() => {
      const sel = [
        '[data-ro-level]',
        '[data-ro-pct]',
        '[data-ro-lakes]',
        '[data-ro-area]',
        '[data-ex-level-out]',
        '[data-ex-minp-out]',
        '[data-ex-topn-out]',
      ];
      const before = sel.map((s) => document.querySelector(s)!.textContent);
      const level = document.querySelector<HTMLInputElement>('#ex-level')!;
      for (let i = 0; i < 10; i++) {
        level.value = String(200 + i * 40);
        level.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const topn = document.querySelector<HTMLInputElement>('#ex-topn')!;
      topn.value = String(Number(topn.value) + 10);
      topn.dispatchEvent(new Event('input', { bubbles: true }));
      const after = sel.map((s) => document.querySelector(s)!.textContent);
      const anims = sel.flatMap((s) =>
        document.querySelector(s)!.getAnimations({ subtree: true }),
      ).length;
      const custom = sel.filter((s) =>
        document.querySelector(s)!.querySelector('*:not(span)'),
      ).length;
      return { changed: after.filter((t, i) => t !== before[i]).length, anims, custom };
    });
    expect(r.changed).toBeGreaterThan(0); // the text updated synchronously
    expect(r.anims).toBe(0); // no CSS or WAAPI animation on any readout
    expect(r.custom).toBe(0); // no custom element (e.g. <number-flow>) inside them
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

// ---- F12b: basin mask (stretch S3) ----------------------------------------------------------

const basinInfo = JSON.parse(readFileSync('public/data/colorado/basin-mask.json', 'utf8')) as {
  attribution: { credit: string };
  coverage: string[];
  grid: { extent: [number, number, number, number] };
};

/** docs/data.md GNIS sanity point (parsed, not retyped). */
function gnis(place: string): { lat: number; lon: number } {
  const md = readFileSync('docs/data.md', 'utf8');
  const line = md.split('\n').find((l) => l.startsWith(`| ${place} |`))!;
  const [lat, lon] = line
    .split('|')[3]
    .split(',')
    .map((v) => Number(v.trim().replace('−', '-')));
  return { lat, lon };
}

/** Fractional map position of a lat/lon on the native footprint. */
function mapFraction(p: { lat: number; lon: number }): { fx: number; fy: number } {
  const [w, s, e, n] = basinInfo.grid.extent;
  return { fx: (p.lon - w) / (e - w), fy: (n - p.lat) / (n - s) };
}

async function basinState(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('[data-explorer]')!.dataset.basin ?? '',
  );
}

test.describe('explorer: basin mask', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('toggle on/off by keyboard: lazy verified load, hatching aligned with known places', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const masks: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('basin-mask')) masks.push(r.url());
    });
    await page.goto(URL);
    await ready(page);
    await pause(page);
    expect(masks).toEqual([]);
    const box = page.getByRole('checkbox', { name: 'Basin mask' });
    await expect(box).toBeEnabled();
    await expect(box).not.toBeChecked();
    await expect(page.locator('#ex-basin-desc')).toContainText(
      'USGS Watershed Boundary Dataset regions 14–15',
    );
    await expect(page.locator('[data-basin-col]')).toBeHidden();

    await box.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => basinState(page)).toBe('on');
    await expect(box).toBeChecked();
    expect(masks.some((u) => u.endsWith('/basin-mask.bin'))).toBe(true);
    await expect(page.locator('[data-ex-basin-status]')).toContainText('97,311 of 134,964');

    // Known cells: Lake Mead inside (region 15), Great Salt Lake outside.
    const mead = mapFraction(gnis('Lake Mead'));
    const gsl = mapFraction(gnis('Great Salt Lake'));
    const probe = await page.evaluate(
      ({ mead, gsl }) => {
        const e = document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!;
        e.scrubTo(0); // only the lowest cell is wet
        const c = document.querySelector<HTMLCanvasElement>('[data-ex-map]')!;
        return new Promise<{ cells: number[]; alpha: number[]; regions: number[] }>((res) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const ctx = c.getContext('2d')!;
              const at = (p: { fx: number; fy: number }) =>
                ctx.getImageData(Math.floor(p.fx * c.width), Math.floor(p.fy * c.height), 1, 1)
                  .data[3];
              const cells = [e.cellAt(mead.fx, mead.fy), e.cellAt(gsl.fx, gsl.fy)];
              res({
                cells,
                regions: cells.map((k) => e.basinAt(k)),
                alpha: [at(mead), at(gsl)],
              });
            }),
          ),
        );
      },
      { mead, gsl },
    );
    expect(probe.regions).toEqual([15, 0]);
    expect(probe.alpha[0]).toBe(0); // inside: nothing drawn over the relief
    expect(probe.alpha[1]).toBeGreaterThan(0); // outside: dimmed / hatched

    // Table column and hover note.
    await expect(page.locator('[data-basin-col]')).toBeVisible();
    const lowest = page.locator(`[data-basin-cell="${meta.min.cell}"]`);
    await expect(lowest).toHaveText(`yes (region${NBSP}15)`);
    const map = page.locator('[data-ex-map]');
    await map.scrollIntoViewIfNeeded();
    const mb = (await map.boundingBox())!;
    await page.mouse.move(mb.x + gsl.fx * mb.width, mb.y + gsl.fy * mb.height);
    await expect(page.locator('[data-ex-hover]')).toContainText('outside the basin mask');
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.setPlaying(false),
    );
    await expect(page.locator('[data-ex-summary]')).toContainText('Basin mask on');

    // Off again: nothing drawn at the outside point, column hidden, no refetch on the next on.
    await box.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => basinState(page)).toBe('off');
    await expect(page.locator('[data-basin-col]')).toBeHidden();
    const alphaOff = await page.evaluate((p) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-ex-map]')!;
      return new Promise<number>((res) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            res(
              c
                .getContext('2d')!
                .getImageData(Math.floor(p.fx * c.width), Math.floor(p.fy * c.height), 1, 1)
                .data[3],
            ),
          ),
        ),
      );
    }, gsl);
    expect(alphaOff).toBe(0);
    const n = masks.length;
    await box.check();
    await expect.poll(() => basinState(page)).toBe('on');
    expect(masks.length).toBe(n);
    // The barcode is unchanged by the mask.
    const live = await page.evaluate(() => {
      const e = document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!;
      return e.result.bars.filter((b) => b.death === Infinity || b.death - b.birth >= 1).length;
    });
    expect(live).toBe(barcode.count);
    expect(errors).toEqual([]);
  });

  test('URL hash round trip; section anchors still work', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    await page.getByRole('checkbox', { name: 'Basin mask' }).check();
    await expect.poll(() => basinState(page)).toBe('on');
    expect(new globalThis.URL(page.url()).hash).toBe('#mask=basin');

    await page.reload();
    await ready(page);
    await expect.poll(() => basinState(page)).toBe('on');
    await expect(page.getByRole('checkbox', { name: 'Basin mask' })).toBeChecked();

    await page.getByRole('checkbox', { name: 'Basin mask' }).uncheck();
    await expect.poll(() => basinState(page)).toBe('off');
    expect(new globalThis.URL(page.url()).hash).toBe('');

    // Hash changes drive the toggle too.
    await page.evaluate(() => (location.hash = '#mask=basin'));
    await expect.poll(() => basinState(page)).toBe('on');
    // An anchor hash (backward compatible) neither turns the mask off nor breaks navigation.
    await page.evaluate(() => (location.hash = '#about-data'));
    await page.waitForTimeout(200);
    expect(await basinState(page)).toBe('on');

    const masks: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('basin-mask')) masks.push(r.url());
    });
    await page.goto('about:blank');
    await page.goto(URL + '#lakes');
    await ready(page);
    await expect(page.getByRole('checkbox', { name: 'Basin mask' })).not.toBeChecked();
    await page.waitForTimeout(300);
    expect(masks).toEqual([]);
    expect(new globalThis.URL(page.url()).hash).toBe('#lakes');
  });

  const broken: { name: string; status: number; body: () => Buffer | string; reason: RegExp }[] = [
    {
      name: 'missing (404)',
      status: 404,
      body: () => 'not found',
      reason: /could not be downloaded/,
    },
    {
      name: 'one flipped bit (SHA-256)',
      status: 200,
      body: () => {
        const b = Buffer.from(readFileSync('public/data/colorado/basin-mask.bin'));
        b[4000] ^= 0x08;
        return b;
      },
      reason: /SHA-256 checksum/,
    },
    {
      name: 'truncated',
      status: 200,
      body: () => readFileSync('public/data/colorado/basin-mask.bin').subarray(0, 1000),
      reason: /does not match the elevation grid/,
    },
  ];
  for (const c of broken) {
    test(`mask ${c.name}: clear error, mask off, explorer keeps working`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/data/colorado/basin-mask.bin', (route) =>
        route.fulfill({
          status: c.status,
          contentType: 'application/octet-stream',
          body: c.body(),
        }),
      );
      await page.goto(URL + '#mask=basin');
      await ready(page);
      await expect.poll(() => basinState(page)).toBe('error');
      const status = page.locator('[data-ex-basin-status]');
      await expect(status).toBeVisible();
      await expect(status).toHaveAttribute('role', 'status');
      await expect(status).toHaveAttribute('data-kind', 'error');
      await expect(status).toContainText('The basin mask failed to load');
      await expect(status).toContainText(c.reason);
      const box = page.getByRole('checkbox', { name: 'Basin mask' });
      await expect(box).not.toBeChecked();
      await expect(box).toBeEnabled();
      expect(new globalThis.URL(page.url()).hash).toBe('');
      await expect(page.locator('[data-basin-col]')).toBeHidden();
      // The rest of the explorer is untouched.
      expect((await state(page)).match).toBe('true');
      await pause(page);
      await page.locator('[data-ex-play]').click();
      expect((await state(page)).state).toBe('playing');
      await pause(page);
      await page.getByRole('button', { name: 'Show lake 1 on the map', exact: true }).click();
      expect((await state(page)).selected).not.toBe('');
      // One console.error from the explorer (plus the browser's own line for an HTTP 404).
      const ours = errors.filter((e) => !e.startsWith('Failed to load resource'));
      expect(ours).toHaveLength(1);
      expect(ours[0]).toContain('basin mask failed');
    });
  }

  test('switching the mask off and on while loading reports a failed request once', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('basin mask failed')) {
        errors.push(message.text());
      }
    });
    let release!: () => void;
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      '**/data/colorado/basin-mask.bin',
      async (route) => {
        await response;
        await route.fulfill({ status: 404, body: 'not found' });
      },
      { times: 1 },
    );
    await page.goto(URL);
    await ready(page);
    const box = page.getByRole('checkbox', { name: 'Basin mask' });
    await box.check();
    await box.uncheck();
    await box.check();
    await expect(page.locator('[data-ex-basin-status]')).toHaveAttribute('data-kind', 'loading');
    release();
    await expect.poll(() => basinState(page)).toBe('error');
    await expect(box).not.toBeChecked();
    expect(errors).toHaveLength(1);

    await box.check();
    await expect.poll(() => basinState(page)).toBe('on');
  });

  for (const width of [375, 768, 1280]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`mask on: no overflow, axe clean at ${width} ${colorScheme}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        const page = await ctx.newPage();
        await page.goto(URL + '#mask=basin');
        await ready(page);
        await pause(page);
        await expect.poll(() => basinState(page)).toBe('on');
        await page.getByRole('button', { name: 'Show lake 3 on the map', exact: true }).click();
        await settled(page);
        const m = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(m.sw).toBeLessThanOrEqual(m.cw);
        await expect(page.locator('[data-ex-card-text]')).toContainText('basin mask');
        const axe = await new AxeBuilder({ page }).analyze();
        const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(bad.map((v) => v.id)).toEqual([]);
        await ctx.close();
      });
    }
  }

  test('About the data shows the WBD credit and coverage notes from basin-mask.json', async ({
    page,
  }) => {
    await page.goto(URL);
    await expect(page.locator('[data-basin-credit]')).toHaveText(basinInfo.attribution.credit);
    await expect(page.locator('[data-basin-coverage] li')).toHaveText(basinInfo.coverage);
    await expect(page.locator('[data-basin-about]')).toContainText('INEGI');
    await expect(page.locator('body')).not.toContainText(/US portion only/i);
  });
});

test.describe('explorer: place labels', () => {
  test('listens for late fonts only while place labels are shown', async ({ page }) => {
    await page.addInitScript(() => {
      const fonts = document.fonts;
      const listeners = new Set<EventListenerOrEventListenerObject>();
      const add = EventTarget.prototype.addEventListener.bind(fonts);
      const remove = EventTarget.prototype.removeEventListener.bind(fonts);
      fonts.addEventListener = (...args: Parameters<EventTarget['addEventListener']>) => {
        if (args[0] === 'loadingdone' && args[1]) listeners.add(args[1]);
        add(...args);
      };
      fonts.removeEventListener = (...args: Parameters<EventTarget['removeEventListener']>) => {
        if (args[0] === 'loadingdone' && args[1]) listeners.delete(args[1]);
        remove(...args);
      };
      Object.assign(window, { labelFontListeners: () => listeners.size });
    });
    const listenerCount = () =>
      page.evaluate(() =>
        (window as Window & { labelFontListeners?: () => number }).labelFontListeners!(),
      );

    await page.goto(URL);
    await ready(page);
    expect(await listenerCount()).toBe(0);

    const toggle = page.getByRole('checkbox', { name: 'Place labels' });
    await toggle.check();
    expect(await listenerCount()).toBe(1);
    await toggle.uncheck();
    expect(await listenerCount()).toBe(0);
    await toggle.check();
    expect(await listenerCount()).toBe(1);

    const label = page.locator('[data-place-id][data-placed]').first();
    const width = await label.evaluate((node) => {
      const rect = node.querySelector('rect')!;
      rect.setAttribute('width', '0');
      document.fonts.dispatchEvent(new Event('loadingdone'));
      return rect.width.baseVal.value;
    });
    expect(width).toBeGreaterThan(0);
    await toggle.uncheck();
    expect(await listenerCount()).toBe(0);
  });

  test('keyboard toggle presents the source, preserves the mask, and leaves the grid unchanged', async ({
    page,
  }) => {
    await page.goto(URL);
    await ready(page);
    await pause(page);
    const root = page.locator('[data-explorer]');
    const layer = root.locator('[data-ex-place-layer]');
    const toggle = page.getByRole('checkbox', { name: 'Place labels' });
    await expect(toggle).not.toBeChecked();
    await expect(layer).toBeHidden();
    const before = await state(page);

    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await expect(layer).toBeVisible();
    await expect(layer.locator('[data-placed]').first()).toBeVisible();
    await expect(root.locator('[data-ex-place-status]')).toContainText('place labels shown');

    await page.getByRole('checkbox', { name: 'Basin mask' }).check();
    await expect(root).toHaveAttribute('data-basin', 'on');
    await expect(layer).toBeVisible();
    const after = await state(page);
    for (const key of ['match', 'level', 'lakes', 'selected'] as const) {
      expect(after[key]).toBe(before[key]);
    }

    await toggle.uncheck();
    await expect(layer).toBeHidden();
    await expect(root).toHaveAttribute('data-basin', 'on');

    const about = page.locator('#place-labels-source');
    await expect(about.locator('[data-place-credit]')).toContainText('U.S. Geological Survey');
    await about.getByText(/All \d+ places and coordinates/).click();
    await expect(about.locator('[data-place-list]')).toContainText('Colorado River (mouth)');
    await expect(about.locator('[data-place-list]')).toContainText('Roosevelt Lake');
    await expect(about.getByRole('link', { name: 'USGS FAQ on GNIS coordinates' })).toBeVisible();
  });

  for (const width of [320, 375, 768, 1280]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`map labels, markers, and leaders stay separated at ${width}px (${colorScheme})`, async ({
        browser,
      }) => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        try {
          const page = await context.newPage();
          await page.goto(URL);
          await ready(page);
          await pause(page);
          await page.getByRole('checkbox', { name: 'Basin mask' }).check();
          await expect(page.locator('[data-explorer]')).toHaveAttribute('data-basin', 'on');
          await page.getByRole('checkbox', { name: 'Place labels' }).check();
          const layer = page.locator('[data-ex-place-layer]');
          await expect(layer.locator('[data-place-id][data-placed]').first()).toBeVisible();
          // CI3: placards are drawn in the self-hosted Plex Sans on every OS, and laid out
          // from the drawn text once the webfont is in use.
          await page.evaluate(() => document.fonts.ready);
          await expect
            .poll(() =>
              layer.evaluate((svg) => {
                const text = svg.querySelector('[data-place-placards] text')!;
                const family = getComputedStyle(text).fontFamily;
                const loaded = document.fonts.check("600 11px 'IBM Plex Sans'");
                const stale = Array.from(
                  svg.querySelectorAll<SVGGElement>('[data-place-id][data-placed]'),
                ).filter((node) => {
                  const drawn = Math.ceil(node.querySelector('text')!.getComputedTextLength()) + 8;
                  return Math.abs(node.querySelector('rect')!.width.baseVal.value - drawn) > 0.01;
                }).length;
                return { plexFirst: family.startsWith('"IBM Plex Sans"'), loaded, stale };
              }),
            )
            .toEqual({ plexFirst: true, loaded: true, stale: 0 });
          const geometry = await layer.evaluate((svg) => {
            const { width, height } = svg.getBoundingClientRect();
            const markers = svg.querySelector('[data-place-markers]')!;
            const placards = svg.querySelector('[data-place-placards]')!;
            return {
              width,
              height,
              markersBehind: Boolean(
                markers.compareDocumentPosition(placards) & Node.DOCUMENT_POSITION_FOLLOWING,
              ),
              allPriorityNames: placards.querySelectorAll('[data-priority="1"]').length,
              placed: Array.from(
                placards.querySelectorAll<SVGGElement>('[data-place-id][data-placed]'),
                (node) => {
                  const rect = node.querySelector('rect')!.getBBox();
                  const marker = markers.querySelector(
                    `[data-place-marker="${node.dataset.placeId}"][data-placed]`,
                  )!;
                  const dot = marker.querySelector('circle')!;
                  const line = marker.querySelector('line')!;
                  return {
                    topPriority: node.dataset.priority === '1',
                    x: dot.cx.baseVal.value,
                    y: dot.cy.baseVal.value,
                    radius: dot.r.baseVal.value + 0.625,
                    lineX: line.x1.baseVal.value,
                    lineY: line.y1.baseVal.value,
                    tipX: line.x2.baseVal.value,
                    tipY: line.y2.baseVal.value,
                    expectedX: width * Number(node.dataset.x),
                    expectedY: height * Number(node.dataset.y),
                    left: rect.x,
                    top: rect.y,
                    right: rect.x + rect.width,
                    bottom: rect.y + rect.height,
                  };
                },
              ),
            };
          });
          const { placed } = geometry;

          expect(geometry.markersBehind).toBe(true);
          expect(geometry.allPriorityNames).toBeGreaterThan(0);
          expect(placed.filter((p) => p.topPriority)).toHaveLength(geometry.allPriorityNames);
          for (const box of placed) {
            expect(box.x).toBeCloseTo(box.expectedX, 3);
            expect(box.y).toBeCloseTo(box.expectedY, 3);
            expect(box.lineX).toBeCloseTo(box.x, 3);
            expect(box.lineY).toBeCloseTo(box.y, 3);
            expect(box.tipX).toBeCloseTo(Math.max(box.left, Math.min(box.x, box.right)), 3);
            expect(box.tipY).toBeCloseTo(Math.max(box.top, Math.min(box.y, box.bottom)), 3);
            expect(box.left).toBeGreaterThanOrEqual(0);
            expect(box.top).toBeGreaterThanOrEqual(0);
            expect(box.right).toBeLessThanOrEqual(geometry.width);
            expect(box.bottom).toBeLessThanOrEqual(geometry.height);
            const dx = box.tipX - box.x;
            const dy = box.tipY - box.y;
            const steps = Math.ceil(Math.hypot(dx, dy));
            const crossesPlacard = placed.some((other) => {
              if (other === box) return false;
              const placardsOverlap =
                box.left < other.right &&
                other.left < box.right &&
                box.top < other.bottom &&
                other.top < box.bottom;
              const markerOverlaps =
                box.x - box.radius < other.right &&
                box.x + box.radius > other.left &&
                box.y - box.radius < other.bottom &&
                box.y + box.radius > other.top;
              if (placardsOverlap || markerOverlaps) return true;
              for (let i = 1; i <= steps; i++) {
                const x = box.x + (dx * i) / steps;
                const y = box.y + (dy * i) / steps;
                if (x >= other.left && x <= other.right && y >= other.top && y <= other.bottom) {
                  return true;
                }
              }
              return false;
            });
            expect(crossesPlacard).toBe(false);
          }
        } finally {
          await context.close();
        }
      });
    }
  }
});

/** F27: fixes for production QA (docs/qa/f23-production/report.md QA-06, QA-07, QA-08, QA-10). */
test.describe('explorer: F27 focus, touch, keyboard and no-JS', () => {
  const elevation = (h: number) =>
    `${h.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('-', '−')} m`;
  const heightAt = (page: Page, cell: number) =>
    page.evaluate(
      (c) => document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.heights[c],
      cell,
    );
  const defaultHint = (page: Page) =>
    page.locator('[data-ex-hover]').getAttribute('data-default') as Promise<string>;

  test('F27 QA-06: keyboard Show moves focus to the map, announced, and Tab continues', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL);
    await ready(page);
    await pause(page);
    const lake = rankedFromFile(5);
    const show = page.getByRole('button', { name: 'Show lake 5 on the map', exact: true });
    await show.focus();
    await page.keyboard.press('Enter');
    expect((await state(page)).selected).toBe(String(lake.bi));
    const stage = page.locator('[data-ex-stage]');
    await expect(stage).toBeFocused();
    // The map's description reads the selected lake's card first.
    await expect(stage).toHaveAttribute('aria-describedby', 'ex-card-title ex-card-text ex-keys');
    await expect(page.locator('#ex-card-title')).toHaveText(
      `Lake${NBSP}5 · birth cell${NBSP}${lake.bi}`,
    );
    // Visible focus ring, and the map is in view after the scroll.
    const outline = await stage.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await expect
      .poll(() => stage.evaluate((el) => Math.round(el.getBoundingClientRect().top)), {
        timeout: 3000,
      })
      .toBeLessThan(844);
    await expect
      .poll(() => stage.evaluate((el) => el.getBoundingClientRect().bottom > 0))
      .toBe(true);
    // Its shortcuts work from there, and Tab moves on to the controls, not back to the table.
    await page.keyboard.press('ArrowDown');
    expect((await state(page)).selected).not.toBe(String(lake.bi));
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-ex-play]')).toBeFocused();
  });

  test('F27 QA-07: a tapped cell stays readable after release until another tap or dismissal', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await ready(page);
    await pause(page);
    const map = page.locator('[data-ex-map]');
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    const hover = page.locator('[data-ex-hover]');
    const root = page.locator('[data-explorer]');

    await page.touchscreen.tap(box.x + box.width * 0.45, box.y + box.height * 0.4);
    await page.waitForTimeout(900);
    const cell = Number(await root.getAttribute('data-hover-cell'));
    expect(cell).toBeGreaterThanOrEqual(0);
    await expect(hover).toContainText(elevation(await heightAt(page, cell)));
    expect(plain(await hover.textContent())).toMatch(
      /^Elevation .* at \d+\.\d{4}° N, \d+\.\d{4}° W/,
    );
    // The same reading goes to the polite cell live region.
    await expect(page.locator('[data-ex-cell-live]')).toContainText(
      elevation(await heightAt(page, cell)),
    );

    // Another tap replaces it.
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height * 0.75);
    await page.waitForTimeout(600);
    const cell2 = Number(await root.getAttribute('data-hover-cell'));
    expect(cell2).not.toBe(cell);
    await expect(hover).toContainText(elevation(await heightAt(page, cell2)));

    // Tapping outside the map dismisses it.
    const h1 = (await page.getByRole('heading', { level: 1, name: meta.label }).boundingBox())!;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.touchscreen.tap(h1.x + 10, h1.y + h1.height / 2);
    await expect(hover).toHaveText(await defaultHint(page));
    await expect(root).toHaveAttribute('data-hover-cell', '');

    // Escape on the focused map also dismisses a tapped reading.
    await map.scrollIntoViewIfNeeded();
    const box2 = (await map.boundingBox())!;
    await page.touchscreen.tap(box2.x + box2.width * 0.5, box2.y + box2.height * 0.5);
    await expect(hover).toContainText('Elevation');
    await page.locator('[data-ex-stage]').focus();
    await page.keyboard.press('Escape');
    await expect(hover).toHaveText(await defaultHint(page));
    await ctx.close();
  });

  test('F27 QA-07: mouse hover still clears when the pointer leaves the map', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL);
    await ready(page);
    await pause(page);
    const map = page.locator('[data-ex-map]');
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-ex-hover]')).toContainText('Elevation');
    await page.mouse.move(box.x + box.width + 40, box.y + 10);
    await expect(page.locator('[data-ex-hover]')).toHaveText(await defaultHint(page));
  });

  test('F27 QA-08: keyboard cell cursor moves, clamps, reads out from the data, Escape clears', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL);
    await ready(page);
    await pause(page);
    const W = meta.width;
    const H = (await page.evaluate(
      () => document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!.geo.H,
    )) as number;
    const stage = page.locator('[data-ex-stage]');
    const root = page.locator('[data-explorer]');
    const hover = page.locator('[data-ex-hover]');
    const live = page.locator('[data-ex-cell-live]');
    await expect(stage).toHaveAttribute('aria-keyshortcuts', /Enter/);
    await expect(page.locator('#ex-keys')).toContainText('Enter turns on a cell cursor');
    await expect(hover).toContainText('press Enter for a cell cursor');
    await stage.focus();
    const cursor = async () => Number(await root.getAttribute('data-cursor-cell'));
    const p0 = (await state(page)).progress;

    await page.keyboard.press('Enter');
    await expect(root).toHaveAttribute('data-cursor', 'on');
    const start = await cursor();
    expect(start).toBe(Math.floor(H / 2) * W + Math.floor(W / 2));
    await page.keyboard.press('ArrowRight');
    expect(await cursor()).toBe(start + 1);
    await page.keyboard.press('Shift+ArrowDown');
    expect(await cursor()).toBe(start + 1 + 10 * W);
    await page.keyboard.press('PageUp');
    expect(await cursor()).toBe(start + 1 + 10 * W - 50 * W);
    await page.keyboard.press('Home');
    const row = Math.floor((await cursor()) / W);
    expect(await cursor()).toBe(row * W);
    await page.keyboard.press('ArrowLeft'); // clamped at the west edge
    expect(await cursor()).toBe(row * W);
    await page.keyboard.press('End');
    expect(await cursor()).toBe(row * W + W - 1);
    // The arrows moved the cursor, not the water level.
    expect((await state(page)).progress).toBe(p0);

    const c = await cursor();
    const h = await heightAt(page, c);
    const text = plain(await hover.textContent());
    expect(text).toContain(`Cursor at column ${W} of ${W}, row ${row + 1} of ${H}: Elevation`);
    expect(text).toContain(elevation(h));
    await expect(root).toHaveAttribute('data-hover-cell', String(c));
    // Debounced, polite announcement of the final position.
    await expect(live).toContainText(`column ${W} of ${W}, row ${row + 1} of ${H}`);
    await expect(live).toContainText(elevation(h));
    expect(await live.getAttribute('aria-live')).toBe('polite');

    // The cursor is drawn: the map pixel at the cursor cell changes when it is on.
    const pixel = () =>
      page.evaluate((cell) => {
        const e = document.querySelector<HTMLElement>('[data-explorer]')!.__explorer!;
        const cv = e.els.map;
        const W = e.geo.W;
        const x = cell % W;
        const y = Math.floor(cell / W);
        const px = Math.floor(((x + 0.5) / W) * cv.width * 0.999);
        const py = Math.floor(((y + 0.5) / e.geo.H) * cv.height * 0.999);
        return Array.from(cv.getContext('2d')!.getImageData(px, py, 1, 1).data).join(',');
      }, c);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const on = await pixel();

    await page.keyboard.press('Escape');
    await expect(root).toHaveAttribute('data-cursor', 'off');
    await expect(hover).toHaveText(await defaultHint(page));
    await expect(live).toContainText('Cell cursor off');
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(await pixel()).not.toBe(on);
    // Back to level mode: ArrowRight raises the water again.
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).progress).toBeGreaterThan(p0);
    // Enter toggles the cursor back on at the last inspected cell.
    await page.keyboard.press('Enter');
    expect(await cursor()).toBe(c);
    await page.keyboard.press('Enter');
    await expect(root).toHaveAttribute('data-cursor', 'off');
  });

  test('F27 QA-10: without JavaScript the explorer explains the fallback, no loading state', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    const note = page.locator('.ex-noscript');
    await expect(note).toBeVisible();
    await expect(note).toContainText('need JavaScript, which is turned off');
    await expect(note.getByRole('link', { name: 'Longest-lived lakes' })).toHaveAttribute(
      'href',
      '#lakes',
    );
    await expect(note.getByRole('link', { name: 'About the data' })).toHaveAttribute(
      'href',
      '#about-data',
    );
    await expect(page.getByText('Loading the elevation grid')).toBeHidden();
    await expect(page.locator('[data-ex-controls]')).toBeHidden();
    await expect(page.locator('[data-ex-hover]')).toBeHidden();
    await expect(page.locator('.ex-readouts')).toBeHidden();
    // No dead focus stop or advertised shortcuts on the map.
    const stage = page.locator('[data-ex-stage]');
    await expect(stage).not.toHaveAttribute('tabindex', /.*/);
    await expect(stage).not.toHaveAttribute('aria-keyshortcuts', /.*/);
    // The static relief and the table are there.
    await expect(page.locator('.ex-map__shade')).toBeVisible();
    await expect(page.locator('[data-lake-row]')).toHaveCount(21);
    await ctx.close();
  });

  test('F27 QA-10: with JavaScript the no-script note is not shown', async ({ page }) => {
    await page.goto(URL);
    await ready(page);
    await expect(page.locator('.ex-noscript')).toHaveCount(0);
    await expect(page.locator('[data-ex-stage]')).toHaveAttribute('tabindex', '0');
  });

  // F28c plan 09 (DECISIONS #91): iOS Safari zooms into fields under 16 px on focus. Touch
  // devices (pointer: coarse) get 16 px; a mouse keeps the 14 px look.
  test('touch: explorer selects are at least 16px (no iOS focus zoom) (F28)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    for (const sel of ['#ex-speed', '#ex-pacing']) {
      const px = await page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
      expect(px, sel).toBeGreaterThanOrEqual(16);
    }
    // "Linear (metres)" still fits its row at 375 px: the Pacing label and select share one line.
    await ready(page);
    await page.selectOption('#ex-pacing', 'linear');
    const fit = await page.$eval('#ex-pacing', (e) => {
      const row = e.closest('label')!;
      const span = row.querySelector('span')!;
      const a = span.getBoundingClientRect();
      const b = e.getBoundingClientRect();
      return {
        sameLine: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) <= 2,
        right: b.right,
      };
    });
    expect(fit.sameLine).toBe(true);
    expect(fit.right).toBeLessThanOrEqual(375);
    await ctx.close();
  });

  test('desktop: explorer selects keep their 14px size (F28)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(URL);
    for (const sel of ['#ex-speed', '#ex-pacing']) {
      const px = await page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
      expect(px, sel).toBe(14);
    }
  });
});
