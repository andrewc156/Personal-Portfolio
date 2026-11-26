// F28a shared helpers: frame strips composed into one PNG, JSON log.
import fs from 'node:fs';
import path from 'node:path';

export const BASE = 'http://localhost:4321';
export const EV = path.resolve('docs/checks/F28a/evidence');
fs.mkdirSync(EV, { recursive: true });

const results = {};
export function log(key, value) {
  results[key] = value;
  console.log(key, JSON.stringify(value));
}
export function saveResults(name) {
  const f = path.join(EV, `${name}.json`);
  const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  fs.writeFileSync(f, JSON.stringify({ ...prev, ...results }, null, 2));
}

/** Pause every running animation/transition, then shoot it at each time (ms). */
export async function strip(page, browser, name, times, clip) {
  const shots = [];
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  for (const t of times) {
    await page.evaluate((t) => {
      for (const a of document.getAnimations()) a.currentTime = t;
    }, t);
    const buf = await page.screenshot(clip ? { clip } : {});
    shots.push({ t, b64: buf.toString('base64') });
  }
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await compose(browser, name, shots);
}

/** Compose frames side by side with time labels; writes evidence/<name>.png. */
export async function compose(browser, name, shots, label = (s) => `${s.t} ms`) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
  const p = await ctx.newPage();
  const html = `<body style="margin:0;background:#888;font:14px sans-serif;display:flex;gap:6px;padding:6px;align-items:flex-start">${shots
    .map(
      (s) =>
        `<figure style="margin:0;background:#fff"><figcaption style="padding:2px 4px;background:#000;color:#fff">${label(s)}</figcaption><img style="display:block;max-width:${shots.length > 4 ? 300 : 420}px" src="data:image/png;base64,${s.b64}"></figure>`,
    )
    .join('')}</body>`;
  await p.setContent(html);
  await p.waitForLoadState('load');
  const file = path.join(EV, `${name}.png`);
  await p.screenshot({ path: file, fullPage: true });
  await ctx.close();
  console.log('STRIP', file);
  return file;
}
