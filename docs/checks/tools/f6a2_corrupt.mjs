// F6 attempt-2 checker: corrupted-data probe. Four corruptions (a) low mantissa bit, (b) exponent byte
// of a top lake's pit, (c) truncation by 4 bytes, (d) barcode.json one bar's di changed (grid intact),
// plus the normal path. Counts rAF callbacks after the check, all painted pixels on both canvases,
// control disabled state, readouts, console errors, and static table/sections. Preview on :4321.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.argv[2] || 'docs/checks/F6/attempt-2';
const log = []; let fails = 0; const ok = (c, m) => { if (!c) fails++; log.push(`${c ? 'OK  ' : 'FAIL'} ${m}`); };
const browser = await chromium.launch();
const grid = (fn) => ['**/data/colorado/grid.f32', async (route) => { const r = await route.fetch(); const b = Buffer.from(await r.body()); await route.fulfill({ response: r, body: fn(b) }); }];
const cases = [
  ['a low mantissa bit cell 70000', grid((b) => { b[4 * 70000] ^= 0x01; return b; })],
  ['b exponent byte of lake-3 pit 17991', grid((b) => { b[4 * 17991 + 3] ^= 0x40; return b; })],
  ['b2 exponent byte of rank-1 pit (from barcode.json)', null],
  ['c truncated by 4 bytes', grid((b) => b.subarray(0, b.length - 4))],
  ['d barcode.json bar 7 di changed', ['**/data/colorado/barcode.json', async (route) => { const r = await route.fetch(); const j = JSON.parse(await r.text()); j.di[7] = j.di[7] + 1; await route.fulfill({ response: r, body: JSON.stringify(j) }); }]],
  ['normal', null],
];
// rank-1 pit from file: largest finite persistence
const file = JSON.parse(fs.readFileSync('public/data/colorado/barcode.json', 'utf8'));
let best = -1, bk = -1; for (let k = 0; k < file.b.length; k++) if (file.d[k] !== null && file.d[k] - file.b[k] > best) { best = file.d[k] - file.b[k]; bk = k; }
const pit1 = file.bi[bk];
cases[2][1] = grid((b) => { b[4 * pit1 + 3] ^= 0x40; return b; });
cases[2][0] += ` cell ${pit1}`;
for (const theme of ['light']) for (const [label, rt] of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: theme });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e)));
  await page.addInitScript(() => { window.__raf = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { window.__raf++; return o(f); }; });
  if (rt) await page.route(rt[0], rt[1]);
  await page.goto('http://localhost:4321/rising-water/');
  await page.waitForFunction(() => { const r = document.querySelector('[data-explorer]'); return r && (r.dataset.ready === 'true' || ['false', 'error'].includes(r.dataset.match)); }, null, { timeout: 20000 });
  const raf0 = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(1500);
  // try interacting: click Play (force), press keys on stage, click a table button (force)
  if (label !== 'normal') {
    await page.locator('[data-ex-stage]').focus().catch(() => {});
    await page.keyboard.press('Space'); await page.keyboard.press('End');
    await page.locator('[data-lake-cell]').first().click({ force: true, timeout: 2000 }).catch(() => {});
    await page.locator('[data-ex-map]').hover({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const s = await page.evaluate(() => {
    const r = document.querySelector('[data-explorer]'); const st = r.querySelector('[data-ex-status]');
    const px = (c) => { if (!c || !c.width) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) a++; return a; };
    const ctrls = [...r.querySelectorAll('[data-ex-control]')].map((e) => e.disabled);
    const lakeBtns = [...document.querySelectorAll('[data-lake-cell]')].map((e) => e.disabled);
    const ro = ['level', 'level-alt', 'pct', 'lakes', 'area'].map((k) => r.querySelector(`[data-ro-${k}]`)?.textContent.trim());
    return { match: r.dataset.match, ready: r.dataset.ready, running: r.dataset.running, kind: st.dataset.kind, role: st.getAttribute('role'), live: st.getAttribute('aria-live'), text: st.textContent.trim(),
      vis: st.getBoundingClientRect().height > 0 && getComputedStyle(st).visibility !== 'hidden' && getComputedStyle(st).display !== 'none',
      hasEx: !!r.__explorer, mapPx: px(r.querySelector('[data-ex-map]')), stripPx: px(r.querySelector('[data-ex-strip]')),
      canvases: [...r.querySelectorAll('canvas')].map((c) => [c.getAttribute('class'), c.width, c.height, px(c)]),
      ctrlN: ctrls.length, ctrlDisabled: ctrls.filter(Boolean).length, lakeN: lakeBtns.length, lakeDisabled: lakeBtns.filter(Boolean).length,
      ro, levelOut: r.querySelector('[data-ex-level-out]')?.textContent.trim(), hover: r.querySelector('[data-ex-hover]')?.textContent.trim(), card: r.querySelector('[data-ex-card-text]')?.textContent.trim(), summary: r.querySelector('[data-ex-summary]')?.textContent.trim(),
      raf: window.__raf, tableRows: document.querySelectorAll('#lakes tbody tr').length, howto: document.querySelectorAll('#how-to-read li').length, about: (document.querySelector('#about-data, #about, [id*=about]')?.textContent || '').length,
      shadeLoaded: (() => { const i = r.querySelector('.ex-map__shade, img'); return i ? i.complete && i.naturalWidth : 0; })() };
  });
  log.push(`     [${label}] ${JSON.stringify({ ...s, raf0 })}`);
  log.push(`     [${label}] console.error (${errors.length}): ${errors.map((e) => e.slice(0, 220)).join(' || ')}`);
  if (label === 'normal') {
    ok(s.ready === 'true' && s.match === 'true' && s.hasEx && s.mapPx > 0 && s.ctrlDisabled === 0 && s.lakeDisabled === 0 && errors.length === 0 && !s.ro.includes('–'), `normal: ready, match, controller, map px ${s.mapPx}, controls enabled ${s.ctrlN}, readouts ${JSON.stringify(s.ro)}, 0 errors; status "${s.text}"`);
  } else {
    ok(s.kind === 'error' && s.role === 'status' && s.vis && errors.length === 1, `${label}: visible role=status error (aria-live ${s.live}) + exactly 1 console.error (${errors.length})`);
    ok(!s.hasEx && s.ready !== 'true', `${label}: no controller (hasEx=${s.hasEx}, ready=${s.ready})`);
    ok(s.canvases.every((c) => c[3] <= 0), `${label}: 0 painted pixels on every explorer canvas ${JSON.stringify(s.canvases)}`);
    ok(s.ctrlN > 0 && s.ctrlDisabled === s.ctrlN && s.lakeDisabled === s.lakeN, `${label}: controls disabled ${s.ctrlDisabled}/${s.ctrlN}, table buttons disabled ${s.lakeDisabled}/${s.lakeN}`);
    ok(s.ro.every((t) => t === '–' || t === '' ) && s.ro.filter((t) => t === '–').length >= 4 && /^–?$/.test(s.levelOut ?? '–'), `${label}: readouts ${JSON.stringify(s.ro)}, level out "${s.levelOut}"`);
    ok(s.raf === raf0, `${label}: no rAF callbacks requested after the check (${raf0} → ${s.raf})`);
    ok(s.tableRows === 20 && s.howto >= 9 && s.about > 200, `${label}: static table ${s.tableRows} rows, how-to ${s.howto} items, about ${s.about} chars`);
  }
  await page.screenshot({ path: `${OUT}/corrupt-${label.split(' ')[0]}-1280-${theme}.png`, fullPage: false });
  await ctx.close();
}
await browser.close();
log.push(`fails ${fails}`);
fs.writeFileSync(`${OUT}/corrupt.txt`, log.join('\n') + '\n');
console.log(log.join('\n'));
