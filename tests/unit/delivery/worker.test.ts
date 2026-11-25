import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalRedirect, createHandler, type Env } from '../../../worker/handler';
import { headersForPath, loadHeaderRules, parseHeadersFile } from '../../../worker/headers';

// The real template, with its markers filled the way scripts/write-headers.mjs does.
const TEMPLATE = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');
const HEADERS_FILE = TEMPLATE.replace('__INLINE_SCRIPT_HASHES__', "'sha256-AAAA'").replace(
  '__INLINE_STYLE_HASHES__',
  "'sha256-BBBB'",
);
const RULES = loadHeaderRules(HEADERS_FILE);
const handler = createHandler(RULES);

const NOT_FOUND_BODY =
  '<h1>This page has gone under water.</h1><a href="/">Go to the home page</a>';
const FILES: Record<string, { body: string; type: string }> = {
  '/': { body: '<h1>Home</h1>', type: 'text/html' },
  '/rising-water/': { body: '<h1>Rising water</h1>', type: 'text/html' },
  '/_astro/app.abc123.js': { body: 'console.log(1)', type: 'text/javascript' },
  '/data/colorado/meta.json': { body: '{}', type: 'application/json' },
  '/og/social-card.png': { body: 'png', type: 'image/png' },
  '/favicon.svg': { body: '<svg/>', type: 'image/svg+xml' },
};

/** A stand-in for the static-asset binding with Cloudflare's default behaviour. */
function fakeAssets() {
  const calls: Request[] = [];
  const env: Env = {
    ASSETS: {
      async fetch(request: Request) {
        calls.push(request);
        const url = new URL(request.url);
        const base = { 'Cache-Control': 'public, max-age=0, must-revalidate' };
        if (url.pathname === '/rising-water') {
          return new Response(null, { status: 307, headers: { Location: '/rising-water/' } });
        }
        const file = FILES[url.pathname];
        const status = file ? 200 : 404;
        const body = file?.body ?? NOT_FOUND_BODY;
        const etag = `"${status}-${body.length}"`;
        const headers = { ...base, ETag: etag, 'Content-Type': file?.type ?? 'text/html' };
        if (file && request.headers.get('If-None-Match') === etag) {
          return new Response(null, { status: 304, headers });
        }
        return new Response(request.method === 'HEAD' ? null : body, { status, headers });
      },
    },
  };
  return { env, calls };
}

async function call(url: string, init?: RequestInit) {
  const { env, calls } = fakeAssets();
  const res = await handler.fetch(new Request(url, init), env);
  return { res, calls };
}

function expectSecurityHeaders(res: Response) {
  const csp = res.headers.get('content-security-policy') ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com 'sha256-AAAA'");
  expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
  expect(csp).toContain("style-src 'self' 'sha256-BBBB'");
  expect(csp).not.toMatch(/__INLINE_/);
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  expect(res.headers.get('x-frame-options')).toBe('DENY');
  expect(res.headers.get('permissions-policy')).toMatch(/camera=\(\)/);
}

describe('canonicalRedirect', () => {
  it.each([
    ['http://andrewchincea.com/', 'https://andrewchincea.com/'],
    ['http://andrewchincea.com/cv/?a=1&b=2', 'https://andrewchincea.com/cv/?a=1&b=2'],
    ['https://www.andrewchincea.com/', 'https://andrewchincea.com/'],
    [
      'https://WWW.AndrewChincea.com/rising-water/?q=x#h',
      'https://andrewchincea.com/rising-water/?q=x',
    ],
    ['http://www.andrewchincea.com/a/b?x=%20y', 'https://andrewchincea.com/a/b?x=%20y'],
    ['http://andrewchincea.com:8080/p', 'https://andrewchincea.com/p'],
  ])('%s → %s', (from, to) => {
    expect(canonicalRedirect(new URL(from))).toBe(to);
  });

  it.each([
    'https://andrewchincea.com/',
    'https://andrewchincea.com/cv/?a=1',
    'http://localhost:8788/',
    'http://127.0.0.1:8787/',
    'https://personal-portfolio.someone.workers.dev/',
    'https://abc123-personal-portfolio.someone.workers.dev/',
    'https://other.andrewchincea.com/',
    'https://notandrewchincea.com/',
  ])('%s is not redirected', (url) => {
    expect(canonicalRedirect(new URL(url))).toBeNull();
  });

  it('never loops: every redirect target is final', () => {
    for (const from of [
      'http://andrewchincea.com/x?y=1',
      'https://www.andrewchincea.com/x?y=1',
      'http://www.andrewchincea.com/x?y=1',
    ]) {
      const to = canonicalRedirect(new URL(from));
      expect(to).toBe('https://andrewchincea.com/x?y=1');
      expect(canonicalRedirect(new URL(to!))).toBeNull();
    }
  });
});

