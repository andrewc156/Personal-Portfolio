// F5 checker screenshots → docs/checks/F5/attempt-1/. Needs preview on 4321.
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const D = 'docs/checks/F5/attempt-1';
const b = await chromium.launch();
const errors = [];
const pause = (p, prog) =>
  p.evaluate(async (q) => {
    const h = document.querySelector('[data-hero]').__hero;
    h.scrubTo(q);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, prog);
async function page(theme, w, h, extra = {}) {
  const c = await b.newContext({ colorScheme: theme, viewport: { width: w, height: h }, ...extra });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${B}/?seed=42`);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => (document.documentElement.style.scrollBehavior = 'auto'));
  return { c, p };
}
const ov = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
for (const theme of ['light', 'dark'])
  for (const [w, h] of [[375, 812], [768, 1024], [1280, 800]]) {
    const { c, p } = await page(theme, w, h, w < 500 ? { isMobile: true, hasTouch: true } : {});
    await p.waitForTimeout(1200); // let it play a bit (live frame)
    let f = `${D}/home-${w}x${h}-${theme}-closed.png`;
    await p.screenshot({ path: f });
    console.log(f, 'overflowX', await ov(p));
    await pause(p, 0.55);
    await p.getByRole('button', { name: 'Art settings', exact: true }).click();
    await p.waitForTimeout(600);
    f = `${D}/home-${w}x${h}-${theme}-open.png`;
    await p.screenshot({ path: f });
    // full panel content (scrolled) to check every control fits
    const panelBody = p.locator('#settings-panel');
    const sh = await p.evaluate(() => { const el = document.getElementById('settings-panel'); const sc = [...el.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible'); if (sc) { sc.scrollTop = sc.scrollHeight; return { scroller: sc.className, sh: sc.scrollHeight, ch: sc.clientHeight }; } return null; });
    await p.waitForTimeout(100);
    const f2 = `${D}/home-${w}x${h}-${theme}-open-scrolled.png`;
    await p.screenshot({ path: f2 });
    const fit = await p.evaluate(() => { const el = document.getElementById('settings-panel'); const r = el.getBoundingClientRect(); const bad = []; for (const x of el.querySelectorAll('input,select,button,label,output')) { const q = x.getBoundingClientRect(); if (q.width && (q.right > r.right + 0.5 || q.left < r.left - 0.5)) bad.push(x.id || x.textContent.trim().slice(0, 20)); } return bad; });
    console.log(f, f2, 'overflowX', await ov(p), 'panel scroller', JSON.stringify(sh), 'controls outside panel:', fit);
    await panelBody.screenshot({ path: `${D}/panel-${w}x${h}-${theme}.png` }).catch(() => {});
    await c.close();
  }
// hover highlight (bar hover, finite bar) light + dark at 1280
for (const theme of ['light', 'dark']) {
  const { c, p } = await page(theme, 1280, 800);
  await pause(p, 0.62);
  const k = await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; const lv = h.level(); return h.drawnRows.findIndex((r) => Number.isFinite(r.death) && r.death <= lv && r.death - r.birth > 80); });
  const geo = await p.evaluate((kk) => { const h = document.querySelector('[data-hero]').__hero; const r = h.els.strip.getBoundingClientRect(); const L = h.L; const n = h.drawnRows.length; const pitch = Math.min((L.bottom - L.top) / n, 9 * L.dpr); const row = h.drawnRows[kk]; const x = L.left + ((row.birth + Math.min(row.death, h.level())) / 2 - h.t.minH) / (h.t.maxH - h.t.minH) * (L.right - L.left); return { x: r.left + x / L.dpr, y: r.top + (L.top + (kk + 0.5) * pitch) / L.dpr }; }, k);
  await p.mouse.move(geo.x, geo.y);
  await p.waitForTimeout(150);
  const f = `${D}/hover-1280-${theme}.png`;
  await p.locator('.hero__figure').screenshot({ path: f });
  console.log(f, 'row', k, 'readout:', await p.locator('[data-hero-readout]').textContent());
  // diagram view with a highlighted point
  await p.evaluate(() => document.querySelector('[data-hero]').__hero.update({ view: 'diagram' }));
  await p.evaluate((kk) => document.querySelector('[data-hero]').__hero.highlightRow(kk), k);
  await p.waitForTimeout(150);
  await p.locator('.hero__figure').screenshot({ path: `${D}/diagram-1280-${theme}.png` });
  console.log(`${D}/diagram-1280-${theme}.png`);
  await c.close();
}
// diagram at 375 (narrow)
{
  const { c, p } = await page('light', 375, 812, { isMobile: true, hasTouch: true });
  await p.evaluate(() => document.querySelector('[data-hero]').__hero.update({ view: 'diagram' }));
  await pause(p, 0.7);
  await p.locator('.hero__figure').screenshot({ path: `${D}/diagram-375-light.png` });
  // touch-tap highlight at 375
  await p.evaluate(() => document.querySelector('[data-hero]').__hero.update({ view: 'barcode' }));
  await pause(p, 0.7);
  const sb = await p.locator('[data-hero-strip]').boundingBox();
  await p.touchscreen.tap(sb.x + sb.width * 0.25, sb.y + 30);
  await p.waitForTimeout(150);
  await p.locator('.hero__figure').screenshot({ path: `${D}/tap-375-light.png` });
  console.log('tap readout:', await p.locator('[data-hero-readout]').textContent());
  await c.close();
}
// reduced motion static frame
for (const theme of ['light', 'dark']) {
  const { c, p } = await page(theme, 1280, 800, { reducedMotion: 'reduce' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${D}/reduced-motion-1280-${theme}.png` });
  console.log(`${D}/reduced-motion-1280-${theme}.png`);
  await c.close();
}
// each palette (light; plus dark for all at a glance)
for (const theme of ['light', 'dark']) {
  const { c, p } = await page(theme, 1280, 800);
  for (const pal of ['delta', 'canyon', 'glacier', 'estuary', 'mono']) {
    await p.getByRole('button', { name: 'Art settings', exact: true }).click().catch(() => {});
    await p.waitForTimeout(350);
    await p.selectOption('#hero-palette', pal);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(350);
    await pause(p, 0.5);
    const f = `${D}/palette-${pal}-1280-${theme}.png`;
    await p.locator('.hero__figure').screenshot({ path: f });
    console.log(f);
  }
  // colour by depth + shoreline off
  await p.evaluate(() => document.querySelector('[data-hero]').__hero.update({ colorBy: 'depth', palette: 'delta' }));
  await pause(p, 0.5);
  await p.locator('.hero__figure').screenshot({ path: `${D}/colorby-depth-1280-${theme}.png` });
  await c.close();
}
// DPR 3 crispness check
{
  const { c, p } = await page('light', 1280, 800, { deviceScaleFactor: 3 });
  await pause(p, 0.5);
  await p.locator('.hero__figure').screenshot({ path: `${D}/dpr3-1280-light.png` });
  await c.close();
}
await b.close();
console.log('console errors:', errors.length ? errors : 'none');
