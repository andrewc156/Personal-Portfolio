// Visible text of each page via a real browser (JS on), plus raw-HTML regex grep of dist/.
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const pages = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
for (const u of pages) {
  await p.goto(B + u);
  const t = await p.evaluate(() => document.body.innerText);
  const title = await p.title();
  const desc = await p.locator('meta[name=description]').getAttribute('content').catch(() => null);
  console.log(`\n######## ${u}\nTITLE: ${title}\nDESC: ${desc}\n${t}`);
  const hits = t.match(/TODO|TBD|lorem|placeholder/gi);
  console.log('BANNED HITS:', hits);
}
await b.close();
