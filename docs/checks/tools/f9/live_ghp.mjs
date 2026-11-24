// F9: read-only browser check of the live GitHub Pages test site.
import { chromium } from '@playwright/test';
const ORIGIN = 'https://andrewc156.github.io', BASE = ORIGIN + '/Personal-Portfolio';
const paths = ['/', '/garden/', '/research/', '/research/water-quality/', '/research/tda-rivernets/', '/research/number-theory/', '/research/spectral-fractals/', '/cv/', '/about/', '/rising-water/', '/no-such-page/'];
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
for (const p of paths) {
  const pg = await c.newPage(); const errs = [], third = [], failed = [];
  pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('request', (r) => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) third.push(r.url()); });
  pg.on('requestfailed', (r) => failed.push(r.url()));
  pg.on('response', (r) => { if (r.status() >= 400 && r.url() !== BASE + p) failed.push(`${r.status()} ${r.url()}`); });
  const resp = await pg.goto(BASE + p, { waitUntil: 'networkidle' });
  let extra = '';
  if (p === '/rising-water/') { await pg.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 20000 }).catch(() => {});
    extra = ' | ' + (await pg.locator('text=/of 600 bars/').first().textContent().catch(() => 'no verify text')); }
  if (p === '/') extra = ' | hero ' + (await pg.evaluate(() => { const c = document.querySelector('[data-hero-map]'); return c ? `${c.width}x${c.height}` : 'none'; }));
  const title = await pg.title();
  console.log(`${p} ${resp.status()} "${title}" errors=${errs.length}${errs.length ? ' ' + errs.join(' | ') : ''} third=${third.length} failed=${failed.length}${failed.length ? ' ' + failed.join(' ') : ''}${extra}`);
  await pg.close();
}
await b.close();
