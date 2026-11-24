// D1 checker: behaviour under the sub-path. Usage: node behave.mjs [origin] [base]
import { chromium } from '@playwright/test';
const O = process.argv[2] || 'http://localhost:4321';
const B = process.argv[3] ?? '/Personal-Portfolio/';
const U = (p) => O + B + p;
const log = []; let fails = 0;
const ok = (c, m) => { if (!c) fails++; log.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); };
const browser = await chromium.launch();
const errs = []; const third = [];
async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  ctx.on('request', (r) => { if (!r.url().startsWith(O) && !/^(data|blob):/.test(r.url())) third.push(r.url()); });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errs.push(`${page.url()}: pageerror ${e}`));
  return { ctx, page };
}
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name}: ${String(e).split('\n')[0]}`); } };

// HERO + settings + theme + anchors
await step('home', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(U(''), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero, null, { timeout: 10000 });
  const f0 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.frames);
  const p0 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.progress);
  await page.waitForTimeout(1500);
  const f1 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.frames);
  const p1 = await page.evaluate(() => document.querySelector('[data-hero]').__hero.progress);
  const st = await page.evaluate(() => document.querySelector('[data-hero]').dataset.state);
  ok(f1 > f0 && p1 !== p0, `hero animates (frames ${f0}->${f1}, progress ${p0?.toFixed?.(3)}->${p1?.toFixed?.(3)}, state ${st})`);
  const varc = await page.evaluate(() => { const c = document.querySelector('[data-hero-map]'); const x = document.createElement('canvas'); x.width = 64; x.height = 32; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 64, 32); const d = g.getImageData(0, 0, 64, 32).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s += l; s2 += l * l; n++; } return s2 / n - (s / n) ** 2; });
  ok(varc > 10, `hero canvas not blank (luminance variance ${varc.toFixed(1)})`);
  // settings panel
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  await gear.click();
  await page.locator('#settings-panel').waitFor({ state: 'visible' });
  const slider = page.locator('#settings-panel input[type="range"]').first();
  const id = await slider.getAttribute('id');
  const before = await page.locator(`#settings-panel output[for="${id}"]`).textContent();
  await slider.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const after = await page.locator(`#settings-panel output[for="${id}"]`).textContent();
  ok(before !== after, `settings slider changes output (${before?.trim()} -> ${after?.trim()})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(await page.locator('#settings-panel').isHidden(), 'settings panel closes on Escape');
  // theme toggle persists
  await page.locator('[data-theme-toggle]').click();
  const t1 = await page.locator('html').getAttribute('data-theme');
  const ls = await page.evaluate(() => localStorage.getItem('theme'));
  await page.goto(U('garden/'), { waitUntil: 'networkidle' });
  const t2 = await page.locator('html').getAttribute('data-theme');
  ok(t1 === 'dark' && ls === 'dark' && t2 === 'dark', `theme toggle persists across pages (${t1}/${ls}/${t2})`);
  await page.locator('[data-theme-toggle]').click();
  ok((await page.locator('html').getAttribute('data-theme')) === 'light', 'theme toggles back to light');
  // nav anchors from another page and on home
  for (const id of ['mission', 'research', 'work', 'open-science']) {
    const link = page.locator(`nav[aria-label="Main"] a[href="${B}#${id}"]`);
    const n = await link.count();
    if (!n) { ok(false, `nav anchor #${id} link with href ${B}#${id} exists`); continue; }
    await link.click();
    await page.waitForURL(new RegExp(`${B}#${id}$`));
    await page.waitForTimeout(900);
    const top = await page.locator(`#${id}`).evaluate((e) => e.getBoundingClientRect().top);
    ok(page.url() === U(`#${id}`) && top >= -2 && top < 200, `nav ${id} -> ${page.url()} target top ${top.toFixed(0)}`);
  }
  // nav page links
  const navHrefs = await page.locator('nav[aria-label="Main"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(navHrefs.every((h) => h.startsWith(B)), `nav hrefs all based: ${navHrefs.join(' ')}`);
  await page.locator('nav[aria-label="Main"] a', { hasText: 'CV' }).click();
  await page.waitForURL(U('cv/'));
  ok((await page.locator('nav[aria-label="Main"] a', { hasText: 'CV' }).getAttribute('aria-current')) === 'page', 'CV nav aria-current=page under base');
  await page.locator('header .wordmark').click();
  await page.waitForURL(U(''));
  ok((await page.locator('header .wordmark').getAttribute('aria-current')) === 'page', 'wordmark -> base home, aria-current=page');
  await ctx.close();
});

