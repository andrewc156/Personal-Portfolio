// F8 checker: own CSP probe against `wrangler pages dev dist`.
// Usage: node docs/checks/tools/f8/csp_probe.mjs [origin] [shotDir]
import { chromium } from '@playwright/test';
const O = process.argv[2] || 'http://localhost:8788';
const SHOTS = process.argv[3] || 'docs/checks/F8/attempt-1';
const XO = O.replace('localhost', '127.0.0.1'); // a different origin, still local
const log = [];
let fails = 0;
const ok = (c, m) => { if (!c) fails++; log.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); };
const browser = await chromium.launch();
const errs = [];
const third = [];
const PAGES = ['', 'garden/', 'research/', 'research/water-quality/', 'research/tda-rivernets/', 'research/number-theory/', 'research/spectral-fractals/', 'cv/', 'about/', 'rising-water/', 'no-such-page-f8c/'];

async function ctxPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__v = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__v.push(`${e.violatedDirective}|${e.blockedURI}|${e.sample}`), true);
  });
  ctx.on('request', (r) => { if (!r.url().startsWith(O)) third.push(r.url()); });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`${page.url()}: pageerror ${e}`));
  return { ctx, page };
}
const V = (page) => page.evaluate(() => window.__v);
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name}: ${String(e).split('\n')[0]}`); } };

await step('all pages zero violations', async () => {
  const { ctx, page } = await ctxPage();
  for (const p of PAGES) {
    const r = await page.goto(O + '/' + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(p === 'rising-water/' ? 2500 : 600);
    const v = await V(page);
    const csp = r.headers()['content-security-policy'] || '';
    // computed styles applied from the external sheet (style-src 'self') + fonts
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
    ok(v.length === 0 && csp.length > 100, `/${p} status ${r.status()} violations=${v.length} ${v.join(' ; ')} font="${font.slice(0, 30)}" loadedFonts=${fontsOk}`);
    if (['', 'garden/', 'rising-water/', 'no-such-page-f8c/'].includes(p)) {
      await page.screenshot({ path: `${SHOTS}/wrangler-${p.replace(/\W+/g, '_') || 'home'}-1280.png` });
    }
  }
  await ctx.close();
});

await step('theme + hero + settings', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(O + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero, null, { timeout: 10000 });
  const f0 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.frames);
  await page.waitForTimeout(1500);
  const f1 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.frames);
  ok(f1 > f0, `hero animates frames ${f0}->${f1}`);
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  await gear.click();
  await page.locator('#settings-panel').waitFor({ state: 'visible' });
  const slider = page.locator('#settings-panel input[type="range"]').first();
  const id = await slider.getAttribute('id');
  const before = await page.locator(`#settings-panel output[for="${id}"]`).textContent();
  await slider.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const after = await page.locator(`#settings-panel output[for="${id}"]`).textContent();
  ok(before !== after, `settings slider works (${before?.trim()} -> ${after?.trim()})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(await page.locator('#settings-panel').isHidden(), 'settings closes on Escape');
  await page.locator('[data-theme-toggle]').click();
  const t1 = await page.locator('html').getAttribute('data-theme');
  await page.reload({ waitUntil: 'networkidle' });
  const t2 = await page.locator('html').getAttribute('data-theme');
  await page.goto(O + '/cv/', { waitUntil: 'networkidle' });
  const t3 = await page.locator('html').getAttribute('data-theme');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(t1 === 'dark' && t2 === 'dark' && t3 === 'dark', `theme persists via inline script (${t1}/${t2}/${t3}) body bg ${bg}`);
  ok((await V(page)).length === 0, 'no violations during theme/hero/settings');
  await ctx.close();
});

await step('garden filters', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(O + '/garden/', { waitUntil: 'networkidle' });
  const total = await page.locator('[data-work-row]').count();
  const typ = (await page.locator('a[data-filter="type"]').evaluateAll((as) => as.map((a) => a.dataset.value).filter(Boolean)))[0];
  await page.locator(`a[data-filter="type"][data-value="${typ}"]`).click();
  await page.waitForURL(/type=/);
  const n = await page.locator('[data-work-row]:visible').count();
  const cur = await page.locator(`a[data-filter="type"][data-value="${typ}"]`).getAttribute('aria-current');
  ok(n < total && cur === 'true', `garden type filter (inline module script) ${typ}: ${n}/${total} aria-current=${cur}`);
  ok((await V(page)).length === 0, 'no violations on garden filters');
  await ctx.close();
});

await step('explorer', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(O + '/rising-water/');
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true' || document.querySelector('[data-explorer]')?.dataset.match === 'error', null, { timeout: 30000 });
  const match = await page.locator('[data-explorer]').getAttribute('data-match');
  const status = (await page.locator('[data-ex-status]').textContent()).replace(/\s+/g, ' ').trim();
  ok(match === 'true' && /600 of 600/.test(status), `explorer verified match=${match} status="${status}"`);
  const subtle = await page.evaluate(() => !!(window.crypto && crypto.subtle && window.isSecureContext));
  ok(subtle, `Web Crypto available (secure context) = ${subtle}`);
  const ar = await page.locator('.ex-map').evaluate((el) => getComputedStyle(el).aspectRatio);
  ok(ar !== 'auto', `style attr aspect-ratio applied: ${ar}`);
  const sw = await page.locator('[style*="--sw-l"]').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--sw-l'));
  ok(sw.trim().length > 0, `swatch custom property applied: ${sw.trim()}`);
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
  const y = await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.rowCenterCss(2));
  const strip = page.locator('[data-ex-strip]');
  await strip.scrollIntoViewIfNeeded();
  const box = await strip.boundingBox();
  await strip.click({ position: { x: box.width / 2, y } });
  await page.waitForTimeout(300);
  const sel = await page.locator('[data-explorer]').getAttribute('data-selected');
  const title = (await page.locator('[data-ex-card-title]').textContent()).replace(/\s+/g, ' ');
  ok(sel && /Lake/.test(title), `bar click selects lake (selected=${sel}, "${title.trim()}")`);
  const prevented = await page.locator('form.ex-controls').evaluate((f) => { const ev = new Event('submit', { cancelable: true }); f.dispatchEvent(ev); return ev.defaultPrevented; });
  ok(prevented, `hashed onsubmit handler ran (defaultPrevented=${prevented})`);
  ok((await V(page)).length === 0, `no violations in explorer: ${(await V(page)).join(' ; ')}`);
  await page.screenshot({ path: `${SHOTS}/wrangler-rising-water-selected-1280.png` });
  await ctx.close();
});

await step('negative controls', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(O + '/rising-water/', { waitUntil: 'networkidle' });
  const res = await page.evaluate(async (XO) => {
    const out = {};
    const s = document.createElement('script'); s.textContent = 'window.__inj = 1'; document.body.append(s);
    out.inlineScript = window.__inj === 1;
    const st = document.createElement('style'); st.textContent = 'body{outline: 7px solid rgb(9, 8, 7)}'; document.head.append(st);
    const d = document.createElement('div'); d.setAttribute('style', 'color: rgb(1, 2, 3)'); document.body.append(d);
    // a copy of an existing allowed attribute value must still apply (hash match), to prove the control is fair
    const handler = document.createElement('button'); handler.setAttribute('onclick', 'window.__h = 1'); document.body.append(handler); handler.click();
    out.handler = window.__h === 1;
    let fetchOk = 'blocked';
    try { await fetch(XO + '/data/colorado/meta.json'); fetchOk = 'loaded'; } catch { fetchOk = 'blocked'; }
    out.fetch = fetchOk;
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r('loaded'); i.onerror = () => r('blocked'); i.src = XO + '/favicon.svg'; document.body.append(i); });
    out.img = img;
    let ev = 'blocked'; try { eval('1'); ev = 'ran'; } catch { ev = 'blocked'; }
    out.eval = ev;
    await new Promise((r) => setTimeout(r, 300));
    out.styleEl = getComputedStyle(document.body).outlineColor;
    out.styleAttr = getComputedStyle(d).color;
    return out;
  }, XO);
  const v = await V(page);
  ok(!res.inlineScript, `injected inline <script> blocked (ran=${res.inlineScript})`);
  ok(res.styleEl !== 'rgb(9, 8, 7)', `injected <style> blocked (outline ${res.styleEl})`);
  ok(res.styleAttr !== 'rgb(1, 2, 3)', `injected style attribute blocked (color ${res.styleAttr})`);
  ok(!res.handler, `injected onclick handler blocked (ran=${res.handler})`);
  ok(res.fetch === 'blocked', `cross-origin fetch ${XO} blocked (${res.fetch})`);
  ok(res.img === 'blocked', `cross-origin <img> blocked (${res.img})`);
  ok(res.eval === 'blocked', `eval blocked (${res.eval})`);
  const dirs = [...new Set(v.map((x) => x.split('|')[0]))];
  ok(v.length >= 6, `violation events ${v.length}: directives ${dirs.join(', ')}`);
  await ctx.close();
});

await browser.close();
const thirdReal = third.filter((u) => !u.startsWith(XO));
ok(thirdReal.length === 0, `no requests to other origins except the deliberate negative-control ones (${thirdReal.length}) ${thirdReal.slice(0, 5).join(' ')}`);
log.push(`console errors (${errs.length}):`, ...errs.map((e) => '   ' + e));
log.push(`other-origin requests attempted (negative controls): ${third.join(' ')}`);
console.log(log.join('\n'));
console.log(fails ? `FAILS: ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
