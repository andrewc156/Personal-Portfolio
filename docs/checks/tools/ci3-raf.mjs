// CI3 checker: raw rAF cadence on a blank page in Playwright headless Chromium (environment check).
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.setContent('<body style="margin:0">blank</body>');
const r = await p.evaluate(() => new Promise((res) => { const t = []; const f = (n) => { t.push(n); t.length < 120 ? requestAnimationFrame(f) : res(t); }; requestAnimationFrame(f); }));
const d = r.slice(1).map((x, i) => x - r[i]).sort((a, b) => a - b);
console.log('blank-page rAF deltas ms: median', d[d.length >> 1].toFixed(1), 'p95', d[Math.floor(0.95 * (d.length - 1))].toFixed(1));
await b.close();
