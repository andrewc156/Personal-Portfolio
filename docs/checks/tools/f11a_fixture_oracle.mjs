// F11a checker: replay islands.json (Python-generated expectations) and islands_golden.json
// against the TS engine AND the checker's own cell-step brute force (imported logic duplicated
// minimal: we spawn the oracle's functions by re-implementing below).
import { readFileSync } from 'node:fs';
import { computeH1Islands } from '../../../src/lib/tda/index.ts';
const before = (h, a, b) => h[a] < h[b] || (h[a] === h[b] && a < b);
const border = (W, H, i) => { const x = i % W, y = (i - x) / W; return !x || !y || x === W - 1 || y === H - 1; };
function bf(h, W, H, land) {
  // union-free brute force: recompute labels by BFS after each added cell
  const n = W * H, R = [...Array(n).keys()].sort((a, b) => (before(h, a, b) ? 1 : -1));
  const inS = new Array(n).fill(false);
  const label = () => {
    const c = new Int32Array(n).fill(-1), L = [];
    for (let s = 0; s < n; s++) if (inS[s] && c[s] < 0) {
      const q = [s]; c[s] = L.length;
      for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (land === 4 && dx && dy)) continue;
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx; if (inS[j] && c[j] < 0) { c[j] = L.length; q.push(j); } } }
      let p = q[0], b = false; for (const i of q) { if (before(h, p, i)) p = i; if (border(W, H, i)) b = true; }
      L.push({ q, p, b });
    }
    return { c, L };
  };
  let prev = label(); const bars = []; let births = 0;
  for (const c of R) { inS[c] = true; const cur = label(); const id = cur.c[c];
    const olds = prev.L.filter((o) => cur.c[o.q[0]] === id);
    if (!olds.length) { if (!border(W, H, c)) births++; }
    else { const m = cur.L[id].b; let e = null;
      if (!m) for (const o of olds) if (e === null || before(h, e, o.p)) e = o.p;
      for (const o of olds) { if (o.b || (!m && o.p === e)) continue; bars.push([o.p, c, m ? -1 : e]); } }
    prev = cur; }
  return { bars, births };
}
const k = (A) => A.map((b) => b.join()).sort().join('|');
let bad = 0, n = 0;
const fx = JSON.parse(readFileSync('tests/fixtures/tda/islands.json', 'utf8')).cases;
for (const c of fx) {
  n++; const h = Float32Array.from(c.heights), land = c.connectivity === 4 ? 8 : 4;
  const b = bf(h, c.W, c.H, land);
  const r = computeH1Islands(h, c.W, c.H, { connectivity: c.connectivity });
  const eng = [...r.bars, ...r.zeroLength].map((x) => [x.peakCell, x.saddleCell, x.mergedInto]);
  if (k(b.bars) !== k(c.bars) || b.births !== c.births || k(eng) !== k(c.bars)) { bad++; console.log('fixture mismatch', c.id); }
}
const gold = JSON.parse(readFileSync('tests/fixtures/tda/islands_golden.json', 'utf8')).cases;
for (const c of gold) {
  n++; const h = Float32Array.from(c.heights), land = c.connectivity === 4 ? 8 : 4;
  const b = bf(h, c.W, c.H, land);
  const vis = b.bars.filter(([p, s]) => h[p] > h[s]).map(([p, s, m]) => [h[s], h[p], p, s, m]);
  if (k(vis) !== k(c.bars) || b.births !== c.births || b.bars.length - vis.length !== c.zeroLength) { bad++; console.log('golden mismatch', c.name, JSON.stringify(vis)); }
}
console.log(`cases=${n} mismatches=${bad}`);
