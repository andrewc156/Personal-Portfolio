// F28a probe 1: Settings drawer/sheet, theme toggle, reduced motion (Chromium).
import { chromium } from '@playwright/test';
import { BASE, log, saveResults, strip } from './f28a-lib.mjs';

const browser = await chromium.launch();
const T = [0, 50, 100, 200, 300];

async function ctxFor(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]')?.disabled);
  return { ctx, page };
}

const animInfo = () =>
  document.getAnimations().map((a) => ({
    type: a.constructor.name,
    name: a.animationName ?? a.transitionProperty,
    target: (a.effect?.target?.className?.baseVal ?? a.effect?.target?.className ?? '') + '',
    dur: a.effect?.getTiming().duration,
    easing: a.effect?.getTiming().easing,
  }));

// --- wide drawer, light + dark
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await ctxFor({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  const open = await page.evaluate((fn) => {
    document.querySelector('[data-settings-toggle]').click();
    return eval(`(${fn})`)();
  }, animInfo.toString());
  log(`drawer-open-anims-${scheme}`, open);
  await strip(page, browser, `drawer-open-1280-${scheme}`, T, { x: 780, y: 0, width: 500, height: 420 });
  // close: what animates?
  const close = await page.evaluate((fn) => {
    document.querySelector('[data-settings-close]').click();
    const p = document.getElementById('settings-panel');
    return { anims: eval(`(${fn})`)(), hidden: p.hidden, display: getComputedStyle(p).display };
  }, animInfo.toString());
  log(`drawer-close-${scheme}`, close);
  // interruption: open, at ~100 ms close, reopen 30 ms later; sample opacity right after reopen
  const intr = await page.evaluate(async () => {
    const p = document.getElementById('settings-panel');
    const g = document.querySelector('[data-settings-toggle]');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    g.click();
    await wait(100);
    const before = { op: +getComputedStyle(p).opacity, tf: getComputedStyle(p).transform };
    g.click(); // close mid-open
    await raf();
    const mid = { display: getComputedStyle(p).display };
    await wait(30);
    g.click(); // reopen
    await raf();
    const after = { op: +getComputedStyle(p).opacity, tf: getComputedStyle(p).transform };
    g.click();
    return { before, mid, after };
  });
  log(`drawer-interrupt-${scheme}`, intr);
  await ctx.close();
}

// --- narrow sheet with touch, light + dark
for (const [w, h] of [
  [375, 812],
  [390, 844],
]) {
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await ctxFor({
      viewport: { width: w, height: h },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const media = await page.evaluate(() => ({
      hover: matchMedia('(hover: hover)').matches,
      fine: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
    }));
    log(`media-${w}-${scheme}`, media);
    await page.evaluate(() => document.querySelector('[data-settings-toggle]').click());
    if (w === 375) await strip(page, browser, `sheet-open-${w}-${scheme}`, T);
    else await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    const sheet = await page.evaluate(() => {
      const p = document.getElementById('settings-panel');
      const r = p.getBoundingClientRect();
      // anything painted over the page behind the sheet (a scrim)?
      const behind = document.elementFromPoint(10, 40);
      const fs = [...p.querySelectorAll('select, input, button')].map((e) => ({
        tag: e.tagName + (e.type ? ':' + e.type : ''),
        id: e.id || e.name || e.textContent.trim().slice(0, 20),
        fontPx: parseFloat(getComputedStyle(e).fontSize),
      }));
      return {
        role: p.getAttribute('role'),
        top: r.top,
        height: r.height,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        behindTop: behind?.tagName + '.' + behind?.className,
        controls: fs,
        padBottom: getComputedStyle(p).paddingBottom,
      };
    });
    log(`sheet-${w}-${scheme}`, sheet);
    // close via backdrop tap
    await page.touchscreen.tap(w / 2, 60);
    const closed = await page.evaluate(() => ({
      hidden: document.getElementById('settings-panel').hidden,
      anims: document.getAnimations().length,
    }));
    log(`sheet-backdrop-close-${w}-${scheme}`, closed);
    await ctx.close();
  }
}

// --- theme toggle: what transitions run when the theme flips
{
  const { ctx, page } = await ctxFor({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const flip = await page.evaluate((fn) => {
    document.querySelector('[data-theme-toggle]').click();
    return eval(`(${fn})`)();
  }, animInfo.toString());
  log('theme-flip-anims', flip.map((a) => `${a.type} ${a.name} ${a.dur} on ${a.target}`));
  await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
  await page.waitForTimeout(300);
  // strip of the hero toolbar + bar during flip
  await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
  await strip(page, browser, 'theme-flip-1280', [0, 40, 80, 120], { x: 0, y: 0, width: 1280, height: 640 });
  await ctx.close();
}

// --- reduced motion: drawer + sheet
for (const [w, h, touch] of [
  [1280, 800, false],
  [375, 812, true],
]) {
  const { ctx, page } = await ctxFor({
    viewport: { width: w, height: h },
    reducedMotion: 'reduce',
    hasTouch: touch,
    isMobile: touch,
  });
  const a = await page.evaluate((fn) => {
    document.querySelector('[data-settings-toggle]').click();
    return eval(`(${fn})`)();
  }, animInfo.toString());
  const sb = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  log(`reduced-open-${w}`, { anims: a, scrollBehavior: sb });
  await ctx.close();
}

// --- smooth scroll: time for nav anchor jump and skip link
{
  const { ctx, page } = await ctxFor({ viewport: { width: 1280, height: 800 } });
  const r = await page.evaluate(async () => {
    const t0 = performance.now();
    document.querySelector('.site-nav a[href$="#open-science"]').click();
    await new Promise((res) => {
      let last = -1,
        stable = 0;
      const tick = () => {
        if (scrollY === last) stable++;
        else stable = 0;
        last = scrollY;
        if (stable > 3) res();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { ms: Math.round(performance.now() - t0), y: scrollY };
  });
  log('smooth-scroll-nav-open-science', r);
  await ctx.close();
}

saveResults('probe1');
await browser.close();
