// F5 attempt-2 checker screenshots + layout probes → docs/checks/F5/attempt-2/. Needs preview on 4321.
import { chromium } from 'playwright';
import fs from 'node:fs';
const B = 'http://localhost:4321';
const D = 'docs/checks/F5/attempt-2';
fs.mkdirSync(D, { recursive: true });
const b = await chromium.launch();
const errors = [];
const H = 'document.querySelector("[data-hero]").__hero';
const pause = (p, prog) =>
  p.evaluate(async (q) => {
    const h = document.querySelector('[data-hero]').__hero;
    h.scrubTo(q);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, prog);
async function page(theme, w, h, extra = {}, url = '/') {
  const c = await b.newContext({ colorScheme: theme, viewport: { width: w, height: h }, ...extra });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(B + url);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => (document.documentElement.style.scrollBehavior = 'auto'));
  return { c, p };
}
const ov = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const fit = (p) => p.locator('[data-hero-readout]').evaluate((el) => ({ text: el.textContent.trim(), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, ov: getComputedStyle(el).overflow, to: getComputedStyle(el).textOverflow }));
// Choose the bar with the longest readout among drawn rows (finite, born and dead at level).
const longestRow = (p) => p.evaluate(() => {
  const h = document.querySelector('[data-hero]').__hero; const lv = h.level();
  let best = -1, bl = -1;
  h.drawnRows.forEach((r, k) => { if (r.birth <= lv && Number.isFinite(r.death)) { const s = `${h.t.lakes.labelOf[r.birthCell]}${Math.round(r.birth)}${h.t.lakes.labelOf[r.mergedInto] ?? 0}${Math.round(r.death)}${Math.round(r.death - r.birth)}`.length; if (s > bl) { bl = s; best = k; } } });
  return best;
});

// 1. Home closed/open at 3 widths × 2 themes
for (const theme of ['light', 'dark'])
  for (const [w, hh] of [[375, 812], [768, 1024], [1280, 800]]) {
    const { c, p } = await page(theme, w, hh, w < 500 ? { isMobile: true, hasTouch: true } : {});
    await p.waitForTimeout(1200);
    let f = `${D}/home-${w}-${theme}-closed.png`;
    await p.screenshot({ path: f });
    console.log(f, 'overflowX', await ov(p));
    await pause(p, 0.55);
    await p.getByRole('button', { name: 'Art settings', exact: true }).click();
    await p.waitForTimeout(600);
    f = `${D}/home-${w}-${theme}-open.png`;
    await p.screenshot({ path: f });
    await p.evaluate(() => { const el = document.getElementById('settings-panel'); const sc = [...el.querySelectorAll('*'), el].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop = sc.scrollHeight; });
    await p.waitForTimeout(100);
    await p.screenshot({ path: `${D}/home-${w}-${theme}-open-scrolled.png` });
    console.log(f, 'overflowX', await ov(p));
    await c.close();
  }

// 2. Bar highlight at all 3 widths (light+dark), longest readout; fit + CLS + bar-row height
for (const theme of ['light', 'dark'])
  for (const [w, hh] of [[375, 812], [768, 1024], [1280, 800]]) {
    const { c, p } = await page(theme, w, hh, w < 500 ? { isMobile: true, hasTouch: true } : {});
    await pause(p, 0.62);
    await p.waitForTimeout(300);
    const cls0 = await p.evaluate(() => window.__cls);
    const before = (await p.locator('.hero__bar').boundingBox()).height;
    const k = await longestRow(p);
    await p.evaluate((kk) => document.querySelector('[data-hero]').__hero.highlightRow(kk), k);
    await p.waitForTimeout(250);
    const after = (await p.locator('.hero__bar').boundingBox()).height;
    const cls1 = await p.evaluate(() => window.__cls);
    const r = await fit(p);
    await p.locator('.hero__figure').screenshot({ path: `${D}/highlight-${w}-${theme}.png` });
    console.log(`highlight ${w} ${theme} row ${k}: ${JSON.stringify(r)} barH ${before}→${after} CLS load ${cls0.toFixed(5)} after-highlight ${cls1.toFixed(5)}`);
    // essential bar readout too
    const ke = await p.evaluate(() => document.querySelector('[data-hero]').__hero.drawnRows.findIndex((r) => !Number.isFinite(r.death)));
    await p.evaluate((kk) => document.querySelector('[data-hero]').__hero.highlightRow(kk), ke);
    await p.waitForTimeout(150);
    console.log(`  essential: ${JSON.stringify(await fit(p))} barH ${(await p.locator('.hero__bar').boundingBox()).height}`);
    await c.close();
  }
