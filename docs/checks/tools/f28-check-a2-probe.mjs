// F28b attempt-2 copy of f28-check-probe.mjs (output dir changed to attempt-2/probe).
// Usage: node docs/checks/tools/f28-check-probe.mjs <chromium|webkit> <label> [sections]
// Needs a production preview on 4321 (f28-check-run.sh). Writes JSON + PNG strips into
// docs/checks/F28b/attempt-2/probe/.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const ENGINE = process.argv[2] ?? 'chromium';
const LABEL = process.argv[3] ?? 'cur';
const ONLY = (process.argv[4] ?? 'all').split(',');
const want = (s) => ONLY.includes('all') || ONLY.includes(s);
const BASE = 'http://localhost:4321';
const OUT = path.resolve('docs/checks/F28b/attempt-2/probe');
fs.mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => {
  R[k] = v;
  console.log(k, JSON.stringify(v));
};
const browserType = ENGINE === 'webkit' ? webkit : chromium;
const browser = await browserType.launch();
const touchCtx = (w, h, extra = {}) =>
  browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: ENGINE !== 'webkit' || true, ...extra });
const mouseCtx = (w, h, extra = {}) => browser.newContext({ viewport: { width: w, height: h }, ...extra });

async function ready(page, url = '/') {
  await page.goto(BASE + url);
  await page.waitForFunction(() => {
    const g = document.querySelector('[data-settings-toggle]');
    return !g || !g.disabled;
  });
}

async function compose(name, shots) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  const p = await ctx.newPage();
  const maxw = shots.length > 4 ? 260 : 400;
  await p.setContent(
    `<body style="margin:0;background:#777;font:13px sans-serif;display:flex;gap:6px;padding:6px;align-items:flex-start">${shots
      .map(
        (s) =>
          `<figure style="margin:0;background:#fff"><figcaption style="padding:2px 4px;background:#000;color:#fff">${s.label}</figcaption><img style="display:block;max-width:${maxw}px" src="data:image/png;base64,${s.b64}"></figure>`,
      )
      .join('')}</body>`,
  );
  await p.waitForLoadState('load');
  const file = path.join(OUT, `${LABEL}-${ENGINE}-${name}.png`);
  await p.screenshot({ path: file, fullPage: true });
  await ctx.close();
  console.log('PNG', file);
}

// ---- helpers evaluated in the page ----
const panelState = () =>
  (() => {
    const p = document.getElementById('settings-panel');
    const cs = getComputedStyle(p);
    const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    return {
      x: m.m41,
      y: m.m42,
      opacity: cs.opacity,
      bg: cs.backgroundColor,
      display: cs.display,
      hidden: p.hidden,
      anims: p.getAnimations().map((a) => ({
        kind: a.constructor.name,
        prop: a.transitionProperty ?? a.animationName,
        dur: a.effect?.getTiming().duration,
        easing: a.effect?.getTiming().easing,
        t: a.currentTime,
      })),
    };
  })();

