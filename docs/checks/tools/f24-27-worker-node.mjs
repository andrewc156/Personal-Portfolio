// F24 checker: run the real worker/index.ts (bundled with esbuild, dist/_headers inlined
// as text exactly as wrangler's Text rule does) in Node against a fake ASSETS binding.
// Usage: node docs/checks/tools/f24-27-worker-node.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const dir = mkdtempSync(join(process.env.TMPDIR ?? '.', 'f24w-'));
const out = join(dir, 'w.mjs');
await build({ entryPoints: ['worker/index.ts'], bundle: true, format: 'esm', outfile: out, loader: { '': 'text' }, platform: 'neutral', logLevel: 'error',
  plugins: [{ name: 'h', setup(b) { b.onResolve({ filter: /_headers$/ }, (a) => ({ path: join(process.cwd(), 'dist/_headers'), namespace: 'file' })); b.onLoad({ filter: /_headers$/ }, async (a) => ({ contents: (await import('node:fs')).readFileSync(a.path, 'utf8'), loader: 'text' })); } }] });
const worker = (await import(out)).default;
rmSync(dir, { recursive: true });
const seen = [];
const ASSETS = { async fetch(req) { seen.push(`${req.method} ${req.url} inm=${req.headers.get('if-none-match')}`);
  const u = new URL(req.url);
  if (req.headers.get('if-none-match') === '"e1"') return new Response(null, { status: 304, headers: { ETag: '"e1"', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  if (u.pathname === '/nope') return new Response('<h1>This page has gone under water.</h1>', { status: 404, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  return new Response(req.method === 'HEAD' ? null : 'ok', { status: 200, headers: { ETag: '"e1"', 'Cache-Control': 'public, max-age=0, must-revalidate' } }); } };
let fails = 0;
const t = async (url, init, check, label) => {
  const res = await worker.fetch(new Request(url, init), { ASSETS });
  const r = { status: res.status, loc: res.headers.get('location'), cc: res.headers.get('cache-control'), csp: !!res.headers.get('content-security-policy'), xfo: res.headers.get('x-frame-options') };
  const ok = check(r); if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${JSON.stringify(r)}`);
};
const A = 'https://andrewchincea.com';
await t('http://andrewchincea.com/garden/?type=paper&x=%20y', {}, (r) => r.status === 301 && r.loc === `${A}/garden/?type=paper&x=%20y` && r.csp && r.cc === null, 'http apex -> https apex, query kept, no cache-control');
await t('https://www.andrewchincea.com/cv/', {}, (r) => r.status === 301 && r.loc === `${A}/cv/`, 'https www');
await t('http://www.andrewchincea.com:8080/a/b?q=1#frag', {}, (r) => r.status === 301 && r.loc === `${A}/a/b?q=1`, 'http www with port');
await t('https://WWW.AndrewChincea.com/x', {}, (r) => r.status === 301 && r.loc === `${A}/x`, 'uppercase host');
await t(`${A}/cv/`, {}, (r) => r.status === 200 && !r.loc && r.csp, 'https apex served (no loop)');
await t(`${A}/_astro/a.js`, {}, (r) => r.cc === 'public, max-age=31536000, immutable', 'asset immutable, set not joined');
await t(`${A}/`, { method: 'HEAD' }, (r) => r.status === 200 && r.csp, 'HEAD passthrough');
await t(`${A}/`, { headers: { 'If-None-Match': '"e1"' } }, (r) => r.status === 304 && r.csp, '304 passthrough');
await t(`${A}/nope`, {}, (r) => r.status === 404 && r.csp && r.xfo === 'DENY', '404 keeps status + headers');
await t('http://www.andrewchincea.com/', { method: 'POST', body: 'x' }, (r) => r.status === 301, 'POST on www still 301');
await t('https://andrewchincea.com.evil.com/', {}, (r) => r.status === 200 && !r.loc, 'lookalike suffix not redirected');
await t('http://localhost:8788/', {}, (r) => r.status === 200 && !r.loc, 'localhost not redirected');
await t('https://personal-portfolio.foo.workers.dev/', {}, (r) => r.status === 200 && !r.loc, 'workers.dev not redirected');
console.log('assets saw:', seen.length, 'requests; forwarded If-None-Match:', seen.some((s) => s.includes('inm="e1"')));
console.log(fails ? `FAILURES ${fails}` : 'all worker node checks passed');
process.exit(fails ? 1 : 0);
