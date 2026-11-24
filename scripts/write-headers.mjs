// Writes dist/_headers from the public/_headers template (spec §10/F8, DECISIONS #55).
//
// The template's Content-Security-Policy contains two marker tokens:
//   __INLINE_SCRIPT_HASHES__  -> hashes for script-src
//   __INLINE_STYLE_HASHES__   -> hashes for style-src
// This script scans every .html file under dist/ and computes 'sha256-…' (base64)
// hashes of:
//   - the text of every inline, executable <script> (no src attribute);
//   - the text of every <style> element;
//   - the value of every style="" attribute and on*="" event-handler attribute.
// Attribute hashes only match when the directive also has 'unsafe-hashes' (CSP 3),
// so that keyword is added to a directive only when the build actually has such
// attributes. Hashes are deduped and sorted, so the output is deterministic.
//
// Run after `astro build` (Astro copies the raw template to dist/_headers; this
// overwrites it). It always reads the template from public/, so reruns are safe.
//
// Exits 1 if: a marker is missing or repeated, dist/ has no HTML, an attribute
// value can't be decoded exactly, a javascript: URL is found, a marker survives, or
// the file breaks Cloudflare's _headers limits (100 rules, 2,000 chars per line:
// https://developers.cloudflare.com/pages/configuration/headers/).
//
// Usage: node scripts/write-headers.mjs [--dist dist] [--template public/_headers]
//                                       [--out <dist>/_headers]
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const show = (p) => (p.startsWith(root) ? relative(root, p) || '.' : p);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const distDir = resolve(root, arg('dist', 'dist'));
const templatePath = resolve(root, arg('template', 'public/_headers'));
const outPath = resolve(root, arg('out', join(distDir, '_headers')));

const SCRIPT_MARKER = '__INLINE_SCRIPT_HASHES__';
const STYLE_MARKER = '__INLINE_STYLE_HASHES__';
const MAX_LINE = 2000;
const MAX_RULES = 100;

// Script types the browser executes (HTML spec): empty/absent, "module", or a
// JavaScript MIME type. Anything else (e.g. application/ld+json) is a data block
// and is not subject to script-src.
const JS_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function fail(msg) {
  console.error(`write-headers: ${msg}`);
  process.exit(1);
}

function sha256(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

// The HTML parser normalises CR LF and lone CR to LF before anything is hashed.
const normaliseNewlines = (s) => s.replace(/\r\n?/g, '\n');

function decodeAttr(value, where) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);?/gi, (m, ent) => {
    if (ent[0] === '#') {
      const code =
        ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : Number(ent.slice(1));
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[ent.toLowerCase()];
    if (named === undefined || !m.endsWith(';')) {
      fail(`${where}: can't decode entity "${m}" in an attribute that needs a hash`);
    }
    return named;
  });
}

const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttrs(src) {
  const attrs = [];
  for (const m of src.matchAll(ATTR_RE)) {
    attrs.push({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? '' });
  }
  return attrs;
}

// Tokenises one HTML document: comments, raw-text elements (script/style) and tags.
const TOKEN_RE =
  /<!--[\s\S]*?-->|<(script|style)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

function scanHtml(html, where, found) {
  for (const m of html.matchAll(TOKEN_RE)) {
    if (m[0].startsWith('<!--')) continue;
    const attrSrc = m[2] ?? m[5] ?? '';
    const attrs = parseAttrs(attrSrc);
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const body = normaliseNewlines(m[3]);
      if (tag === 'script') {
        const type = (attrs.find((a) => a.name === 'type')?.value ?? '').trim().toLowerCase();
        const hasSrc = attrs.some((a) => a.name === 'src');
        if (!hasSrc && JS_TYPES.has(type)) found.scripts.add(sha256(body));
      } else {
        found.styles.add(sha256(body));
      }
    }
    for (const { name, value } of attrs) {
      if (name === 'style') {
        found.styleAttrs.add(sha256(normaliseNewlines(decodeAttr(value, where))));
      } else if (/^on[a-z]+$/.test(name)) {
        found.handlers.add(sha256(normaliseNewlines(decodeAttr(value, where))));
      } else if (
        ['href', 'src', 'action', 'formaction'].includes(name) &&
        /^\s*javascript:/i.test(decodeAttr(value, where))
      ) {
        fail(`${where}: javascript: URL in ${name}="" is not allowed under the CSP`);
      }
    }
  }
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function sourceList(elementHashes, attrHashes) {
  const sorted = (set) => [...set].sort();
  const parts = [...new Set([...sorted(elementHashes), ...sorted(attrHashes)])];
  if (attrHashes.size > 0) parts.unshift("'unsafe-hashes'");
  return parts.join(' ');
}

function fillMarker(text, marker, value) {
  const count = text.split(marker).length - 1;
  if (count !== 1) fail(`template must contain ${marker} exactly once (found ${count})`);
  // Drop the separating space too when there is nothing to insert.
  return value ? text.replace(marker, value) : text.replace(new RegExp(` ?${marker}`), '');
}

function checkLimits(text) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.length > MAX_LINE) {
      fail(`line ${i + 1} is ${line.length} chars; Cloudflare's limit is ${MAX_LINE}`);
    }
  });
  // A rule starts with an unindented, non-comment URL line.
  const rules = lines.filter((l) => l.trim() && !/^\s/.test(l) && !l.startsWith('#')).length;
  if (rules > MAX_RULES) fail(`${rules} header rules; Cloudflare's limit is ${MAX_RULES}`);
  const leftover = text.match(/__INLINE_[A-Z_]+__/);
  if (leftover) fail(`unreplaced marker ${leftover[0]}`);
  return rules;
}

let template;
try {
  template = await readFile(templatePath, 'utf8');
} catch {
  fail(`can't read template ${show(templatePath)}`);
}

let files;
try {
  files = (await htmlFiles(distDir)).sort();
} catch {
  fail(`can't read ${show(distDir)}; run astro build first`);
}
if (files.length === 0) fail(`no .html files in ${show(distDir)}`);

const found = { scripts: new Set(), styles: new Set(), styleAttrs: new Set(), handlers: new Set() };
for (const file of files) {
  scanHtml(await readFile(file, 'utf8'), show(file), found);
}

let out = fillMarker(template, SCRIPT_MARKER, sourceList(found.scripts, found.handlers));
out = fillMarker(out, STYLE_MARKER, sourceList(found.styles, found.styleAttrs));
const rules = checkLimits(out);
const cspLine = out.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));

await writeFile(outPath, out);
console.log(
  `write-headers: ${files.length} HTML files; script-src +${found.scripts.size} element` +
    ` +${found.handlers.size} handler hashes; style-src +${found.styles.size} element` +
    ` +${found.styleAttrs.size} attribute hashes; CSP line ${cspLine?.length ?? 0}/${MAX_LINE}` +
    ` chars; ${rules} rules -> ${show(outPath)}`,
);
