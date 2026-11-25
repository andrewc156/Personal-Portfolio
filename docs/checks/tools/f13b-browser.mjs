import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const [base, out] = process.argv.slice(2);
const data = (name) => JSON.parse(readFileSync(`public/data/colorado/${name}.json`, 'utf8'));
const dataset = data('labels');
const places = new Map(dataset.labels.map((place) => [place.id, place]));
const meta = data('meta');
const [west, south, east, north] = meta.native.extent;
const h0 = JSON.parse(readFileSync(`${out}/independent-h0.json`)).all.filter(([b, d]) => d === null || d > b);
const basin = readFileSync('public/data/colorado/basin-mask.bin');
const plane = Math.ceil(meta.cells / 8);
const expectedMarker = (cell) => {
  const byte = Math.floor(cell / 8);
  const bit = 2 ** (cell % 8);
  return basin[byte] & bit ? `yes (region ${basin[byte + plane] & bit ? 15 : 14})` : 'no';
};
const route = `${base}/rising-water/`;
const browser = await chromium.launch();
const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(0.95 * values.length) - 1];

async function geometry(page) {
  return page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const map = document.querySelector('[data-ex-map]').getBoundingClientRect();
    const svg = document.querySelector('[data-ex-place-layer]');
    const bounds = svg.getBoundingClientRect();
    const root = document.querySelector('[data-explorer]');
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      pointerEvents: getComputedStyle(svg).pointerEvents,
      rect: [bounds.x, bounds.y, bounds.width, bounds.height],
      map: [map.x, map.y, map.width, map.height],
      labels: [...svg.querySelectorAll('g[data-placed]')].map((group) => {
        const backgroundNode = group.querySelector('rect');
        const rect = backgroundNode.getBoundingClientRect();
        const matrix = backgroundNode.getScreenCTM();
        const r = new DOMRect(
          (rect.x - matrix.e) / matrix.a, (rect.y - matrix.f) / matrix.d,
          rect.width / matrix.a, rect.height / matrix.d,
        );
        const t = group.querySelector('text');
        const textBox = t.getBBox();
        const c = group.querySelector('circle');
        return {
          id: +group.dataset.placeId,
          x: c.cx.baseVal.value,
          y: c.cy.baseVal.value,
          box: [r.x, r.y, r.x + r.width, r.y + r.height],
          text: t.textContent,
          textBox: [textBox.x, textBox.y, textBox.x + textBox.width, textBox.y + textBox.height],
          color: getComputedStyle(t).fill,
          background: getComputedStyle(backgroundNode).fill,
          rectAttrs: ['x', 'y', 'width', 'height'].map((key) => backgroundNode.getAttribute(key)),
        };
      }),
      bars: root.__explorer.result.bars.map((bar) => [
        bar.birth, Number.isFinite(bar.death) ? bar.death : null, bar.birthCell, bar.deathCell, bar.mergedInto,
      ]),
      markers: [...document.querySelectorAll('[data-basin-cell]')].map((cell) => ({
        index: +cell.dataset.basinCell,
        visible: !cell.hidden,
        text: cell.textContent.trim().replace(/\s+/g, ' '),
      })),
    };
  });
}

function luma(rgb) {
  return rgb.match(/\d+/g).slice(0, 3).map(Number)
    .map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
}
function verify(g, maskOn) {
  assert.equal(g.pageWidth, g.viewport);
  assert.deepEqual(g.rect, g.map);
  assert.equal(g.pointerEvents, 'none');
  assert.deepEqual(g.bars, h0);
  assert.equal(g.markers.length, 21);
  for (const marker of g.markers) {
    assert.equal(marker.visible, maskOn);
    if (maskOn) assert.equal(marker.text, expectedMarker(marker.index));
  }
  const ids = new Set(g.labels.map((label) => label.id));
  assert.equal(ids.size, g.labels.length);
  for (const row of places.values()) if (row.priority === 1) assert(ids.has(row.id), row.name);
  let contrast = Infinity;
  const [, , width, height] = g.map;
  for (const [index, label] of g.labels.entries()) {
    const place = places.get(label.id);
    assert(place);
    assert.equal(label.text, place.display ?? place.name);
    assert(Math.abs(label.x - (place.lon - west) / (east - west) * width) < 0.001, label.text);
    assert(Math.abs(label.y - (north - place.lat) / (north - south) * height) < 0.001, label.text);
    const [left, top, right, bottom] = label.box;
    assert(left >= 0 && top >= 0 && right <= width && bottom <= height, JSON.stringify(label));
    const [tl, tt, tr, tb] = label.textBox;
    assert(tl >= left - 0.1 && tt >= top - 0.1 && tr <= right + 0.1 && tb <= bottom + 0.1, JSON.stringify(label));
    for (const other of g.labels.slice(index + 1)) {
      const [l, t, r, b] = other.box;
      assert(!(left < r && l < right && top < b && t < bottom), `${label.text}/${other.text}`);
    }
    const fs = [luma(label.color), luma(label.background)].sort((a, b) => b - a);
    contrast = Math.min(contrast, (fs[0] + 0.05) / (fs[1] + 0.05));
  }
  assert(contrast >= 4.5);
  return contrast;
}

const placement = ({ labels }) => labels.map(({ id, rectAttrs }) => [id, rectAttrs]);

