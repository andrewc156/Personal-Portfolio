import {chromium} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parse} from 'yaml';
import assert from 'node:assert/strict';
const root = 'http://localhost:4321';
const b = await chromium.launch();
try {
 const p = await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:3});
 if(process.argv.includes('--blank')) {
  await p.goto('about:blank');
  for(let i=0;i<5;i++) console.log('blank p95',await p.evaluate(async()=> {
   const ts=[]; await new Promise(r=>{const step=t=>{ts.push(t);if(ts.length<240)requestAnimationFrame(step);else r()};requestAnimationFrame(step)});
   const d=ts.slice(1).map((t,i)=>t-ts[i]).sort((a,b)=>a-b); return d[Math.floor(.95*(d.length-1))];
  }));
 } else {
  const files=execFileSync('git',['diff','--name-only','HEAD','--','src/content']).toString().trim().split('\n');
  for(const f of files){ const a=parse(execFileSync('git',['show',`HEAD:${f}`]).toString()); const z=parse(readFileSync(f,'utf8')); for(const k of ['description',...(f.includes('/research/')?['summary']:[])]) { if(k==='summary'||f.includes('/work/'))assert(z[k].length<=160,`${f} ${k}`); delete a[k];delete z[k]; } assert.deepEqual(z,a,f); }
  console.log('YAML non-prose invariants + capped lengths:',files.length);
  const all = readdirSync('src/content/work').filter(x=>x.endsWith('.yaml')).map(x=>[x,parse(readFileSync(`src/content/work/${x}`,'utf8'))]);
  console.log('Work entries total/draft',all.length,all.filter(([,x])=>x.draft).length);
  const copy=parse(readFileSync('src/data/copy.yaml','utf8'));assert(Object.values(copy).every(x=>x.confirmed===false));
  const urls=['/','/about/','/garden/','/cv/','/research/','/research/number-theory/','/research/water-quality/','/research/spectral-fractals/','/rising-water/','/404.html'];
  for(const u of urls){await p.goto(root+u);const t=await p.locator('body').innerText();assert(!/TODO|TBD|lorem|placeholder/i.test(t),u);assert.equal(await p.locator('[data-draft-badge]').count(),0,u);}
  console.log('Visible text / draft badges clean:',urls.length);
  for(const w of [375,768,1280]) { await p.setViewportSize({width:w,height:800}); await p.goto(root+'/?seed=42'); await p.waitForFunction(()=>document.querySelector('[data-hero]')?.__hero); const data=await p.evaluate(()=>{ const h=document.querySelector('[data-hero]').__hero; const m=document.querySelector('[data-hero-map]'); const r=m.getBoundingClientRect();const s=document.querySelector('[data-hero-strip]').getBoundingClientRect();return {frames:h.frames,start:h.startAt,rows:h.drawnRows.length,ratio:r.width/r.height,dpr:m.width/r.width,strip:s.height};}); assert(Math.abs(data.ratio-16/9)<.005);assert(Math.abs(data.dpr-2)<.01);assert.equal(data.rows,12);assert(data.start>0&&data.start<.35);assert(data.strip<120);console.log('hero',w,data);}
  const errors=[];p.on('pageerror',x=>errors.push(String(x)));await p.goto(root+'/rising-water/',{waitUntil:'networkidle'});
  const t=await p.locator('main').innerText(); for(const needle of ['bar does. With the basin mask on','pipeline/tda_ref.py. Repository','browser. Source'])assert(t.includes(needle),needle);
  const net=await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/data/colorado/')).map(({name,transferSize,decodedBodySize})=>({file:name.split('/').pop(),transferSize,decodedBodySize}))); console.log('rising-water spaces: 3/3; data transfer',net.reduce((s,x)=>s+x.transferSize,0),net);assert(!errors.length);assert(net.length>0);assert(net.reduce((s,x)=>s+x.transferSize,0)<3e6);
 } 
} finally {await b.close();}
