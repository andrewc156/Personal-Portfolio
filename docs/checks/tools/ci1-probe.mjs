// CI1 checker: minimal Chromium probe. 200px overflow-x list, 100px link at varying offsets; Tab-focus it, read scrollLeft.
import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage();
const out = [];
for (const hidden of [0, 1, 10, 50, 99, 100, 120]) {
  await p.setContent(`<button id=s>s</button><ul id=u style="display:flex;overflow-x:auto;width:200px;margin:0;padding:0;list-style:none">
  <li style="flex:none;width:${100 + hidden}px"></li><li style="flex:none"><a href="#" style="display:inline-block;width:100px">x</a></li><li style="flex:none;width:300px"></li></ul>`);
  await p.focus('#s'); await p.keyboard.press('Tab');
  out.push({ hiddenPx: hidden, scrollLeft: await p.evaluate(() => document.getElementById('u').scrollLeft) });
}
console.log(JSON.stringify(out)); await b.close();
