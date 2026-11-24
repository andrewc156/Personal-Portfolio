// Checker-owned probe for F1 attempt 2: sticky header + drawer below header, overlap, CLS, tab order.
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const out = {};
const browser = await chromium.launch();
const settle = (p) => p.evaluate(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => 0)));
});
// Element at the center of a locator's box: is it the element itself (or inside it)?
const hit = (p, sel) => p.evaluate((s) => {
  const e = document.querySelector(s); const r = e.getBoundingClientRect();
  const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { inView: r.top >= 0 && r.bottom <= innerHeight, top: Math.round(r.top), hitSelf: !!t && (t === e || e.contains(t)), hitEl: t ? t.tagName + '.' + (t.className?.baseVal ?? t.className) : null };
}, sel);

for (const theme of ['light', 'dark']) for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
  const c = await browser.newContext({ colorScheme: theme, viewport: { width: w, height: h } });
  await c.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__shifts.push({ v: e.value, recent: e.hadRecentInput, src: (e.sources || []).map((s) => s.node?.nodeName + '.' + (s.node?.className || '')) }))).observe({ type: 'layout-shift', buffered: true });
  });
  const p = await c.newPage();
  await p.goto(B + '/'); await p.evaluate(() => document.fonts.ready); await settle(p);
  const r = { scrollable: await p.evaluate(() => document.documentElement.scrollHeight - innerHeight) };
  r.shiftsLoad = await p.evaluate(() => window.__shifts.slice());
  // open at top
  const mainTop0 = await p.evaluate(() => Math.round(document.getElementById('main').getBoundingClientRect().top));
  await p.locator('[data-settings-toggle]').click(); await settle(p);
  r.mainTopDelta = (await p.evaluate(() => Math.round(document.getElementById('main').getBoundingClientRect().top))) - mainTop0;
  r.geom = await p.evaluate(() => {
    const hd = document.querySelector('.site-header').getBoundingClientRect(); const pn = document.getElementById('settings-panel').getBoundingClientRect();
    return { headerBottom: Math.round(hd.bottom), headerPos: getComputedStyle(document.querySelector('.site-header')).position, var: document.documentElement.style.getPropertyValue('--shell-header-h'), panel: [Math.round(pn.x), Math.round(pn.y), Math.round(pn.width), Math.round(pn.height), Math.round(pn.bottom)], overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  r.gearTop = await hit(p, '[data-settings-toggle]'); r.toggleTop = await hit(p, '[data-theme-toggle]');
  // scroll with panel open
  await p.mouse.move(20, h - 20); await p.mouse.wheel(0, 700); await p.waitForTimeout(400);
  r.scrollY = await p.evaluate(() => scrollY);
  r.gearScrolled = await hit(p, '[data-settings-toggle]'); r.toggleScrolled = await hit(p, '[data-theme-toggle]');
  r.panelYScrolled = await p.evaluate(() => Math.round(document.getElementById('settings-panel').getBoundingClientRect().y));
  // close, scroll, reopen while scrolled (header switches static→sticky)
  await p.keyboard.press('Escape'); await settle(p);
  r.focusAfterEsc = await p.evaluate(() => document.activeElement?.hasAttribute('data-settings-toggle'));
  await p.evaluate(() => scrollTo(0, 500)); await p.waitForTimeout(200);
  const sy0 = await p.evaluate(() => scrollY);
  await p.evaluate(() => { window.__shifts = []; });
  await p.locator('[data-settings-toggle]').evaluate((e) => e.click()); await settle(p);
  r.reopenScrolled = { scrollBefore: sy0, scrollAfter: await p.evaluate(() => scrollY), gear: await hit(p, '[data-settings-toggle]'), shifts: await p.evaluate(() => window.__shifts.slice()) };
  r.screenshot = `docs/checks/F1/attempt-2/extra-open-scrolled-${w}x${h}-${theme}.png`;
  await p.screenshot({ path: r.screenshot });
  // all shifts during the session (open/close), excluding input-driven
  r.shiftsNoInputTotal = await p.evaluate(() => window.__shifts.filter((s) => !s.recent).reduce((a, s) => a + s.v, 0));
  await p.evaluate(() => localStorage.clear());
  out[`${theme}-${w}`] = r;
  await c.close();
}

// Stored-open on load at 1280 scrolled restore + resize 1280→375→1280 with panel open
{
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => { try { localStorage.setItem('settings-open', '1'); } catch {} });
  const p = await c.newPage(); await p.goto(B + '/'); await settle(p);
  const g = () => p.evaluate(() => { const pn = document.getElementById('settings-panel').getBoundingClientRect(); return { hidden: document.getElementById('settings-panel').hidden, attr: document.documentElement.hasAttribute('data-settings-open'), expanded: document.querySelector('[data-settings-toggle]').getAttribute('aria-expanded'), panel: [Math.round(pn.x), Math.round(pn.y), Math.round(pn.width), Math.round(pn.height)], hdr: Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom), headerPos: getComputedStyle(document.querySelector('.site-header')).position }; });
  out.storedOpen1280 = await g();
  await p.setViewportSize({ width: 375, height: 812 }); await settle(p); out.resized375 = await g();
  await p.setViewportSize({ width: 800, height: 900 }); await settle(p); out.resized800 = await g();
  await p.setViewportSize({ width: 1280, height: 800 }); await settle(p); out.resized1280 = await g();
  await c.close();
}

// Tab order with the panel open: gear -> first panel control -> ... -> then main/footer
{
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage();
  await p.goto(B + '/');
  await p.locator('[data-settings-toggle]').focus(); await p.keyboard.press('Enter');
  const afterOpen = await p.evaluate(() => document.activeElement?.id);
  await p.locator('[data-settings-toggle]').focus();
  const seq = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    seq.push(await p.evaluate(() => { const e = document.activeElement; return (e.closest('#settings-panel') ? 'PANEL:' : e.closest('main') ? 'MAIN:' : e.closest('footer') ? 'FOOTER:' : '') + e.tagName + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') + (e.id ? '#' + e.id : ''); }));
  }
  // closed panel: Tab from gear skips hidden panel
  await p.keyboard.press('Escape');
  await p.locator('[data-settings-toggle]').focus(); await p.keyboard.press('Tab');
  const closedNext = await p.evaluate(() => { const e = document.activeElement; return (e.closest('#settings-panel') ? 'PANEL:' : '') + e.tagName + ' ' + (e.textContent || '').trim().slice(0, 30); });
  // skip link still targets main
  await p.goto(B + '/'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
  const skip = await p.evaluate(() => document.activeElement?.id);
  out.tab = { afterOpen, seq, closedNext, skip };
  await c.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
