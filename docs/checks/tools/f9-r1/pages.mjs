import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const out = 'docs/checks/F9/attempt-2';
mkdirSync(out,{recursive:true});
const routes = readdirSync('dist',{recursive:true}).filter(f=> f.endsWith('.html')).map(f=>'/'+f.replace(/index\.html$/,''));
const browser = await chromium.launch();
const results = [];
for (const [width,height] of [[375,812],[768,1024],[1280,800]]) for (const theme of ['light','dark']) {
  const context = await browser.newContext({viewport:{width,height},colorScheme:theme, reducedMotion:'reduce'});
  for (const route of routes) {
    const p=await context.newPage();
    const errors=[], external=new Set(), asset=new Map();
    p.on('pageerror', e=>errors.push(e.message));
    p.on('request', req=>{if (/^https?:/.test(req.url()) && !req.url().startsWith('http://localhost:4321/')) external.add(req.url());});
    const tasks=[];
    p.on('response',res=>{if(res.request().resourceType()==='script') tasks.push(res.body().then(body=>asset.set(res.url(),body)));});
    await p.goto('http://localhost:4321'+route,{waitUntil:'networkidle'});
    await p.evaluate(()=>document.fonts.ready);
    if (route==='/rising-water/') await p.waitForSelector('[data-explorer][data-ready="true"]');
    const name=(route.replace(/^\/|\/$/g,'').replaceAll('/','-')||'home');
    await p.screenshot({path:out+'/'+name+'-'+width+'-'+theme+'.png',fullPage:true});
    const metrics=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,text:document.body.innerText,canonical:document.querySelector('link[rel=canonical]')?.href,inline:[...document.scripts].filter(s=>!s.src && !s.type.includes('json')).map(s=>s.textContent).join('\n')}));
    await Promise.all(tasks);
    const {gzipSync}=await import('node:zlib');
    const jsBytes=[...asset.values(), metrics.inline].reduce((total,src)=>total+gzipSync(src).length,0);
    if (width===375 && theme==='light') writeFileSync(out+'/'+name+'.txt',metrics.text);
    results.push({route,width,theme,overflow:metrics.overflow,errors,external:[...external],jsBytes,canonical:metrics.canonical,unfinished:/\b(TODO|TBD|lorem|placeholder)\b/i.test(metrics.text)});
    await p.close();
  }
  await context.close();
}
await browser.close();
writeFileSync(out+'/pages.json',JSON.stringify(results,null,2));
