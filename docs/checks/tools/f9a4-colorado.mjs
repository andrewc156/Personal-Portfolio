// F9 attempt 4: Colorado grid — TS engine vs barcode.json vs Python reference vs an independent
// union-find written here vs BFS component counts at sampled levels. Checker-owned, throwaway.
// Run: node docs/checks/tools/f9a4-colorado.mjs docs/checks/F9/attempt-4/py-colorado.json
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { computeH0, computeH1Islands } from '../../../src/lib/tda/index.ts';

const W = 326, H = 414, n = W * H;
const buf = readFileSync('public/data/colorado/grid.f32');
const h = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const bc = JSON.parse(readFileSync('public/data/colorado/barcode.json', 'utf8'));
const py = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const res = {};
res.sha256 = createHash('sha256').update(buf).digest('hex');
res.sha256MatchesBarcode = res.sha256 === bc.grid.sha256;
res.nan = h.some((v) => !Number.isFinite(v));
let mi = 0, ma = 0;
for (let i = 0; i < n; i++) { if (h[i] < h[mi]) mi = i; if (h[i] > h[ma]) ma = i; }
res.min = { cell: mi, v: h[mi], x: mi % W, y: (mi / W) | 0 };
res.max = { cell: ma, v: h[ma], x: ma % W, y: (ma / W) | 0 };

const t0 = performance.now();
const eng = computeH0(h, W, H);
res.computeH0ms = +(performance.now() - t0).toFixed(1);
const all = eng.bars.concat(eng.zeroLength);

// Independent union-find (written here): sort by (h,i), elder = smaller (birthH, birthCell).
const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[a] - h[b] || a - b);
const rank = new Int32Array(n); order.forEach((c, k) => (rank[c] = k));
const par = new Int32Array(n).fill(-1), birthOf = new Int32Array(n);
const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
const mine = [];
for (const c of order) {
  const x = c % W, y = (c / W) | 0, rs = new Set();
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx; if (par[j] >= 0) rs.add(find(j));
  }
  par[c] = c; birthOf[c] = c;
  if (!rs.size) continue;
  const roots = [...rs].sort((a, b) => rank[birthOf[a]] - rank[birthOf[b]]);
  const el = roots[0];
  for (const r of roots.slice(1)) { mine.push([birthOf[r], c, birthOf[el]]); par[r] = el; }
  par[c] = el;
}
const rootsLeft = new Set(); for (let i = 0; i < n; i++) rootsLeft.add(find(i));
for (const r of rootsLeft) mine.push([birthOf[r], -1, -1]);
const k3 = (a) => a.join('|');
const engK = all.map((b) => [b.birthCell, b.deathCell, b.mergedInto]);
res.engineBarsAll = engK.length;
res.engineEqualsMineSorted = engK.map(k3).sort().join() === mine.map(k3).sort().join();
res.engineEqualsPythonInOrder = engK.map(k3).join() === py.h0.map(k3).join();
res.engineEqualsPythonSorted = engK.map(k3).sort().join() === py.h0.map(k3).sort().join();

// barcode.json: bars with persistence >= 1 m + essential, same order as engine filtered.
const filt = eng.bars.filter((b) => !Number.isFinite(b.death) || b.death - b.birth >= 1);
let same = filt.length === bc.count, valuesExact = true;
for (let k = 0; k < Math.min(filt.length, bc.count); k++) {
  const b = filt[k];
  if (b.birthCell !== bc.bi[k] || b.deathCell !== bc.di[k] || b.mergedInto !== bc.mi[k]) same = false;
  if (b.birth !== bc.b[k] || (bc.d[k] === null ? Number.isFinite(b.death) : b.death !== bc.d[k])) valuesExact = false;
}
res.barcodeJson = { count: bc.count, engineFiltered: filt.length, pairsIdenticalInOrder: same, valuesExact,
  essentialAtGlobalMin: bc.bi[bc.count - 1] === mi && bc.d[bc.count - 1] === null };

// BFS component count at 400 sampled levels vs engine alive bars.
const levels = []; const sorted = Float32Array.from(h).sort();
for (let q = 0; q < 400; q++) levels.push(sorted[Math.floor((q / 400) * n)]);
let bad = 0;
const lab = new Int32Array(n);
for (const t of levels) {
  lab.fill(-1); let c = 0;
  for (let s = 0; s < n; s++) {
    if (h[s] > t || lab[s] >= 0) continue;
    const st = [s]; lab[s] = c;
    while (st.length) { const u = st.pop(), x = u % W, y = (u / W) | 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx;
        if (h[j] <= t && lab[j] < 0) { lab[j] = c; st.push(j); } } }
    c++;
  }
  const alive = eng.bars.filter((b) => b.birth <= t && t < b.death).length;
  if (alive !== c) bad++;
}
res.bfsLevelChecks = { levels: levels.length, mismatches: bad };

// Islands: TS vs Python
const isl = computeH1Islands(h, W, H);
const islK = isl.bars.concat(isl.zeroLength).map((b) => [b.peakCell, b.saddleCell, b.mergedInto]);
res.islands = { tsBars: isl.bars.length, tsZero: isl.zeroLength.length, pyAll: py.islands.length,
  tsEqualsPySorted: islK.map(k3).sort().join() === py.islands.map(k3).sort().join() };
console.log(JSON.stringify(res, null, 1));
