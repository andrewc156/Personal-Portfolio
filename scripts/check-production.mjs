#!/usr/bin/env node
// Post-deploy smoke check for the public site (F24; F23 QA-01, QA-02, QA-12, QA-18).
// Read-only: it only sends GET and HEAD requests and never follows redirects.
//
// Checks:
//  - robots.txt advertises <origin>/sitemap-index.xml;
//  - the sitemap index and every child sitemap list only <origin> URLs;
//  - every sitemap page returns 200 HTML whose canonical and og:url equal its sitemap
//    URL and whose og:image and twitter:image are on <origin>; no localhost anywhere;
//  - response headers: CSP (with exactly the Cloudflare Web Analytics allowance),
//    nosniff, frame and referrer policy, and the per-path Cache-Control rules;
//  - HEAD works and a matching If-None-Match gets a 304;
//  - an unknown path returns 404 with the branded page and the same security headers;
//  - http://<apex>, https://www.<apex> and http://www.<apex> answer 301 to
//    https://<apex> with the path and query preserved (skipped for localhost/IP
//    origins, or with --skip-aliases).
//
// Usage:
//   node scripts/check-production.mjs                       # https://andrewchincea.com
//   node scripts/check-production.mjs --origin https://example.com
//   # A local `wrangler dev` of a production build (URLs still advertise the apex):
//   node scripts/check-production.mjs --base http://localhost:8788 \
//     --origin https://andrewchincea.com --skip-aliases
// Exits 1 if any check fails.
import { pathToFileURL } from 'node:url';

export const DEFAULT_ORIGIN = 'https://andrewchincea.com';
// From src/pages/404.astro.
export const NOT_FOUND_MARKERS = ['This page has gone under water.', 'Go to the home page'];
const LOCAL_HOST_RE = /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]/i;
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
};
const CACHE = {
  html: 'public, max-age=0, must-revalidate',
  immutable: 'public, max-age=31536000, immutable',
  day: 'public, max-age=86400, must-revalidate',
};