async function source(page) {
  const about = page.locator('#place-labels-source');
  assert.equal((await about.locator('[data-place-credit]').innerText()).trim(), dataset.attribution.credit);
  assert.equal(await about.getByRole('link', { name: 'GNIS Domestic Names data' }).getAttribute('href'), dataset.source.page);
  assert.equal(await about.getByRole('link', { name: 'USGS FAQ on GNIS coordinates' }).getAttribute('href'),
    'https://www.usgs.gov/us-board-on-geographic-names/what-geographic-names-information-system-gnis');
  await about.getByText(`All ${places.size} places and coordinates`).click();
  const values = (await about.locator('[data-place-list] li').allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
  assert.deepEqual(values, dataset.labels.map((p) =>
    `${p.display ?? p.name}${p.anchor === 'mouth' ? ' (mouth)' : ''} · ${p.lat}, ${p.lon}`));
}

try {
  for (const [width, height] of [[375, 812], [768, 1024], [1280, 800]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const requests = [];
      const errors = [];
      let transfer = 0;
      page.on('request', (r) => requests.push(r.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      cdp.on('Network.loadingFinished', (event) => { transfer += event.encodedDataLength; });
      await page.goto(route);
      await page.waitForFunction(() => document.querySelector('[data-explorer]')?.dataset.ready === 'true');
      const box = page.getByRole('checkbox', { name: 'Place labels' });
      const svg = page.locator('[data-ex-place-layer]');
      const map = page.locator('.ex-map');
      assert.equal(await box.isChecked(), false);
      assert.equal(await svg.isVisible(), false);
      const offBytes = transfer;
      await box.focus();
      await page.keyboard.press('Space');
      await page.locator('[data-ex-place-status]').filter({ hasText: /place labels shown/ }).waitFor();
      const offMask = await geometry(page);
      await page.screenshot({ fullPage: true, path: `${out}/labels-${width}-${theme}.png` });
      const contrast = verify(offMask, false);
      const mask = page.getByRole('checkbox', { name: 'Basin mask' });
      await mask.check();
      await page.waitForFunction(() => document.querySelector('[data-ex-basin-status]')?.dataset.kind === 'ok');
      const onMask = await geometry(page);
      verify(onMask, true);
      assert.deepEqual(placement(onMask), placement(offMask));
      await map.screenshot({ path: `${out}/labels-mask-${width}-${theme}.png` });
      const axe = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id), []);
      await page.setViewportSize({ width: width === 375 ? 768 : 375, height });
      await page.waitForFunction((w) => Math.abs(document.querySelector('[data-ex-place-layer]').getBoundingClientRect().width - w) > 1, onMask.rect[2]);
      await page.setViewportSize({ width, height });
      await page.waitForFunction((w) => Math.abs(document.querySelector('[data-ex-place-layer]').getBoundingClientRect().width - w) < 0.01, onMask.rect[2]);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const resized = await geometry(page);
      verify(resized, true);
      assert.deepEqual(placement(resized), placement(onMask));
      assert.equal(await svg.getAttribute('aria-hidden'), 'true');

      if (width === 1280 && theme === 'light') {
        await map.scrollIntoViewIfNeeded();
        const run = await page.evaluate(async () => {
          const root = document.querySelector('[data-explorer]');
          const svg = root.querySelector('[data-ex-place-layer]');
          let changes = 0;
          const observer = new MutationObserver((records) => { changes += records.length; });
          observer.observe(svg, { subtree: true, attributes: true });
          const explorer = root.__explorer;
          explorer.scrubTo(0.1);
          explorer.setPlaying(true);
          const times = [];
          await new Promise((done) => {
            function frame(t) {
              times.push(t);
              if (times.length === 320) done();
              else requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          });
          explorer.setPlaying(false);
          observer.disconnect();
          return { changes, intervals: times.slice(1).map((t, i) => t - times[i]), renders: explorer.renderTimes() };
        });
        assert.equal(run.changes, 0);
        assert(run.renders.length >= 200);
        assert(p95(run.intervals) <= 22 && p95(run.renders) <= 6);
        console.log(`animation ${run.intervals.length} intervals p95 ${p95(run.intervals).toFixed(2)} ms, ${run.renders.length} renders p95 ${p95(run.renders).toFixed(2)} ms, zero overlay mutations`);
      }
      await source(page);
      await box.uncheck();
      assert.equal(await svg.isVisible(), false);
      assert.equal(await mask.isChecked(), true);
      assert.deepEqual(errors, []);
      const urls = requests.map((r) => new URL(r));
      assert(urls.every((u) => u.origin === base && !u.pathname.endsWith('/labels.json')));
      assert(transfer < 3_000_000);
      const scripts = new Set(urls.filter((u) => u.pathname.endsWith('.js')).map((u) => u.pathname));
      const gzipBytes = [...scripts].reduce((sum, path) => sum + gzipSync(readFileSync(`dist${path}`)).length, 0);
      assert(gzipBytes < 120_000);
      console.log(JSON.stringify({ width, theme, labels: onMask.labels.length, priority1: dataset.labels.filter((p) => p.priority === 1).length,
        contrast: +contrast.toFixed(2), offBytes, onBytes: transfer, gzipBytes, runtimeOrigins: new Set(urls.map((u) => u.origin)).size }));
      await context.close();
    }
  }

  const plain = await browser.newContext({ javaScriptEnabled: false });
  const page = await plain.newPage();
  await page.goto(route);
  await source(page);
  await plain.close();
  console.log('All 39 named coordinate rows and links visible without JavaScript after opening native disclosure');
} finally {
  await browser.close();
}
