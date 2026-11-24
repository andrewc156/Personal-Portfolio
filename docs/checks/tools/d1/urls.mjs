// Extract every URL-ish attribute/CSS url()/fetch-like literal from every text file in a dist dir.
// Usage: node urls.mjs <distDir> [--js]  -> prints "file\tkind\tvalue" sorted
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = process.argv[2];
const withJs = process.argv.includes('--js');
const out = [];
function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|xml|txt|css)$/.test(n) || (withJs && /\.js$/.test(n))) scan(p);
  }
}
function scan(p) {
  const t = readFileSync(p, 'utf8');
  const f = relative(root, p);
  const add = (k, v) => out.push(`${f}\t${k}\t${v}`);
  for (const m of t.matchAll(/\s(href|src|content|action|poster|data-src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
    const v = m[3] ?? m[4] ?? m[5];
    if (m[1].toLowerCase() === 'content' && !/^(https?:|\/)/.test(v)) continue;
    add(m[1].toLowerCase(), v);
  }
  for (const m of t.matchAll(/srcset\s*=\s*"([^"]*)"/gi)) for (const s of m[1].split(',')) add('srcset', s.trim().split(/\s+/)[0]);
  for (const m of t.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add('css-url', m[1]);
  for (const m of t.matchAll(/<loc>([^<]+)<\/loc>/g)) add('loc', m[1]);
  for (const m of t.matchAll(/^Sitemap:\s*(\S+)/gm)) add('robots-sitemap', m[1]);
  for (const m of t.matchAll(/(?:import\(|from\s*|import\s*)["']([^"']+)["']/g)) add('import', m[1]);
  if (withJs) for (const m of t.matchAll(/["'`](\/[A-Za-z_][^"'`\s]*)["'`]/g)) add('js-literal', m[1]);
}
walk(root);
console.log([...new Set(out)].sort().join('\n'));