function attrsOf(tag) {
  const out = {};
  for (const m of tag.matchAll(/([^\s"'>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').replace(/&amp;/g, '&');
  }
  return out;
}

/** canonical, og:url, og:image and twitter:image values (all occurrences). */
export function metadataUrls(html) {
  const found = { canonical: [], 'og:url': [], 'og:image': [], 'twitter:image': [] };
  for (const m of html.matchAll(/<(link|meta)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const a = attrsOf(m[2]);
    if (m[1].toLowerCase() === 'link') {
      if ((a.rel ?? '').toLowerCase().split(/\s+/).includes('canonical')) {
        found.canonical.push(a.href ?? '');
      }
    } else {
      const key = (a.property ?? a.name ?? '').toLowerCase();
      if (key in found) found[key].push(a.content ?? '');
    }
  }
  return found;
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

function cspProblems(csp) {
  if (!csp) return ['no Content-Security-Policy header'];
  const problems = [];
  const d = new Map(
    csp
      .split(';')
      .map((p) => p.trim().split(/\s+/))
      .filter((p) => p[0])
      .map(([name, ...values]) => [name.toLowerCase(), values]),
  );
  const hosts = (name) => (d.get(name) ?? []).filter((v) => /^https?:|\*/.test(v));
  const expect = (name, allowed) => {
    const got = hosts(name);
    if (got.join(' ') !== allowed.join(' ')) {
      problems.push(`CSP ${name} hosts are [${got.join(' ')}], expected [${allowed.join(' ')}]`);
    }
  };
  expect('script-src', ['https://static.cloudflareinsights.com']);
  expect('connect-src', ['https://cloudflareinsights.com']);
  for (const name of ['default-src', 'style-src', 'img-src', 'font-src']) expect(name, []);
  if ((d.get('default-src') ?? [])[0] !== "'self'") problems.push("CSP default-src isn't 'self'");
  if (/unsafe-inline|unsafe-eval/.test(csp)) problems.push('CSP allows unsafe-inline/eval');
  return problems;
}

/**
 * Runs every check. `base` is where requests are sent; `origin` is the public origin
 * the site must advertise (they differ only for a local `wrangler dev`).
 *
 * @param {{
 *   origin?: string,
 *   base?: string,
 *   aliases?: boolean,
 *   fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>,
 *   log?: (message: string) => void,
 * }} [options]
 * @returns {Promise<{ passed: number, failures: string[] }>}
 */
export async function runChecks({
  origin = DEFAULT_ORIGIN,
  base = origin,
  aliases,
  fetchImpl = fetch,
  log = () => {},
} = {}) {
  origin = new URL(origin).origin;
  base = new URL(base).origin;
  const failures = [];
  let passed = 0;
  const check = (ok, message) => {
    if (ok) passed++;
    else failures.push(message);
    return ok;
  };
  const get = (path, init = {}) =>
    fetchImpl(new URL(path, base).href, { redirect: 'manual', ...init });
  const securityHeaders = (res, what) => {
    for (const [name, value] of Object.entries(SECURITY)) {
      check(res.headers.get(name) === value, `${what}: ${name} is ${res.headers.get(name)}`);
    }
    for (const p of cspProblems(res.headers.get('content-security-policy'))) {
      check(false, `${what}: ${p}`);
    }
    check(
      /camera=\(\)/.test(res.headers.get('permissions-policy') ?? ''),
      `${what}: Permissions-Policy missing`,
    );
  };
  const onOrigin = (url, what) => {
    let ok = false;
    try {
      ok = new URL(url).origin === origin && !LOCAL_HOST_RE.test(url);
    } catch {
      ok = false;
    }
    return check(ok, `${what}: ${url || '(missing)'} is not on ${origin}`);
  };

  // robots.txt and the sitemap tree.
  const robots = await get('/robots.txt');
  const robotsText = await robots.text();
  check(robots.status === 200, `/robots.txt: status ${robots.status}`);
  const sitemapLines = [...robotsText.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  check(
    sitemapLines.length === 1 && sitemapLines[0] === `${origin}/sitemap-index.xml`,
    `/robots.txt: Sitemap lines [${sitemapLines.join(', ')}], expected ${origin}/sitemap-index.xml`,
  );

  const index = await get('/sitemap-index.xml');
  const indexXml = await index.text();
  check(index.status === 200, `/sitemap-index.xml: status ${index.status}`);
  const children = locs(indexXml);
  check(children.length > 0, '/sitemap-index.xml: no <loc> entries');
  const pages = [];
  for (const child of children) {
    if (!onOrigin(child, 'sitemap-index.xml <loc>')) continue;
    const res = await get(new URL(child).pathname);
    const xml = await res.text();
    check(res.status === 200, `${child}: status ${res.status}`);
    for (const loc of locs(xml))
      if (onOrigin(loc, `${new URL(child).pathname} <loc>`)) pages.push(loc);
  }
  check(pages.length > 0, 'sitemaps list no pages');
  // Still check the home page's metadata when the sitemap tree is broken.
  if (pages.length === 0) pages.push(`${origin}/`);
  log(`sitemap: ${pages.length} pages`);

  // Every page: status, metadata URLs, headers.
  let assetPath;
  for (const page of pages) {
    const path = new URL(page).pathname + new URL(page).search;
    const res = await get(path);
    const html = await res.text();
    if (!check(res.status === 200, `${path}: status ${res.status}`)) continue;
    check(/text\/html/.test(res.headers.get('content-type') ?? ''), `${path}: not text/html`);
    const meta = metadataUrls(html);
    for (const field of ['canonical', 'og:url']) {
      check(
        meta[field].length === 1 && meta[field][0] === page,
        `${path}: ${field} [${meta[field].join(', ')}], expected ${page}`,
      );
    }
    for (const field of ['og:image', 'twitter:image']) {
      check(meta[field].length === 1, `${path}: ${meta[field].length} ${field} tags`);
      for (const url of meta[field]) onOrigin(url, `${path} ${field}`);
    }
    check(!/localhost:\d/.test(html), `${path}: page source mentions localhost`);
    securityHeaders(res, path);
    check(
      res.headers.get('cache-control') === CACHE.html,
      `${path}: Cache-Control ${res.headers.get('cache-control')}, expected ${CACHE.html}`,
    );
    assetPath ??= html.match(/(?:src|href)="(\/_astro\/[^"]+)"/)?.[1];
  }

  // Per-path caching, HEAD and conditional requests.
  const cacheOf = async (path, expected) => {
    const res = await get(path, { method: 'HEAD' });
    check(res.status === 200, `HEAD ${path}: status ${res.status}`);
    check(
      res.headers.get('cache-control') === expected,
      `HEAD ${path}: Cache-Control ${res.headers.get('cache-control')}, expected ${expected}`,
    );
    return res;
  };
  if (check(Boolean(assetPath), 'no /_astro/ asset referenced by any page')) {
    await cacheOf(assetPath, CACHE.immutable);
  }
  await cacheOf('/favicon.svg', CACHE.day);
  await cacheOf('/og/social-card.png', CACHE.day);
  await cacheOf('/data/colorado/meta.json', CACHE.day);
  const home = await get('/', { method: 'HEAD' });
  securityHeaders(home, 'HEAD /');
  const etag = home.headers.get('etag');
  if (check(Boolean(etag), 'HEAD /: no ETag')) {
    const again = await get('/', { headers: { 'If-None-Match': etag } });
    await again.arrayBuffer();
    check(again.status === 304, `GET / with If-None-Match: status ${again.status}, expected 304`);
  }

  // Branded 404.
  const missingPath = `/check-production-missing-${Date.now().toString(36)}/`;
  const missing = await get(missingPath);
  const missingBody = await missing.text();
  check(missing.status === 404, `${missingPath}: status ${missing.status}, expected 404`);
  for (const marker of NOT_FOUND_MARKERS) {
    check(missingBody.includes(marker), `${missingPath}: body lacks "${marker}"`);
  }
  securityHeaders(missing, missingPath);

  // Host and scheme aliases.
  const host = new URL(origin).hostname;
  const runAliases =
    aliases ?? !(LOCAL_HOST_RE.test(host) || /^[\d.]+$/.test(host) || host.includes(':'));
  if (runAliases) {
    const probe = '/rising-water/?check=production&x=1';
    // At most two permanent hops: a zone-level "Always Use HTTPS" may first send
    // http://www.<apex> to https://www.<apex>, which the Worker then sends to the apex.
    for (const alias of [`http://${host}`, `https://www.${host}`, `http://www.${host}`]) {
      let url = alias + probe;
      const hops = [];
      for (let i = 0; i < 2 && url !== origin + probe; i++) {
        const res = await fetchImpl(url, { redirect: 'manual' });
        await res.arrayBuffer();
        const location = res.headers.get('location');
        hops.push(`${res.status} → ${location ?? '(no Location)'}`);
        if (![301, 308].includes(res.status) || !location) break;
        const next = new URL(location, url);
        if (next.pathname + next.search !== probe) break;
        url = next.href;
      }
      check(
        url === origin + probe && hops.every((h) => h.startsWith('301')),
        `${alias}${probe}: ${hops.join(', ')}; expected 301 → ${origin}${probe}`,
      );
    }
  } else {
    log('aliases: skipped');
  }

  return { passed, failures };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origin = arg('origin') ?? DEFAULT_ORIGIN;
  const base = arg('base') ?? origin;
  const aliases = process.argv.includes('--skip-aliases') ? false : undefined;
  console.log(`check-production: ${base} (expected public origin ${origin})`);
  try {
    const { passed, failures } = await runChecks({ origin, base, aliases, log: console.log });
    for (const f of failures) console.error(`  FAIL ${f}`);
    console.log(`check-production: ${passed} passed, ${failures.length} failed`);
    process.exit(failures.length ? 1 : 0);
  } catch (err) {
    console.error(`check-production: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
