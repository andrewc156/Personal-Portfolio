import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [feature, candidate] = process.argv.slice(2);
const base = 'http://localhost:4321';
const browser = await chromium.launch();
try {
  const p = await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});
  if (feature==='F19a') {
    for (const type of ['research','work']) for (const file of readdirSync(`${candidate}/src/content/${type}`)) {
      const f = `src/content/${type}/${file}`;
      const actual = parse(readFileSync(`${candidate}/${f}`, 'utf8'));
      const before = parse(execFileSync('git',['show',`HEAD:${f}`],{encoding:'utf8'}));
      assert((type==='work'?actual.description:actual.summary).length<=160);
      for(const key of ['summary','description']) { delete before[key]; delete actual[key]; }
      assert.deepEqual(actual,before,f);
    }
    const copy=parse(readFileSync(`${candidate}/src/data/copy.yaml`,'utf8'));
    assert.equal(Object.keys(copy).length,4);
    assert(Object.values(copy).every(x=>x.confirmed===false));
    for(const path of ['/','/about/','/garden/','/cv/','/research/','/research/number-theory/','/research/water-quality/','/research/spectral-fractals/','/rising-water/','/404.html']) {
      await p.goto(base+path);
      const prose=await p.locator('body').innerText();
      assert(!/TODO|TBD|lorem|placeholder/i.test(prose),path);
      assert.equal(await p.locator('[data-draft-badge]').count(),0);
      for(const name of ['Michael Liu','Yunus Kaya']) {
        const actual=await p.getByText(name,{exact:false}).evaluateAll((els,n)=>els.filter(e=>e.textContent.includes(n)&&![...e.children].some(c=>c.textContent.includes(n))).map(e=>e.outerHTML),name);
        for(const e of actual) { console.log('author rendering',path,name,e.slice(0,325)); assert(!e.includes('description')); }
      }
      if (path==='/garden/') {
        assert.match(await p.locator('.garden__lede').innerText(),/^Here's some of my work\./);
        assert.match(await p.locator('meta[name=description]').getAttribute('content'),/^Selected work/);
        assert(!/Michael Liu|Yunus Kaya/.test(await p.locator('main').innerText()));
      }
      if(path==='/about/') assert(prose.includes('selected work'));
      if(path==='/about/'||path==='/') assert(prose.includes("I'm interested in PhD programs and in mathematics and data science REUs."));
    }
    console.log('12 YAML records retain all nonprose fields; 10 production routes have no visible draft text/badges; copy scope verified');
  } else {
    await p.goto(base+'/?seed=42'); await p.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero);
    const state=()=>p.evaluate(()=>{const r=document.querySelector('[data-hero]'),h=r.__hero;return {progress:h.progress,row:h.highlightedRow,seed:r.dataset.seed};});
    const loc=await p.evaluate(()=>{const r=document.querySelector('[data-hero]'),h=r.__hero;h.setPlaying(false);h.scrubTo(h.startAt);const c=r.querySelector('[data-hero-map]').getBoundingClientRect();const {W,H}=h.grid;for(let i=0;i<W*H;i++){const k=h.lakeRowAt(i);if(k>=0)return {k,x:c.x+(i%W+.5)*c.width/W,y:c.y+(Math.floor(i/W)+.5)*c.height/H};}});
    assert(loc); await p.touchscreen.tap(loc.x,loc.y); await p.waitForTimeout(350); assert.equal((await state()).row,loc.k);
    console.log('tap pinned row',loc.k);
    const replay=await p.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;h.scrubTo(1);h.setPlaying(true);return h.progress;}); assert.equal(replay,0);
    const seed=(await state()).seed;
    await p.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;h.scrubTo(.99);h.setPlaying(true);});
    const next=await p.waitForFunction(s=>{const r=document.querySelector('[data-hero]');if(r.dataset.seed!==s)return {seed:r.dataset.seed,progress:r.__hero.progress};},seed,{timeout:15000});
    const loop=await next.jsonValue(); assert.equal(loop.progress,0); console.log('replay and next-seed progress',replay,loop);
    await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+'/?seed=25'); await p.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero);
    assert.equal((await state()).progress,.45); await p.waitForTimeout(350); assert.equal((await state()).progress,.45);
    await p.goto(base+'/rising-water/',{waitUntil:'networkidle'});
    const t=await p.locator('main').innerText();
    for(const n of ['bar does. With the basin mask on','pipeline/tda_ref.py. Repository','browser. Source']) assert(t.includes(n),n);
    const bytes=await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/data/colorado/')).reduce((sum,e)=>sum+e.transferSize,0));
    assert(bytes>0&&bytes<3e6);console.log('explorer whitespace 3/3; initial Colorado transfer',bytes);
  }
} finally { await browser.close(); }
