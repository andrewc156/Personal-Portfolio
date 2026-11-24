import { test, expect, type Page } from '@playwright/test';

/**
 * F8 Cloudflare Pages headers. `astro preview` ignores _headers, so this spec only
 * runs against `wrangler pages dev` and skips unless HEADERS_BASE_URL is set:
 *
 *   npm run build                      # astro build + scripts/write-headers.mjs
 *   npx wrangler pages dev dist --port 8788
 *   HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts
 *
 * (Playwright's webServer still starts preview on 4321; this spec doesn't use it.)
 */

const BASE = (process.env.HEADERS_BASE_URL ?? '').replace(/\/$/, '');
test.skip(!BASE, 'set HEADERS_BASE_URL to a `wrangler pages dev dist` origin');

const PAGES = [
  '/',
  '/garden/',
  '/research/',
  '/research/water-quality/',
  '/research/number-theory/',
  '/research/spectral-fractals/',
  '/cv/',
  '/about/',
  '/rising-water/',
];

const SECURITY: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'x-frame-options': 'DENY',
};

const REQUIRED_CSP = [
  "default-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
];

function directives(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map.set(name, values);
  }
  return map;
}

function expectSecurityHeaders(headers: Record<string, string>): void {
  for (const [name, value] of Object.entries(SECURITY)) expect(headers[name], name).toBe(value);
  expect(headers['permissions-policy']).toMatch(/camera=\(\)/);
  expect(headers['permissions-policy']).toMatch(/microphone=\(\)/);
  expect(headers['permissions-policy']).toMatch(/geolocation=\(\)/);
  const csp = headers['content-security-policy'] ?? '';
  for (const d of REQUIRED_CSP) expect(csp, d).toContain(d);
  expect(csp).not.toMatch(/__INLINE_|unsafe-inline|unsafe-eval|\*|https?:/);
  const d = directives(csp);
  for (const name of ['script-src', 'style-src']) {
    const values = d.get(name) ?? [];
    expect(values[0], `${name} starts with 'self'`).toBe("'self'");
    for (const v of values.slice(1)) expect(v).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
  }
}

async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
}

const violations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe('response headers', () => {
  test('HTML pages: security headers, CSP, revalidated', async ({ request }) => {
    for (const path of PAGES) {
      const res = await request.get(BASE + path);
      expect(res.status(), path).toBe(200);
      const h = res.headers();
      expectSecurityHeaders(h);
      expect(h['cache-control'], path).toBe('public, max-age=0, must-revalidate');
    }
  });

  test('/_astro/* is immutable for a year', async ({ request }) => {
    const html = await (await request.get(`${BASE}/`)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]);
    expect(assets.length).toBeGreaterThan(0);
    for (const a of new Set(assets)) {
      const res = await request.get(BASE + a);
      expect(res.status(), a).toBe(200);
      expect(res.headers()['cache-control'], a).toBe('public, max-age=31536000, immutable');
      expectSecurityHeaders(res.headers());
    }
  });

  test('/data/*, /og/* and the favicon: one day, then revalidate', async ({ request }) => {
    for (const path of [
      '/data/colorado/meta.json',
      '/data/colorado/barcode.json',
      '/data/colorado/grid.f32',
      '/data/colorado/hillshade.webp',
      '/og/social-card.png',
      '/favicon.svg',
    ]) {
      const res = await request.get(BASE + path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['cache-control'], path).toBe('public, max-age=86400, must-revalidate');
    }
  });

  test('unknown route: custom 404 page with status 404 and the same headers', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/no-such-page-f8/`);
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('Page not found');
    expectSecurityHeaders(res.headers());
  });
});

test.describe('CSP in the browser', () => {
  test('every page renders with zero CSP violations', async ({ page }) => {
    await watchCsp(page);
    for (const path of [...PAGES, '/no-such-page-f8/']) {
      await page.goto(BASE + path);
      await page.waitForLoadState('load');
      expect(await violations(page), path).toEqual([]);
    }
  });

  test('theme script runs: a stored theme is applied on load', async ({ page }) => {
    await watchCsp(page);
    await page.goto(`${BASE}/about/`);
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await violations(page)).toEqual([]);
  });

  test('explorer verifies its data and handles form submissions under the CSP', async ({
    page,
  }) => {
    await watchCsp(page);
    await page.goto(`${BASE}/rising-water/`);
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>('[data-explorer]')?.dataset.ready === 'true',
      null,
      { timeout: 30_000 },
    );
    const root = page.locator('[data-explorer]');
    await expect(root).toHaveAttribute('data-match', 'true');
    expect(
      await page.locator('.ex-map').evaluate((el) => getComputedStyle(el).aspectRatio),
    ).not.toBe('auto');
    const prevented = await page.locator('form.ex-controls').evaluate((f) => {
      const ev = new Event('submit', { cancelable: true });
      f.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);
    expect(await violations(page)).toEqual([]);
  });

  test('negative control: injected inline script and style are blocked', async ({ page }) => {
    await watchCsp(page);
    await page.goto(`${BASE}/`);
    const result = await page.evaluate(async () => {
      const w = window as unknown as { __injected?: boolean };
      const s = document.createElement('script');
      s.textContent = 'window.__injected = true';
      document.body.append(s);
      const d = document.createElement('div');
      d.setAttribute('style', 'color: rgb(1, 2, 3)');
      document.body.append(d);
      await new Promise((r) => setTimeout(r, 100));
      return { ran: w.__injected === true, color: getComputedStyle(d).color };
    });
    expect(result.ran).toBe(false);
    expect(result.color).not.toBe('rgb(1, 2, 3)');
    expect((await violations(page)).length).toBeGreaterThanOrEqual(2);
  });
});
