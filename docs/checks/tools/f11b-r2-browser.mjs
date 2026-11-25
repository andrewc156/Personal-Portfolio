import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { computeH1Islands } from '../../../src/lib/tda/h1.ts';
const browser = await chromium.launch();
const base = process.argv[2] ?? 'http://localhost:4321';
const out = resolve('docs/checks/F11b/attempt-2');
const copy = 'An island appears when rising water cuts a hill off from land connected to the edge of the grid. It disappears when its last dry cell goes underwater. Each bar spans those two water levels.';
try {
  const offline = await browser.newPage({ javaScriptEnabled:false, viewport:{width:375,height:812} });
  await offline.goto(base);
  assert.equal(await offline.locator('.hero__fallback').isVisible(),true);
  assert.equal(await offline.locator('[data-hero-islands-copy]').isVisible(),false);
  assert.match(await offline.locator('[data-hero-caption]').innerText(), /records each lake/);
  assert.equal(await offline.locator('[data-hero-caption-link] a').isVisible(), true);
  await offline.close();
  console.log('No-JavaScript home shows the static hero and keeps the islands explanation hidden.');
  for (const [width,height] of [[375,812],[768,1024],[1280,800]]) {
    for (const colorScheme of ['light','dark']) {
      const ctx = await browser.newContext({ viewport:{width,height}, colorScheme, reducedMotion:'reduce' });
      const page = await ctx.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
      page.on('request', r => requests.push(r.url()));
      await page.goto(`${base}/?seed=42`);
      await page.waitForFunction(() => document.querySelector('[data-hero]')?.__hero);
      await page.evaluate(() => document.fonts.ready);
      const hero = page.locator('[data-hero]');
      const strip = page.locator('[data-hero-strip]');
      const original = await strip.boundingBox();
      const caption = page.locator('[data-hero-caption]');
      const captionLink = page.locator('[data-hero-caption-link] a');
      const lakeCopy = await caption.innerText();
      assert.match(lakeCopy, /records each lake/);
      assert.match(await captionLink.getAttribute('href'), /rising-water/);
      assert(await captionLink.isVisible());
      assert.match(await strip.getAttribute('aria-label'), /^Barcode:/);
      assert.equal(await page.locator('[data-hero-islands-copy]').isVisible(), false);
      const startFrames = await hero.evaluate(el => el.__hero.frames);
      await page.waitForTimeout(300);
      assert.equal(await hero.evaluate(el => el.__hero.playing), false);
      assert((await hero.evaluate(el => el.__hero.frames)) - startFrames <= 2);
      await page.getByRole('button',{name:'Art settings',exact:true}).click();
      const panel = page.locator('#settings-panel');
      await panel.getByLabel('View',{exact:true}).selectOption('islands');
      assert.equal((await panel.locator('[data-hero-islands-copy]').innerText()).replace(/\s+/g,' ').trim(), copy);
      assert.equal((await strip.boundingBox()).height, original.height);
      assert.equal(await strip.getAttribute('aria-label'), 'Islands barcode');
      assert.equal(await strip.getAttribute('aria-describedby'), 'hero-islands-explainer');
      const settingsCopy = panel.locator('[data-hero-islands-copy]');
      await settingsCopy.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const helpBounds = await settingsCopy.boundingBox();
      assert(helpBounds && helpBounds.x >= 0 && helpBounds.x + helpBounds.width <= width);
      assert(helpBounds.y >= 0 && helpBounds.y + helpBounds.height <= height);
      await page.screenshot({path:`${out}/settings-${width}-${colorScheme}.png`});
      if (width === 375) {
        const result = await new AxeBuilder({page}).analyze();
        assert.deepEqual(result.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
      }
      await page.keyboard.press('Escape');
      assert.equal(await panel.isVisible(),false);
      assert.equal(await caption.innerText(), copy);
      assert(await caption.isVisible());
      assert(await captionLink.isVisible());
      assert.match(await captionLink.getAttribute('href'), /rising-water/);
      const capBounds = await caption.boundingBox();
      assert(capBounds.x >= 0 && capBounds.x + capBounds.width <= width);
      await hero.focus();
      await hero.press('End');
      const info = await hero.evaluate(async el => {
        const h = el.__hero;
        const c = el.querySelector('[data-hero-strip]').getContext('2d');
        const render = async (progress) => {
          const fills = [];
          const original = c.fillRect;
          c.fillRect = function (...args) { fills.push(args); return original.apply(this,args); };
          h.scrubTo(progress);
          await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
          c.fillRect = original;
          return { fills, level: h.level() };
        };
        return { W:h.grid.W,H:h.grid.H, heights:[...h.t.heights], settings:h.settings, rows:h.drawnIslandRows, layout:h.L, ext:[h.t.minH,h.t.maxH], painted:[await render(.72),await render(1)] };
      });
      const bars = computeH1Islands(Float32Array.from(info.heights),info.W,info.H).bars;
      const ordering = (a,b)=>a.birth-b.birth || a.saddleCell-b.saddleCell || a.peakCell-b.peakCell;
      const expected = bars.filter(r => r.death > r.birth && r.death-r.birth >= info.settings.minPersistence)
        .sort((a,b)=>(b.death-b.birth)-(a.death-a.birth) || ordering(a,b)).slice(0,info.settings.maxBars).sort(ordering);
      assert.deepEqual(info.rows,expected);
      const [lo,hi] = info.ext;
      const {left,right,top,bottom,dpr} = info.layout;
      const pitch = Math.min((bottom-top)/expected.length, 9*dpr);
      const thick = Math.max(dpr,pitch*.62);
      const x = height => left+(height-lo)/(hi-lo)*(right-left);
      for (const { level, fills } of info.painted) {
        const match = expected.flatMap(({birth,death},i) => {
          if (level < birth) return [];
          return [[x(birth),top+i*pitch+(pitch-thick)/2,x(Math.min(death,level))-x(birth),thick]];
        });
        assert.equal(fills.length,match.length);
        for (let i=0;i<match.length;i++) for(let j=0;j<4;j++) {
          assert(Math.abs(fills[i][j]-match[i][j])<1e-7, 'painted rectangle differs from independently projected interval');
        }
      }
      const middle = info.painted[0].level;
      const alive = bars.filter(r => r.birth <= middle && middle < r.death).length;
      const shown = expected.filter(r => r.birth <= middle).length;
      await hero.evaluate(el => el.__hero.scrubTo(.72));
      const summary = page.locator('[data-hero-summary]');
      await page.waitForFunction(({alive,shown,total}) => {
        const text = document.querySelector('[data-hero-summary]').textContent;
        return text.includes(alive === 1 ? '1 island is present.' : `${alive} islands are present.`) &&
          text.includes(`shows ${shown} of ${total} bars so far.`);
      }, {alive,shown,total:expected.length});
      assert((await summary.textContent()).includes('Paused'));
      await hero.press('End');
      await hero.press('ArrowDown');
      const readout = page.locator('[data-hero-readout]');
      assert.match(await readout.innerText(),/Island · appears at/);
      await hero.press('Escape');
      const box = await strip.boundingBox();
      await page.mouse.move(box.x + box.width/2, box.y + (top+pitch*.5)/dpr);
      assert.match(await readout.innerText(),/Island · appears at/);
      await page.locator('.hero__caption').screenshot({path:`${out}/caption-${width}-${colorScheme}.png`});
      await page.screenshot({path:`${out}/strip-${width}-${colorScheme}.png`,fullPage:true});
      if (width === 1280) {
        const result = await new AxeBuilder({page}).analyze();
        assert.deepEqual(result.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
      }
      const geometry = await page.evaluate(() => ({ viewport:innerWidth, document:document.documentElement.scrollWidth }));
      assert(geometry.document <= geometry.viewport);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests.filter(u => /^https?:/.test(u) && !u.startsWith(base + '/')),[]);
      console.log(JSON.stringify({width,colorScheme,bars:bars.length,displayed:expected.length,geometry}));
      if(width === 1280 && colorScheme === 'light'){
        await hero.press('Escape');
        await hero.press('Home');
        await hero.press('Space');
        const times = await page.evaluate(async () => {
          const controller = document.querySelector('[data-hero]').__hero;
          if (!controller.playing) throw Error('Islands play did not start');
          const times=[];
          await new Promise(done => {
            let prior = 0;
            function sample(now) {
              if (prior) times.push(now-prior);
              prior=now;
              if(times.length >= 300) done();
              else requestAnimationFrame(sample);
            }
            requestAnimationFrame(sample);
          });
          return times;
        });
        const p95 = times.sort((a,b)=>a-b)[Math.ceil(0.95*times.length)-1];
        assert(p95 <= 22, 'rAF p95 ' + p95);
        await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; scrollTo(0,document.body.scrollHeight); });
        await page.waitForFunction(() => !document.querySelector('[data-hero]').__hero.isRunning);
        const at = await hero.evaluate(el => el.__hero.frames);
        await page.waitForTimeout(400);
        assert.equal(await hero.evaluate(el => el.__hero.frames),at);
        console.log(JSON.stringify({ p95, frames:300, offscreen:'0 draws in 400 ms' }));
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
