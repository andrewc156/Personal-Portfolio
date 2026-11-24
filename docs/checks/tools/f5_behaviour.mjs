// F5 checker: behaviour probe (keyboard scoping, loop hold, pausing, DPR cap, summary cadence,
// reduced motion, CLS incl. theme toggle, hover readouts). Needs preview on 4321.
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const b = await chromium.launch();
const errors = [];
const log = (...a) => console.log(...a);
const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
async function open(opts = {}, url = '/?seed=42') {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput) {
          window.__cls += e.value;
          window.__shifts.push([Math.round(e.startTime), e.value]);
        }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await p.goto(B + url);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  return { ctx, p };
}
const H = (p, fn, arg) => p.evaluate(fn, arg);
const st = (p) =>
  H(p, () => {
    const r = document.querySelector('[data-hero]');
    const h = r.__hero;
    return { state: r.dataset.state, running: r.dataset.running, seed: r.dataset.seed, progress: h.progress, frames: h.frames, scrollY: scrollY };
  });

// 1. First paint timing relative to hydration (script start) — non-blank
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    // record when the hero controller first exists and when canvas first has variance
    const t0 = performance.now();
    const check = () => {
      const r = document.querySelector('[data-hero]');
      if (r && r.__hero && !window.__hydr) window.__hydr = performance.now();
      if (window.__hydr && !window.__paint) {
        const c = r.querySelector('[data-hero-map]');
        const x = document.createElement('canvas');
        x.width = 64;
        x.height = 32;
        const g = x.getContext('2d');
        g.drawImage(c, 0, 0, 64, 32);
        const d = g.getImageData(0, 0, 64, 32).data;
        let m = 0, m2 = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; m += v; m2 += v * v; n++; }
        const varr = m2 / n - (m / n) ** 2;
        if (varr > 50) { window.__paint = performance.now(); window.__var = varr; }
      }
      if (!window.__paint) setTimeout(check, 0);
    };
    void t0;
    setTimeout(check, 0);
  });
  await p.goto(B + '/?seed=42');
  await p.waitForFunction(() => !!window.__paint, null, { timeout: 5000 });
  log('1 hydration→non-blank:', await H(p, () => ({ hydr: Math.round(window.__hydr), paint: Math.round(window.__paint), dt: +(window.__paint - window.__hydr).toFixed(1), variance: Math.round(window.__var) })));
  await ctx.close();
}

