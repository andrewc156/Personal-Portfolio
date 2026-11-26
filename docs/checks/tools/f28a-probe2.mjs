// F28a probe 2: touch/hover, input zoom, WebKit, explorer readout cadence, focus after tap.
import { chromium, webkit, devices } from '@playwright/test';
import { BASE, log, saveResults, compose } from './f28a-lib.mjs';

const touch = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

const zoomAudit = () =>
  [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => !['range', 'checkbox', 'radio', 'hidden', 'button', 'submit'].includes(e.type))
    .map((e) => ({
      sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.type ? `[${e.type}]` : ''),
      fontPx: parseFloat(getComputedStyle(e).fontSize),
    }));

for (const [engine, bt, ctxOpts] of [
  ['chromium', chromium, touch],
  ['webkit', webkit, { ...devices['iPhone 13'] }],
]) {
  const browser = await bt.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const shots = [];

  // input zoom audit on pages with form controls
  for (const p of ['/', '/rising-water/', '/garden/']) {
    await page.goto(BASE + p);
    await page.waitForTimeout(400);
    log(`${engine}-zoom-${p}`, await page.evaluate(`(${zoomAudit})()`));
  }
  // meta + tap highlight + viewport units
  await page.goto(BASE + '/');
  log(
    `${engine}-meta`,
    await page.evaluate(() => ({
      themeColor: [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content),
      viewport: document.querySelector('meta[name=viewport]').content,
      tapHighlight: getComputedStyle(document.documentElement).webkitTapHighlightColor,
      btnTapHighlight: getComputedStyle(document.querySelector('.btn')).webkitTapHighlightColor,
      touchActionBtn: getComputedStyle(document.querySelector('.btn')).touchAction,
      userSelectBtn: getComputedStyle(document.querySelector('.btn')).webkitUserSelect,
      innerH: innerHeight,
      bodyMinH: getComputedStyle(document.body).minHeight,
      hover: matchMedia('(hover: hover)').matches,
    })),
  );

  // sticky hover: tap a Garden chip, then read its state
  await page.goto(BASE + '/garden/');
  await page.waitForTimeout(300);
  const chipSel = '.chip:not([aria-current="true"])';
  const before = await page.$eval(chipSel, (c) => ({ bg: getComputedStyle(c).backgroundColor, txt: c.textContent.trim() }));
  const chip = await page.$(chipSel);
  const box = await chip.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  // the tapped chip is now current; tap "All" back, then check a non-current chip we tapped
  const after = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y).closest('.chip');
      return { txt: el?.textContent.trim(), hover: el?.matches(':hover'), bg: el && getComputedStyle(el).backgroundColor, current: el?.getAttribute('aria-current') };
    },
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  log(`${engine}-chip-tap`, { before, after });
  // Tap a work row link? Navigates. Instead tap a .btn on home that does not navigate: New terrain.
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('.hero__btn[data-hero-new]').disabled);
  await page.$eval('.hero__btn[data-hero-new]', (b) => b.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const nb = await (await page.$('.hero__btn[data-hero-new]')).boundingBox();
  const bgBefore = await page.$eval('.hero__btn[data-hero-new]', (b) => getComputedStyle(b).backgroundColor);
  await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
  await page.waitForTimeout(500);
  const st = await page.$eval('.hero__btn[data-hero-new]', (b) => ({ hover: b.matches(':hover'), bg: getComputedStyle(b).backgroundColor, border: getComputedStyle(b).borderColor }));
  log(`${engine}-btn-tap-sticky`, { bgBefore, after: st });
  shots.push({ t: `${engine}: after tap New terrain (500ms)`, b64: (await page.screenshot({ clip: { x: 0, y: nb.y - 60, width: 375, height: 130 } })).toString('base64') });

  // focus ring after tapping the gear (sheet title gets focus)
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  const g = await (await page.$('[data-settings-toggle]')).boundingBox();
  await page.touchscreen.tap(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(400);
  log(
    `${engine}-gear-tap-focus`,
    await page.evaluate(() => {
      const a = document.activeElement;
      return { active: a?.className, focusVisible: a?.matches(':focus-visible'), outline: getComputedStyle(a).outlineStyle };
    }),
  );
  shots.push({ t: `${engine}: sheet after tapping gear`, b64: (await page.screenshot()).toString('base64') });
  await compose(browser, `touch-${engine}`, shots, (s) => s.t);
  await ctx.close();
  await browser.close();
}

// --- explorer readout cadence (Chromium desktop)
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/rising-water/');
  await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 60000 });
  const arm = () =>
    page.evaluate(() => {
      window.__mut = {};
      const sels = ['[data-ro-level]', '[data-ro-level-alt]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]', '[data-ex-level-out]', '[data-ex-minp-out]', '[data-ex-topn-out]', '[data-ex-hover]', '[data-ex-card-title]'];
      window.__mo?.disconnect();
      window.__mo = new MutationObserver((ms) => {
        for (const m of ms) {
          const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
          for (const s of sels) if (el.closest(s)) window.__mut[s] = (window.__mut[s] ?? 0) + 1;
        }
      });
      for (const s of sels) {
        const e = document.querySelector(s);
        if (e) window.__mo.observe(e, { childList: true, characterData: true, subtree: true });
      }
      // <output>.value sets textContent: covered by childList
    });
  const read = () => page.evaluate(() => window.__mut);
  await arm();
  await page.click('[data-ex-play]');
  await page.waitForTimeout(2000);
  await page.click('[data-ex-play]');
  log('explorer-play-2s-mutations', await read());
  await arm();
  await page.evaluate(() => {
    const r = document.getElementById('ex-level');
    for (let i = 0; i < 30; i++) {
      r.value = String(300 + i * 5);
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);
  log('explorer-scrub-30-inputs-mutations', await read());
  await arm();
  await page.evaluate(() => {
    const r = document.getElementById('ex-topn');
    for (let i = 0; i < 10; i++) {
      r.value = String(20 + i * 5);
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);
  log('explorer-topn-10-inputs-mutations', await read());
  await arm();
  const vals0 = await page.evaluate(() => ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]'].map((s) => document.querySelector(s).textContent));
  await page.evaluate(() => document.querySelector('[data-lake-cell]').click());
  await page.waitForTimeout(400);
  const vals1 = await page.evaluate(() => ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]'].map((s) => document.querySelector(s).textContent));
  log('explorer-lake-click', { mutations: await read(), before: vals0, after: vals1 });
  await arm();
  await page.click('[data-ex-units="ft"]').catch(() => {});
  await page.waitForTimeout(200);
  log('explorer-units-toggle-mutations', await read());
  // controls font sizes + play button width stability
  log(
    'explorer-controls',
    await page.evaluate(() => {
      const p = document.querySelector('[data-ex-play]');
      return { playW: p.getBoundingClientRect().width, playTxt: p.textContent, selects: [...document.querySelectorAll('.ex-controls select')].map((s) => getComputedStyle(s).fontSize) };
    }),
  );
  await page.click('[data-ex-play]');
  const w2 = await page.$eval('[data-ex-play]', (p) => [p.getBoundingClientRect().width, p.textContent]);
  await page.click('[data-ex-play]');
  log('explorer-play-width-playing', w2);
  // hero play/pause width
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('.hero__btn[data-hero-play]').disabled);
  const hw = [];
  for (let i = 0; i < 2; i++) {
    hw.push(await page.$eval('.hero__btn[data-hero-play]', (p) => [p.getBoundingClientRect().width, p.textContent.trim()]));
    await page.click('.hero__btn[data-hero-play]');
  }
  log('hero-play-width', hw);
  // hero readout cadence while playing
  await page.evaluate(() => {
    window.__n = 0;
    new MutationObserver(() => window.__n++).observe(document.querySelector('[data-hero-readout]'), { childList: true, characterData: true, subtree: true });
  });
  const playing = await page.$eval('[data-hero-art], [data-hero]', (e) => e.dataset.state);
  await page.waitForTimeout(1000);
  log('hero-readout-mutations-1s', { state: playing, n: await page.evaluate(() => window.__n) });
  await ctx.close();
  await browser.close();
}

saveResults('probe2');
