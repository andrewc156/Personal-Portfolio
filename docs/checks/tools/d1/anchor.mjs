import { chromium } from '@playwright/test';
const [O = 'http://localhost:4321', B = '/Personal-Portfolio/'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto(O + B + 'garden/'); await p.locator(`nav[aria-label="Main"] a[href="${B}#open-science"]`).click();
await p.waitForTimeout(1200);
console.log(await p.evaluate(() => ({ url: location.href, top: document.getElementById('open-science').getBoundingClientRect().top, y: scrollY, max: document.documentElement.scrollHeight - innerHeight })));
await b.close();