// 2. Keyboard scoping
{
  const { ctx, p } = await open();
  await H(p, () => (document.documentElement.style.scrollBehavior = 'auto'));
  const s0 = await st(p);
  // body focus: Space should scroll page, not toggle
  await H(p, () => document.activeElement.blur());
  await p.keyboard.press('Space');
  await p.waitForTimeout(300);
  const s1 = await st(p);
  log('2a Space with body focus: state', s0.state, '→', s1.state, 'scrollY', s0.scrollY, '→', s1.scrollY);
  await H(p, () => scrollTo(0, 0));
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(300);
  log('2b ArrowDown with body focus: scrollY', (await st(p)).scrollY, 'progress unchanged?', (await st(p)).state);
  await H(p, () => scrollTo(0, 0));
  await p.keyboard.press('n');
  await p.waitForTimeout(100);
  log('2c "n" with body focus: seed', (await st(p)).seed, '(was 42)');
  // focus hero: Space toggles, no scroll
  await p.focus('[data-hero]');
  const y0 = (await st(p)).scrollY;
  const before = (await st(p)).state;
  await p.keyboard.press('Space');
  await p.waitForTimeout(200);
  let s = await st(p);
  log('2d Space on hero:', before, '→', s.state, 'scrollY', y0, '→', s.scrollY);
  await p.keyboard.press('End');
  await p.waitForTimeout(100);
  const pEnd = (await st(p)).progress;
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('Shift+ArrowLeft');
  await p.waitForTimeout(100);
  s = await st(p);
  log('2e End then ←,←,Shift+←: progress', pEnd, '→', s.progress.toFixed(4), '(expect 0.86), state', s.state, 'scrollY', s.scrollY);
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(100);
  log('2f →: progress', (await st(p)).progress.toFixed(4));
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(100);
  log('2g ↓ on hero highlights:', await H(p, () => ({ hl: document.querySelector('[data-hero]').__hero.highlight, readout: document.querySelector('[data-hero-readout]').textContent })), 'scrollY', (await st(p)).scrollY);
  await p.keyboard.press('Escape');
  await p.keyboard.press('n');
  await p.waitForTimeout(100);
  log('2h N on hero: seed', (await st(p)).seed);
  // seed input inside the panel: typing n / space must not act
  await p.getByRole('button', { name: 'Art settings', exact: true }).click();
  await p.waitForTimeout(400);
  const seedBefore = (await st(p)).seed;
  const stateBefore = (await st(p)).state;
  await p.focus('#hero-seed');
  await p.keyboard.type('n 5');
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(100);
  s = await st(p);
  log('2i typing "n 5" + ← in seed input: seed', seedBefore, '→', s.seed, 'state', stateBefore, '→', s.state, 'input value', await p.inputValue('#hero-seed'));
  // Space on a focused button elsewhere (Close settings) still works
  await p.focus('[data-settings-close]');
  await p.keyboard.press('Space');
  await p.waitForTimeout(400);
  log('2j Space on focused Close button: panel hidden =', await H(p, () => document.getElementById('settings-panel').hidden));
  await p.focus('[data-theme-toggle]');
  await p.keyboard.press('Space');
  await p.waitForTimeout(200);
  log('2k Space on theme toggle: data-theme =', await H(p, () => document.documentElement.dataset.theme), 'hero state', (await st(p)).state);
  // Space on the hero's own Play button (a button inside the hero root): toggles exactly once
  const pb = (await st(p)).state;
  await p.focus('.hero__bar [data-hero-play]');
  await p.keyboard.press('Space');
  await p.waitForTimeout(200);
  log('2l Space on focused hero Play button:', pb, '→', (await st(p)).state);
  await ctx.close();
}

// 3. Backward scrub: level slider down
{
  const { ctx, p } = await open();
  await p.getByRole('button', { name: 'Art settings', exact: true }).click();
  await p.waitForTimeout(400);
  const lv = p.locator('#hero-level');
  await lv.fill('80');
  await p.waitForTimeout(100);
  const a = await H(p, () => { const h = document.querySelector('[data-hero]').__hero; return { prog: h.progress, alive: h.t.flood.alive(), level: h.level(), state: h.playing }; });
  await lv.focus();
  for (let i = 0; i < 40; i++) await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(150);
  const c = await H(p, async () => { const h = document.querySelector('[data-hero]').__hero; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return { prog: h.progress, alive: h.t.flood.alive(), level: h.level(), wet: h.t.flood.wetCount, summary: document.querySelector('[data-hero-summary]').textContent }; });
  log('3 slider 80 % →', a, '; 40×← →', c);
  await ctx.close();
}

