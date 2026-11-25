// F27 checker: does keyboard "Show" scroll the map into view? (playing vs paused, motion prefs)
import { chromium } from '@playwright/test';
const B = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
for (const variant of ['default', 'paused-first', 'reduced-motion', 'mouse-click']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  await p.goto(B + '/rising-water/');
  await p.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 25000 });
  const playing0 = await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.playing);
  if (variant === 'paused-first') await p.evaluate(() => document.querySelector('[data-explorer]').__explorer.setPlaying(false));
  const btn = p.getByRole('button', { name: 'Show lake 5 on the map', exact: true });
  await btn.focus(); await p.waitForTimeout(1500);
  const y0 = await p.evaluate(() => Math.round(scrollY));
  if (variant === 'mouse-click') await btn.click(); else await p.keyboard.press('Enter');
  const trace = [];
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(200); trace.push(await p.evaluate(() => [Math.round(scrollY), Math.round(document.querySelector('[data-ex-stage]').getBoundingClientRect().top), document.activeElement?.matches('[data-ex-stage]')])); }
  console.log(variant, JSON.stringify({ playing0, y0, trace: trace.filter((_, i) => i % 3 === 0 || i === 9) }));
  if (variant === 'default') await p.screenshot({ path: 'docs/checks/F27/attempt-1/qa06-default-after-enter-390.png' });
  await ctx.close();
}
await browser.close();
