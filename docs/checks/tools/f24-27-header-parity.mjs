// F24 checker: independent parity check between dist/_headers and a running Worker.
// My own _headers interpretation (Cloudflare docs): every matching rule applies in order,
// duplicates joined with ", ", "! Name" detaches. Compares against live responses.
import { readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:8788';
const text = readFileSync('dist/_headers', 'utf8');
const rules = [];
let cur;
for (const line of text.split('\n')) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) { cur = { re: new RegExp('^' + line.trim().split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'), h: [] }; rules.push(cur); continue; }
  cur.h.push(line.trim());
}
function expected(path) {
  const m = new Map();
  for (const r of rules) if (r.re.test(path)) for (const l of r.h) {
    if (l.startsWith('!')) { m.delete(l.slice(1).trim().toLowerCase()); continue; }
    const i = l.indexOf(':'); const k = l.slice(0, i).trim().toLowerCase(); const v = l.slice(i + 1).trim();
    m.set(k, m.has(k) ? m.get(k) + ', ' + v : v);
  }
  return m;
}
const html = readFileSync('dist/index.html', 'utf8');
const asset = html.match(/\/_astro\/[^"]+\.(js|css)/)[0];
const paths = ['/', '/rising-water/', '/garden/', '/cv/', '/robots.txt', '/sitemap-index.xml', '/favicon.svg', '/og/social-card.png', '/data/colorado/meta.json', asset, '/missing-xyz', '/_astro/missing.js'];
let bad = 0;
for (const p of paths) {
  for (const method of ['GET', 'HEAD']) {
    const res = await fetch(base + p, { method, redirect: 'manual' });
    await res.arrayBuffer();
    const exp = expected(p);
    const diffs = [];
    for (const [k, v] of exp) {
      const got = res.headers.get(k);
      if (got !== v) diffs.push(`${k}: got ${got?.slice(0, 80)} want ${v.slice(0, 80)}`);
    }
    if (!exp.has('cache-control')) {
      const cc = res.headers.get('cache-control');
      if (cc !== 'public, max-age=0, must-revalidate') diffs.push(`default cache-control: ${cc}`);
    }
    if ((res.headers.get('cache-control') ?? '').includes(',') && (res.headers.get('cache-control').match(/max-age/g) ?? []).length > 1) diffs.push('duplicated cache-control');
    console.log(`${diffs.length ? 'DIFF' : 'OK  '} ${method} ${p} ${res.status}${diffs.length ? '\n     ' + diffs.join('\n     ') : ''}`);
    bad += diffs.length;
  }
}
console.log(`rules=${rules.length} mismatches=${bad}`);
process.exit(bad ? 1 : 0);
