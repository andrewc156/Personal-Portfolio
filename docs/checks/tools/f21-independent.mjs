// Usage from the pristine, built archive (with preview on 4321): node /path/to/this.mjs [perf|paused|visual] [screenshots-dir]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import assert from 'node:assert/strict';
const req = createRequire(resolve('package.json'));
const { chromium, firefox, webkit } = req('playwright');
const gecko=process.env.F21_ALT_FIREFOX ? req(process.env.F21_ALT_FIREFOX).firefox : firefox;
const { AxeBuilder } = req('@axe-core/playwright');
const site = 'http://localhost:4321';
const gear = p => p.getByRole('button', { name: 'Animation settings', exact: true });
const slider = p => p.getByRole('slider', { name: 'Steps', exact: true });
const panel = p => p.locator('#settings-panel');
const simReady = (p,id) => p.waitForFunction(id => {const r=document.querySelector('[data-hero]');return r?.dataset.mode===id && !!(id==='rising'?r.__hero:r.__heroMode);},id);
const read = p => p.locator('[data-hero-readout]').textContent();
const summary = p => p.locator('[data-hero-summary]').textContent();
const lastDrawn = (p,d) => p.waitForFunction(d => document.querySelector('[data-hero]').__heroMode.sim.drawnLevels === d,d);
const pause = p => p.getByRole('button',{name:'Pause',exact:true}).first().click();
const bits = p => p.evaluate(() => {
  const s=document.querySelector('[data-hero]').__heroMode.sim;
  const c=document.querySelector('[data-hero-map]');
  const ctx=c.getContext('2d');
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  let hash=2166136261;for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619);
  return {hash,drawn:s.drawnLevels,depth:s.tree.maxDepth,width:c.width,height:c.height,dpr:c.width/c.getBoundingClientRect().width};
});
const pct = (arr,p) => +[...arr].sort((a,b)=>a-b)[Math.floor(p*(arr.length-1))]?.toFixed(2);
const stats = a => ({n:a.length,p50:pct(a,.5),p95:pct(a,.95),max:pct(a,1)});
const watch = p => {const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error') errors.push(m.text());});return errors;};
const browser = process.env.F21_BROWSERS==='firefox' && !['perf','paused'].includes(process.argv[2]) ? null : await chromium.launch();
try {
if(process.argv[2]==='paused') {
  for(const dpr of [1,2]) {
    const ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr});
    const p=await ctx.newPage(); const errors=watch(p);
    await p.goto(`${site}/?seed=42&mode=collatz`);await simReady(p,'collatz');
    await pause(p);await gear(p).click();await slider(p).press('Home');await lastDrawn(p,1);
    const before=await bits(p);
    await p.evaluate(()=>{
      const s=document.querySelector('[data-hero]').__heroMode.sim;
      const build=s.build,draw=s.draw;window.jumpData={};
      document.addEventListener('keydown',()=>{jumpData.start=performance.now();},{capture:true,once:true});
      s.build=function(...a){const t=performance.now();try{return build.apply(this,a);}finally{jumpData.build=performance.now()-t;}};
      s.draw=function(...a){const t=performance.now();try{return draw.apply(this,a);}finally{jumpData.draw=performance.now()-t;jumpData.untilSubmit=performance.now()-jumpData.start;const q=performance.now();a[0].getImageData(0,0,1,1);jumpData.flush=performance.now()-q;jumpData.untilFlush=performance.now()-jumpData.start;s.build=build;s.draw=draw;}};
    });
    await slider(p).press('End');await lastDrawn(p,120);
    const after=await bits(p);const jump=await p.evaluate(()=>window.jumpData);
    assert.ok(Number.isFinite(jump.untilFlush));assert.notEqual(before.hash,after.hash);
    assert.equal(await p.locator('[data-hero]').getAttribute('data-state'),'paused');
    assert.match(await summary(p),/Paused.*120 of 120 levels/);
    // Allow the shared ResizeObserver's 200 ms settle repaint after opening the drawer.
    await p.waitForTimeout(350);
    const frames=await p.evaluate(()=>document.querySelector('[data-hero]').__heroMode.frames);
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(()=>document.querySelector('[data-hero]').__heroMode.frames),frames);
    console.log('Standard-motion paused full jump',dpr,jump,after);
    assert.deepEqual(errors,[]);await ctx.close();
  }
} else if(process.argv[2]==='perf') {
  // Independent exact oracle, BigInt BFS and dedup by first appearance.
  let level=[1n]; const seen=new Set(level);const totals=[1];
  for(let i=1;i<=50;i++) {
    const next=[];
    for(const n of level) for(const x of [n*2n, (n-1n)/3n]) {
      if(x>0n && !seen.has(x) && ((x&1n)?3n*x+1n:x/2n)===n) {seen.add(x);next.push(x);}
    }
    level=next;totals.push(seen.size);
  }
  assert.equal(totals[50],379600);assert.equal(totals[1],2);
  console.log('Oracle', {total50:totals[50],lastLevel:level.length,max50:String(2n**50n),total1:totals[1]});
  for(const dpr of [1,2]) {
    const ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr,reducedMotion:'reduce'});
    const p=await ctx.newPage();const errors=watch(p);
    const blank=await p.evaluate(() => new Promise(resolve=>{
      const a=[];let previous;
      const f=t=>{if(previous!==undefined)a.push(t-previous);previous=t;if(a.length<160)requestAnimationFrame(f);else resolve(a);};requestAnimationFrame(f);
    }));
    await p.goto(`${site}/?seed=42&mode=collatz`);await simReady(p,'collatz');await lastDrawn(p,50);
    assert.match(await read(p),/^379,600 numbers within 50 steps of 1 · 3,217 drawn$/);
    const exact=await p.evaluate(() => {
      const s=document.querySelector('[data-hero]').__heroMode.sim, old=s.steps;
      const a=Array.from({length:51},(_,d)=>{s.steps=s.totalSteps*(d/50)**2+1e-6;return Number(s.readout().split(' ')[0].replaceAll(',',''));});s.steps=old;return a;
    });assert.deepEqual(exact,totals);
    await gear(p).click();
    await slider(p).press('Home');await lastDrawn(p,1);
    assert.equal(await read(p),'2 numbers within 1 step of 1');
    let prefix;
    for(const [index,depth] of [1,50,120,51].entries()) {
      if(index===1) {await slider(p).fill('50');await lastDrawn(p,50);}
      if(index===2) {
        await slider(p).press('Home');await lastDrawn(p,1);
        await p.evaluate(()=>{
          const s=document.querySelector('[data-hero]').__heroMode.sim;
          const build=s.build,draw=s.draw;window.jumpData={};
          document.addEventListener('keydown',()=>{jumpData.start=performance.now();},{capture:true,once:true});
          s.build=function(...a){const t=performance.now();try{return build.apply(this,a);}finally{jumpData.build=performance.now()-t;}};
          s.draw=function(...a){const t=performance.now();try{return draw.apply(this,a);}finally{jumpData.draw=performance.now()-t;jumpData.untilSubmit=performance.now()-jumpData.start;const q=performance.now();a[0].getImageData(0,0,1,1);jumpData.flush=performance.now()-q;jumpData.untilFlush=performance.now()-jumpData.start;s.build=build;s.draw=draw;}};
        });
        await slider(p).press('End');await lastDrawn(p,120);
        const jump=await p.evaluate(()=>window.jumpData);assert.ok(Number.isFinite(jump.untilFlush));
        assert.match(await summary(p),/9,937 sampled numbers, not a total\. 120 of 120 levels/);
        console.log('Reduced motion full jump',dpr,jump,await bits(p));
      }
      if(index===3) {await slider(p).fill('51');await lastDrawn(p,51);assert.equal(await read(p),'Sampled branches · 51 steps');}
      const tree=await p.evaluate(()=>{const {tree:t}=document.querySelector('[data-hero]').__heroMode.sim;return {n:t.count,v:t.value.map(String),p:[...t.parent],d:[...t.depth],ls:[...t.levelStart]};});
      const expected={1:2,50:3217,120:9937};if(depth in expected)assert.equal(tree.n,expected[depth]);
      assert.equal(new Set(tree.v).size,tree.n);assert.equal(tree.ls.length,depth+2);
      for(let i=1;i<tree.n;i++){const x=BigInt(tree.v[i]);assert.ok(tree.p[i]>=0 && tree.p[i]<i && tree.d[tree.p[i]]===tree.d[i]-1);assert.equal((x&1n)?3n*x+1n:x/2n,BigInt(tree.v[tree.p[i]]));}
      for(let d=0;d<=depth;d++){assert.equal(tree.v[tree.ls[d]],String(2n**BigInt(d)));assert.ok(tree.ls[d+1]-tree.ls[d]<=96);}
      if(depth===50)prefix=tree.v;if(depth===120)assert.deepEqual(tree.v.slice(0,prefix.length),prefix);
    }
    await p.keyboard.press('Escape');
    for(const depth of [50,120]) {
      await gear(p).click();await slider(p).fill(String(depth));await lastDrawn(p,depth);await p.keyboard.press('Escape');
      const result=await p.evaluate(async depth=>{
        const root=document.querySelector('[data-hero]');const ctl=root.__heroMode;const s=ctl.sim;
        const native=s.draw;const render=ctl.render;const rows=[];let latest;
        let previous,initial,intervals=[];
        s.draw=function(...args){const t=performance.now();native.apply(this,args);latest={draw:performance.now()-t,painted:this.drawnLevels,ticks:this.steps,limit:this.tree.maxDepth};};
        ctl.render=function(...args){const t=performance.now();render.apply(this,args);rows.push({...latest,render:performance.now()-t,t});};
        ctl.setPlaying(true);
        await new Promise((resolve,reject)=>{const sample=t=>{initial??=t;if(previous!==undefined)intervals.push({dt:t-previous,painted:s.drawnLevels,ticks:s.steps});previous=t;if(s.drawnLevels===depth)resolve();else if(t-initial>25_000)reject(new Error('did not draw last level'));else requestAnimationFrame(sample);};requestAnimationFrame(sample);});
        ctl.setPlaying(false);s.draw=native;ctl.render=render;
        return {rows,intervals,wall:previous-initial};
      },depth);
      const tail=result.rows.filter(r=>r.painted>=depth*.9);
      const tailI=result.intervals.filter(r=>r.painted>=depth*.9);
      const last=result.rows.at(-1);assert.equal(last.painted,depth);assert.equal(last.ticks,540);
      console.log('Replay',JSON.stringify({dpr,depth,blank:stats(blank),wall:result.wall,actual:{depth:last.painted,ticks:last.ticks},draw:stats(result.rows.map(r=>r.draw)),render:stats(result.rows.map(r=>r.render)),raf:stats(result.intervals.map(r=>r.dt)),tailDraw:stats(tail.map(r=>r.draw)),tailRender:stats(tail.map(r=>r.render)),tailRaf:stats(tailI.map(r=>r.dt)),lastDraw:last.draw}));
    }
    await gear(p).click();await slider(p).press('Home');await lastDrawn(p,1);await slider(p).press('End');await lastDrawn(p,120);
    assert.equal(await panel(p).locator('output[for="hero-collatz-steps"]').textContent(),'120');
    assert.equal((await bits(p)).drawn,120);
    assert.deepEqual(errors,[]);await ctx.close();
  }
} else {
  const out=process.argv[3];
  for(const bname of (process.env.F21_BROWSERS ?? 'chromium,firefox,webkit').split(',')){
    const b=bname==='chromium'?browser:await (bname==='firefox'?gecko:webkit).launch();
    const views=process.env.F21_NARROW ? [[320,740]] : [[375,812],[768,1024],[1280,800]];
    for(const [width,height] of views) for(const colorScheme of ['light','dark']){
      const opts={viewport:{width,height},isMobile:bname!=='firefox'&&width<=375,hasTouch:width<=375,deviceScaleFactor:width<=375?3:1,colorScheme,reducedMotion:'reduce'};
      const ctx=await b.newContext(opts);
      try {
      const p=await ctx.newPage();const errors=watch(p);const scripts=new Set(),third=new Set();p.on('request',r=>{if(r.resourceType()==='script') scripts.add(new URL(r.url()).pathname);if(!r.url().startsWith(`${site}/`)&&!r.url().startsWith('data:')) third.add(r.url());});
      await p.goto(`${site}/?seed=42`);await simReady(p,'rising');await p.waitForLoadState('networkidle');
      assert.ok(![...scripts].some(s=>/\/modes\./.test(s)));
      const eager=[...scripts];
      const mode=p.getByLabel('Animation',{exact:true});
      await mode.selectOption('collatz');await simReady(p,'collatz');await lastDrawn(p,50);
      const default50=await bits(p);assert.match(await read(p),/379,600.*3,217 drawn/);
      const readoutFits=()=>p.evaluate(()=>{const a=document.querySelector('[data-hero-readout]');return [document.documentElement.scrollWidth<=innerWidth,a.scrollWidth<=a.clientWidth,a.scrollHeight<=a.clientHeight];});
      assert.deepEqual(await readoutFits(),[true,true,true]);
      await gear(p).click();const steps=slider(p);assert.equal(await steps.inputValue(),'50');
      for(const [key,d] of [['Home',1],['End',120]]){await steps.press(key);await lastDrawn(p,d);assert.equal(await steps.inputValue(),String(d));}
      assert.equal(await read(p),'Sampled branches · 120 steps');assert.match(await summary(p),/9,937 sampled numbers, not a total\. 120 of 120 levels/);
      const max=await bits(p);assert.notEqual(default50.hash,max.hash);assert.ok(max.dpr<2.01);
      const fits=await p.evaluate(()=>{const a=document.querySelector('[data-hero-readout]'),i=document.querySelector('#hero-collatz-steps').getBoundingClientRect();return [document.documentElement.scrollWidth<=innerWidth,a.scrollWidth<=a.clientWidth,a.scrollHeight<=a.clientHeight,i.left>=0&&i.right<=innerWidth];});assert.deepEqual(fits,[true,true,true,true]);
      if(bname==='chromium') {
        if(out)await p.screenshot({path:`${out}/${width}-${colorScheme}-settings.png`});
        const axe=await new AxeBuilder({page:p}).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
      }
      await p.keyboard.press('Escape');await panel(p).waitFor({state:'hidden'});assert.equal(await gear(p).evaluate(x=>document.activeElement===x),true);
      if(bname==='chromium'&&out)await p.screenshot({path:`${out}/${width}-${colorScheme}.png`});
      await mode.selectOption('pond');await simReady(p,'pond');assert.ok(!(await steps.isVisible()));
      await mode.selectOption('collatz');await simReady(p,'collatz');await lastDrawn(p,120);
      await gear(p).click();assert.equal(await steps.inputValue(),'120');
      await panel(p).getByRole('button',{name:'New terrain',exact:true}).click();await lastDrawn(p,120);
      assert.equal(await steps.inputValue(),'120');assert.notEqual((await bits(p)).hash,max.hash);
      await steps.press('ArrowLeft');await lastDrawn(p,119);assert.equal(await steps.inputValue(),'119');
      await panel(p).getByRole('button',{name:'Reset',exact:true}).click();await simReady(p,'rising');assert.ok(!(await steps.isVisible()));
      await mode.selectOption('collatz');await simReady(p,'collatz');await lastDrawn(p,50);assert.equal(await steps.inputValue(),'50');
      assert.deepEqual(errors,[]);assert.deepEqual([...third],[]);
      console.log('Visual / control',bname,width,colorScheme,'PASS',JSON.stringify({eager,deferred:[...scripts].filter(s=>!eager.includes(s)),dpr:max.dpr}));
      }finally{await ctx.close();}
    }
    if(b!==browser) await b.close();
  }
}
} finally { await browser?.close(); }
