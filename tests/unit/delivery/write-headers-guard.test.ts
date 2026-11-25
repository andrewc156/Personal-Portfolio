import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// scripts/write-headers.mjs public-URL guard (F24, QA-01).
const SCRIPT = fileURLToPath(new URL('../../../scripts/write-headers.mjs', import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function page(origin: string, path: string) {
  return `<!doctype html><html lang="en"><head>
<link rel="canonical" href="${origin}${path}">
<meta property="og:url" content="${origin}${path}">
<meta property="og:image" content="${origin}/og/social-card.png">
<meta name="twitter:image" content="${origin}/og/social-card.png">
<script>document.documentElement.dataset.js = '1'</script>
</head><body><h1>x</h1></body></html>`;
}

function fakeDist(origin: string, { robotsOrigin = origin } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'f24-dist-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'cv'));
  writeFileSync(join(dir, 'index.html'), page(origin, '/'));
  writeFileSync(join(dir, 'cv', 'index.html'), page(origin, '/cv/'));
  writeFileSync(
    join(dir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${robotsOrigin}/sitemap-index.xml\n`,
  );
  writeFileSync(
    join(dir, 'sitemap-index.xml'),
    `<sitemapindex><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`,
  );
  writeFileSync(
    join(dir, 'sitemap-0.xml'),
    `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/cv/</loc></url></urlset>`,
  );
  return dir;
}

function run(dist: string, env: Record<string, string | undefined>) {
  const clean = { ...process.env };
  delete clean.WORKERS_CI;
  delete clean.CF_PAGES;
  return spawnSync(process.execPath, [SCRIPT, '--dist', dist], {
    env: { ...clean, ...env },
    encoding: 'utf8',
  });
}

describe('write-headers public-URL guard', () => {
  it('local builds keep localhost URLs and still write _headers', () => {
    const dist = fakeDist('http://localhost:4321');
    const res = run(dist, {});
    expect(res.status, res.stderr).toBe(0);
    const headers = readFileSync(join(dist, '_headers'), 'utf8');
    expect(headers).toContain("script-src 'self' https://static.cloudflareinsights.com 'sha256-");
    expect(headers).toContain("connect-src 'self' https://cloudflareinsights.com;");
  });

  it.each([{ WORKERS_CI: '1' }, { CF_PAGES: '1' }])(
    'a Cloudflare build (%o) fails on localhost URLs',
    (env) => {
      const res = run(fakeDist('http://localhost:4321'), env);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/canonical http:\/\/localhost:4321\//);
      expect(res.stderr).toMatch(/robots\.txt: Sitemap/);
      expect(res.stderr).toMatch(/sitemap-0\.xml/);
    },
  );

  it('a Cloudflare build fails on a single localhost Sitemap line', () => {
    const res = run(
      fakeDist('https://andrewchincea.com', { robotsOrigin: 'http://localhost:4321' }),
      { WORKERS_CI: '1' },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/robots\.txt: Sitemap http:\/\/localhost/);
  });

  it('a Cloudflare build with production URLs passes', () => {
    const res = run(fakeDist('https://andrewchincea.com'), { WORKERS_CI: '1' });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/public URLs checked/);
  });
});
