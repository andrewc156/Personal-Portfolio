// Checker-owned probe for F1. Run against preview on :4321.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const B = 'http://localhost:4321';
const out = {};
const browser = await chromium.launch();

async function ctx(opts = {}) { return browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }); }

// 1. axe after the panel animation has settled, both themes, 3 widths, + 404, + reduced motion
out.axe = [];
for (const colorScheme of ['light', 'dark']) for (const width of [375, 768, 1280]) for (const rm of ['no-preference', 'reduce']) {
  const c = await ctx({ colorScheme, viewport: { width, height: 800 }, reducedMotion: rm });
  const p = await c.newPage();
  for (const [label, path, open] of [['home', '/', false], ['home+settings', '/', true], ['404', '/nope/', false]]) {
    await p.goto(B + path);
    if (open) { await p.locator('[data-settings-toggle]').click(); await p.waitForTimeout(600); }
    const r = await new AxeBuilder({ page: p }).analyze();
    const v = r.violations.map((x) => `${x.id}:${x.impact}:${x.nodes.length}`);
    out.axe.push(`${colorScheme} ${width} rm=${rm} ${label}: ${v.join(', ') || 'none'}`);
    if (open) await p.evaluate(() => localStorage.clear());
  }
  await c.close();
}

// 2. axe immediately after open (no wait) to confirm animation-race hypothesis
{
  const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/');
  await p.locator('[data-settings-toggle]').click();
  const op = await p.evaluate(() => getComputedStyle(document.getElementById('settings-panel')).opacity);
  const r = await new AxeBuilder({ page: p }).include('#settings-panel').analyze();
  out.axeImmediate = { opacityAtCheck: op, violations: r.violations.map((x) => `${x.id}:${x.impact}`) };
  await p.waitForTimeout(600);
  const box = await p.locator('#settings-panel').boundingBox();
  const cw = await p.evaluate(() => document.documentElement.clientWidth);
  out.drawerSettled = { box, clientWidth: cw };
  await c.close();
}

// 3. No flash: stored theme != OS, check data-theme AND computed bg at the moment <body> exists, plus first paint via rAF
for (const [os, stored] of [['light', 'dark'], ['dark', 'light']]) {
  const c = await ctx({ colorScheme: os });
  await c.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch {}
    const w = window; w.__log = [];
    new MutationObserver((m, o) => { if (document.body) { w.__log.push(['body', document.documentElement.getAttribute('data-theme'), getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()]); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
    requestAnimationFrame(() => w.__log.push(['raf1', document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]));
  }, stored);
  const p = await c.newPage();
  await p.goto(B + '/');
  out[`noflash_os=${os}_stored=${stored}`] = await p.evaluate(() => window.__log);
  await c.close();
}

// 4. localStorage throws: page works, theme follows OS, toggle + panel work, no page errors
{
  const c = await ctx({ colorScheme: 'dark' });
  await c.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
  });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(B + '/');
  const before = await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]);
  await p.locator('[data-theme-toggle]').click();
  const afterToggle = await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]);
  await p.locator('[data-settings-toggle]').click();
  const exp = await p.locator('[data-settings-toggle]').getAttribute('aria-expanded');
  await p.keyboard.press('Escape');
  const focusGear = await p.evaluate(() => document.activeElement?.hasAttribute('data-settings-toggle'));
  out.storageThrows = { before, afterToggle, expandedAfterOpen: exp, focusGearAfterEsc: focusGear, errors: errs };
  await c.close();
}

// 5. Third-party requests on / (+settings open), /404.html, unknown route, in both themes
{
  const foreign = []; const all = [];
  for (const colorScheme of ['light', 'dark']) {
    const c = await ctx({ colorScheme }); const p = await c.newPage();
    p.on('request', (r) => { const u = r.url(); all.push(u); if (!u.startsWith('data:') && new URL(u).origin !== B) foreign.push(u); });
    for (const path of ['/', '/404.html', '/x/y/']) { await p.goto(B + path); await p.waitForLoadState('networkidle'); }
    await p.goto(B + '/'); await p.locator('[data-settings-toggle]').click(); await p.waitForTimeout(400);
    await c.close();
  }
  out.requests = { foreign, uniqueSameOrigin: [...new Set(all)] };
}