// 2b. Real mouse hover at 1280 + real tap at 375 (CLS includes input-excluded? we report raw too)
{
  const { c, p } = await page('light', 1280, 800);
  await pause(p, 0.62);
  const sb = await p.locator('[data-hero-strip]').boundingBox();
  for (let i = 0; i < 8; i++) { await p.mouse.move(sb.x + sb.width * 0.3, sb.y + 8 + i * 6); await p.waitForTimeout(60); }
  await p.locator('.hero__figure').screenshot({ path: `${D}/hover-mouse-1280-light.png` });
  console.log('mouse hover 1280:', JSON.stringify(await fit(p)), 'CLS', (await p.evaluate(() => window.__cls)).toFixed(5));
  await c.close();
}
{
  const { c, p } = await page('dark', 375, 812, { isMobile: true, hasTouch: true });
  await pause(p, 0.7);
  const sb = await p.locator('[data-hero-strip]').boundingBox();
  await p.touchscreen.tap(sb.x + sb.width * 0.25, sb.y + 30);
  await p.waitForTimeout(200);
  await p.locator('.hero__figure').screenshot({ path: `${D}/tap-375-dark.png` });
  console.log('tap 375:', JSON.stringify(await fit(p)), 'CLS', (await p.evaluate(() => window.__cls)).toFixed(5));
  await c.close();
}