// 1. Drawer/sheet strips, timings, opacity, interruption.
if (want('drawer')) {
  for (const [w, h, touch] of [
    [1280, 800, false],
    [375, 812, true],
  ]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = touch ? await touchCtx(w, h, { colorScheme: scheme }) : await mouseCtx(w, h, { colorScheme: scheme });
      const page = await ctx.newPage();
      await ready(page);
      const key = `drawer-${w}-${scheme}`;
      // open, paused + seeked
      const open = [];
      const shotsO = [];
      await page.evaluate(() => {
        document.querySelector('[data-settings-toggle]').click();
        document.getAnimations().forEach((a) => a.pause());
      });
      for (const t of [0, 40, 80, 130, 180, 260]) {
        await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
        open.push({ t, ...(await page.evaluate(panelState)) });
        shotsO.push({ label: `open ${t} ms`, b64: (await page.screenshot()).toString('base64') });
      }
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      await page.waitForTimeout(100);
      const close = [];
      const shotsC = [];
      await page.evaluate(() => {
        document.querySelector('[data-settings-toggle]').click();
        document.getAnimations().forEach((a) => a.pause());
      });
      for (const t of [0, 40, 80, 120, 160, 200]) {
        await page.evaluate((t) => document.getAnimations().forEach((a) => (a.currentTime = t)), t);
        close.push({ t, ...(await page.evaluate(panelState)) });
        shotsC.push({ label: `close ${t} ms`, b64: (await page.screenshot()).toString('base64') });
      }
      await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
      await page.waitForTimeout(100);
      const after = await page.evaluate(panelState);
      log(key, {
        open: open.map((s) => ({ t: s.t, x: s.x, y: s.y, op: s.opacity, bg: s.bg, anims: s.anims })),
        close: close.map((s) => ({ t: s.t, x: s.x, y: s.y, op: s.opacity, display: s.display, anims: s.anims })),
        after: { display: after.display, anims: after.anims.length },
      });
      if (scheme === 'light' || w === 375) {
        await compose(`${key}-open`, shotsO);
        await compose(`${key}-close`, shotsC);
      }
      await ctx.close();
    }
    // deterministic interrupts at several points
    {
      const ctx = touch ? await touchCtx(w, h) : await mouseCtx(w, h);
      const page = await ctx.newPage();
      await ready(page);
      const res = await page.evaluate(async (axis) => {
        const p = document.getElementById('settings-panel');
        const g = document.querySelector('[data-settings-toggle]');
        const off = () => {
          const t = getComputedStyle(p).transform;
          const m = new DOMMatrix(t === 'none' ? undefined : t);
          return axis === 'x' ? m.m41 : m.m42;
        };
        const tr = () => p.getAnimations().find((a) => a.transitionProperty === 'transform');
        const settle = async () => {
          for (const a of p.getAnimations()) a.finish();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        };
        const out = [];
        for (const t of [20, 60, 100, 150, 220]) {
          g.click(); // open
          tr().pause();
          tr().currentTime = t;
          const before = off();
          g.click(); // close mid-open
          const afterC = off();
          const a2 = tr();
          a2.pause();
          a2.currentTime = Math.min(t, 150);
          const mid = off();
          g.click(); // reopen mid-close
          const afterR = off();
          out.push({ t, before, afterC, mid, afterR });
          await settle();
          if (!p.hidden) {
            g.click();
            await settle();
          }
        }
        return out;
      }, w > 640 ? 'x' : 'y');
      log(`interrupt-seek-${w}`, res);
      // real-time spam: click every ~70 ms, sample every frame
      const spam = await page.evaluate(async (axis) => {
        const p = document.getElementById('settings-panel');
        const g = document.querySelector('[data-settings-toggle]');
        const off = () => {
          const t = getComputedStyle(p).transform;
          const m = new DOMMatrix(t === 'none' ? undefined : t);
          return axis === 'x' ? m.m41 : m.m42;
        };
        const samples = [];
        let open = false;
        const t0 = performance.now();
        let next = 0;
        while (performance.now() - t0 < 1400) {
          const now = performance.now() - t0;
          let clicked = '';
          if (now >= next && next <= 900) {
            g.click();
            open = !open;
            clicked = open ? 'open' : 'close';
            next += 70 + (samples.length % 3) * 25;
          }
          samples.push({ t: Math.round(now), off: Math.round(off() * 10) / 10, clicked, hidden: p.hidden });
          await new Promise((r) => requestAnimationFrame(r));
        }
        return samples;
      }, w > 640 ? 'x' : 'y');
      // Check: inside each segment, motion is monotonic toward the target; no sample after a click
      // jumps beyond the last pre-click position away from the new target.
      let violations = [];
      for (let i = 1; i < spam.length; i++) {
        const prev = spam[i - 1].off;
        const cur = spam[i].off;
        const target = spam[i].hidden ? 'up' : 'down'; // hidden → offset increasing
        if (target === 'down' && cur > prev + 0.5) violations.push({ i, prev, cur, why: 'moved away while opening' });
        if (target === 'up' && cur < prev - 0.5) violations.push({ i, prev, cur, why: 'moved away while closing' });
      }
      log(`interrupt-spam-${w}`, { n: spam.length, violations, samples: spam });
      await ctx.close();
    }
  }
}

