// F28 check: does making the closing panel inert (the proposed fix) stop a fast Tab from
// landing in it? Simulates the fix in-page (MutationObserver mirrors `hidden` onto `inert`),
// without touching source. Usage (preview on 4321): node docs/checks/tools/f28-check-inert-fix.mjs
import { chromium, webkit } from '@playwright/test';
for (const [name, bt] of [['webkit', webkit], ['chromium', chromium]]) {
  const b = await bt.launch();
  for (const fix of [false, true]) {
    for (const [w, h] of [[1280, 800], [375, 812]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(w < 640 ? { hasTouch: true, isMobile: true } : {}) });
      const page = await ctx.newPage();
      await page.goto('http://localhost:4321/');
      await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]').disabled);
      if (fix)
        await page.evaluate(() => {
          const p = document.getElementById('settings-panel');
          // Same order a settings.ts fix would use: inert flips synchronously with hidden,
          // before setSettingsOpen moves focus into the panel.
          const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
          Object.defineProperty(p, 'hidden', {
            get() { return d.get.call(this); },
            set(v) { this.inert = !!v; d.set.call(this, v); },
          });
          p.inert = p.hidden;
        });
      const res = [];
      for (let i = 0; i < 3; i++) {
        await page.focus('[data-settings-toggle]');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(450);
        const openOk = await page.evaluate(() => document.getElementById('settings-panel').contains(document.activeElement));
        await page.keyboard.press('Escape');
        await page.keyboard.press('Tab');
        const r = await page.evaluate(() => {
          const p = document.getElementById('settings-panel');
          const a = document.activeElement;
          return { focus: a.id || a.getAttribute('aria-label') || a.tagName, inLeavingPanel: p.contains(a), stillRendered: getComputedStyle(p).display !== 'none' };
        });
        await page.waitForTimeout(400);
        const later = await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName);
        res.push({ openFocusInside: openOk, ...r, after400ms: later });
        await page.evaluate(() => document.activeElement.blur());
      }
      console.log(name, fix ? 'WITH inert fix' : 'as built', w, JSON.stringify(res));
      await ctx.close();
    }
  }
  await b.close();
}