// 6. Focus visible on every focusable element (tab through whole page with panel open)
{
  const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/');
  await p.locator('[data-settings-toggle]').click(); await p.waitForTimeout(400);
  await p.locator('body').click({ position: { x: 5, y: 700 } });
  const seen = [];
  await p.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press('Tab');
    const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return `${e.tagName}.${e.className.split(' ')[0] || ''}#${e.id}[${e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20)}] outline=${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} shadow=${cs.boxShadow}`; });
    if (s && seen.includes(s)) break; seen.push(s);
  }
  out.focus = seen;
  await c.close();
}

// 7. Esc / focus return / gear absent on 404, aria-expanded, open from keyboard
{
  const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/');
  await p.locator('[data-settings-toggle]').focus(); await p.keyboard.press('Enter');
  const a = await p.evaluate(() => [document.querySelector('[data-settings-toggle]').getAttribute('aria-expanded'), document.activeElement?.id, document.getElementById('settings-panel').hidden]);
  await p.keyboard.press('Escape');
  const b = await p.evaluate(() => [document.querySelector('[data-settings-toggle]').getAttribute('aria-expanded'), document.activeElement?.hasAttribute('data-settings-toggle'), document.getElementById('settings-panel').hidden]);
  await p.goto(B + '/404.html');
  const g404 = await p.evaluate(() => [document.querySelectorAll('[data-settings-toggle]').length, document.querySelectorAll('#settings-panel').length]);
  await p.goto(B + '/nope/');
  const gUnknown = await p.evaluate(() => [document.querySelectorAll('[data-settings-toggle]').length, document.title, document.querySelector('h1')?.textContent]);
  // skip link
  await p.goto(B + '/'); await p.keyboard.press('Tab');
  const skipBox = await p.locator('.skip-link').boundingBox();
  await p.keyboard.press('Enter');
  const afterSkip = await p.evaluate(() => [location.hash, document.activeElement?.id]);
  await p.keyboard.press('Tab');
  const nextAfterSkip = await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
  out.panel = { afterOpenKeyboard: a, afterEsc: b, gear404: g404, gearUnknown: gUnknown, skipBox, afterSkip, nextAfterSkip };
  await c.close();
}

// 8. Reduced motion: scroll-behavior, panel animation duration
{
  for (const rm of ['no-preference', 'reduce']) {
    const c = await ctx({ reducedMotion: rm }); const p = await c.newPage(); await p.goto(B + '/');
    await p.locator('[data-settings-toggle]').click();
    out[`motion_${rm}`] = await p.evaluate(() => [getComputedStyle(document.documentElement).scrollBehavior, getComputedStyle(document.getElementById('settings-panel')).animationDuration, getComputedStyle(document.querySelector('.btn')).transitionDuration]);
    await c.close();
  }
}

// 9. Nav scroll to anchors at 375 (mobile) — target top visible under header?
{
  const c = await ctx({ viewport: { width: 375, height: 812 } }); const p = await c.newPage(); await p.goto(B + '/');
  const res = [];
  for (const id of ['mission', 'research', 'work', 'open-science']) {
    await p.goto(B + '/'); await p.locator(`nav a[href="/#${id}"]`).click(); await p.waitForTimeout(900);
    res.push([id, await p.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), id), await p.evaluate(() => scrollY)]);
  }
  out.anchors375 = res;
  await c.close();
}

// 10. Contrast: compute token pairs from live computed styles
out.fontsLoaded = await (async () => { const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/'); const f = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((x) => x.status === 'loaded').map((x) => `${x.family} ${x.weight} ${x.style}`); }); await c.close(); return f; })();

await browser.close();
console.log(JSON.stringify(out, null, 1));