// 2. Exit window: focus, AX tree, axe.
if (want('exit')) {
  for (const [w, h, touch] of [
    [1280, 800, false],
    [375, 812, true],
  ]) {
    const ctx = touch ? await touchCtx(w, h) : await mouseCtx(w, h);
    const page = await ctx.newPage();
    await ready(page);
    const who = () =>
      (() => {
        const a = document.activeElement;
        const p = document.getElementById('settings-panel');
        return {
          tag: a?.tagName,
          label: a?.getAttribute('aria-label') ?? a?.id ?? a?.textContent?.trim().slice(0, 30),
          inPanel: p.contains(a),
          panelHidden: p.hidden,
          panelDisplay: getComputedStyle(p).display,
          panelAnims: p.getAnimations().length,
        };
      })();
    const runs = [];
    for (const how of ['Escape', 'gear-Enter', 'close-button']) {
      await page.focus('[data-settings-toggle]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(450);
      const t0 = Date.now();
      if (how === 'Escape') await page.keyboard.press('Escape');
      else if (how === 'gear-Enter') {
        // gear is reachable on the wide drawer (non-modal); on the sheet, Escape path only
        await page.focus('[data-settings-toggle]').catch(() => {});
        await page.keyboard.press('Enter');
      } else {
        await page.focus('[data-settings-close]');
        await page.keyboard.press('Enter');
      }
      const afterClose = await page.evaluate(who);
      await page.keyboard.press('Tab');
      const dt = Date.now() - t0;
      const afterTab = await page.evaluate(who);
      await page.waitForTimeout(400);
      const later = await page.evaluate(who);
      runs.push({ how, afterClose, msToTab: dt, afterTab, later400ms: later });
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(100);
    }
    log(`exit-focus-${w}`, runs);

    // Freeze the exit at 50 ms and inspect AX tree / axe / aria snapshot.
    await page.focus('[data-settings-toggle]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
    await page.keyboard.press('Escape');
    await page.evaluate(() =>
      document.getElementById('settings-panel').getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 50;
      }),
    );
    const frozen = await page.evaluate(who);
    let ax = null;
    if (ENGINE === 'chromium') {
      const cdp = await ctx.newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      const names = ['Close art settings', 'Art settings', 'Seed', 'New terrain', 'Hero art settings'];
      ax = nodes
        .filter((n) => !n.ignored && names.includes(n.name?.value))
        .map((n) => ({ role: n.role?.value, name: n.name?.value }));
    }
    const aria = await page.locator('body').ariaSnapshot();
    const ariaHasPanel = /Close art settings|Hero art settings/.test(aria);
    let axe = null;
    try {
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      const res = await new AxeBuilder({ page }).analyze();
      axe = res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.target) }));
    } catch (e) {
      axe = String(e);
    }
    // Is the frozen-closing panel's close button focusable (programmatic)?
    const focusable = await page.evaluate(() => {
      const b = document.querySelector('[data-settings-close]');
      b.focus();
      return document.activeElement === b;
    });
    log(`exit-frozen-${w}`, { frozen, axPanelNodes: ax, ariaSnapshotHasPanel: ariaHasPanel, axe, closeBtnFocusable: focusable });
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    // Steady closed state for comparison
    await page.waitForTimeout(300);
    let axClosed = null;
    if (ENGINE === 'chromium') {
      const cdp = await ctx.newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      axClosed = nodes.filter((n) => !n.ignored && ['Close art settings', 'Hero art settings'].includes(n.name?.value)).length;
    }
    log(`exit-closed-${w}`, { axPanelNodesClosed: axClosed });
    await ctx.close();
  }
}

