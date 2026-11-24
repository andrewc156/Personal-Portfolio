// F5 a2 checker: readout lag during play (per-frame log), unmatched frames listed with index.
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const seed of [42, 7, 2024]) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto(`http://localhost:4321/?seed=${seed}`);
  await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
  await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const h = document.querySelector('[data-hero]').__hero;
    const el = document.querySelector('[data-hero-readout]');
    const log = [];
    await new Promise((res) => {
      const t0 = performance.now();
      const f = () => {
        const lv = Math.round(h.level()); const n = h.lakeCount;
        log.push({ t: performance.now(), truth: `Level ${lv} m · ${n === 1 ? '1 lake' : n + ' lakes'}`, shown: el.textContent.trim() });
        if (performance.now() - t0 < 5000 && h.playing) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    let maxLag = 0; const un = []; let changes = 0;
    for (let i = 0; i < log.length; i++) {
      if (i && log[i].shown !== log[i - 1].shown) changes++;
      let j = i; while (j >= 0 && log[j].truth !== log[i].shown) j--;
      if (j < 0) { un.push(i); continue; }
      let k = j; while (k + 1 <= i && log[k + 1].truth === log[i].shown) k++;
      maxLag = Math.max(maxLag, k === i ? 0 : log[i].t - log[k + 1].t);
    }
    return { frames: log.length, maxLag: Math.round(maxLag), unmatched: un.slice(0, 12), changes, first: log.slice(0, 2) };
  });
  console.log(seed, JSON.stringify(r));
}
await b.close();
