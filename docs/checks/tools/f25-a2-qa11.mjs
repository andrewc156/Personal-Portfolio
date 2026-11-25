// F25 attempt-2 checker: independent QA-11 repro (D01 steps), default + reduced motion,
// optional `scrollend` suppression, 1024/1280/1440. Also checks focus timing after Back.
// Usage: node docs/checks/tools/f25-a2-qa11.mjs [base]   env: RM=1 (reduce), NOSE=1 (swallow scrollend)
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const RM = !!process.env.RM;
const NOSE = !!process.env.NOSE;
const settle = (p) =>
  p.evaluate(
    () =>
      new Promise((res) => {
        let last = scrollY, s = 0;
        const t = () => { s = scrollY === last ? s + 1 : 0; last = scrollY; s >= 12 ? res() : requestAnimationFrame(t); };
        requestAnimationFrame(t);
      }),
  );
const state = (p) =>
  p.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    const off = a !== document.body && (r.bottom <= 0 || r.top >= innerHeight);
    return { url: location.pathname + location.hash, y: Math.round(scrollY), focus: a.tagName + ':' + (a.textContent || '').trim().slice(0, 28), top: Math.round(r.top), off };
  });
const browser = await chromium.launch();
let fails = 0;
for (const w of [1024, 1280, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: RM ? 'reduce' : 'no-preference' });
  if (NOSE) await ctx.addInitScript(() => {
    const swallow = (e) => e.stopImmediatePropagation();
    window.addEventListener('scrollend', swallow, true);
    document.addEventListener('scrollend', swallow, true);
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t, ...r) { if (t === 'scrollend') return; return orig.call(this, t, ...r); };
  });
  const p = await ctx.newPage();
  await p.goto(B + '/');
  const sb = await p.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  // Header nav "Research" via keyboard
  await p.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Research', exact: true }).focus();
  await p.keyboard.press('Enter');
  await settle(p);
  const fwdY = await p.evaluate(() => Math.round(scrollY));
  await p.keyboard.press('Tab');
  await settle(p);
  const onCard = await state(p);
  // Same-document Back, sample focus state over time
  await p.evaluate(() => {
    window.__trace = [];
    const t0 = performance.now();
    const s = () => { const a = document.activeElement; window.__trace.push([Math.round(performance.now() - t0), Math.round(scrollY), a === document.body ? 'BODY' : a.tagName]); if (performance.now() - t0 < 1600) requestAnimationFrame(s); };
    addEventListener('popstate', () => requestAnimationFrame(s), { once: true });
    history.back();
  });
  await p.waitForTimeout(1700);
  const trace = await p.evaluate(() => window.__trace);
  const landed = trace.find((r) => r[1] === 0);
  const bodyAt = trace.find((r) => r[2] === 'BODY');
  const after = await state(p);
  await p.keyboard.press('Tab');
  await settle(p);
  const tab = await state(p);
  // Full D01 path: Research -> article -> Back x2 (real nav to article page)
  await p.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Research', exact: true }).focus();
  await p.keyboard.press('Enter'); await settle(p);
  await p.keyboard.press('Tab'); await settle(p);
  await p.keyboard.press('Enter'); await p.waitForURL(/\/research\/[^#]+/);
  await p.goBack(); await settle(p);
  await p.goBack(); await p.waitForTimeout(1500);
  const d01 = await state(p);
  await p.keyboard.press('Tab'); await settle(p);
  const d01tab = await state(p);
  const ok = fwdY > 800 && onCard.focus.startsWith('A:') && !onCard.off && after.y === 0 && !after.off && tab.y < 200 && !tab.off && d01.y === 0 && !d01.off && d01tab.y < 200;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${w} rm=${RM} noScrollend=${NOSE} scroll-behavior=${sb}`);
  console.log('  ' + JSON.stringify({ fwdY, onCard, after, tab, landedAtMs: landed?.[0], bodyFocusAtMs: bodyAt?.[0], d01, d01tab }));
  await ctx.close();
}
await browser.close();
process.exitCode = fails ? 1 : 0;
