// F25 attempt-2 checker: Settings panel roles (complementary wide / dialog+aria-modal narrow,
// incl. resize while open), focus containment, inert background, focus return to both openers,
// Escape, wide-drawer regression, axe on / with the 375 sheet open (light + dark).
// Usage: node docs/checks/tools/f25-a2-settings.mjs [base] [outdir]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const B = process.argv[2] ?? 'http://localhost:4321';
const OUT = process.argv[3] ?? 'docs/checks/F25/attempt-2';
const res = { ok: true, checks: [] };
const chk = (name, pass, detail) => { res.checks.push({ name, pass: !!pass, detail }); if (!pass) res.ok = false; };
const panelState = (p) =>
  p.evaluate(() => {
    const el = document.getElementById('settings-panel');
    const a = document.activeElement;
    return {
      tag: el.tagName, hidden: el.hidden, role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'),
      inert: Array.from(document.querySelectorAll('[inert]')).map((n) => n.tagName + (n.className ? '.' + String(n.className).split(' ')[0] : '')),
      focusInPanel: el.contains(a), focus: a.tagName + ':' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30),
    };
  });
const browser = await chromium.launch();
const openers = async (p) => p.locator('button[aria-controls="settings-panel"]').evaluateAll((bs) => bs.map((b, i) => ({ i, label: b.getAttribute('aria-label') || b.textContent.trim(), inHeader: !!b.closest('header') })));

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); localStorage.removeItem('settings-open'); } catch {} }, theme);
  const p = await ctx.newPage();
  await p.goto(B + '/');
  await p.waitForTimeout(600);
  const ops = await openers(p);
  if (theme === 'light') chk('two openers present', ops.length >= 2, ops);
  for (const op of theme === 'light' ? ops : ops.slice(0, 1)) {
    const btn = p.locator('button[aria-controls="settings-panel"]').nth(op.i);
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    const s = await panelState(p);
    chk(`375 ${theme} opener "${op.label}": dialog + aria-modal + inert bg + focus in panel`, s.tag === 'DIV' && s.role === 'dialog' && s.modal === 'true' && s.inert.length > 0 && s.focusInPanel, s);
    let escaped = [];
    for (let k = 0; k < 40; k++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement)))) escaped.push('Tab' + k); }
    for (let k = 0; k < 12; k++) { await p.keyboard.press('Shift+Tab'); if (!(await p.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement)))) escaped.push('ShiftTab' + k); }
    chk(`375 ${theme} "${op.label}": 40 Tab + 12 Shift+Tab stay in panel`, escaped.length === 0, escaped);
    if (theme === 'light' && op.i === 0) {
      const axe = await new AxeBuilder({ page: p }).analyze();
      fs.writeFileSync(`${OUT}/axe-375-sheet-${theme}.json`, JSON.stringify(axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.map((n) => n.target) })), null, 1));
      chk(`axe / 375 ${theme} sheet open: 0 violations (any impact)`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}:${v.impact}`));
      await p.screenshot({ path: `${OUT}/sheet-375-${theme}.png` });
    }
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    const after = await panelState(p);
    const back = await btn.evaluate((b) => b === document.activeElement);
    chk(`375 ${theme} "${op.label}": Escape closes, focus back on that opener, no inert left, role complementary`, after.hidden && back && after.inert.length === 0 && after.role === 'complementary' && after.modal === null, { after, back });
  }
  if (theme === 'dark') {
    const btn = p.locator('button[aria-controls="settings-panel"]').first();
    await btn.click(); await p.waitForTimeout(300);
    const axe = await new AxeBuilder({ page: p }).analyze();
    fs.writeFileSync(`${OUT}/axe-375-sheet-${theme}.json`, JSON.stringify(axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.map((n) => n.target) })), null, 1));
    chk(`axe / 375 ${theme} sheet open: 0 violations (any impact)`, axe.violations.length === 0, axe.violations.map((v) => `${v.id}:${v.impact}`));
    const dark = await p.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className);
    chk('dark theme actually applied', /dark/.test(dark), dark);
    await p.screenshot({ path: `${OUT}/sheet-375-${theme}.png` });
    // backdrop tap closes & returns focus
    await p.mouse.click(187, 60); await p.waitForTimeout(250);
    const s = await panelState(p);
    chk('375 dark: tap on covered page closes sheet, focus to opener', s.hidden && (await btn.evaluate((b) => b === document.activeElement)) && s.inert.length === 0, s);
  }
  await ctx.close();
}

// Resize while open + wide drawer regression
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.removeItem('settings-open'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(B + '/');
  await p.waitForTimeout(600);
  const btn = p.locator('header button[aria-controls="settings-panel"]').first();
  await btn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  let s = await panelState(p);
  chk('1280 drawer open: role complementary, no aria-modal, nothing inert, focus in panel', s.role === 'complementary' && s.modal === null && s.inert.length === 0 && s.focusInPanel, s);
  const landmark = await p.getByRole('complementary', { name: /settings/i }).count();
  chk('1280: complementary landmark named "Art settings"', landmark === 1, landmark);
  // Tab out of drawer allowed (non-modal)
  let left = false;
  for (let k = 0; k < 40 && !left; k++) { await p.keyboard.press('Tab'); left = !(await p.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement))); }
  chk('1280: Tab can leave the non-modal drawer', left, null);
  await p.mouse.click(200, 400); await p.waitForTimeout(250);
  s = await panelState(p);
  chk('1280: background click keeps drawer open', !s.hidden, s);
  await p.screenshot({ path: `${OUT}/drawer-1280.png` });
  // resize wide -> narrow while open
  await p.setViewportSize({ width: 375, height: 812 }); await p.waitForTimeout(400);
  s = await panelState(p);
  chk('resize 1280→375 open: dialog + aria-modal + inert + focus moved into panel', s.role === 'dialog' && s.modal === 'true' && s.inert.length > 0 && s.focusInPanel, s);
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  chk('after resize: Tab stays in panel', await p.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement)), null);
  // narrow -> wide while open
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(400);
  s = await panelState(p);
  chk('resize 375→1280 open: complementary, no aria-modal, nothing inert, still open', s.role === 'complementary' && s.modal === null && s.inert.length === 0 && !s.hidden, s);
  const axe = await new AxeBuilder({ page: p }).analyze();
  chk('axe / 1280 drawer open: 0 violations', axe.violations.length === 0, axe.violations.map((v) => `${v.id}:${v.impact}`));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  s = await panelState(p);
  chk('1280 Escape closes, focus back to header opener', s.hidden && (await btn.evaluate((b) => b === document.activeElement)), s);
  // remembered open restores beside the art on wide; starts closed on narrow
  await p.reload(); await p.waitForTimeout(500);
  s = await panelState(p);
  chk('1280 closed state remembered after reload (closed)', s.hidden, s);
  await ctx.close();
}
await browser.close();
for (const c of res.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  ' + JSON.stringify(c.detail)}`);
console.log(res.ok ? 'ALL PASS' : 'SOME FAIL');
fs.writeFileSync(`${OUT}/settings-probes.json`, JSON.stringify(res, null, 1));
