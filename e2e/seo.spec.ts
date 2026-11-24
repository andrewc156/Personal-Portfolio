import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * F7 SEO: canonical, description, Open Graph, Twitter, sitemap, robots.txt and the 404.
 * Expected absolute URLs use the origin the site is served from (the e2e build has no
 * SITE_URL, so astro.config.mjs falls back to the preview origin); no domain is hard-coded.
 */

const PAGES = [
  '/',
  '/garden/',
  '/research/',
  '/research/water-quality/',
  '/research/tda-rivernets/',
  '/research/number-theory/',
  '/research/spectral-fractals/',
  '/cv/',
  '/about/',
  '/rising-water/',
];

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function content(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute('content') ?? e.getAttribute('href') ?? ''),
    );
}

async function one(page: Page, selector: string): Promise<string> {
  const values = await content(page, selector);
  expect(values, selector).toHaveLength(1);
  expect(values[0], selector).not.toBe('');
  return values[0];
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString('latin1'), 'PNG signature').toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function locs(request: APIRequestContext, origin: string, path: string): Promise<string[]> {
  const res = await request.get(new URL(path, origin).href);
  expect(res.status(), path).toBe(200);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

test.describe('page metadata', () => {
  for (const path of PAGES) {
    test(`${path} has canonical, description, Open Graph and Twitter tags`, async ({
      page,
      request,
    }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      const origin = new URL(page.url()).origin;
      const expected = new URL(path, origin).href;

      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}/);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

      const canonical = await one(page, 'link[rel="canonical"]');
      expect(canonical).toBe(expected);

      const description = await one(page, 'meta[name="description"]');
      expect(description.length).toBeLessThanOrEqual(160);

      const title = await page.title();
      expect(await one(page, 'meta[property="og:type"]')).toBe('website');
      expect(await one(page, 'meta[property="og:title"]')).toBe(title);
      expect(await one(page, 'meta[property="og:description"]')).toBe(description);
      expect(await one(page, 'meta[property="og:url"]')).toBe(expected);
      await one(page, 'meta[property="og:site_name"]');
      await one(page, 'meta[property="og:locale"]');
      await one(page, 'meta[property="og:image:alt"]');
      expect(await one(page, 'meta[property="og:image:width"]')).toBe(String(OG_WIDTH));
      expect(await one(page, 'meta[property="og:image:height"]')).toBe(String(OG_HEIGHT));

      expect(await one(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(await one(page, 'meta[name="twitter:title"]')).toBe(title);
      expect(await one(page, 'meta[name="twitter:description"]')).toBe(description);
      await one(page, 'meta[name="twitter:image:alt"]');

      const image = await one(page, 'meta[property="og:image"]');
      expect(await one(page, 'meta[name="twitter:image"]')).toBe(image);
      const imageUrl = new URL(image);
      expect(imageUrl.origin, 'og:image is absolute on the site origin').toBe(origin);

      const img = await request.get(image);
      expect(img.status(), image).toBe(200);
      expect(img.headers()['content-type']).toContain('image/png');
      expect(pngSize(await img.body())).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
    });
  }
});

test.describe('not found', () => {
  test('an unknown route returns 404, without noindex or a canonical', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist/');
    expect(res?.status()).toBe(404);
    // The HTTP 404 status keeps it out of indexes; no robots meta (DECISIONS #53).
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}/);
  });
});

test.describe('sitemap and robots.txt', () => {
  test('sitemap lists every public page on the site origin and no 404', async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4321').origin;
    const index = await locs(request, origin, '/sitemap-index.xml');
    expect(index.length).toBeGreaterThan(0);
    const urls: string[] = [];
    for (const loc of index) {
      expect(new URL(loc).origin).toBe(origin);
      urls.push(...(await locs(request, origin, new URL(loc).pathname)));
    }
    for (const u of urls) expect(new URL(u).origin).toBe(origin);
    expect([...urls].sort()).toEqual(PAGES.map((p) => new URL(p, origin).href).sort());
    expect(urls.some((u) => /404/.test(new URL(u).pathname))).toBe(false);
  });

  test('robots.txt allows crawling and points to the sitemap', async ({ request, baseURL }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4321').origin;
    const res = await request.get(`${origin}/robots.txt`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body).not.toMatch(/^Disallow: \/\s*$/m);
    expect(body).toContain(`Sitemap: ${origin}/sitemap-index.xml`);
  });
});