// 3. F25 modal semantics at 375 touch.
if (want('f25')) {
  const ctx = await touchCtx(375, 812);
  const page = await ctx.newPage();
  await ready(page);
  await page.focus('[data-settings-toggle]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => {
    const p = document.getElementById('settings-panel');
    return {
      role: p.getAttribute('role'),
      modal: p.getAttribute('aria-modal'),
      mainInert: document.querySelector('main').inert,
      headerInert: document.querySelector('.site-header').inert,
      focusTitle: document.activeElement?.id,
    };
  });
  const tabs = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    tabs.push(await page.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement)));
  }
  await page.keyboard.press('Shift+Tab');
  const shiftIn = await page.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const esc = await page.evaluate(() => ({
    hidden: document.getElementById('settings-panel').hidden,
    focus: document.activeElement?.getAttribute('aria-label'),
    inert: document.querySelectorAll('[inert]').length,
    modalAttr: document.documentElement.hasAttribute('data-settings-modal'),
  }));
  await page.locator('[data-settings-toggle]').tap();
  await page.waitForTimeout(400);
  await page.touchscreen.tap(187, 120);
  await page.waitForTimeout(400);
  const backdrop = await page.evaluate(() => ({ hidden: document.getElementById('settings-panel').hidden, inert: document.querySelectorAll('[inert]').length }));
  log('f25-375', { ...s, tabAllInside: tabs.every(Boolean), shiftIn, esc, backdrop });
  await ctx.close();
}

// 4. Scrim + CLS.
if (want('scrim')) {
  for (const scheme of ['light', 'dark']) {
    const out = {};
    for (const [w, h] of [
      [375, 812],
      [1280, 800],
    ]) {
      const ctx = w < 640 ? await touchCtx(w, h, { colorScheme: scheme }) : await mouseCtx(w, h, { colorScheme: scheme });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await ready(page);
      await page.waitForTimeout(500);
      const sc = () =>
        page.evaluate(() => {
          const cs = getComputedStyle(document.body, '::after');
          return { op: cs.opacity, bg: cs.backgroundColor, content: cs.content, pe: cs.pointerEvents };
        });
      const cls0 = await page.evaluate(() => window.__cls);
      const before = await sc();
      if (w < 640) await page.locator('[data-settings-toggle]').tap();
      else await page.locator('[data-settings-toggle]').click();
      await page.waitForTimeout(450);
      const open = await sc();
      if (w < 640) {
        await page.screenshot({ path: path.join(OUT, `${LABEL}-${ENGINE}-scrim-${scheme}-375.png`) });
        await page.touchscreen.tap(187, 120);
      } else {
        await page.locator('[data-settings-toggle]').click();
      }
      await page.waitForTimeout(450);
      const closed = await sc();
      const hidden = await page.evaluate(() => document.getElementById('settings-panel').hidden);
      const cls1 = await page.evaluate(() => window.__cls);
      out[w] = { before, open, closed, closedByBackdropOrGear: hidden, clsDuringOpenClose: cls1 - cls0 };
      await ctx.close();
    }
    log(`scrim-${scheme}`, out);
  }
}

// 5. Hover gating: touch taps leave no hover; mouse hover works.
if (want('hover')) {
  const targets = [
    ['/', '.hero__btn[data-hero-new]', 'btn New terrain'],
    ['/', '.hero__btn[data-hero-play]', 'btn Play'],
    ['/', '[data-settings-toggle]', 'icon-btn gear'],
    ['/', '.site-nav a[href="/#mission"]', 'nav link'],
    ['/', '.wordmark', 'wordmark'],
    ['/garden/', 'a.chip:not([aria-current="true"])', 'garden chip'],
    ['/garden/', 'a.work-row__inner', 'work row'],
    ['/', '.research-card__title a', 'research card title'],
  ];
  const props = (sel) =>
    ((sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const cs = getComputedStyle(e);
      const t = e.querySelector('.work-row__title');
      return [cs.backgroundColor, cs.color, cs.borderColor, cs.textDecorationLine, cs.textDecorationThickness, t ? getComputedStyle(t).color : ''].join(' | ');
    })(sel);
  const touch = [];
  for (const [url, sel, name] of targets) {
    const ctx = await touchCtx(375, 812);
    const page = await ctx.newPage();
    await ready(page, url);
    await page.evaluate(() =>
      document.addEventListener('click', (e) => { if (e.target.closest('a[href]')) e.preventDefault(); }, true),
    );
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0 || !(await loc.isVisible())) {
      touch.push({ name, skipped: 'not visible' });
      await ctx.close();
      continue;
    }
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const before = await page.evaluate(props, sel);
    await loc.tap();
    await page.waitForTimeout(350);
    const after = await page.evaluate(props, sel);
    const hoverMatches = await page.evaluate((sel) => document.querySelector(sel).matches(':hover'), sel);
    touch.push({ name, same: before === after, hoverMatches, before, after });
    await ctx.close();
  }
  log('hover-touch-375', touch);
  const mouse = [];
  for (const [url, sel, name] of targets) {
    const ctx = await mouseCtx(1280, 800);
    const page = await ctx.newPage();
    await ready(page, url);
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0 || !(await loc.isVisible())) {
      mouse.push({ name, skipped: 'not visible' });
      await ctx.close();
      continue;
    }
    await loc.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 790);
    await page.waitForTimeout(250);
    const before = await page.evaluate(props, sel);
    await loc.hover();
    await page.waitForTimeout(250);
    const after = await page.evaluate(props, sel);
    mouse.push({ name, changed: before !== after, before, after });
    await ctx.close();
  }
  log('hover-mouse-1280', mouse);
}

