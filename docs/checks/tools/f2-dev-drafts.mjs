import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
for (const u of ['/garden/', '/', '/research/number-theory/', '/cv/']) {
  await p.goto('http://localhost:4321' + u);
  const rows = await p.$$eval('[data-work-row], [data-citation]', (rs) => rs.map((r) => `${r.dataset.id} badge=${!!r.querySelector('[data-draft-badge]')} :: ${r.innerText.replace(/\s+/g, ' ').slice(0, 140)}`));
  console.log('##', u); rows.forEach((r) => console.log('  ', r));
  console.log('   badge text:', await p.$$eval('[data-draft-badge]', (b) => [...new Set(b.map((x) => x.textContent.trim()))]));
}
await p.goto('http://localhost:4321/garden/');
await p.screenshot({ path: process.argv[2] + '/dev-garden-drafts-1280-light.png', fullPage: true });
await b.close();
