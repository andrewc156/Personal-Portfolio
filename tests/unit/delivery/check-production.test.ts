import { describe, expect, it } from 'vitest';
import { runChecks } from '../../../scripts/check-production.mjs';
import { createHandler, type Env } from '../../../worker/handler';
import { loadHeaderRules } from '../../../worker/headers';
import { readFileSync } from 'node:fs';

// scripts/check-production.mjs run against the real Worker handler and a fake asset
// binding, so the smoke check and the Worker are tested against each other.
const TEMPLATE = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');
const RULES = loadHeaderRules(
  TEMPLATE.replace('__INLINE_SCRIPT_HASHES__', "'sha256-AAAA'").replace(
    '__INLINE_STYLE_HASHES__',
    "'sha256-BBBB'",
  ),
);
const ORIGIN = 'https://andrewchincea.com';
const NOT_FOUND = '<h1>This page has gone under water.</h1><a href="/">Go to the home page</a>';

function site(advertised: string) {
  const html = (path: string) =>
    `<html><head><link rel="canonical" href="${advertised}${path}">` +
    `<meta property="og:url" content="${advertised}${path}">` +
    `<meta property="og:image" content="${advertised}/og/social-card.png">` +
    `<meta name="twitter:image" content="${advertised}/og/social-card.png">` +
    `<script type="module" src="/_astro/app.abc.js"></script></head><body></body></html>`;
  const files: Record<string, string> = {
    '/': html('/'),
    '/cv/': html('/cv/'),
    '/robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${advertised}/sitemap-index.xml\n`,
    '/sitemap-index.xml': `<sitemapindex><sitemap><loc>${advertised}/sitemap-0.xml</loc></sitemap></sitemapindex>`,
    '/sitemap-0.xml': `<urlset><url><loc>${advertised}/</loc></url><url><loc>${advertised}/cv/</loc></url></urlset>`,
    '/_astro/app.abc.js': '1',
    '/favicon.svg': '<svg/>',
    '/og/social-card.png': 'png',
    '/data/colorado/meta.json': '{}',
  };
  const env: Env = {
    ASSETS: {
      async fetch(req: Request) {
        const path = new URL(req.url).pathname;
        const body = files[path];
        const etag = `"${path}"`;
        const headers = {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Content-Type': path.endsWith('/') ? 'text/html; charset=utf-8' : 'text/plain',
          ETag: etag,
        };
        if (body === undefined) return new Response(NOT_FOUND, { status: 404, headers });
        if (req.headers.get('if-none-match') === etag) {
          return new Response(null, { status: 304, headers });
        }
        return new Response(req.method === 'HEAD' ? null : body, { headers });
      },
    },
  };
  const worker = createHandler(RULES);
  const fetchImpl = async (url: string, init?: RequestInit) =>
    worker.fetch(new Request(url, init), env);
  return fetchImpl;
}

describe('check-production', () => {
  it('passes for a correct deployment, aliases included', async () => {
    const { failures, passed } = await runChecks({ origin: ORIGIN, fetchImpl: site(ORIGIN) });
    expect(failures).toEqual([]);
    expect(passed).toBeGreaterThan(40);
  });

  it('reports localhost metadata and sitemap URLs (QA-01)', async () => {
    const { failures } = await runChecks({
      origin: ORIGIN,
      fetchImpl: site('http://localhost:4321'),
    });
    expect(failures.some((f: string) => f.startsWith('/robots.txt: Sitemap'))).toBe(true);
    expect(failures.some((f: string) => f.includes('sitemap-index.xml <loc>'))).toBe(true);
  });

  it('reports missing alias redirects (QA-12)', async () => {
    const good = site(ORIGIN);
    // Serve every alias directly, as production did before F24.
    const noRedirects = async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      u.protocol = 'https:';
      u.hostname = 'andrewchincea.com';
      const res = await good(u.href, init);
      return url.startsWith(ORIGIN) ? res : new Response(await res.text(), { status: 200 });
    };
    const { failures } = await runChecks({ origin: ORIGIN, fetchImpl: noRedirects });
    expect(failures.filter((f: string) => f.includes('expected 301'))).toHaveLength(3);
  });

  it('skips aliases for a localhost base serving a production build', async () => {
    const fetchImpl = site(ORIGIN);
    const { failures } = await runChecks({
      origin: ORIGIN,
      base: 'http://localhost:8788',
      aliases: false,
      fetchImpl,
    });
    expect(failures).toEqual([]);
  });
});