// GARDEN
await step('garden', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(U('garden/'), { waitUntil: 'networkidle' });
  const total = await page.locator('[data-work-row]').count();
  const vis = () => page.locator('[data-work-row]:visible').count();
  const chips = await page.locator('a[data-filter="tag"]').evaluateAll((as) => as.map((a) => a.dataset.value).filter(Boolean));
  const tag = chips[0];
  await page.locator(`a[data-filter="tag"][data-value="${tag}"]`).click();
  await page.waitForURL(new RegExp(`${B}garden/\\?tag=${tag}$`));
  const n1 = await vis();
  ok(page.url() === U(`garden/?tag=${tag}`) && n1 < total, `tag chip -> ${page.url()} rows ${n1}/${total}`);
  const typ = (await page.locator('a[data-filter="type"]').evaluateAll((as) => as.map((a) => a.dataset.value).filter(Boolean)))[0];
  await page.locator(`a[data-filter="type"][data-value="${typ}"]`).click();
  await page.waitForURL(/type=/);
  ok(new URL(page.url()).pathname === `${B}garden/` && /tag=/.test(page.url()), `type chip combined -> ${page.url()}`);
  const chipHrefs = await page.locator('a[data-filter]').evaluateAll((as) => as.map((a) => new URL(a.href).pathname));
  ok(chipHrefs.every((p) => p === `${B}garden/`), 'chip hrefs updated client-side stay under base/garden/');
  await page.goBack(); await page.waitForTimeout(300);
  ok(page.url() === U(`garden/?tag=${tag}`) && (await vis()) === n1, `back -> ${page.url()} rows ${await vis()}`);
  await page.goBack(); await page.waitForTimeout(300);
  ok(page.url() === U('garden/') && (await vis()) === total, `back -> ${page.url()} rows ${await vis()}`);
  await page.goForward(); await page.waitForTimeout(300);
  ok(page.url() === U(`garden/?tag=${tag}`) && (await vis()) === n1, `forward -> ${page.url()} rows ${await vis()}`);
  await page.goto(U(`garden/?type=${typ}&tag=${tag}`), { waitUntil: 'networkidle' });
  ok((await page.locator(`a[data-filter="type"][data-value="${typ}"]`).getAttribute('aria-current')) === 'true', 'deep link ?type&tag restores state');
  await page.locator('a[data-filter="type"][data-value=""]').click();
  await page.locator('a[data-filter="tag"][data-value=""]').click();
  await page.waitForTimeout(200);
  ok(page.url() === U('garden/') && (await vis()) === total, `All chips -> ${page.url()}`);
  // row links
  const rowHrefs = await page.locator('[data-work-row] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(rowHrefs.filter((h) => h.startsWith('/')).every((h) => h.startsWith(B)), `garden row links based (${rowHrefs.join(' ')})`);
  await ctx.close();
});

// EXPLORER
await step('explorer', async () => {
  const { ctx, page } = await ctxPage();
  await page.goto(U('rising-water/'));
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true' || document.querySelector('[data-explorer]')?.dataset.match === 'error', null, { timeout: 20000 });
  const match = await page.locator('[data-explorer]').getAttribute('data-match');
  const status = (await page.locator('[data-ex-status]').textContent()).replace(/\s+/g, ' ').trim();
  ok(match === 'true' && /600 of 600/.test(status), `explorer data verified: match=${match} status="${status}"`);
  const imgOk = await page.locator('.ex-map__shade').evaluate((i) => i.complete && i.naturalWidth > 0 && i.getAttribute('src'));
  ok(imgOk && imgOk.startsWith(B), `hillshade img loaded from ${imgOk}`);
  await page.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
  const y = await page.evaluate(() => { const e = document.querySelector('[data-explorer]').__explorer; return e.rowCenterCss(2); });
  const strip = page.locator('[data-ex-strip]');
  await strip.scrollIntoViewIfNeeded();
  const box = await strip.boundingBox();
  await strip.click({ position: { x: box.width / 2, y } });
  await page.waitForTimeout(300);
  const sel = await page.locator('[data-explorer]').getAttribute('data-selected');
  const title = (await page.locator('[data-ex-card-title]').textContent()).replace(/\s+/g, ' ');
  ok(sel && /Lake/.test(title), `bar click selects lake (selected=${sel}, card="${title}")`);
  const rows = await page.locator('[data-lake-row]').count();
  ok(rows === 21, `lakes table has ${rows} rows`);
  await page.getByRole('button', { name: 'Show lake 1 on the map', exact: true }).click();
  await page.waitForTimeout(300);
  const text = (await page.locator('[data-ex-card-text]').textContent()).replace(/\s+/g, ' ');
  ok(/merged at/.test(text), `table button fills card: "${text.slice(0, 80)}…"`);
  await ctx.close();
});

// 404 under base
await step('404', async () => {
  const { ctx, page } = await ctxPage();
  const r = await page.goto(U('no/such/page/'), { waitUntil: 'networkidle' });
  ok(r.status() === 404 && /gone under water/.test(await page.locator('h1').textContent()), `unknown path -> 404 status ${r.status()} custom page`);
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(hrefs.filter((h) => h.startsWith('/')).every((h) => h.startsWith(B)), `404 links based: ${hrefs.filter((h) => h.startsWith('/')).join(' ')}`);
  const css = await page.evaluate(() => [...document.styleSheets].length);
  ok(css > 0, `404 at deep path has stylesheets (${css})`);
  const font = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(','); });
  ok(/Plex/.test(font), `404 deep path fonts loaded (${font})`);
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await page.waitForURL(U(''));
  ok(page.url() === U(''), `404 home link -> ${page.url()}`);
  await page.goto(U('no/such/page/'));
  await page.locator('nav[aria-label="Main"] a', { hasText: 'Rising water' }).click();
  await page.waitForURL(U('rising-water/'));
  ok(true, '404 nav link Rising water works');
  await ctx.close();
});

const unexpected = errs.filter((e) => !(/no\/such\/page/.test(e) && /status of 404/.test(e)));
ok(unexpected.length === 0, `console errors other than the 404 document: ${unexpected.length}`);
errs.forEach((e) => log.push('   ' + e));
ok(third.length === 0, `third-party requests: ${third.length}`); third.forEach((t) => log.push('   ' + t));
console.log(log.join('\n')); console.log(`\nBEHAVIOUR FAILS=${fails}`);
await browser.close();
process.exit(fails ? 1 : 0);
