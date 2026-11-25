import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [base, out] = process.argv.slice(2);
const all = JSON.parse(readFileSync(`${out}/independent-h0.json`)).all.filter(([birth, death]) => death === null || death > birth);
const meta = JSON.parse(readFileSync('public/data/colorado/meta.json', 'utf8'));
const maskData = JSON.parse(readFileSync('public/data/colorado/basin-mask.json', 'utf8'));
const heights = readFileSync('public/data/colorado/grid.f32');
const bytes = readFileSync('public/data/colorado/basin-mask.bin');
const size = maskData.grid.cells;
const planeBytes = Math.ceil(size / 8);
const cellValues = Array.from({ length: size }, (_, i) => {
  const bit = 2 ** (i % 8);
  const at = Math.floor(i / 8);
  if ((bytes[at] & bit) === 0) return 0;
  return (bytes[planeBytes + at] & bit) === 0 ? 14 : 15;
});

const browser = await chromium.launch();
const ready = (page) => page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
const waitStatus = (page, status) => page.waitForFunction((x) => document.querySelector('[data-ex-basin-status]')?.dataset.kind === x, status);
const url = `${base}/rising-water/`;
const modes = [[375, 812], [768, 1024], [1280, 800]];

try {
  for (const [width, height] of modes) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const own = new Set();
      const external = [];
      let transfer = 0;
      page.on('request', (request) => {
        const u = new URL(request.url());
        if (u.origin !== base) external.push(u.href);
        else own.add(u.pathname);
      });
      cdp.on('Network.loadingFinished', (event) => { transfer += event.encodedDataLength; });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(url);
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      assert.equal([...own].filter((p) => /basin-mask/.test(p)).length, 0);
      const offTransfer = transfer;
      const box = page.getByRole('checkbox', { name: 'Basin mask' });
      assert.equal(await box.isChecked(), false);

      const browserState = () => page.evaluate(() => {
        const explorer = document.querySelector('[data-explorer]').__explorer;
        return {
          bars: explorer.result.bars.map((bar) => [
            bar.birth, Number.isFinite(bar.death) ? bar.death : null, bar.birthCell, bar.deathCell, bar.mergedInto,
          ]),
          rows: [...document.querySelectorAll('[data-basin-cell]')].map((e) => ({
            cell: Number(e.getAttribute('data-basin-cell')),
            text: e.textContent.trim().replace(/\u00a0/g, ' '),
            hidden: e.hidden,
          })),
          shows: explorer.basinShown,
          maxOverflow: document.documentElement.scrollWidth - innerWidth,
          stamp: explorer.basinBuildMs,
        };
      });
      const off = await browserState();
      assert.deepEqual(off.bars, all);
      assert.equal(off.shows, false);
      assert(off.rows.length > 0 && off.rows.every((r) => r.hidden));
      await box.focus();
      await page.keyboard.press('Space');
      await waitStatus(page, 'ok');
      await page.evaluate(async () => {
        const explorer = document.querySelector('[data-explorer]').__explorer;
        explorer.scrubTo(0.52);
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      });
      const on = await browserState();
      assert.deepEqual(on.bars, off.bars);
      assert.deepEqual(on.rows.map((r) => r.cell), off.rows.map((r) => r.cell));
      assert(on.shows);
      for (const { cell, text, hidden } of on.rows) {
        assert.equal(hidden, false);
        assert.equal(text, cellValues[cell] ? `yes (region ${cellValues[cell]})` : 'no');
      }
      assert.equal(on.maxOverflow, 0);

      const pageText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const oneLine = (s) => s.replace(/\s+/g, ' ');
      assert(pageText.includes(oneLine(maskData.attribution.credit)));
      assert(pageText.includes(oneLine(maskData.attribution.publicDomain)));
      assert(pageText.includes('INEGI'));
      for (const note of maskData.coverage) assert(pageText.includes(oneLine(note)));
      const js = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter((r) => /\.js([?#]|$)/.test(r.name)).map((r) => new URL(r.name).pathname));
      console.log(JSON.stringify({width, theme, offTransfer, onTransfer: transfer, rows: on.rows.length,
        bars: all.length, basinBuildMs: on.stamp, js: [...new Set(js)], external, errors}));
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      assert(transfer < 3_000_000);
      const map = page.locator('[data-ex-map]');
      const lens = await map.boundingBox();
      assert(Math.abs(lens.width / lens.height / meta.derived.displayAspect - 1) < 0.01);
      await page.screenshot({ path: `${out}/on-${width}-${theme}.png`, fullPage: true });
      await box.focus();
      await page.keyboard.press('Space');
      await waitStatus(page, 'idle');
      assert.equal(await box.isChecked(), false);
      assert.equal(await page.evaluate(() => location.hash), '');
      assert.deepEqual((await browserState()).bars, off.bars);
      await context.close();
    }
  }

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  await page.goto(url);
  await ready(page);
  await page.getByRole('checkbox', { name: 'Basin mask' }).check();
  await waitStatus(page, 'ok');
  await page.locator('[data-ex-map]').scrollIntoViewIfNeeded();
  const perf = await page.evaluate(async () => {
    const explorer = document.querySelector('[data-explorer]').__explorer;
    explorer.scrubTo(0.1);
    explorer.setPlaying(true);
    const ts = [];
    await new Promise((done) => {
      function frame(t) {
        ts.push(t);
        if (ts.length < 450) requestAnimationFrame(frame);
        else done();
      }
      requestAnimationFrame(frame);
    });
    const render = explorer.renderTimes();
    const endLevel = explorer.level;
    explorer.setPlaying(false);
    return { interval: ts.slice(1).map((t, i) => t - ts[i]), render, endLevel };
  });
  const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];
  assert(perf.render.length >= 300);
  assert(p95(perf.interval) < 22);
  assert(p95(perf.render) < 6);
  console.log(`Mask on playing: ${perf.interval.length} frame intervals, p95 ${p95(perf.interval).toFixed(2)} ms; ${perf.render.length} render samples, p95 ${p95(perf.render).toFixed(2)} ms`);
  await page.close();

  for (const reactivate of [false, true]) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    let release;
    let started;
    const held = new Promise((resolve) => { release = resolve; });
    const requested = new Promise((resolve) => { started = resolve; });
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('basin mask failed')) errors.push(message.text());
    });
    await page.route('**/basin-mask.json', async (route) => {
      started();
      await held;
      await route.fulfill({ status: 200, json: { ...maskData, label: 'tampered' } });
    }, { times: 1 });
    await page.goto(url);
    await ready(page);
    const box = page.getByRole('checkbox', { name: 'Basin mask' });
    await box.check();
    await requested;
    await box.uncheck();
    if (reactivate) await box.check();
    const response = page.waitForResponse((r) => r.url().endsWith('basin-mask.json'), { timeout: 8000 });
    release();
    await response;
    if (reactivate) {
      await waitStatus(page, 'error');
      assert.equal(errors.length, 1);
    } else {
      await page.waitForTimeout(500);
      assert.equal(errors.length, 0);
    }
    assert.equal(await box.isChecked(), false);
    await box.check();
    await waitStatus(page, 'ok');
    assert.equal(await box.isChecked(), true);
    console.log(`Delayed corrupt JSON, resume=${reactivate}: ${errors.length} reported failures, clean retry`);
    await page.close();
  }
  assert.equal(heights.length, size * 4);
} finally {
  await browser.close();
}
