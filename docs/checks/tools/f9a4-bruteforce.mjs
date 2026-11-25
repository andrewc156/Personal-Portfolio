// F9 attempt 4 — independent brute-force oracle (checker-owned, throwaway).
// H0: add cells one at a time in (h, index) order; after every step, relabel ALL components of
// the added set with BFS from scratch (no union-find). A component's identity is its ≺-minimum
// cell. When a step makes several old components one, every non-eldest dies at that cell.
// Also checks a tie-agnostic invariant at every distinct level t: #components of {h <= t}
// equals #bars alive (b <= t < d).
// H1 islands: at every distinct level t, BFS the land {h > t} with the complementary
// neighbourhood; islands = land components touching no border cell. Their count and their
// ≺-maximum cells (peaks) must equal the engine's alive island bars at t.
// Run: node docs/checks/tools/f9a4-bruteforce.mjs
import { computeH0, computeH1Islands } from '../../../src/lib/tda/index.ts';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nbrs = (i, W, H, conn) => {
  const x = i % W, y = (i / W) | 0, out = [];
  const d4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const d8 = d4.concat([[-1, -1], [1, -1], [-1, 1], [1, 1]]);
  for (const [dx, dy] of conn === 4 ? d4 : d8) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
  }
  return out;
};
const less = (h, a, b) => h[a] < h[b] || (h[a] === h[b] && a < b);

function labels(inSet, n, W, H, conn) {
  const lab = new Int32Array(n).fill(-1);
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (!inSet[s] || lab[s] >= 0) continue;
    const q = [s]; lab[s] = c;
    while (q.length) { const u = q.pop(); for (const v of nbrs(u, W, H, conn)) if (inSet[v] && lab[v] < 0) { lab[v] = c; q.push(v); } }
    c++;
  }
  return { lab, count: c };
}

function bruteH0(h, W, H, conn) {
  const n = W * H;
  const order = [...Array(n).keys()].sort((a, b) => (less(h, a, b) ? -1 : less(h, b, a) ? 1 : 0));
  const added = new Uint8Array(n);
  let prevLab = new Int32Array(n).fill(-1);
  const bars = [];
  for (const c of order) {
    added[c] = 1;
    const { lab } = labels(added, n, W, H, conn);
    // old components (by prevLab) adjacent to c, identified by their ≺-min cell
    const oldIds = new Map();
    for (let i = 0; i < n; i++) if (prevLab[i] >= 0 && lab[i] === lab[c]) {
      const id = prevLab[i];
      if (!oldIds.has(id) || less(h, i, oldIds.get(id))) oldIds.set(id, i);
    }
    const mins = [...oldIds.values()].sort((a, b) => (less(h, a, b) ? -1 : 1));
    for (let k = 1; k < mins.length; k++) bars.push({ b: h[mins[k]], d: h[c], bi: mins[k], di: c, into: mins[0] });
    prevLab = lab;
  }
  const { lab, count } = labels(added, n, W, H, conn);
  for (let cc = 0; cc < count; cc++) { let m = -1; for (let i = 0; i < n; i++) if (lab[i] === cc && (m < 0 || less(h, i, m))) m = i; bars.push({ b: h[m], d: Infinity, bi: m, di: -1, into: -1 }); }
  return bars;
}

function levelInvariantH0(h, W, H, conn, bars) {
  const n = W * H;
  for (const t of [...new Set(h)].sort((a, b) => a - b)) {
    const set = new Uint8Array(n); for (let i = 0; i < n; i++) set[i] = h[i] <= t ? 1 : 0;
    const { count } = labels(set, n, W, H, conn);
    const alive = bars.filter((b) => b.birth <= t && t < b.death).length;
    if (count !== alive) return `level ${t}: components ${count} vs alive bars ${alive}`;
  }
  return null;
}

function checkIslands(h, W, H, conn, res) {
  const n = W * H, landConn = conn === 4 ? 8 : 4;
  const all = res.bars.concat(res.zeroLength);
  for (const t of [...new Set(h)].sort((a, b) => a - b).concat([-Infinity])) {
    const land = new Uint8Array(n); for (let i = 0; i < n; i++) land[i] = h[i] > t ? 1 : 0;
    const { lab, count } = labels(land, n, W, H, landConn);
    const peaks = [];
    for (let c = 0; c < count; c++) {
      let border = false, p = -1;
      for (let i = 0; i < n; i++) if (lab[i] === c) {
        const x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
        if (p < 0 || less(h, p, i)) p = i;
      }
      if (!border) peaks.push(p);
    }
    const alive = all.filter((b) => b.birth <= t && t < b.death).map((b) => b.peakCell);
    const A = peaks.sort((a, b) => a - b).join(','), B = alive.sort((a, b) => a - b).join(',');
    if (A !== B) return `islands level ${t}: brute peaks [${A}] vs engine [${B}]`;
  }
  return null;
}

const key = (b) => `${b.bi}|${b.di}|${b.b}|${b.d}|${b.into}`;
let grids = 0, fails = [], tied = 0, islandGrids = 0, islandBars = 0;
const R = rng(20261125);
for (let g = 0; g < 160; g++) {
  const W = 1 + Math.floor(R() * 9), H = 1 + Math.floor(R() * 9);
  const ties = g % 2 === 0;
  const h = new Float32Array(W * H).map(() => (ties ? Math.floor(R() * 4) : R() * 100));
  if (ties) tied++;
  for (const conn of [4, 8]) {
    const eng = computeH0(h, W, H, { connectivity: conn });
    const engAll = eng.bars.concat(eng.zeroLength).map((b) => ({ b: b.birth, d: b.death, bi: b.birthCell, di: b.deathCell, into: b.mergedInto }));
    const bf = bruteH0(h, W, H, conn);
    const A = engAll.map(key).sort().join('\n'), B = bf.map(key).sort().join('\n');
    if (A !== B) fails.push(`H0 grid ${g} ${W}x${H} conn${conn}`);
    if (eng.zeroLength.some((b) => b.death !== b.birth) || eng.bars.some((b) => !(b.death > b.birth))) fails.push(`H0 zero-length split ${g}`);
    const inv = levelInvariantH0(h, W, H, conn, eng.bars);
    if (inv) fails.push(`H0 grid ${g} conn${conn}: ${inv}`);
    const isl = computeH1Islands(h, W, H, { connectivity: conn });
    const e = checkIslands(h, W, H, conn, isl);
    if (e) fails.push(`H1 grid ${g} ${W}x${H} conn${conn}: ${e}`);
    islandGrids++; islandBars += isl.bars.length;
    grids++;
  }
}
// Golden and checkerboard (§10 F3)
const gold = computeH0(new Float32Array([10, 1, 8, 3, 6, 5, 10]), 7, 1);
const goldStr = gold.bars.map((b) => `${b.birth}->${b.death}(${b.birthCell},${b.deathCell})`).join(' ');
const cb4 = computeH0(new Float32Array([0, 1, 1, 0]), 2, 2, { connectivity: 4 });
const cb8 = computeH0(new Float32Array([0, 1, 1, 0]), 2, 2, { connectivity: 8 });
console.log(JSON.stringify({
  gridRuns: grids, tiedGrids: tied, islandGridRuns: islandGrids, islandBarsChecked: islandBars,
  failures: fails.slice(0, 10), failureCount: fails.length,
  golden: goldStr,
  checkerboard4: cb4.bars.map((b) => `${b.birth}->${b.death}`),
  checkerboard8: cb8.bars.map((b) => `${b.birth}->${b.death}`),
}, null, 1));
