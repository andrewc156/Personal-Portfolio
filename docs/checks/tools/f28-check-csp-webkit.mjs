// F28 check: why does the routed-CSP run stall in WebKit? Compare with/without the CSP header.
// Usage (preview on 4321): node docs/checks/tools/f28-check-csp-webkit.mjs <distDir>
import fs from 'node:fs';
import { webkit, chromium } from '@playwright/test';
const dist = process.argv[2] ?? 'dist';
const hdr = fs.readFileSync(`${dist}/_headers`, 'utf8');
const csp = hdr.split('\n').find((l) => /^\s*Content-Security-Policy:/i.test(l)).split(/:(.+)/)[1].trim().replace(/;\s*upgrade-insecure-requests/, ''); // http localhost: WebKit would upgrade to https
for (const [name, bt] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await bt.launch();
  for (const withCsp of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    if (withCsp)
      await ctx.route('**/*', async (route) => {
        const resp = await route.fetch();
        const headers = { ...resp.headers() };
        if ((headers['content-type'] ?? '').includes('text/html')) headers['content-security-policy'] = csp;
        return route.fulfill({ response: resp, headers });
      });
    for (const url of ['/', '/garden/', '/rising-water/', '/404.html']) {
      const page = await ctx.newPage();
      const msgs = [];
      page.on('console', (m) => msgs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
      page.on('pageerror', (e) => msgs.push(`pageerror: ${String(e).slice(0, 160)}`));
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${(e.sample || '').slice(0, 60)}`));
      });
      await page.goto('http://localhost:4321' + url);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({
        gearEnabled: document.querySelector('[data-settings-toggle]') ? !document.querySelector('[data-settings-toggle]').disabled : null,
        themeEnabled: !document.querySelector('[data-theme-toggle]')?.disabled,
        csp: window.__csp,
      }));
      if (r.gearEnabled) {
        await page.locator('[data-settings-toggle]').click();
        await page.locator('[data-theme-toggle]').click();
        await page.waitForTimeout(300);
        await page.locator('[data-theme-toggle]').click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        r.cspAfter = await page.evaluate(() => window.__csp);
      }
      console.log(name, withCsp ? 'CSP' : 'noCSP', url, JSON.stringify(r), JSON.stringify(msgs.filter((m) => !/^(log|debug|info)/.test(m))));
      await page.close();
    }
    await ctx.close();
  }
  await b.close();
}
