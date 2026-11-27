// F28b attempt-2 checker probe (independent of the builder's webkit-exit-tab.mjs).
// Needs a production preview on 4321: bash docs/checks/tools/f28-check-run.sh . docs/checks/tools/f28-check-a2-exit.mjs
// Sections: (A) Tab / Shift+Tab right after closing (Esc, real gear click, real Close click,
// Enter on Close), plus focus() into the leaving panel; (B) inert semantics with a
// MutationObserver + focusin log (order of inert vs hidden, inert at the moment focus enters);
// (C) F25 modal behaviour; (D) no-JS fallback. Chromium + WebKit, 1280 and 375.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';

const OUT = path.resolve('docs/checks/F28b/attempt-2');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4321';
const R = { A: [], B: [], C: [], D: [] };
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const INIT = () => {
  window.__log = [];
  window.__t0 = performance.now();
  const hook = () => {
    const p = document.getElementById('settings-panel');
    if (!p) return;
    new MutationObserver((ms) => {
      for (const m of ms) window.__log.push({ k: 'attr', a: m.attributeName, v: p.getAttribute(m.attributeName), t: +(performance.now() - window.__t0).toFixed(1) });
    }).observe(p, { attributes: true, attributeFilter: ['hidden', 'inert', 'aria-modal', 'role'] });
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      window.__log.push({ k: 'focus', id: t.id || t.getAttribute?.('aria-label') || t.tagName, inPanel: p.contains(t), panelInert: p.inert, panelHidden: p.hidden, t: +(performance.now() - window.__t0).toFixed(1) });
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
};

const desc = () => {
  const a = document.activeElement;
  const p = document.getElementById('settings-panel');
  return { focus: a ? a.id || a.getAttribute('aria-label') || a.tagName : null, inPanel: !!(a && p.contains(a)), inert: p.inert, hidden: p.hidden, rendered: getComputedStyle(p).display !== 'none' };
};

for (const [ename, bt] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await bt.launch();
  for (const [w, h] of [[1280, 800], [375, 812]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 640 ? { hasTouch: true } : {}) });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.goto(BASE + '/');
    await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
    const load = await page.evaluate(() => { const p = document.getElementById('settings-panel'); return { inert: p.inert, attr: p.hasAttribute('inert'), hidden: p.hidden }; });
    R.B.push({ ename, w, onLoad: load });
    check(load.inert && load.attr && load.hidden, `${ename} ${w} not inert on load`);

    // ---- A + B: close paths
    const ways = w > 640 ? ['Escape', 'gear-click', 'close-click', 'close-enter'] : ['Escape', 'close-click', 'close-enter'];
    for (const how of ways) {
      for (const dir of ['Tab', 'Shift+Tab']) {
        for (let run = 0; run < 2; run++) {
          await page.evaluate(() => { document.activeElement?.blur(); window.__log.length = 0; });
          await page.focus('[data-settings-toggle]');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(450);
          const openLog = await page.evaluate(() => window.__log.splice(0));
          const open = await page.evaluate(desc);
          // inert must already be false when focus first enters the panel
          const firstIn = openLog.find((e) => e.k === 'focus' && e.inPanel);
          const inertAttrIdx = openLog.findIndex((e) => e.k === 'attr' && e.a === 'inert' && e.v === null);
          const hiddenAttrIdx = openLog.findIndex((e) => e.k === 'attr' && e.a === 'hidden' && e.v === null);
          // a Tab inside the open panel reaches a real control
          await page.keyboard.press('Tab');
          const tabInside = await page.evaluate(desc);
          await page.keyboard.press('Shift+Tab');
          await page.evaluate(() => { window.__log.length = 0; }); // only log from the close on
          // close
          if (how === 'Escape') await page.keyboard.press('Escape');
          else if (how === 'gear-click') { const bb = await page.locator('[data-settings-toggle]').boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
          else if (how === 'close-click') { const bb = await page.locator('[data-settings-close]').boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
          else { await page.focus('[data-settings-close]'); await page.keyboard.press('Enter'); }
          const afterClose = await page.evaluate(desc);
          await page.keyboard.press(dir);
          const afterTab = await page.evaluate(desc);
          await page.waitForTimeout(400);
          const later = await page.evaluate(desc);
          const closeLog = await page.evaluate(() => window.__log.splice(0));
          const ci = closeLog.findIndex((e) => e.k === 'attr' && e.a === 'inert' && e.v !== null);
          const ch = closeLog.findIndex((e) => e.k === 'attr' && e.a === 'hidden' && e.v !== null);
          const focusIntoPanelDuringExit = closeLog.filter((e) => e.k === 'focus' && e.inPanel && e.panelHidden); // focusing Close itself before the close is expected
          const row = { ename, w, how, dir, run, open: { ...open, firstFocusInPanelInert: firstIn?.panelInert, inertClearedBeforeHiddenCleared: inertAttrIdx >= 0 && inertAttrIdx <= hiddenAttrIdx }, tabInside: tabInside.inPanel, afterClose, afterTab, later, closeOrder: { inertIdx: ci, hiddenIdx: ch }, focusIntoPanelDuringExit: focusIntoPanelDuringExit.length };
          R.A.push(row);
          const tag = `${ename} ${w} ${how} ${dir} #${run}`;
          check(open.inPanel && open.inert === false && open.focus === 'settings-title', `${tag}: open state ${JSON.stringify(open)}`);
          check(firstIn && firstIn.panelInert === false, `${tag}: focus entered panel while inert`);
          check(tabInside.inPanel, `${tag}: Tab inside open panel left it`);
          check(afterClose.inert === true, `${tag}: not inert synchronously after close`);
          check(ci >= 0 && ch >= 0 && ci <= ch, `${tag}: inert not set before/with hidden ${ci}/${ch}`);
          check(!afterTab.inPanel && !later.inPanel, `${tag}: focus in leaving panel`);
          check(later.focus === afterTab.focus, `${tag}: focus not sane after 400ms ${afterTab.focus}->${later.focus}`);
          check(focusIntoPanelDuringExit.length === 0, `${tag}: focusin inside panel during exit`);
        }
      }
    }
    // control: where does Shift+Tab / Tab from the gear go when the panel was never opened?
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
    const ctl = {};
    for (const k of ['Tab', 'Shift+Tab']) {
      await page.focus('[data-settings-toggle]');
      await page.keyboard.press(k);
      ctl[k] = await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName);
    }
    R.A.push({ ename, w, controlFromGearNeverOpened: ctl });
    // programmatic focus() into the leaving panel must fail
    await page.focus('[data-settings-toggle]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
    await page.keyboard.press('Escape');
    const prog = await page.evaluate(() => {
      const p = document.getElementById('settings-panel');
      const rendered = getComputedStyle(p).display !== 'none';
      p.querySelector('[data-settings-close]').focus();
      const s = p.querySelector('select, input'); s?.focus();
      return { rendered, inPanel: p.contains(document.activeElement), focus: document.activeElement.id || document.activeElement.tagName };
    });
    R.A.push({ ename, w, programmaticFocusMidExit: prog });
    check(prog.rendered && !prog.inPanel, `${ename} ${w}: focus() into leaving panel succeeded ${JSON.stringify(prog)}`);
    await ctx.close();
  }

  // ---- C: F25 modal (390) + drawer (1280)
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    for (const opener of ['[data-settings-toggle]', 'button[aria-label="Animation settings"]']) {
      await page.goto(BASE + '/');
      await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
      await page.focus(opener);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(450);
      const st = await page.evaluate(() => {
        const p = document.getElementById('settings-panel');
        return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), inert: p.inert, sib: ['header.site-header', 'main', 'footer', '.skip-link'].map((s) => document.querySelector(s)?.inert ?? null), focus: document.activeElement.id };
      });
      let leaks = 0;
      for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('#settings-panel')))) leaks++; }
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Shift+Tab'); if (!(await page.evaluate(() => !!document.activeElement?.closest('#settings-panel')))) leaks++; }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const esc = await page.evaluate((o) => ({ hidden: document.getElementById('settings-panel').hidden, focusIsOpener: document.activeElement === document.querySelector(o), bgInert: document.querySelectorAll('[inert]:not(#settings-panel)').length, panelInert: document.getElementById('settings-panel').inert, modal: document.getElementById('settings-panel').getAttribute('aria-modal') }), opener);
      // backdrop
      await page.focus(opener);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(450);
      const bb = await page.locator('#settings-panel').boundingBox();
      await page.mouse.click(195, Math.max(5, Math.round(bb.y / 2)));
      await page.waitForTimeout(350);
      const bd = await page.evaluate((o) => ({ hidden: document.getElementById('settings-panel').hidden, focusIsOpener: document.activeElement === document.querySelector(o), bgInert: document.querySelectorAll('[inert]:not(#settings-panel)').length, panelInert: document.getElementById('settings-panel').inert }), opener);
      R.C.push({ ename, opener, open: st, tabLeaks: leaks, esc, backdrop: bd });
      const tag = `${ename} F25 ${opener}`;
      check(st.role === 'dialog' && st.modal === 'true' && st.inert === false && st.sib.every((x) => x === true) && st.focus === 'settings-title', `${tag}: open ${JSON.stringify(st)}`);
      if (ename === 'chromium') check(leaks === 0, `${tag}: Tab wrap leaked ${leaks}`);
      check(esc.hidden && esc.focusIsOpener && esc.bgInert === 0 && esc.panelInert && esc.modal !== 'true', `${tag}: esc ${JSON.stringify(esc)}`);
      check(bd.hidden && bd.focusIsOpener && bd.bgInert === 0 && bd.panelInert, `${tag}: backdrop ${JSON.stringify(bd)}`);
    }
    await ctx.close();
    const c2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await c2.newPage();
    await p2.goto(BASE + '/');
    await p2.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
    await p2.click('[data-settings-toggle]');
    await p2.waitForTimeout(450);
    const dr = await p2.evaluate(() => ({ role: document.getElementById('settings-panel').getAttribute('role'), modal: document.getElementById('settings-panel').getAttribute('aria-modal'), inertCount: document.querySelectorAll('[inert]').length }));
    await p2.mouse.click(100, 400);
    await p2.waitForTimeout(300);
    dr.openAfterBgClick = !(await p2.evaluate(() => document.getElementById('settings-panel').hidden));
    // remembered open drawer reload: open on load and not inert
    await p2.reload();
    await p2.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
    dr.reloadOpen = await p2.evaluate(() => ({ hidden: document.getElementById('settings-panel').hidden, inert: document.getElementById('settings-panel').inert }));
    await p2.click('[data-settings-toggle]');
    R.C.push({ ename, drawer1280: dr });
    check(dr.role === 'complementary' && dr.modal !== 'true' && dr.inertCount === 0 && dr.openAfterBgClick, `${ename} drawer ${JSON.stringify(dr)}`);
    check(dr.reloadOpen.hidden === false && dr.reloadOpen.inert === false, `${ename} remembered drawer ${JSON.stringify(dr.reloadOpen)}`);
    await c2.close();
  }

  // ---- D: no JS
  for (const [w, h] of [[1280, 800], [375, 812]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(BASE + '/');
    const st = await page.evaluate(() => {
      const p = document.getElementById('settings-panel');
      return { hidden: p.hasAttribute('hidden'), inertAttr: p.hasAttribute('inert'), display: getComputedStyle(p).display, gearDisabled: document.querySelector('[data-settings-toggle]').disabled, anyInert: document.querySelectorAll('[inert]').length };
    });
    const seen = [];
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => ({ id: document.activeElement.id || document.activeElement.tagName, inPanel: !!document.activeElement.closest('#settings-panel') }))); }
    st.tabEntersPanel = seen.some((s) => s.inPanel);
    R.D.push({ ename, w, ...st });
    check(st.hidden && !st.inertAttr && st.display === 'none' && st.gearDisabled && st.anyInert === 0 && !st.tabEntersPanel, `${ename} ${w} no-JS ${JSON.stringify(st)}`);
    await ctx.close();
  }
  await b.close();
}
fs.writeFileSync(path.join(OUT, 'exit-probe.json'), JSON.stringify({ R, fails }, null, 2));
for (const r of R.A) console.log('A', JSON.stringify(r.how ? { e: r.ename, w: r.w, how: r.how, dir: r.dir, run: r.run, open: r.open.focus, firstInInert: r.open.firstFocusInPanelInert, closeSync: r.afterClose.inert, rendered: r.afterTab.rendered, tab: r.afterTab.focus, inP: r.afterTab.inPanel, later: r.later.focus, order: r.closeOrder } : r));
console.log('B', JSON.stringify(R.B));
for (const r of R.C) console.log('C', JSON.stringify(r));
for (const r of R.D) console.log('D', JSON.stringify(r));
console.log('FAILS', fails.length, JSON.stringify(fails, null, 1));
