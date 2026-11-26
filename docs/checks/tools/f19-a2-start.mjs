import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const BASE='http://localhost:4321';
const OUT='docs/checks/F19b/attempt-2';
const browser=await chromium.launch();
const data=[];
try {
for (const [width,height] of [[375,812],[768,1024],[1280,800]]) {
  const p=await browser.newPage({viewport:{width,height}, reducedMotion:'no-preference', deviceScaleFactor:3});
  await p.addInitScript(() => {
    const o = new MutationObserver(() => {
      const root=document.querySelector('[data-hero]'), h=root?.__hero;
      if (!h?.frames) return;
      o.disconnect();
      const L=h.level(), {W,H}=h.grid, t=h.t, map=root.querySelector('[data-hero-map]'), strip=root.querySelector('[data-hero-strip]');
      const sample=map.getContext('2d').getImageData(0,0,map.width,map.height).data;
      // Count wet components directly in the height grid; independent of engine/flood counter.
      const seen=new Uint8Array(W*H); let wet=0, components=0, s=0,s2=0,n=0;
      for(let i=0;i<sample.length;i+=148) { const k=sample[i]+sample[i+1]+sample[i+2]; s+=k;s2+=k*k;n++; }
      for(let i=0;i<W*H;i++) {
        if(t.heights[i]>L) continue;
        wet++; if(seen[i]) continue;
        components++; const queue=[i];seen[i]=1;
        while(queue.length) {
          const j=queue.pop(), x=j%W, y=Math.floor(j/W);
          for(const v of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1]) if(v>=0&&!seen[v]&&t.heights[v]<=L){seen[v]=1;queue.push(v);}
        }
      }
      const r=map.getBoundingClientRect();
      const nav=performance.getEntriesByType('navigation')[0];
      const png=location.search==='?seed=25'&&innerWidth===375 ? map.toDataURL() : undefined;
      window.__frame={png,frames:h.frames,progress:h.progress,L,lakes:h.lakeCount,components,wet:wet/(W*H),rows:h.drawnRows.length,
        deep:h.drawnRows.filter(b=>L-b.birth>=15&&L<b.death).length, variance:s2/n-(s/n)**2, ratio:r.width/r.height,
        dpr:map.width/r.width, strip:strip.getBoundingClientRect().height, ms:performance.now()-nav.domInteractive};
    });
    o.observe(document,{subtree:true,attributes:true,attributeFilter:['data-state']});
  });
  const start=async(seed)=>{
    await p.goto(BASE+'/?seed='+seed);
    await p.waitForFunction(()=>window.__frame);
    const {png,ms,...state}=await p.evaluate(()=>window.__frame);
    assert.equal(state.frames,1);assert.equal(state.lakes,state.components);assert(state.lakes>=2);
    assert(state.deep>=2);assert(state.wet<=.4);assert(state.rows<=12);assert(state.variance>50);
    assert(Math.abs(state.ratio-16/9)<.005);assert(Math.abs(state.dpr-2)<.02);assert(state.strip<120);
    return {png,ms,state};
  };
  for(let seed=1;seed<=30;seed++) {
    const {state,png,ms}=await start(seed);
    if(seed===25&&width===375) {
      const again=await start(seed);assert.deepEqual(again.state,state);assert.equal(again.png,png);
      assert(state.components>=3&&state.deep>=3); assert(ms<500&&again.ms<500);
      writeFileSync(`${OUT}/seed25-mobile-frame1.png`,Buffer.from(png.split(',')[1],'base64'));
      console.log('seed25 exact first frame (same pixels on reload)',state, 'ms',ms,again.ms);
    }
    data.push({width,seed,ms,...state});
  }
  if(width===1280) {
    const one=await start(42), two=await start(42); assert.deepEqual(one.state,two.state);assert(one.ms<500&&two.ms<500);
    console.log('seed42 exact first frame',one.state,'ms',one.ms,two.ms);
  }
  await p.close();
}
for(const width of [375,768,1280]) {
  const rows=data.filter(x=>x.width===width);
  console.log('sweep',width,rows.length,'min lakes/deep',Math.min(...rows.map(x=>x.lakes)),Math.min(...rows.map(x=>x.deep)),'max wet',Math.max(...rows.map(x=>x.wet)));
}
writeFileSync(`${OUT}/test-results/start.json`,JSON.stringify(data,null,2));
} finally {await browser.close();}