describe('worker fetch', () => {
  it('redirects aliases with a 301, preserving path and query, without touching assets', async () => {
    for (const from of [
      'http://andrewchincea.com/research/number-theory/?ref=a&b=2',
      'https://www.andrewchincea.com/research/number-theory/?ref=a&b=2',
      'http://www.andrewchincea.com/research/number-theory/?ref=a&b=2',
    ]) {
      const { res, calls } = await call(from);
      expect(res.status, from).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://andrewchincea.com/research/number-theory/?ref=a&b=2',
      );
      expect(calls).toHaveLength(0);
      expectSecurityHeaders(res);
      expect(res.headers.get('cache-control')).toBeNull();
    }
  });

  it('a redirect for an /_astro/ path does not get the immutable Cache-Control', async () => {
    const { res } = await call('https://www.andrewchincea.com/_astro/app.abc123.js');
    expect(res.status).toBe(301);
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('passes the canonical host through to the assets with headers attached', async () => {
    const { res, calls } = await call('https://andrewchincea.com/');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>Home</h1>');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://andrewchincea.com/');
    expectSecurityHeaders(res);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(res.headers.get('content-type')).toBe('text/html');
    expect(res.headers.get('etag')).toBeTruthy();
  });

  it('does not redirect localhost or workers.dev', async () => {
    for (const url of ['http://localhost:8788/', 'https://personal-portfolio.x.workers.dev/']) {
      const { res, calls } = await call(url);
      expect(res.status, url).toBe(200);
      expect(calls).toHaveLength(1);
      expectSecurityHeaders(res);
    }
  });

  it.each([
    ['/_astro/app.abc123.js', 'public, max-age=31536000, immutable'],
    ['/data/colorado/meta.json', 'public, max-age=86400, must-revalidate'],
    ['/og/social-card.png', 'public, max-age=86400, must-revalidate'],
    ['/favicon.svg', 'public, max-age=86400, must-revalidate'],
    ['/rising-water/', 'public, max-age=0, must-revalidate'],
  ])('%s gets Cache-Control %s (replaced, never joined)', async (path, cache) => {
    const { res } = await call(`https://andrewchincea.com${path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(cache);
    expect(res.headers.get('cache-control')).not.toContain(',  ');
    expect(res.headers.get('cache-control')!.split('max-age')).toHaveLength(2);
    expectSecurityHeaders(res);
  });

  it('unknown paths keep the 404 status and the branded body, with headers', async () => {
    for (const path of ['/no-such-page/', '/no-such-page', '/research/nope/']) {
      const { res } = await call(`https://andrewchincea.com${path}`);
      expect(res.status, path).toBe(404);
      const body = await res.text();
      expect(body).toContain('This page has gone under water.');
      expect(body).toContain('Go to the home page');
      expectSecurityHeaders(res);
    }
  });

  it('keeps the asset server trailing-slash redirect (307)', async () => {
    const { res } = await call('https://andrewchincea.com/rising-water');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/rising-water/');
    expectSecurityHeaders(res);
  });

  it('HEAD passes through with no body and the same headers', async () => {
    const { res, calls } = await call('https://andrewchincea.com/', { method: 'HEAD' });
    expect(calls[0].method).toBe('HEAD');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expectSecurityHeaders(res);
  });

  it('conditional requests reach the assets and keep the 304', async () => {
    const first = await call('https://andrewchincea.com/_astro/app.abc123.js');
    const etag = first.res.headers.get('etag')!;
    const { res, calls } = await call('https://andrewchincea.com/_astro/app.abc123.js', {
      headers: { 'If-None-Match': etag },
    });
    expect(calls[0].headers.get('if-none-match')).toBe(etag);
    expect(res.status).toBe(304);
    expect(res.body).toBeNull();
    expect(res.headers.get('etag')).toBe(etag);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});

describe('_headers parsing', () => {
  it('parses the real template into its five rules', () => {
    expect(RULES.map((r) => r.pattern)).toEqual([
      '/*',
      '/_astro/*',
      '/data/*',
      '/og/*',
      '/favicon.svg',
    ]);
  });

  it('applies Cloudflare semantics: all matches, joined duplicates, detach', () => {
    const rules = parseHeadersFile(
      [
        '# c',
        '/*',
        '  X-A: 1',
        '  X-B: keep',
        '/a/*',
        '  X-A: 2',
        '  ! X-B',
        '/a/b',
        '  X-C: 3',
      ].join('\n'),
    );
    const at = (p: string) => Object.fromEntries(headersForPath(rules, p).set);
    expect(at('/')).toEqual({ 'x-a': '1', 'x-b': 'keep' });
    expect(at('/a/b')).toEqual({ 'x-a': '1, 2', 'x-c': '3' });
    expect([...headersForPath(rules, '/a/x').unset]).toEqual(['x-b']);
    expect(at('/a.b')).toEqual({ 'x-a': '1', 'x-b': 'keep' });
    expect(at('/favicon.svgx')).toEqual({ 'x-a': '1', 'x-b': 'keep' });
  });

  it('matches /favicon.svg exactly and treats "." literally', () => {
    const at = (p: string) => headersForPath(RULES, p).set.get('cache-control');
    expect(at('/favicon.svg')).toBe('public, max-age=86400, must-revalidate');
    expect(at('/faviconXsvg')).toBeUndefined();
    expect(at('/favicon.svg/extra')).toBeUndefined();
  });

  it('rejects files it cannot honour', () => {
    expect(() => loadHeaderRules(TEMPLATE)).toThrow(/template markers/);
    expect(() => loadHeaderRules('/*\n  X-A: 1\n')).toThrow(/Content-Security-Policy/);
    expect(() => parseHeadersFile('https://x.org/*\n  X-A: 1')).toThrow(/path patterns/);
    expect(() => parseHeadersFile('/a/:id\n  X-A: 1')).toThrow(/placeholders/);
    expect(() => parseHeadersFile('  X-A: 1')).toThrow(/before any URL/);
    expect(() => parseHeadersFile('/*\n  nonsense')).toThrow(/Name: value/);
  });
});
