// D1 checker probe: crawl the base build served under ORIGIN+BASE, record every request, DOM URL
// attribute and console error; then exercise behaviours. Usage: node probe.mjs [origin] [base]
import { chromium } from '@playwright/test';
const ORIGIN = process.argv[2] || 'http://localhost:4321';
const BASE = process.argv[3] ?? '/Personal-Portfolio/';
const log = []; let fails = 0;
const ok = (c, m) => { if (!c) fails++; log.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const reqs = []; const thirdParty = []; const consoleErrs = [];
ctx.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== ORIGIN && !/^(data|blob):/.test(r.url())) thirdParty.push(r.url()); });
ctx.on('response', (r) => reqs.push({ url: r.url(), status: r.status(), from: r.frame()?.url?.() }));
const seen = new Set(); const queue = [ORIGIN + BASE, ORIGIN + BASE + '404.html', ORIGIN + BASE + 'robots.txt', ORIGIN + BASE + 'sitemap-index.xml', ORIGIN + BASE + 'sitemap-0.xml'];
const badAttr = []; const pagesVisited = [];
while (queue.length) {
  const url = queue.shift(); const key = url.split('#')[0];
  if (seen.has(key)) continue; seen.add(key);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(`${key}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrs.push(`${key}: pageerror ${e}`));
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  pagesVisited.push(`${resp?.status()} ${key}`);
  const ct = resp?.headers()['content-type'] || '';
  if (ct.includes('html')) {
    if (key.includes('rising-water')) await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 20000 }).catch(() => {});
    const attrs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[href],[src],[srcset],[content],[action],[poster]')) {
        for (const a of ['href', 'src', 'srcset', 'content', 'action', 'poster']) {
          const v = el.getAttribute(a); if (v == null) continue;
          if (a === 'content' && !/^(https?:|\/)/.test(v)) continue;
          for (const part of a === 'srcset' ? v.split(',').map((s) => s.trim().split(/\s+/)[0]) : [v]) out.push({ tag: el.tagName, a, v: part });
        }
      }
      return out;
    });
    for (const { tag, a, v } of attrs) {
      if (/^(mailto:|tel:|#|data:|javascript:)/.test(v)) continue;
      const abs = new URL(v, key);
      const isSame = abs.origin === ORIGIN || abs.host === 'andrewc156.github.io';
      if (!isSame) continue;
      if (!abs.pathname.startsWith(BASE)) badAttr.push(`${key} ${tag}[${a}]=${v}`);
      if (abs.origin === ORIGIN && tag === 'A' && a === 'href') queue.push(abs.href);
      if (abs.host === 'andrewc156.github.io' && !/^https:\/\/andrewc156\.github\.io\/Personal-Portfolio\//.test(v)) badAttr.push(`${key} abs ${tag}[${a}]=${v}`);
    }
  } else if (ct.includes('xml') || ct.includes('text/plain')) {
    const t = await resp.text();
    for (const m of t.matchAll(/<loc>([^<]+)<\/loc>|Sitemap:\s*(\S+)/g)) {
      const v = m[1] || m[2];
      if (!v.startsWith('https://andrewc156.github.io/Personal-Portfolio/')) badAttr.push(`${key} loc ${v}`);
      // map the public URL onto our local server and crawl it
      queue.push(v.replace('https://andrewc156.github.io', ORIGIN));
    }
  }
  await page.close();
}
const badReq = reqs.filter((r) => new URL(r.url).origin === ORIGIN && (!new URL(r.url).pathname.startsWith(BASE) || (r.status >= 400 && !/404\.html$|\/nope/.test(r.url))));
ok(badAttr.length === 0, `every same-origin DOM URL under ${BASE} (${badAttr.length} bad)`); badAttr.slice(0, 20).forEach((b) => log.push('   ' + b));
ok(badReq.length === 0, `every same-origin request under base and <400 (${reqs.length} responses, ${badReq.length} bad)`); badReq.slice(0, 20).forEach((b) => log.push(`   ${b.status} ${b.url}`));
ok(thirdParty.length === 0, `0 third-party requests (${thirdParty.length})`); thirdParty.slice(0, 10).forEach((b) => log.push('   ' + b));
const nonExpected = consoleErrs.filter((e) => !/404\.html: Failed to load resource: the server responded with a status of 404/.test(e) || false);
log.push(`pages visited (${pagesVisited.length}):`); pagesVisited.forEach((p) => log.push('   ' + p));
log.push('console errors:'); consoleErrs.forEach((e) => log.push('   ' + e));
const urlsFetched = [...new Set(reqs.map((r) => new URL(r.url).pathname))].sort();
log.push(`distinct same-origin paths fetched: ${urlsFetched.length}`); urlsFetched.forEach((p) => log.push('   ' + p));
console.log(log.join('\n'));
console.log(`\nCRAWL FAILS=${fails}`);
await browser.close();
process.exit(fails ? 1 : 0);
