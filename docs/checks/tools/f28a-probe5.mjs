// F28a probe 5: sanity-run the guard/test snippets from plans 03, 11, 12 against the current build.
import { chromium } from '@playwright/test';
import { BASE, log, saveResults } from './f28a-lib.mjs';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

// plan 03 scan (expected to FAIL today: lists ungated rules)
await page.goto(BASE + '/');
log(
  'plan03-ungated-hover-today',
  await page.evaluate(() => {
    const bad = [];
    const walk = (rules, gated) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSMediaRule) {
          const c = r.conditionText.replace(/\s+/g, ' ');
          walk(r.cssRules, gated || (c.includes('hover: hover') && c.includes('pointer: fine')));
        } else if (r instanceof CSSStyleRule) {
          if (r.selectorText.includes(':hover') && !gated) bad.push(r.selectorText);
          if (r.cssRules?.length) walk(r.cssRules, gated);
        } else if ('cssRules' in r) walk(r.cssRules, gated);
      }
    };
    for (const s of Array.from(document.styleSheets)) {
      try { walk(s.cssRules, false); } catch {}
    }
    return bad;
  }),
);

// plan 11 garden guard (expected to PASS today)
await page.goto(BASE + '/garden/');
await page.waitForTimeout(300);
log(
  'plan11-garden-guard',
  await page.evaluate(() => {
    const rows = () => Array.from(document.querySelectorAll('.garden-list > li')).filter((li) => !li.hidden).length;
    const before = rows();
    const chip = Array.from(document.querySelectorAll('a.chip')).find((c) => c.getAttribute('aria-current') !== 'true' && !/all/i.test(c.textContent ?? ''));
    chip.click();
    const after = rows();
    return { chip: chip.textContent.trim(), before, after, anims: document.querySelector('.garden-list').getAnimations({ subtree: true }).length };
  }),
);

// plan 12 explorer guard (expected to PASS today)
await page.goto(BASE + '/rising-water/');
await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 60000 });
log(
  'plan12-explorer-guard',
  await page.evaluate(() => {
    const sel = ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]', '[data-ex-level-out]', '[data-ex-minp-out]', '[data-ex-topn-out]'];
    const before = sel.map((s) => document.querySelector(s).textContent);
    const level = document.querySelector('#ex-level');
    for (let i = 0; i < 10; i++) {
      level.value = String(200 + i * 40);
      level.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const topn = document.querySelector('#ex-topn');
    topn.value = String(Number(topn.value) + 10);
    topn.dispatchEvent(new Event('input', { bubbles: true }));
    const after = sel.map((s) => document.querySelector(s).textContent);
    return {
      changed: after.filter((t, i) => t !== before[i]).length,
      anims: sel.flatMap((s) => document.querySelector(s).getAnimations({ subtree: true })).length,
      custom: sel.filter((s) => document.querySelector(s).querySelector('*:not(span)')).length,
    };
  }),
);
// plan 07 check text (expected FAIL today)
await page.goto(BASE + '/404');
log('plan07-svh-today', await page.evaluate(() => Array.from(document.styleSheets).some((s) => { try { return Array.from(s.cssRules).some((r) => r instanceof CSSStyleRule && r.selectorText === 'body' && r.cssText.includes('100svh')); } catch { return false; } })));
log('plan07-body-rules', await page.evaluate(() => Array.from(document.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules).filter((r) => r instanceof CSSStyleRule && r.selectorText === 'body').map((r) => r.cssText.slice(0, 120)); } catch { return []; } })));
saveResults('probe5');
await browser.close();
