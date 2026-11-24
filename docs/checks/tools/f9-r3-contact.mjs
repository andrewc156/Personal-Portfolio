import { chromium } from 'playwright';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('docs/checks/F9/attempt-3');
const images = readdirSync(directory).filter((name) => name.endsWith('.png')).sort();
const browser = await chromium.launch();
for (let start = 0; start < images.length; start += 10) {
  const group = images.slice(start, start + 10);
  const cells = group.map((name) => `<figure><img src="file://${directory}/${name}"><figcaption>${name}</figcaption></figure>`).join('');
  const html = `<style>body{margin:0;display:grid;grid-template-columns:repeat(2,340px);gap:4px;background:#ddd}figure{margin:0;background:white;height:292px;text-align:center}img{max-width:320px;max-height:260px;object-fit:contain;margin:10px}figcaption{font:12px monospace}</style>${cells}`;
  const file = resolve(directory, `contact-${start / 10 + 1}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: 688, height: Math.ceil(group.length / 2) * 292 } });
  await page.goto(`file://${file}`);
  await page.screenshot({ path: resolve(directory, `contact-${start / 10 + 1}.jpg`) });
  await page.close();
}
await browser.close();