// 4. Loop hold ≈ 2.5 s then new seed
{
  const { ctx, p } = await open();
  const r = await H(p, async () => {
    const h = document.querySelector('[data-hero]').__hero;
    const root = document.querySelector('[data-hero]');
    h.scrubTo(0.97);
    h.update({ speed: 1 });
    h.setPlaying(true);
    let top = 0, newSeed = 0, seed0 = root.dataset.seed, progAfter = -1;
    await new Promise((res) => {
      const f = () => {
        if (!top && h.progress >= 1) top = performance.now();
        if (top && root.dataset.seed !== seed0) { newSeed = performance.now(); progAfter = h.progress; return res(); }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
      setTimeout(res, 8000);
    });
    return { holdMs: Math.round(newSeed - top), seed0, seed1: root.dataset.seed, progAfter, playing: h.playing };
  });
  log('4 loop:', r);
  // loop off: stops at top
  const r2 = await H(p, async () => {
    const h = document.querySelector('[data-hero]').__hero;
    h.update({ loop: false });
    h.scrubTo(0.98);
    h.setPlaying(true);
    await new Promise((res) => setTimeout(res, 4000));
    return { progress: h.progress, playing: h.playing, state: document.querySelector('[data-hero]').dataset.state };
  });
  log('4b loop off after 4 s:', r2);
  await ctx.close();
}

// 5. Off-screen & hidden tab (true background via a second page brought to front)
{
  const { ctx, p } = await open();
  await H(p, () => (document.documentElement.style.scrollBehavior = 'auto'));
  await p.waitForTimeout(300);
  const a = await st(p);
  await H(p, () => scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(400);
  const f0 = (await st(p)).frames;
  await p.waitForTimeout(800);
  const bb = await st(p);
  log('5a off-screen: running', a.running, '→', bb.running, 'frames during 0.8 s:', bb.frames - f0, 'progress', bb.progress.toFixed(3));
  await H(p, () => scrollTo(0, 0));
  await p.waitForTimeout(400);
  log('5b back on screen: running', (await st(p)).running);
  // hidden tab: CDP emulation of page visibility via a second tab
  const p2 = await ctx.newPage();
  await p2.goto(B + '/garden/');
  await p2.bringToFront();
  await p.waitForTimeout(500);
  const vis = await H(p, () => document.visibilityState);
  const g0 = (await st(p)).frames;
  await p.waitForTimeout(800);
  const g1 = await st(p);
  log('5c other tab in front: visibilityState', vis, 'running', g1.running, 'frames in 0.8 s', g1.frames - g0);
  // CDP: emulate hidden via Page lifecycle? Use Emulation.setFocusEmulationEnabled false + dispatch
  const cdp = await ctx.newCDPSession(p);
  try {
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await new Promise((r) => setTimeout(r, 300));
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  } catch (e) { log('lifecycle err', e.message); }
  // fallback emulation identical in spirit to a real hide: override visibilityState and fire the event
  await p.bringToFront();
  await H(p, () => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(200);
  const h0 = (await st(p)).frames;
  await p.waitForTimeout(800);
  const h1 = await st(p);
  log('5d emulated hidden: running', h1.running, 'frames in 0.8 s', h1.frames - h0);
  await H(p, () => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(300);
  log('5e visible again: running', (await st(p)).running);
  await ctx.close();
}

// 6. DPR 3 → capped at 2
{
  const { ctx, p } = await open({ deviceScaleFactor: 3 });
  log('6 DPR 3:', await H(p, () => { const c = document.querySelector('[data-hero-map]'); const s = document.querySelector('[data-hero-strip]'); const r = c.getBoundingClientRect(); const q = s.getBoundingClientRect(); return { dpr: devicePixelRatio, map: [c.width, c.height, r.width, r.height, +(c.width / r.width).toFixed(3)], strip: [s.width, s.height, +(s.width / q.width).toFixed(3)] }; }));
  await ctx.close();
}

// 7. Summary cadence
{
  const { ctx, p } = await open();
  const r = await H(p, async () => {
    const el = document.querySelector('[data-hero-summary]');
    const h = document.querySelector('[data-hero]').__hero;
    let n = 0;
    const mo = new MutationObserver(() => n++);
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    const f0 = h.frames;
    await new Promise((res) => setTimeout(res, 2000));
    const playN = n, framesPlay = h.frames - f0;
    h.setPlaying(false);
    await new Promise((res) => setTimeout(res, 100));
    const afterPause = n, txtPause = el.textContent;
    h.scrubTo(0.3);
    await new Promise((res) => setTimeout(res, 50));
    const mid = n;
    await new Promise((res) => setTimeout(res, 400));
    const afterScrub = n;
    return { playChanges2s: playN, framesPlay, afterPause, txtPause, scrubImmediate: mid, afterScrub, txt: el.textContent, live: el.getAttribute('aria-live') };
  });
  log('7 summary:', r);
  log('7b aria:', await H(p, () => { const m = document.querySelector('[data-hero-map]'); const s = document.querySelector('[data-hero-strip]'); return { mapRole: m.getAttribute('role'), mapLabel: m.getAttribute('aria-label'), stripRole: s.getAttribute('role'), stripLabel: s.getAttribute('aria-label') }; }));
  await ctx.close();
}

// 8. Reduced motion
{
  const { ctx, p } = await open({ reducedMotion: 'reduce' });
  const a = await st(p);
  await p.waitForTimeout(1500);
  const c = await st(p);
  log('8 reduced motion:', a, '→ after 1.5 s', c, 'buttons', await p.locator('.hero__bar [data-hero-play]').textContent(), 'level', await H(p, () => { const h = document.querySelector('[data-hero]').__hero; return [h.level().toFixed(1), h.t.minH.toFixed(1), h.t.maxH.toFixed(1)]; }));
  await p.locator('.hero__bar [data-hero-play]').click();
  await p.waitForTimeout(500);
  log('8b after clicking Play:', await st(p));
  await ctx.close();
}

// 9. CLS through load, hydration, play, theme toggle (light→dark→light), settings open/close; at 375 and 1280
for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  const { ctx, p } = await open({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await p.waitForTimeout(1500);
  const c1 = await H(p, () => window.__cls);
  await p.click('[data-theme-toggle]');
  await p.waitForTimeout(600);
  await p.click('[data-theme-toggle]');
  await p.waitForTimeout(600);
  const c2 = await H(p, () => window.__cls);
  log(`9 CLS @${vp.width}: after load+hydration ${c1.toFixed(5)}, after 2 theme toggles ${c2.toFixed(5)}`, await H(p, () => window.__shifts));
  await ctx.close();
}

// 10. Map hover + touch tap on bar
{
  const { ctx, p } = await open();
  await H(p, () => document.querySelector('[data-hero]').__hero.scrubTo(0.5));
  const box = await p.locator('[data-hero-map]').boundingBox();
  // find a wet cell
  const cell = await H(p, () => { const h = document.querySelector('[data-hero]').__hero; const t = h.t; for (let i = 0; i < t.W * t.H; i++) if (t.flood.componentOf(i) >= 0 && t.lakes.labelOf[t.flood.componentOf(i)] > 0) return { x: i % t.W, y: Math.floor(i / t.W), W: t.W, H: t.H, h: t.heights[i], lab: t.lakes.labelOf[t.flood.componentOf(i)] }; });
  await p.mouse.move(box.x + ((cell.x + 0.5) / cell.W) * box.width, box.y + ((cell.y + 0.5) / cell.H) * box.height);
  await p.waitForTimeout(100);
  log('10a map hover wet cell', cell, '→ readout', await p.locator('[data-hero-readout]').textContent());
  await p.mouse.move(box.x + 2, box.y + 2);
  log('10b map hover corner → readout', await p.locator('[data-hero-readout]').textContent());
  await ctx.close();
  const t = await open({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
  await H(t.p, () => document.querySelector('[data-hero]').__hero.scrubTo(0.6));
  await t.p.waitForTimeout(100);
  const sb = await t.p.locator('[data-hero-strip]').boundingBox();
  await t.p.touchscreen.tap(sb.x + sb.width * 0.3, sb.y + 10);
  await t.p.waitForTimeout(150);
  log('10c touch tap on top bar → readout', await t.p.locator('[data-hero-readout]').textContent());
  await t.p.locator('.hero__bar [data-hero-play]').tap();
  await t.p.waitForTimeout(150);
  log('10d touch tap Play →', (await st(t.p)).state);
  await t.ctx.close();
}

await b.close();
log('console errors:', errors.length ? errors : 'none');