// 3. Reduced motion static frame with readout
for (const theme of ['light', 'dark'])
  for (const [w, hh] of [[375, 812], [1280, 800]]) {
    const { c, p } = await page(theme, w, hh, { reducedMotion: 'reduce', ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${D}/reduced-motion-${w}-${theme}.png` });
    console.log(`reduced ${w} ${theme}:`, JSON.stringify(await fit(p)));
    await c.close();
  }

// 4. Markers near map edges at 375 for several seeds: record label boxes from fillText/measureText
//    on the real map context (independent of placeLabel), and check inside + no overlap.
let markerBad = 0, markerCases = 0;
for (const seed of [42, 7, 2026, 123456, 99, 31337]) {
  const { c, p } = await page('light', 375, 812, { isMobile: true, hasTouch: true });
  await p.evaluate((s) => document.querySelector('[data-hero]').__hero.newTerrain(s), seed);
  await pause(p, 1);
  const info = await p.evaluate(() => {
    const h = document.querySelector('[data-hero]').__hero; const W = h.grid.W, HH = h.grid.H;
    const edge = (cell) => { const x = cell % W, y = Math.floor(cell / W); return Math.min(x, y, W - 1 - x, HH - 1 - y); };
    return h.drawnRows.map((r, k) => ({ k, e: Math.min(edge(r.birthCell), Number.isFinite(r.death) ? edge(r.deathCell) : 99) })).sort((a, b) => a.e - b.e).slice(0, 3);
  });
  let shot = 0;
  for (const { k, e } of info) {
    const res = await p.evaluate(async (kk) => {
      const h = document.querySelector('[data-hero]').__hero; const cv = h.els.map; const ctx = cv.getContext('2d');
      const texts = []; const of = ctx.fillText.bind(ctx); const arcs = []; const oa = ctx.arc.bind(ctx);
      ctx.fillText = (s, x, y, mw) => { texts.push({ s, x, y, w: ctx.measureText(s).width, font: ctx.font, base: ctx.textBaseline }); return of(s, x, y, mw); };
      ctx.arc = (x, y, r, a0, a1) => { arcs.push({ x, y, r }); return oa(x, y, r, a0, a1); };
      h.highlightRow(kk);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ctx.fillText = of; ctx.arc = oa;
      return { texts: texts.slice(-2), arcs: arcs.slice(-2), W: cv.width, H: cv.height, dpr: h.dpr };
    }, k);
    markerCases++;
    const px = Number.parseFloat(res.texts[0]?.font.match(/(\d+(\.\d+)?)px/)[1] ?? '12');
    const boxes = res.texts.map((t) => ({ s: t.s, x: t.x, y: t.y - px * 0.6, w: t.w, h: px * 1.2 }));
    const inside = boxes.every((q) => q.x >= 0 && q.y >= 0 && q.x + q.w <= res.W && q.y + q.h <= res.H);
    const ovl = boxes.length === 2 && boxes[0].x < boxes[1].x + boxes[1].w && boxes[1].x < boxes[0].x + boxes[0].w && boxes[0].y < boxes[1].y + boxes[1].h && boxes[1].y < boxes[0].y + boxes[0].h;
    const pit = res.arcs.find((a) => a.r > 3 * res.dpr) ?? res.arcs[0];
    const pitIn = pit && pit.x - pit.r >= 0 && pit.y - pit.r >= 0 && pit.x + pit.r <= res.W && pit.y + pit.r <= res.H;
    // label vs marker overlap (pit ring)
    const hitsPit = pit && boxes.some((q) => q.x < pit.x + pit.r && pit.x - pit.r < q.x + q.w && q.y < pit.y + pit.r && pit.y - pit.r < q.y + q.h);
    const ok = inside && !ovl && pitIn && !hitsPit && boxes.length >= 1;
    if (!ok) markerBad++;
    console.log(`markers seed ${seed} row ${k} edgeDist ${e}: ${ok ? 'OK' : 'BAD'} inside=${inside} overlap=${ovl} pitInside=${pitIn} labelOnPit=${hitsPit} ${boxes.map((q) => `"${q.s}"@${q.x.toFixed(0)},${q.y.toFixed(0)}+${q.w.toFixed(0)}`).join(' ')} canvas ${res.W}x${res.H}`);
    if (shot++ < 2) await p.locator('.hero__map').screenshot({ path: `${D}/markers-375-seed${seed}-row${k}.png` });
  }
  await c.close();
}
console.log(`marker cases ${markerCases}, bad ${markerBad}`);

// 5. Diagram view (with highlight) light/dark 1280 + 375; strip aria-label per view
for (const theme of ['light', 'dark'])
  for (const [w, hh] of [[1280, 800], [375, 812]]) {
    const { c, p } = await page(theme, w, hh, w < 500 ? { isMobile: true, hasTouch: true } : {});
    const lab0 = await p.getAttribute('[data-hero-strip]', 'aria-label');
    await p.getByRole('button', { name: 'Art settings', exact: true }).click();
    await p.waitForTimeout(400);
    const viewSel = await p.evaluate(() => { const el = document.querySelector('#hero-view'); return el ? { tag: el.tagName, opts: [...(el.options ?? [])].map((o) => o.value) } : [...document.querySelectorAll('[name="hero-view"]')].map((e) => e.value); });
    if (viewSel.tag === 'SELECT') await p.selectOption('#hero-view', 'diagram');
    else await p.check('[name="hero-view"][value="diagram"]');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const lab1 = await p.getAttribute('[data-hero-strip]', 'aria-label');
    await pause(p, 0.7);
    const k = await longestRow(p);
    await p.evaluate((kk) => document.querySelector('[data-hero]').__hero.highlightRow(kk), k);
    await p.waitForTimeout(200);
    await p.locator('.hero__figure').screenshot({ path: `${D}/diagram-${w}-${theme}.png` });
    if (theme === 'light' && w === 1280) {
      console.log('view control:', JSON.stringify(viewSel));
      console.log('strip label barcode:', lab0);
      console.log('strip label diagram:', lab1);
      await p.evaluate(() => document.querySelector('[data-hero]').__hero.update({ view: 'barcode' }));
      console.log('strip label back to barcode:', await p.getAttribute('[data-hero-strip]', 'aria-label'));
      console.log('keyshortcuts:', await p.getAttribute('[data-hero]', 'aria-keyshortcuts'));
      console.log('help:', (await p.textContent('#hero-keys')).replace(/\s+/g, ' ').trim());
      console.log('caption:', (await p.textContent('.hero__caption')).replace(/\s+/g, ' ').trim(), '| href', await p.getAttribute('.hero__caption a', 'href'));
    }
    console.log(`diagram ${w} ${theme}:`, JSON.stringify(await fit(p)));
    await c.close();
  }
await b.close();
console.log('console errors:', errors.length ? errors : 'none');
