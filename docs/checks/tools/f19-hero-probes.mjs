import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const b=await chromium.launch();
const root='http://localhost:4321';
try {
 for(const [w,h] of [[375,812],[768,1024],[1280,800]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  const p=await ctx.newPage(); const failures=[]; let min=Infinity;
  for(let seed=1;seed<=30;seed++){
   await p.goto(`${root}/?seed=${seed}`);
   await p.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero);
   const f=await p.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;return {start:h.startAt,lakes:h.lakeCount,frames:h.frames};}); min=Math.min(min,f.lakes); if(f.lakes<2) failures.push({seed,...f});
  }
  console.log('seed sweep',w,'n=30 min lakes',min,'fewer than two',JSON.stringify(failures));await ctx.close();
 }
 const repro=await b.newPage({viewport:{width:375,height:812}});await repro.goto(root+'/?seed=25');await repro.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero);
 const intervals=await repro.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;h.scrubTo(h.startAt);const {minH,maxH,result,heights}=h.t;const spans=result.bars.flatMap(b=>[b.birth,b.death]).filter(Number.isFinite).sort((a,b)=>a-b);const levels=spans.flatMap((x,i)=>[x,...(i===spans.length-1?[]:[(x+spans[i+1])/2])]);const opt=levels.map(L=>({L,p:(L-minH)/(maxH-minH),wet:[...heights].filter(x=>x<=L).length/heights.length,alive:result.bars.filter(b=>b.birth<=L && b.death>L).length,visible:result.bars.filter(b=>b.birth+15<=L && b.death>L).length}));return {frame:h.startAt,maxAtOrBelowP35Wet40:opt.filter(x=>x.p<=.35&&x.wet<=.4).sort((a,b)=>b.alive-a.alive)[0],bestWet40:opt.filter(x=>x.wet<=.4).sort((a,b)=>b.visible-a.visible)[0]};});
 console.log('seed 25 interval analysis',intervals);await repro.waitForTimeout(300);await repro.screenshot({path:'docs/checks/F19b/attempt-1/seed25-mobile-light.png'});await repro.close();
 const p=await b.newPage({viewport:{width:1280,height:800},hasTouch:true}); await p.goto(root+'/?seed=42');
 await p.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero);
 await p.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;h.setPlaying(false);h.scrubTo(h.startAt);});
 const pt=await p.evaluate(()=>{const r=document.querySelector('[data-hero]'),h=r.__hero,c=r.querySelector('[data-hero-map]').getBoundingClientRect();const {W,H}=h.grid;for(let i=0;i<W*H;i++){const k=h.lakeRowAt(i);if(k>=0)return {k,x:c.x+(i%W+.5)*c.width/W,y:c.y+(Math.floor(i/W)+.5)*c.height/H};}});
 assert(pt);await p.touchscreen.tap(pt.x,pt.y);
 const state=()=>p.evaluate(()=>{const r=document.querySelector('[data-hero]'),h=r.__hero;return {progress:h.progress,row:h.highlightedRow,seed:r.dataset.seed};});
 assert.equal((await state()).row,pt.k);await p.waitForTimeout(400);assert.equal((await state()).row,pt.k);console.log('touch pinned row',pt.k);
 const replay=await p.evaluate(()=>{const r=document.querySelector('[data-hero]'),h=r.__hero;h.scrubTo(1);h.setPlaying(true);return h.progress;}); assert.equal(replay,0); console.log('replay starts at',replay);
 let oldSeed=(await state()).seed;
 await p.evaluate(()=>{const h=document.querySelector('[data-hero]').__hero;h.scrubTo(.99);h.setPlaying(true);});
 const next=await p.waitForFunction((seed)=>{const r=document.querySelector('[data-hero]');if(r.dataset.seed!==seed)return {seed:r.dataset.seed,progress:r.__hero.progress};},oldSeed,{timeout:15000});console.log('loop starts',await next.jsonValue());
} finally {await b.close();}