// 6. Press feedback + reduced motion.
if (want('press')) {
  for (const rm of ['no-preference', 'reduce']) {
    const ctx = await mouseCtx(1280, 800, { reducedMotion: rm });
    const res = [];
    for (const [url, sel] of [
      ['/', '.hero__btn[data-hero-new]'],
      ['/', '[data-theme-toggle]'],
      ['/garden/', 'a.chip:not([aria-current="true"])'],
    ]) {
      const page = await ctx.newPage();
      await ready(page, url);
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(250);
      const st = await loc.evaluate((e) => ({ tf: getComputedStyle(e).transform, active: e.matches(':active'), tr: getComputedStyle(e).transitionProperty, bg: getComputedStyle(e).backgroundColor }));
      await page.mouse.move(2, 2);
      await page.mouse.up();
      const tap = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('-webkit-tap-highlight-color'));
      const us = await loc.evaluate((e) => getComputedStyle(e).userSelect + '/' + getComputedStyle(e).touchAction);
      res.push({ sel, ...st, tap, userSelect_touchAction: us });
      await page.close();
    }
    // reduced/default: panel transform per frame and transitions on open + theme
    const page = await ctx.newPage();
    await ready(page);
    const m = await page.evaluate(async () => {
      const p = document.getElementById('settings-panel');
      document.querySelector('[data-settings-toggle]').click();
      const open = document.getAnimations().map((a) => a.constructor.name + ':' + (a.transitionProperty ?? a.animationName));
      const tf = [];
      for (let i = 0; i < 4; i++) {
        tf.push(getComputedStyle(p).transform);
        await new Promise((r) => requestAnimationFrame(r));
      }
      document.querySelector('[data-theme-toggle]').click();
      const theme = document.getAnimations().map((a) => a.constructor.name + ':' + (a.transitionProperty ?? a.animationName));
      document.querySelector('[data-settings-toggle]').click();
      const close = document.getAnimations().map((a) => a.constructor.name + ':' + (a.transitionProperty ?? a.animationName));
      return { open, tf, theme, close };
    });
    log(`press-${rm}`, { controls: res, panel: m });
    await ctx.close();
  }
  // touch press (Chromium: CDP touchStart hold)
  if (ENGINE === 'chromium') {
    const ctx = await touchCtx(375, 812);
    const page = await ctx.newPage();
    await ready(page);
    const loc = page.locator('.hero__btn[data-hero-new]');
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await page.waitForTimeout(250);
    const st = await loc.evaluate((e) => ({ tf: getComputedStyle(e).transform, active: e.matches(':active') }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    log('press-touch-hold', st);
    await ctx.close();
  }
}

// 7. Theme switch in one frame, both directions.
if (want('theme')) {
  const ctx = await mouseCtx(1280, 800);
  const page = await ctx.newPage();
  await ready(page);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const r = await page.evaluate(async () => {
      const btn = document.querySelector('.hero__btn[data-hero-new]');
      const gear = document.querySelector('[data-settings-toggle]');
      document.querySelector('[data-theme-toggle]').click();
      const trans = document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length;
      const sync = [getComputedStyle(btn).backgroundColor, getComputedStyle(document.body).backgroundColor, getComputedStyle(gear).color];
      await new Promise((r) => requestAnimationFrame(r));
      const f1 = [getComputedStyle(btn).backgroundColor, getComputedStyle(document.body).backgroundColor, getComputedStyle(gear).color];
      await new Promise((r) => setTimeout(r, 400));
      const fin = [getComputedStyle(btn).backgroundColor, getComputedStyle(document.body).backgroundColor, getComputedStyle(gear).color];
      return { theme: document.documentElement.dataset.theme, trans, syncEqualsFinal: sync.join() === fin.join(), f1EqualsFinal: f1.join() === fin.join(), attrLeft: document.documentElement.hasAttribute('data-theme-switching') };
    });
    out.push(r);
  }
  // hover transition still works after switching
  const loc = page.locator('.hero__btn[data-hero-new]');
  await loc.hover();
  const hov = await page.evaluate(() => document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').map((a) => a.transitionProperty));
  log('theme-switch', { flips: out, hoverTransitionsAfter: hov });
  await ctx.close();
}

// 8. Font sizes + overflow.
if (want('fonts')) {
  const sel = ['#hero-mode', '#hero-seed', '#hero-pacing', '#hero-view', '#hero-palette', '#hero-color-by'];
  const vsel = ['#ex-speed', '#ex-pacing'];
  const fs_ = (sels) => (sels) => sels.map((s) => [s, document.querySelector(s) ? getComputedStyle(document.querySelector(s)).fontSize : 'missing']);
  const out = {};
  for (const [mode, w, h] of [
    ['touch', 375, 812],
    ['mouse', 1280, 800],
  ]) {
    const ctx = mode === 'touch' ? await touchCtx(w, h) : await mouseCtx(w, h);
    const page = await ctx.newPage();
    await ready(page);
    const home = await page.evaluate(fs_(), sel);
    await ready(page, '/rising-water/');
    const rw = await page.evaluate(fs_(), vsel);
    const rwSettings = await page.evaluate(fs_(), ['#settings-panel select']);
    out[mode] = { coarse: await page.evaluate(() => matchMedia('(pointer: coarse)').matches), home, rw, rwSettings };
    await ctx.close();
  }
  log('fonts', out);
  const ov = [];
  for (const w of [320, 375, 390]) {
    const ctx = await touchCtx(w, 812);
    const page = await ctx.newPage();
    for (const url of ['/', '/garden/', '/rising-water/']) {
      await ready(page, url);
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      let withPanel = null;
      if (await page.locator('[data-settings-toggle]').count()) {
        await page.locator('[data-settings-toggle]').tap();
        await page.waitForTimeout(400);
        withPanel = await page.evaluate(() => {
          const p = document.getElementById('settings-panel');
          const wide = Array.from(p.querySelectorAll('select,input,label,button')).filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5);
          }).map((e) => e.id || e.textContent.trim().slice(0, 20));
          return { sw: document.documentElement.scrollWidth, panelSW: p.scrollWidth, panelCW: p.clientWidth, clipped: wide };
        });
        if (w === 320) await page.screenshot({ path: path.join(OUT, `${LABEL}-${ENGINE}-sheet-320-${url.replace(/\//g, '_') || 'home'}.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
      // toolbar / explorer controls rows
      const tb = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.height)]; };
        return { heroMode: r('#hero-mode'), heroSettingsBtn: r('.hero__toolbar button'), exSpeed: r('#ex-speed'), exPacing: r('#ex-pacing') };
      });
      ov.push({ w, url, overflow: o.sw > o.iw, ...o, withPanel, tb });
    }
    await ctx.close();
  }
  log('overflow', ov);
}

// 9. body min-height and short pages.
if (want('svh')) {
  const out = [];
  for (const [mode, w, h] of [
    ['touch', 375, 812],
    ['touch', 390, 664],
    ['mouse', 1280, 800],
  ]) {
    const ctx = mode === 'touch' ? await touchCtx(w, h) : await mouseCtx(w, h);
    const page = await ctx.newPage();
    for (const url of ['/about/', '/404.html']) {
      await page.goto(BASE + url);
      await page.waitForTimeout(200);
      out.push({ mode, w, h, url, ...(await page.evaluate(() => ({ minH: getComputedStyle(document.body).minHeight, sh: document.documentElement.scrollHeight, ih: innerHeight, bodyH: document.body.getBoundingClientRect().height }))) });
    }
    await ctx.close();
  }
  log('svh', out);
}

// 10. Instant readouts.
if (want('instant')) {
  const ctx = await mouseCtx(1280, 800);
  const page = await ctx.newPage();
  await ready(page, '/garden/');
  const g = await page.evaluate(() => {
    const rows = () => Array.from(document.querySelectorAll('.garden-list > li')).filter((li) => !li.hidden).length;
    const chips = Array.from(document.querySelectorAll('a.chip')).filter((c) => c.getClientRects().length && c.getAttribute('aria-current') !== 'true');
    const res = [];
    for (const c of chips.slice(0, 4)) {
      const b = rows();
      c.click();
      res.push({ chip: c.textContent.trim(), before: b, after: rows(), anims: document.getAnimations().length });
    }
    return res;
  });
  await ready(page, '/rising-water/');
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 60000 });
  const ex = await page.evaluate(() => {
    const sel = ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]', '[data-ex-level-out]', '[data-ex-minp-out]', '[data-ex-topn-out]'];
    const b = sel.map((s) => document.querySelector(s)?.textContent);
    const lv = document.querySelector('#ex-level');
    lv.value = String(Number(lv.min) + (Number(lv.max) - Number(lv.min)) * 0.6);
    lv.dispatchEvent(new Event('input', { bubbles: true }));
    const mp = document.querySelector('#ex-minp');
    if (mp) { mp.value = String(Number(mp.max) * 0.3); mp.dispatchEvent(new Event('input', { bubbles: true })); }
    const a = sel.map((s) => document.querySelector(s)?.textContent);
    return {
      changed: sel.filter((_, i) => a[i] !== b[i]),
      anims: document.getAnimations().filter((x) => sel.some((s) => document.querySelector(s)?.contains(x.effect?.target))).length,
      children: sel.map((s) => document.querySelector(s)?.children.length ?? -1),
      customEls: document.querySelectorAll(':not(:defined)').length,
    };
  });
  await ready(page, '/');
  const hero = await page.evaluate(async () => {
    const ro = document.querySelector('[data-hero-readout]');
    let writes = 0;
    const seen = new Set([ro.textContent]);
    const mo = new MutationObserver(() => { writes++; seen.add(ro.textContent); });
    mo.observe(ro, { childList: true, characterData: true, subtree: true });
    await new Promise((r) => setTimeout(r, 1500));
    mo.disconnect();
    return { state: document.querySelector('[data-hero]').dataset.state, writes, distinct: seen.size, anims: ro.getAnimations({ subtree: true }).length, children: ro.children.length };
  });
  log('instant', { garden: g, explorer: ex, hero });
  await ctx.close();
}

// 11. CSP: inject the built CSP header into preview responses, collect violations.
if (want('csp')) {
  const hdr = fs.readFileSync('dist/_headers', 'utf8');
  const csp = hdr.split('\n').find((l) => /^\s*Content-Security-Policy:/i.test(l)).split(/:(.+)/)[1].trim();
  const ctx = await mouseCtx(1280, 800);
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    if (!req.url().startsWith(BASE)) return route.continue();
    const resp = await route.fetch();
    const headers = { ...resp.headers() };
    if ((headers['content-type'] ?? '').includes('text/html')) headers['content-security-policy'] = csp;
    return route.fulfill({ response: resp, headers });
  });
  const out = {};
  for (const url of ['/', '/garden/', '/rising-water/', '/404.html']) {
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => { if (/Content Security Policy|CSP|Refused/i.test(m.text())) msgs.push(m.text().slice(0, 200)); });
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample}`));
    });
    await page.goto(BASE + url);
    await page.waitForTimeout(1200);
    if (await page.locator('[data-settings-toggle]').count()) {
      await page.locator('[data-settings-toggle]').click();
      await page.waitForTimeout(400);
      await page.locator('[data-theme-toggle]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-theme-toggle]').click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    out[url] = { console: msgs, events: await page.evaluate(() => window.__csp), cspApplied: true };
    await page.close();
  }
  log('csp', { cspLen: csp.length, pages: out });
  await ctx.close();
}

fs.writeFileSync(path.join(OUT, `${LABEL}-${ENGINE}-${ONLY.join('_')}.json`), JSON.stringify(R, null, 2));
await browser.close();
