// F9: hero drawn bars (live page) vs my own union-find H0 on the hero's own heights.
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:4321';
function myH0(h, W, H) { // independent: (h,i) order, 4-conn, elder rule; root = birth cell
  const n = W * H, idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[a] - h[b] || a - b);
  const rank = new Int32Array(n); idx.forEach((c, k) => (rank[c] = k));
  const par = new Int32Array(n).fill(-1);
  const find = (a) => { let r = a; while (par[r] !== r) r = par[r]; while (par[a] !== r) { const t = par[a]; par[a] = r; a = t; } return r; };
  const bars = [];
  for (const i of idx) {
    const x = i % W, y = (i / W) | 0, roots = new Set();
    for (const j of [y > 0 ? i - W : -1, y < H - 1 ? i + W : -1, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && par[j] >= 0) roots.add(find(j));
    if (!roots.size) { par[i] = i; continue; }
    const old = [...roots].sort((a, b) => rank[a] - rank[b])[0]; par[i] = old;
    for (const r of roots) if (r !== old) { bars.push({ b: h[r], d: h[i], bi: r, di: i }); par[r] = old; }
  }
  const ess = new Set(); for (let i = 0; i < n; i++) ess.add(find(i));
  for (const r of ess) bars.push({ b: h[r], d: Infinity, bi: r, di: -1 });
  return { bars, rank };
}
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(BASE + '/'); await p.waitForFunction(() => !!document.querySelector('[data-hero]')?.__hero);
let bad = 0;
for (let t = 0; t < 5; t++) {
  if (t) { await p.click('.hero__bar [data-hero-new]'); await p.waitForTimeout(300); }
  const d = await p.evaluate(() => { const h = document.querySelector('[data-hero]').__hero; h.setPlaying(false); h.scrubTo(1);
    const T = h.t; return { W: T.W, H: T.H, h: Array.from(T.heights), min: h.settings.minPersistence, max: h.settings.maxBars, seed: h.settings.seed,
      rows: h.drawnRows.map((r) => [r.birthCell, r.deathCell, r.birth, r.death === Infinity ? null : r.death]) }; });
  const h = Float32Array.from(d.h); const { bars, rank } = myH0(h, d.W, d.H);
  const keep = bars.filter((x) => x.d === Infinity || x.d - x.b >= d.min).sort((a, c) => (c.d === Infinity) - (a.d === Infinity) || (c.d - c.b) - (a.d - a.b) || rank[a.bi] - rank[c.bi]).slice(0, d.max).sort((a, c) => rank[a.bi] - rank[c.bi]);
  const exp = keep.map((x) => [x.bi, x.di, x.b, x.d === Infinity ? null : x.d]);
  const ok = JSON.stringify(exp) === JSON.stringify(d.rows);
  if (!ok) bad++;
  console.log(`seed ${d.seed} ${d.W}x${d.H}=${d.W * d.H} cells, ${bars.length} bars total, drawn ${d.rows.length} rows: ${ok ? 'identical' : 'MISMATCH'}`);
}
console.log(bad ? `FAIL ${bad}` : 'all hero terrains: drawn rows == my H0 selection'); await b.close();
