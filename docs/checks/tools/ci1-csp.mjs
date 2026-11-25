// CI1 checker: load / at 412px from wrangler pages dev, collect console errors + CSP violations,
// and confirm the inline focusin script actually executes under the CSP (Tab to "CV" reveals it).
import { chromium } from '@playwright/test';
const base = process.argv[2];
const b = await chromium.launch();
for (const width of [412, 375, 320]) {
  const ctx = await b.newContext({ viewport: { width, height: 800 } });
  const p = await ctx.newPage();
  const msgs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await p.addInitScript(() => { window.__v = []; document.addEventListener('securitypolicyviolation', (e) => window.__v.push(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sample)); });
  const res = await p.goto(base + '/'); await p.waitForLoadState('load'); await p.waitForTimeout(800);
  const csp = res.headers()['content-security-policy'] || '';
  await p.locator('.wordmark').focus();
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  const st = await p.evaluate(() => { const a = document.activeElement, u = a.closest('ul'); const b = u.getBoundingClientRect(), r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), scrollLeft: u.scrollLeft, fully: r.left - 4 >= b.left - 0.5 && r.right + 4 <= b.right + 0.5 }; });
  console.log(JSON.stringify({ width, cspHasScriptSrc: /script-src 'self' 'sha256-/.test(csp), violations: await p.evaluate(() => window.__v), console: msgs, focusedCV: st }));
  await ctx.close();
}
await b.close();
