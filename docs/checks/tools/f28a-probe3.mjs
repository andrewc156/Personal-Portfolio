// F28a probe 3: 768 tablet drawer, close is instant, reduced-motion sheet first frame.
import { chromium } from '@playwright/test';
import { BASE, log, saveResults, compose } from './f28a-lib.mjs';

const browser = await chromium.launch();
const shots = [];
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, colorScheme: scheme, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]')?.disabled);
  await page.click('[data-settings-toggle]');
  await page.waitForTimeout(400);
  log(`tablet-768-${scheme}`, await page.evaluate(() => ({ role: document.getElementById('settings-panel').getAttribute('role'), modal: document.documentElement.hasAttribute('data-settings-modal') })));
  shots.push({ t: `768 ${scheme} drawer open`, b64: (await page.screenshot()).toString('base64') });
  // close: two consecutive frames
  await page.evaluate(() => document.querySelector('[data-settings-close]').click());
  shots.push({ t: `768 ${scheme} +1 frame after close`, b64: (await page.screenshot()).toString('base64') });
  await ctx.close();
}
await compose(browser, 'tablet-768-drawer-open-close', shots, (s) => s.t);

// reduced motion: sheet at its first frame
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForFunction(() => !document.querySelector('[data-settings-toggle]')?.disabled);
  const s = await page.evaluate(() => {
    document.querySelector('[data-settings-toggle]').click();
    const p = document.getElementById('settings-panel');
    return { op: getComputedStyle(p).opacity, tf: getComputedStyle(p).transform, anims: document.getAnimations().filter((a) => a.animationName).map((a) => [a.animationName, a.effect.getTiming().duration]) };
  });
  log('reduced-sheet-first-frame', s);
  const hero = await page.evaluate(() => document.querySelector('[data-hero]').dataset.state);
  log('reduced-hero-state', hero);
  await compose(browser, 'reduced-sheet-375', [{ t: 'reduced motion: sheet, first frame', b64: (await page.screenshot()).toString('base64') }], (x) => x.t);
  await ctx.close();
}
saveResults('probe3');
await browser.close();
