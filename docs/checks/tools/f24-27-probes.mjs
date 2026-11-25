// F24–F27 checker: independent browser probes against `astro preview` on :4321.
// Usage: node docs/checks/tools/f24-27-probes.mjs [group]   (groups: f25 f26 f27 all)
// Writes JSON results and screenshots under docs/checks/F2N/attempt-1/.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const B = 'http://localhost:4321';
const group = process.argv[2] ?? 'all';
const out = (f) => { mkdirSync(`docs/checks/${f}/attempt-1`, { recursive: true }); return `docs/checks/${f}/attempt-1`; };
const results = {};
const rec = (f, id, ok, detail) => { (results[f] ??= []).push({ id, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${f} ${id}: ${JSON.stringify(detail)}`); };
const browser = await chromium.launch();
const errors = [];
async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  c.on('page', (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`${p.url()}: pageerror ${e.message}`));
  });
  return c;
}
const activeInfo = (page) => page.evaluate(() => {
  const a = document.activeElement; const r = a?.getBoundingClientRect();
  return { tag: a?.tagName, id: a?.id, text: (a?.getAttribute('aria-label') || a?.textContent || '').trim().slice(0, 40), inPanel: !!a?.closest('#settings-panel'), top: r ? Math.round(r.top) : null, bottom: r ? Math.round(r.bottom) : null, vh: innerHeight, scrollY: Math.round(scrollY) };
});
const waitHero = (p) => p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero || !!document.querySelector('[data-hero]')?.__art);
const heroSt = (p) => p.evaluate(() => { const r = document.querySelector('[data-hero]'); const a = r.__art; return { state: r.dataset.state, running: r.dataset.running, playing: a?.playing, progress: a?.progress, frames: a?.frames, label: document.querySelector('.hero__bar [data-hero-play]')?.textContent.trim(), summary: document.querySelector('[data-hero-summary]')?.textContent, url: location.href, hl: history.length }; });
const canvasHash = (p) => p.evaluate(() => { const c = document.querySelector('[data-hero-map]'); const d = c.toDataURL(); let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d.charCodeAt(i)) | 0; return h; });

if (group === 'f25' || group === 'all') {
  const F = 'F25'; const dir = out(F);
  // QA-03: narrow sheet, both openers
  for (const opener of ['header', 'hero']) {
    const c = await ctx({ viewport: { width: 390, height: 844 }, hasTouch: false });
    const p = await c.newPage(); await p.goto(B + '/'); await waitHero(p);
    const btn = opener === 'header' ? p.locator('header button[aria-controls="settings-panel"]') : p.locator('.hero__toolbar button[aria-controls="settings-panel"]');
    await btn.focus(); await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    const sem = await p.evaluate(() => { const pn = document.getElementById('settings-panel'); return { role: pn.getAttribute('role'), modal: pn.getAttribute('aria-modal'), mainInert: document.querySelector('main')?.inert ?? document.querySelector('main')?.closest('[inert]') !== null, headerInert: !!document.querySelector('body > header, header')?.closest('[inert]') }; });
    await p.getByRole('button', { name: 'Reset' }).first().focus();
    const seq = [];
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); seq.push(await activeInfo(p)); }
    for (let i = 0; i < 10; i++) { await p.keyboard.press('Shift+Tab'); seq.push(await activeInfo(p)); }
    const escaped = seq.filter((s) => !s.inPanel);
    if (opener === 'header') await p.screenshot({ path: `${dir}/qa03-sheet-390-tabbing.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({ expanded: document.activeElement?.getAttribute('aria-controls'), inHeader: !!document.activeElement?.closest('header'), inHero: !!document.activeElement?.closest('.hero__toolbar'), inertLeft: document.querySelectorAll('[inert]').length }));
    // backdrop tap
    await btn.click(); await p.waitForTimeout(300);
    await p.mouse.click(195, 80); await p.waitForTimeout(300);
    const afterBackdrop = await p.evaluate(() => ({ open: !document.getElementById('settings-panel').hidden, focusOpener: document.activeElement?.getAttribute('aria-controls') === 'settings-panel', inert: document.querySelectorAll('[inert]').length }));
    rec(F, `QA-03 ${opener} opener`, sem.role === 'dialog' && sem.modal === 'true' && escaped.length === 0 && back.expanded === 'settings-panel' && (opener === 'header' ? back.inHeader : back.inHero) && back.inertLeft === 0 && !afterBackdrop.open && afterBackdrop.focusOpener && afterBackdrop.inert === 0, { sem, tabs: seq.length, escaped: escaped.slice(0, 3), back, afterBackdrop });
    await c.close();
  }
  // QA-03 regression: wide drawer non-modal
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/'); await waitHero(p);
    await p.locator('header button[aria-controls="settings-panel"]').click(); await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ role: document.getElementById('settings-panel').getAttribute('role'), inert: document.querySelectorAll('[inert]').length, open: !document.getElementById('settings-panel').hidden }));
    await p.mouse.click(300, 600); await p.waitForTimeout(200);
    const still = await p.evaluate(() => !document.getElementById('settings-panel').hidden);
    await p.screenshot({ path: `${dir}/qa03-wide-drawer-1280.png` });
    rec(F, 'QA-03 wide drawer stays non-modal (regression)', s.open && s.inert === 0 && s.role === null && still, { ...s, stillOpenAfterBgClick: still });
    // theme toggle works
    const t0 = await p.evaluate(() => document.documentElement.dataset.theme);
    await p.locator('[data-theme-toggle]').first().click();
    const t1 = await p.evaluate(() => document.documentElement.dataset.theme);
    rec(F, 'theme toggle switches theme (regression)', t0 !== t1, { t0, t1 });
    await c.close();
  }
  // QA-11: D01 repro at 1024/1280/1440
  for (const w of [1024, 1280, 1440]) {
    const c = await ctx({ viewport: { width: w, height: 800 } }); const p = await c.newPage();
    await p.goto(B + '/'); await waitHero(p);
    await p.locator('header a[href$="#research"]').first().focus(); await p.keyboard.press('Enter');
    await p.waitForTimeout(1200);
    await p.keyboard.press('Tab'); const art = await activeInfo(p);
    await Promise.all([p.waitForNavigation(), p.keyboard.press('Enter')]);
    await p.waitForTimeout(500);
    const articleUrl = p.url();
    await p.goBack(); await p.waitForTimeout(1200);
    const afterBack1 = await activeInfo(p); const url1 = p.url();
    await p.goBack(); await p.waitForTimeout(1200);
    const afterBack2 = await activeInfo(p); const url2 = p.url();
    await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    const afterTab = await activeInfo(p);
    if (w === 1280) await p.screenshot({ path: `${dir}/qa11-after-back-tab-1280.png` });
    const focusVisibleOrBody = afterBack2.tag === 'BODY' || (afterBack2.top !== null && afterBack2.bottom > 0 && afterBack2.top < afterBack2.vh);
    rec(F, `QA-11 history focus ${w}`, url2.endsWith('/') && afterBack2.scrollY === 0 && focusVisibleOrBody && afterTab.scrollY < 300, { art, articleUrl, url1, afterBack1, url2, afterBack2, afterTab });
    await c.close();
  }
  // QA-16 shell no-JS + JS no flash
  {
    const c = await ctx({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } }); const p = await c.newPage();
    const tabbed = {};
    for (const path of ['/', '/garden/', '/rising-water/', '/cv/']) {
      await p.goto(B + path);
      const st = await p.evaluate(() => [...document.querySelectorAll('[data-theme-toggle], button[aria-controls="settings-panel"]')].map((b) => ({ label: b.getAttribute('aria-label'), disabled: b.disabled, opacity: getComputedStyle(b).opacity })));
      const seq = []; for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName}${a.disabled ? '[disabled]' : ''}:${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30)}` : null; })); }
      const deadButtons = seq.filter((s) => s?.startsWith('BUTTON') || s?.startsWith('SELECT'));
      tabbed[path] = { st, deadButtons };
      if (path === '/') await p.screenshot({ path: `${dir}/qa16-nojs-home-1280.png` });
    }
    const ok = Object.values(tabbed).every((t) => t.st.every((b) => b.disabled && Number(b.opacity) < 1) && t.deadButtons.length === 0);
    rec(F, 'QA-16 shell no-JS: theme/gear disabled+dimmed, no dead buttons in first 25 Tabs', ok, tabbed);
    await c.close();
    const c2 = await ctx(); const p2 = await c2.newPage();
    await p2.addInitScript(() => { window.__dim = []; new MutationObserver(() => {}).observe(document, { childList: true, subtree: true }); const tick = () => { for (const b of document.querySelectorAll('.icon-btn, .hero__btn')) { const o = getComputedStyle(b).opacity; if (o !== '1') window.__dim.push(`${b.className}:${o}`); } if (performance.now() < 3000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await p2.goto(B + '/'); await waitHero(p2); await p2.waitForTimeout(800);
    const dim = await p2.evaluate(() => [...new Set(window.__dim)]);
    const en = await p2.evaluate(() => [...document.querySelectorAll('[data-theme-toggle], button[aria-controls="settings-panel"], [data-hero-play], [data-hero-new], #hero-mode')].map((b) => b.disabled));
    rec(F, 'QA-16 JS on: controls enabled, never dimmed during load', dim.length === 0 && en.every((d) => d === false), { dim, disabled: en });
    await c2.close();
  }
  // QA-17 garden
  {
    const c = await ctx({ viewport: { width: 375, height: 812 } }); const p = await c.newPage();
    const g = {};
    for (const t of ['preprint', 'software', 'dataset']) {
      await p.goto(`${B}/garden/?type=${t}&tag=water-quality`); await p.waitForTimeout(300);
      g[t] = await p.evaluate(() => ({ current: [...document.querySelectorAll('[aria-current="true"]')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()), status: document.querySelector('[data-garden-status]')?.textContent.trim(), empty: document.querySelector('[data-garden-empty]')?.hidden === false ? document.querySelector('[data-garden-empty]').textContent.trim().replace(/\s+/g, ' ') : null, clear: [...document.querySelectorAll('[data-garden-clear]')].filter((e) => e.offsetParent).map((e) => e.textContent.trim() + ' ' + e.getAttribute('href')), url: location.search }));
      if (t === 'preprint') await p.screenshot({ path: `${dir}/qa17-garden-preprint-375.png`, fullPage: false });
    }
    await p.goto(`${B}/garden/?type=preprint`);
    const clearLink = p.locator('[data-garden-clear]:visible').first();
    await clearLink.click(); await p.waitForTimeout(300);
    const afterClear = await p.evaluate(() => ({ url: location.search, status: document.querySelector('[data-garden-status]')?.textContent.trim(), focus: document.activeElement?.textContent.trim() }));
    await p.goto(`${B}/garden/?type=bogus&x=1`); await p.waitForTimeout(300);
    const bogus = await p.evaluate(() => location.search);
    const ok = Object.values(g).every((v) => v.current.length >= 1 && v.clear.length >= 1 && /0 of/.test(v.status ?? '')) && /9 of 9|Showing 9/.test(afterClear.status ?? '') || false;
    rec(F, 'QA-17 unlisted type deep links show active chip + clear', Object.values(g).every((v) => v.current.length >= 1 && v.clear.length >= 1), { g, afterClear, bogus });
    await c.close();
  }
}

if (group === 'f26' || group === 'all') {
  const F = 'F26'; const dir = out(F);
  // QA-04 reduced motion mid-play
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/'); await waitHero(p);
    await p.waitForFunction(() => document.querySelector('[data-hero]').dataset.running === 'true');
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(300);
    const h0 = await canvasHash(p); const s0 = await heroSt(p); await p.waitForTimeout(1100); const h1 = await canvasHash(p); const s1 = await heroSt(p);
    await p.locator('.hero__bar [data-hero-play]').click(); await p.waitForTimeout(700);
    const s2 = await heroSt(p);
    // and for collatz
    await p.selectOption('#hero-mode', 'collatz'); await p.waitForTimeout(800);
    const sc = await heroSt(p);
    await p.emulateMedia({ reducedMotion: 'no-preference' }); await p.locator('.hero__bar [data-hero-play]').click(); await p.waitForTimeout(300);
    const scPlaying = await heroSt(p);
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(400);
    const sc2 = await heroSt(p); const hc0 = await canvasHash(p); await p.waitForTimeout(800); const hc1 = await canvasHash(p);
    rec(F, 'QA-04 reduced motion mid-play pauses (rising, collatz); Play still works', h0 === h1 && s1.label === 'Play' && s1.playing === false && s2.playing === true && scPlaying.playing === true && sc2.playing === false && hc0 === hc1, { s0: s0.label, s1: { label: s1.label, playing: s1.playing }, sameCanvas: h0 === h1, afterPlay: s2.playing, collatzAfterSwitchInReduce: sc.playing, collatzPlay: scPlaying.playing, collatzAfterReduce: sc2.playing, collatzCanvasStill: hc0 === hc1 });
    await c.close();
  }
  // QA-05 manual pause survives mode switches
  {
    const c = await ctx({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await p.goto(B + '/'); await waitHero(p);
    await p.waitForFunction(() => document.querySelector('[data-hero]').dataset.running === 'true');
    await p.locator('.hero__bar [data-hero-play]').click(); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('[data-hero]').__hero.scrubTo(0.27));
    const before = await heroSt(p);
    const chain = [];
    for (const m of ['dye', 'pond', 'rivers', 'collatz', 'rising']) { await p.selectOption('#hero-mode', m); await p.waitForTimeout(900); const s = await heroSt(p); chain.push({ m, label: s.label, playing: s.playing, progress: s.progress }); }
    const ok = chain.every((s) => s.playing === false && s.label === 'Play') && Math.abs(chain.at(-1).progress - 0.27) < 1e-6;
    rec(F, 'QA-05 manual pause + held level survive switches', ok, { before: before.progress, chain });
    // Play then switch -> autoplays
    await p.locator('.hero__bar [data-hero-play]').click(); await p.selectOption('#hero-mode', 'dye'); await p.waitForTimeout(900);
    const ap = await heroSt(p);
    rec(F, 'QA-05 after Play, the next mode autoplays (regression)', ap.playing === true, { ap: ap.playing });
    await c.close();
  }
  // QA-15 URL sync
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/?x=1&mode=collatz&seed=123456#hero-title'); await waitHero(p); await p.waitForTimeout(400);
    const hl0 = await p.evaluate(() => history.length);
    await p.selectOption('#hero-mode', 'dye'); await p.waitForTimeout(800); const u1 = p.url();
    await p.locator('.hero__bar [data-hero-new]').click(); await p.waitForTimeout(400); const u2 = p.url();
    await p.selectOption('#hero-mode', 'rising'); await p.waitForTimeout(800); const u3 = p.url();
    const hl1 = await p.evaluate(() => history.length);
    const seed3 = await p.evaluate(() => document.querySelector('[data-hero]').__art.settings.seed);
    const p2 = await c.newPage(); await p2.goto(u3); await waitHero(p2); const seedRe = await p2.evaluate(() => document.querySelector('[data-hero]').__art.settings.seed);
    rec(F, 'QA-15 address bar follows mode/seed with replaceState', /mode=dye/.test(u1) && /seed=123456/.test(u1) && /x=1/.test(u1) && u1.endsWith('#hero-title') && !/seed=123456/.test(u2) && !/mode=/.test(u3) && hl0 === hl1 && seed3 === seedRe, { u1, u2, u3, hl0, hl1, seed3, seedRe });
    await c.close();
  }
  // QA-09 live summary milestones + selection
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/?seed=305613'); await waitHero(p);
    await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; h.update({ loop: false, speed: 3 }); h.setPlaying(false); h.scrubTo(0); h.setPlaying(true); });
    const seen = new Set(); const t0 = Date.now();
    while (Date.now() - t0 < 12000) { const s = await heroSt(p); seen.add(s.summary); if (s.playing === false && s.progress >= 1) break; await p.waitForTimeout(250); }
    const fin = await heroSt(p);
    await p.locator('[data-hero]').focus(); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(600);
    const sel = (await heroSt(p)).summary;
    rec(F, 'QA-09 live summary updates at milestones and announces selection', seen.size >= 3 && /Selected/i.test(sel ?? ''), { distinctSummaries: seen.size, sample: [...seen].slice(0, 4).map((s) => s?.slice(0, 90)), final: fin.summary?.slice(0, 90), selection: sel?.slice(0, 140) });
    await c.close();
  }
  // QA-14 blank chart space
  {
    const c = await ctx({ viewport: { width: 1200, height: 1000 } }); const p = await c.newPage(); await p.goto(B + '/?seed=123456'); await waitHero(p);
    await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; h.setPlaying(false); h.update({ maxBars: 32, view: 'barcode' }); h.scrubTo(1); });
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; const strip = document.querySelector('[data-hero-strip]').getBoundingClientRect(); const rects = h.drawnRows.map((_, k) => h.barRect(k)); let best = -1, bw = Infinity; rects.forEach((r, k) => { if (r && r.w < bw && r.x + r.w + 80 < strip.width) { bw = r.w; best = k; } }); return { strip: { x: strip.x, y: strip.y, w: strip.width }, k: best, r: rects[best], n: rects.length }; });
    const y = info.strip.y + info.r.y + info.r.h / 2;
    await p.mouse.move(info.strip.x + info.r.x + info.r.w / 2, y); await p.waitForTimeout(150);
    const onBar = await p.evaluate(() => document.querySelector('[data-hero]').__hero.highlightedRow);
    await p.mouse.move(info.strip.x + info.r.x + info.r.w + 60, y); await p.waitForTimeout(150);
    const blank = await p.evaluate(() => document.querySelector('[data-hero]').__hero.highlightedRow);
    await p.mouse.move(info.strip.x + info.r.x + info.r.w + 4, y); await p.waitForTimeout(150);
    const near = await p.evaluate(() => document.querySelector('[data-hero]').__hero.highlightedRow);
    await p.screenshot({ path: `${dir}/qa14-blank-hover-1200.png` });
    rec(F, 'QA-14 hover blank row space does not select a distant bar', onBar === info.k && blank === -1 && near === info.k, { info, onBar, blank, near });
    await c.close();
  }
  // QA-13 selector at 320
  {
    const r = {};
    for (const w of [320, 375, 768, 1280]) {
      const c = await ctx({ viewport: { width: w, height: 700 }, hasTouch: w < 400, isMobile: w < 400 }); const p = await c.newPage(); await p.goto(B + '/'); await waitHero(p);
      r[w] = await p.evaluate(() => { const s = document.getElementById('hero-mode'); const cs = getComputedStyle(s); const cv = document.createElement('canvas').getContext('2d'); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const text = cv.measureText(s.selectedOptions[0].text).width; const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); const set = document.querySelector('.hero__toolbar button[aria-controls="settings-panel"]').getBoundingClientRect(); return { selectW: Math.round(s.getBoundingClientRect().width), textW: Math.round(text), pad: Math.round(pad), fits: s.getBoundingClientRect().width - pad - 20 >= text, overflowX: document.documentElement.scrollWidth > innerWidth, sameRowAsSettings: Math.abs(set.top - s.getBoundingClientRect().top) < 12 }; });
      if (w === 320) { await p.locator('.hero__toolbar').screenshot({ path: `${dir}/qa13-toolbar-320.png` }); }
      await c.close();
    }
    rec(F, 'QA-13 closed selector fits "Rising water" at 320–1280', Object.values(r).every((v) => v.fits && !v.overflowX), r);
  }
  // QA-16 hero no-JS
  {
    const c = await ctx({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await p.goto(B + '/');
    const st = await p.evaluate(() => ({ play: document.querySelector('.hero__bar [data-hero-play]')?.disabled, nw: document.querySelector('.hero__bar [data-hero-new]')?.disabled, sel: document.getElementById('hero-mode').disabled, heroTab: document.querySelector('[data-hero]').getAttribute('tabindex'), readout: document.querySelector('[data-hero-readout]').textContent.trim(), playOpacity: getComputedStyle(document.querySelector('.hero__bar [data-hero-play]')).opacity }));
    const seq = []; for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => !!document.activeElement?.closest('[data-hero]'))); }
    await p.screenshot({ path: `${dir}/qa16-nojs-hero-390.png` });
    rec(F, 'QA-16 hero no-JS: controls disabled, hero not tabbable', st.play && st.nw && st.sel && st.heroTab === null && !seq.some(Boolean), { ...st, tabLandedInHero: seq.filter(Boolean).length });
    await c.close();
  }
}

if (group === 'f27' || group === 'all') {
  const F = 'F27'; const dir = out(F);
  const ready = (p) => p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 25000 });
  // QA-06
  {
    const c = await ctx({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await p.goto(B + '/rising-water/'); await ready(p);
    await p.getByRole('button', { name: 'Show lake 5 on the map', exact: true }).focus(); await p.waitForTimeout(1500);
    const btnLabel = await p.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent);
    await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
    const a = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); return { stage: e.matches('[data-ex-stage]'), top: Math.round(r.top), vh: innerHeight, outline: getComputedStyle(e).outlineStyle, desc: e.getAttribute('aria-describedby'), card: document.getElementById('ex-card-title').textContent.trim() }; });
    await p.screenshot({ path: `${dir}/qa06-show-focus-390.png` });
    await p.keyboard.press('Tab'); const next = await p.evaluate(() => { const e = document.activeElement; return { text: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 30), top: Math.round(e.getBoundingClientRect().top) }; });
    rec(F, 'QA-06 Show moves focus to the map; next Tab continues forward', a.stage && a.top < a.vh && a.outline !== 'none' && !/Show lake 6/.test(next.text), { btnLabel, a, next });
    await c.close();
  }
  // QA-07 touch tap persistence
  {
    const c = await ctx({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await c.newPage(); await p.goto(B + '/rising-water/'); await ready(p);
    const stage = p.locator('[data-ex-stage]'); await stage.scrollIntoViewIfNeeded(); const bb = await stage.boundingBox();
    await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(900);
    const r1 = await p.locator('[data-ex-hover]').textContent();
    await p.screenshot({ path: `${dir}/qa07-tap-persist-390.png` });
    await p.touchscreen.tap(bb.x + bb.width * 0.3, bb.y + bb.height * 0.3); await p.waitForTimeout(900);
    const r2 = await p.locator('[data-ex-hover]').textContent();
    rec(F, 'QA-07 tapped cell reading persists after release; second tap replaces', /m \(/.test(r1) && /m \(/.test(r2) && r1 !== r2, { r1: r1.trim().slice(0, 100), r2: r2.trim().slice(0, 100) });
    await c.close();
  }
  // QA-08 keyboard cell cursor
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/rising-water/'); await ready(p);
    await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false)); await p.locator('[data-ex-stage]').focus(); const lvl0 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
    await p.keyboard.press('Enter'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Shift+ArrowDown'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => ({ hover: document.querySelector('[data-ex-hover]').textContent.trim(), live: document.querySelector('[data-ex-cell-live]').textContent.trim() }));
    const lvl1 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
    await p.screenshot({ path: `${dir}/qa08-cursor-1280.png` });
    await p.keyboard.press('Escape'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
    const lvl2 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
    rec(F, 'QA-08 keyboard cursor gives cell elevation/coords in a live region', /Cursor at column/.test(r.live) && /° N/.test(r.live) && lvl0 === lvl1 && lvl2 !== lvl1, { r: { hover: r.hover.slice(0, 120), live: r.live.slice(0, 160) }, lvl0, lvl1, lvl2 });
    await c.close();
  }
  // QA-10 no-JS
  {
    const c = await ctx({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }); const p = await c.newPage(); await p.goto(B + '/rising-water/');
    const s = await p.evaluate(() => { const vis = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; }; return { noscriptVisible: vis('.ex-noscript'), loadingVisible: vis('[data-ex-status]'), controls: vis('.ex-controls'), stageTab: document.querySelector('[data-ex-stage]').getAttribute('tabindex'), rows: document.querySelectorAll('#lakes tbody tr, [id="lakes"] ~ * tbody tr').length }; });
    await p.locator('.ex-noscript').scrollIntoViewIfNeeded().catch(() => {});
    await p.screenshot({ path: `${dir}/qa10-nojs-390.png` });
    rec(F, 'QA-10 no-JS explorer shows a fallback, no endless loading', s.noscriptVisible && !s.loadingVisible && !s.controls && s.stageTab === null, s);
    await c.close();
  }
  // regression: explorer label + play
  {
    const c = await ctx(); const p = await c.newPage(); await p.goto(B + '/rising-water/'); await ready(p);
    await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false)); const l0 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
    await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false)); await p.locator('[data-ex-play]').click(); await p.waitForTimeout(1200);
    const l1 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.level);
    const labels = await p.evaluate(() => document.querySelectorAll('.ex-map [class*="label"], .ex-map text, .ex-map li').length);
    rec(F, 'explorer Play advances level; place labels present (regression)', l1 !== l0 && labels > 0, { l0, l1, labels });
    await c.close();
  }
}
writeFileSync(`docs/checks/F24/attempt-1/probes-${group}.json`, JSON.stringify({ results, errors }, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
