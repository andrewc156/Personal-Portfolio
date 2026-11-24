import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:4321/');
for (const id of ['mission','work','research','open-science']) {
  await p.locator(`nav[aria-label="Main"] a[href="/#${id}"]`).click();
  await p.waitForTimeout(Number(process.env.W||0));
  await p.waitForTimeout(id==='open-science'?3000:0); const r = await p.evaluate((id) => { const e=document.getElementById(id).getBoundingClientRect(); return {top:e.top,bottom:e.bottom,h:e.height,scrollY,docH:document.documentElement.scrollHeight,url:location.href, smooth:getComputedStyle(document.documentElement).scrollBehavior}; }, id);
  console.log(id, JSON.stringify(r));
}
await b.close();
