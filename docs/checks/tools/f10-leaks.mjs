// F10 checker tool: independent leak check for hero mode switching.
// Instruments rAF, timers, listeners and observers in the page (not the builder's hooks),
// switches modes through the real <select> many times, and compares live counts with baseline.
// usage: node docs/checks/tools/f10-leaks.mjs http://localhost:4321
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  const w = window;
  const live = { raf: new Set(), timeouts: new Set(), intervals: new Set(), listeners: new Map(), io: new Set(), ro: new Set(), mo: new Set(), mq: 0 };
  w.__live = live;
  w.__rafCalls = 0;
  const oRaf = w.requestAnimationFrame.bind(w);
  const oCaf = w.cancelAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => {
    w.__rafCalls++;
    const id = oRaf((t) => {
      live.raf.delete(id);
      cb(t);
    });
    live.raf.add(id);
    return id;
  };
  w.cancelAnimationFrame = (id) => {
    live.raf.delete(id);
    oCaf(id);
  };
  const oST = w.setTimeout.bind(w);
  const oCT = w.clearTimeout.bind(w);
  w.setTimeout = (cb, ms, ...a) => {
    const id = oST(() => {
      live.timeouts.delete(id);
      typeof cb === 'function' ? cb(...a) : 0;
    }, ms);
    live.timeouts.add(id);
    return id;
  };
  w.clearTimeout = (id) => {
    live.timeouts.delete(id);
    oCT(id);
  };
  const oSI = w.setInterval.bind(w);
  const oCI = w.clearInterval.bind(w);
  w.setInterval = (cb, ms, ...a) => {
    const id = oSI(cb, ms, ...a);
    live.intervals.add(id);
    return id;
  };
  w.clearInterval = (id) => {
    live.intervals.delete(id);
    oCI(id);
  };
  const el = (t, sel) => t instanceof Element && t.matches(sel);
  const key = (t, type) => `${t === document ? 'document' : t === window ? 'window' : el(t, '[data-hero]') ? 'hero' : el(t, '[data-hero-map]') ? 'map' : el(t, '[data-hero-strip]') ? 'strip' : t instanceof MediaQueryList ? 'mq' : 'other'}:${type}`;
  const oAdd = EventTarget.prototype.addEventListener;
  const oRem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const k = key(this, type);
    if (!live.listeners.has(k)) live.listeners.set(k, new Set());
    live.listeners.get(k).add(fn);
    return oAdd.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    live.listeners.get(key(this, type))?.delete(fn);
    return oRem.call(this, type, fn, opts);
  };
  for (const [name, set] of [['IntersectionObserver', 'io'], ['ResizeObserver', 'ro'], ['MutationObserver', 'mo']]) {
    const O = w[name];
    w[name] = class extends O {
      constructor(cb, o) {
        super(cb, o);
        this.__obs = 0;
      }
      observe(...a) {
        if (!this.__obs) live[set].add(this);
        this.__obs++;
        return super.observe(...a);
      }
      disconnect() {
        live[set].delete(this);
        this.__obs = 0;
        return super.disconnect();
      }
    };
  }
  w.__snap = () => {
    const ls = {};
    for (const [k, s] of live.listeners) if (/^(document|window|hero|map|strip|mq):/.test(k) && s.size) ls[k] = s.size;
    return { raf: live.raf.size, timeouts: live.timeouts.size, intervals: live.intervals.size, io: live.io.size, ro: live.ro.size, mo: live.mo.size, listeners: ls };
  };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?seed=42`);
await page.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Art settings', exact: true }).click();
const select = page.locator('#hero-mode');
const settle = async () => {
  await page.waitForTimeout(700); // past every debounce (≤ 600 ms)
  return page.evaluate(() => window.__snap());
};
const baseline = await settle();
console.log('baseline rising', JSON.stringify(baseline));
const seq = ['dye', 'pond', 'rivers', 'collatz', 'rising', 'dye', 'collatz', 'pond', 'rising', 'rivers', 'dye', 'rising'];
const snaps = {};
for (let round = 0; round < 3; round++) {
  for (const m of seq) {
    await select.selectOption(m);
    await page.waitForFunction((id) => document.querySelector('[data-hero]').dataset.mode === id && !!document.querySelector('[data-hero]').__art, m);
    const s = await settle();
    const k = `${m}`;
    if (!snaps[k]) snaps[k] = [];
    snaps[k].push(JSON.stringify(s));
  }
}
// Rapid switching (no settle), including mid-import, then settle
for (let i = 0; i < 20; i++) await select.selectOption(seq[i % seq.length]);
await select.selectOption('rising');
await page.waitForFunction(() => document.querySelector('[data-hero]').dataset.mode === 'rising' && !!document.querySelector('[data-hero]').__hero);
const after = await settle();
let stable = true;
for (const [m, list] of Object.entries(snaps)) {
  const uniq = [...new Set(list)];
  console.log(m, uniq.length === 1 ? 'stable' : 'DRIFT', uniq.join(' | '));
  if (uniq.length !== 1) stable = false;
}
console.log('after rapid switching, rising', JSON.stringify(after));
const same = JSON.stringify(after) === JSON.stringify(baseline);
console.log('rising after == baseline:', same);
// rAF rate while paused in an extra mode: should be 0 new rAF calls
await select.selectOption('rivers');
await page.waitForFunction(() => !!document.querySelector('[data-hero]').__heroMode);
await page.evaluate(() => document.querySelector('.hero__bar [data-hero-play]').click());
console.log('state after pause click:', await page.evaluate(() => document.querySelector('[data-hero]').dataset.state));
await page.waitForTimeout(400);
const r0 = await page.evaluate(() => window.__rafCalls);
await page.waitForTimeout(1000);
const r1 = await page.evaluate(() => window.__rafCalls);
console.log('rAF calls during 1 s paused in rivers:', r1 - r0);
console.log('page errors:', errors.length ? errors : 'none');
console.log(stable && same && r1 - r0 === 0 && !errors.length ? 'LEAKS: PASS' : 'LEAKS: FAIL');
await browser.close();
