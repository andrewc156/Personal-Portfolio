// F10 checker tool: (a) how often the hidden summary and canvas aria-label change during 4 s of
// play per mode (must not be per frame); (b) keyboard: Space / N / Enter per mode, Enter must not
// act in rivers/collatz; (c) reduced-motion static frames (screenshots); (d) CLS when loading
// /?mode=<id> directly.
// usage: node docs/checks/tools/f10-a11y-probe.mjs http://localhost:4321 docs/checks/F10/attempt-1
import { chromium } from '@playwright/test';

const [base, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const mode of ['dye', 'pond', 'rivers', 'collatz']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${base}/?seed=42&mode=${mode}`);
  await page.waitForFunction(() => document.querySelector('[data-hero]')?.__heroMode);
  const r = await page.evaluate(async () => {
    const root = document.querySelector('[data-hero]');
    const sum = root.querySelector('[data-hero-summary]');
    const map = root.querySelector('[data-hero-map]');
    let s = 0;
    let l = 0;
    const mo = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'attributes') l++;
        else s++;
      }
    });
    mo.observe(sum, { childList: true, characterData: true, subtree: true });
    mo.observe(map, { attributes: true, attributeFilter: ['aria-label'] });
    const f0 = root.__heroMode.frames;
    await new Promise((res) => setTimeout(res, 4000));
    mo.disconnect();
    return { summaryChanges: s, labelChanges: l, frames: root.__heroMode.frames - f0, cls: window.__cls };
  });
  // keyboard
  await page.locator('[data-hero]').focus();
  const k = await page.evaluate(() => {
    const a = document.querySelector('[data-hero]').__heroMode;
    return { pokes: a.pokes, seed: a.settings.seed, playing: a.playing };
  });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  const k2 = await page.evaluate(() => {
    const a = document.querySelector('[data-hero]').__heroMode;
    return { pokes: a.pokes, playing: a.playing, sum: document.querySelector('[data-hero-summary]').textContent };
  });
  await page.keyboard.press('n');
  const k3 = await page.evaluate(() => document.querySelector('[data-hero]').__heroMode.settings.seed);
  console.log(
    mode,
    JSON.stringify(r),
    `| Enter pokes ${k.pokes}→${k2.pokes} | Space playing ${k.playing}→${k2.playing} | N seed ${k.seed}→${k3}`,
  );
  await page.close();
  // reduced motion static frame
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const p2 = await ctx.newPage();
  await p2.goto(`${base}/?seed=42&mode=${mode}`);
  await p2.waitForFunction(() => document.querySelector('[data-hero]')?.__heroMode);
  await p2.waitForTimeout(1500);
  const st = await p2.evaluate(() => {
    const r = document.querySelector('[data-hero]');
    return { state: r.dataset.state, running: r.dataset.running, frames: r.__heroMode.frames, btn: r.querySelector('[data-hero-play]').textContent.trim(), summary: r.querySelector('[data-hero-summary]').textContent };
  });
  console.log(`  reduced-motion ${mode}:`, JSON.stringify(st));
  await p2.locator('.hero__art').screenshot({ path: `${out}/rm-${mode}-1280-light.png` });
  await ctx.close();
}
await browser.close();
