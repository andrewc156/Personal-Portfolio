import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 for(let i=0;i<10;i++) {
  const p=await browser.newPage({viewport:{width:1280,height:800}});
  await p.goto('http://localhost:4321/?seed=42');
  await p.waitForFunction(()=>document.querySelector('[data-hero]')?.dataset.running==='true',{timeout:5000});
  const read=()=>{const r=document.querySelector('[data-hero]'); const h=r.__hero; return {running:r.dataset.running,frames:h.frames,progress:h.progress,timers:h.pendingTimerCount};};
  await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  const before=await p.evaluate(read);
  await p.waitForTimeout(400);
  const after=await p.evaluate(read);
  console.log(JSON.stringify({before,after}));
  assert.equal(after.running,'false');assert.equal(after.progress,before.progress);
  await p.close();
 }
} finally {await browser.close();}
