// F11a checker oracle: independent brute-force islands (H1) vs the engine.
// Usage: node docs/checks/tools/f11a_islands_oracle.mjs [dumpPath]
// Written by the checker; uses only the engine's public API for the comparison side.
import { writeFileSync } from 'node:fs';
import { computeH1Islands, Islands } from '../../../src/lib/tda/index.ts';

// ---------- seeded RNG ----------
let seed = 0x5eed1234;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ---------- brute force ----------
// total order: a before b iff (h[a], a) < (h[b], b)
const before = (h, a, b) => h[a] < h[b] || (h[a] === h[b] && a < b);
const nbrs = (W, H, i, land) => {
  const x = i % W, y = (i - x) / W, out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (land === 4 && dx && dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
    }
  return out;
};
const onBorder = (W, H, i) => {
  const x = i % W, y = (i - x) / W;
  return x === 0 || y === 0 || x === W - 1 || y === H - 1;
};
// components of the cell set `inSet` (boolean array); returns {comp: Int32Array, list:[{cells, peak, border}]}
function components(h, W, H, inSet, land) {
  const n = W * H, comp = new Int32Array(n).fill(-1), list = [];
  for (let s = 0; s < n; s++) {
    if (!inSet[s] || comp[s] >= 0) continue;
    const id = list.length, cells = [s];
    comp[s] = id;
    for (let q = 0; q < cells.length; q++)
      for (const j of nbrs(W, H, cells[q], land))
        if (inSet[j] && comp[j] < 0) { comp[j] = id; cells.push(j); }
    let peak = cells[0], border = false;
    for (const c of cells) { if (before(h, peak, c)) peak = c; if (onBorder(W, H, c)) border = true; }
    list.push({ cells, peak, border });
  }
  return { comp, list };
}
function islandsAt(h, W, H, t, land) {
  const inSet = Array.from(h, (v) => v > t);
  const { comp, list } = components(h, W, H, inSet, land);
  const cellIsland = new Int32Array(W * H).fill(-1);
  const peaks = [];
  list.forEach((c, id) => {
    if (c.border) return;
    peaks.push(c.peak);
    for (const x of c.cells) cellIsland[x] = c.peak;
  });
  void comp;
  return { peaks: peaks.sort((a, b) => a - b), cellIsland };
}
// cell-step brute force with the elder rule (mainland eldest, else ≺-greatest peak)
function cellStepBars(h, W, H, land) {
  const n = W * H;
  const R = [...Array(n).keys()].sort((a, b) => (before(h, a, b) ? 1 : -1)); // descending
  const inSet = new Array(n).fill(false);
  let prev = components(h, W, H, inSet, land);
  const bars = [];
  let births = 0;
  for (const c of R) {
    inSet[c] = true;
    const cur = components(h, W, H, inSet, land);
    const newId = cur.comp[c];
    const newC = cur.list[newId];
    // old comps contained in newC
    const olds = prev.list.filter((o) => cur.comp[o.cells[0]] === newId);
    if (olds.length === 0) {
      if (!onBorder(W, H, c)) births++;
    } else {
      const toMain = newC.border;
      let eld = null;
      if (!toMain) for (const o of olds) if (eld === null || before(h, eld, o.peak)) eld = o.peak;
      for (const o of olds) {
        if (o.border) continue; // was already mainland
        if (!toMain && o.peak === eld) continue;
        bars.push([h[c], h[o.peak], o.peak, c, toMain ? -1 : eld]);
      }
      // a lone border cell joining nothing is just mainland
    }
    prev = cur;
  }
  return { bars, births };
}

// ---------- grid generators ----------
function gen(kind) {
  const W = ri(1, 10), H = ri(1, 10), n = W * H, a = new Float32Array(n);
  if (kind === 'ties') for (let i = 0; i < n; i++) a[i] = ri(0, 3);
  else if (kind === 'ints') for (let i = 0; i < n; i++) a[i] = ri(0, 9);
  else if (kind === 'float') for (let i = 0; i < n; i++) a[i] = rnd() * 100 - 50;
  else if (kind === 'plateau') {
    const bx = ri(1, 3), by = ri(1, 3), m = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = `${(x / bx) | 0},${(y / by) | 0}`;
      if (!m.has(k)) m.set(k, ri(0, 4));
      a[y * W + x] = m.get(k);
    }
  } else if (kind === 'lowborder') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      a[y * W + x] = onBorder(W, H, y * W + x) ? ri(0, 1) : ri(1, 6);
  }
  return { W, H, a, kind };
}
const G = (W, H, arr, kind) => ({ W, H, a: Float32Array.from(arr), kind });
const adversarial = [
  G(1, 1, [5], 'adv 1x1'),
  G(7, 1, [1, 5, 9, 5, 1, 9, 2], 'adv 1x7 strip'),
  G(1, 7, [3, 1, 4, 1, 5, 9, 2], 'adv 7x1 strip'),
  G(6, 2, [1, 9, 2, 8, 3, 7, 4, 6, 5, 5, 6, 4], 'adv 2-row strip'),
  G(5, 5, Array(25).fill(2), 'adv all-equal 5x5'),
  G(3, 3, Array(9).fill(0), 'adv all-equal 3x3'),
  // diagonal pinch: two interior peaks touching only at a corner
  G(6, 6, [0,0,0,0,0,0, 0,5,0,0,0,0, 0,0,6,0,0,0, 0,0,0,7,0,0, 0,0,0,0,4,0, 0,0,0,0,0,0], 'adv diagonal chain'),
  G(5, 5, [0,0,0,0,0, 0,5,0,0,0, 0,0,5,0,0, 0,0,0,5,0, 0,0,0,0,0], 'adv diagonal plateau chain'),
  // hill touching border diagonally only
  G(4, 4, [3,0,0,0, 0,6,0,0, 0,0,0,0, 0,0,0,0], 'adv diag to corner'),
  // border-touching hill with apex on border
  G(5, 5, [0,0,9,0,0, 0,5,6,5,0, 0,4,5,4,0, 0,0,0,0,0, 0,0,0,0,0], 'adv apex on border'),
  // whole border floods first (border all lowest), central multi-peak
  G(6, 6, [0,0,0,0,0,0, 0,3,3,3,3,0, 0,3,8,2,7,0, 0,3,3,3,3,0, 0,3,3,3,3,0, 0,0,0,0,0,0], 'adv border floods first'),
  G(5, 5, [1,1,1,1,1, 1,2,2,2,1, 1,2,2,2,1, 1,2,2,2,1, 1,1,1,1,1], 'adv central plateau'),
  // checkerboards
  G(4, 4, [0,1,0,1, 1,0,1,0, 0,1,0,1, 1,0,1,0], 'adv checker 4x4'),
  G(5, 5, [1,0,1,0,1, 0,1,0,1,0, 1,0,1,0,1, 0,1,0,1,0, 1,0,1,0,1], 'adv checker 5x5'),
  // ring with a diagonal gap (water 4 cannot leak through the diagonal)
  G(7, 7, [9,9,9,9,9,9,9, 9,1,1,1,1,1,9, 9,1,3,3,3,1,9, 9,1,3,6,3,1,9, 9,1,3,3,3,1,9, 9,1,1,1,1,1,9, 9,9,9,9,9,9,9], 'adv ring'),
  // negative and -0 values
  G(4, 4, [-0, 0, -1, -1, 0, -0.5, -0.5, 0, -1, -0.5, 3, -1, 0, 0, 0, -0], 'adv signed zero'),
  G(3, 3, [2,0,2,0,3,0,2,0,2], 'adv dual checker'),
];

// ---------- comparison ----------
const key = (b) => b.join(',');
const sameMultiset = (A, B) => {
  const a = A.map(key).sort(), b = B.map(key).sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
};
let grids = 0, levelChecks = 0, failures = 0, totalBars = 0, totalZero = 0;
const dump = [];
const fail = (g, conn, msg) => {
  failures++;
  if (failures <= 20) console.log(`FAIL [${g.kind} ${g.W}x${g.H} water${conn}] ${msg}\n  h=${JSON.stringify(Array.from(g.a))}`);
};
function check(g) {
  grids++;
  const { W, H, a } = g;
  for (const conn of [4, 8]) {
    const land = conn === 4 ? 8 : 4;
    const res = computeH1Islands(a, W, H, { connectivity: conn });
    const eng = [...res.bars, ...res.zeroLength].map((b) => [b.birth, b.death, b.peakCell, b.saddleCell, b.mergedInto]);
    const bf = cellStepBars(a, W, H, land);
    totalBars += res.bars.length; totalZero += res.zeroLength.length;
    if (!sameMultiset(eng, bf.bars)) fail(g, conn, `bars differ\n  eng=${JSON.stringify(eng)}\n  bf =${JSON.stringify(bf.bars)}`);
    if (res.stats.births !== bf.births) fail(g, conn, `births eng=${res.stats.births} bf=${bf.births}`);
    if (res.stats.zeroLength !== bf.bars.filter((b) => b[0] === b[1]).length) fail(g, conn, 'zeroLength count');
    if (res.bars.some((b) => !(b.death > b.birth)) || res.zeroLength.some((b) => b.death !== b.birth)) fail(g, conn, 'bars/zeroLength split');
    // level-wise: at -inf, every distinct level, and midpoints
    const lv = [...new Set(Array.from(a))].sort((x, y) => x - y);
    const levels = [-Infinity, ...lv];
    for (let k = 0; k + 1 < lv.length; k++) levels.push((lv[k] + lv[k + 1]) / 2);
    levels.push(lv[lv.length - 1] + 1);
    const isl = new Islands(a, W, H, { connectivity: conn });
    // ascending sweep then a few random (non-monotone) levels to exercise reset
    const seq = [...levels].sort((x, y) => x - y);
    for (let r = 0; r < 4; r++) seq.push(levels[ri(0, levels.length - 1)]);
    let evAlive = 0;
    let lastL = -Infinity;
    for (const t of seq) {
      levelChecks++;
      const bfL = islandsAt(a, W, H, t, land);
      const live = res.bars.filter((b) => b.birth <= t && t < b.death).map((b) => b.peakCell).sort((x, y) => x - y);
      if (live.join() !== bfL.peaks.join()) fail(g, conn, `t=${t} live peaks ${live} vs BFS ${bfL.peaks}`);
      if (t < lastL) evAlive = 0;
      lastL = t;
      const ev = isl.advanceTo(t);
      for (const e of ev) evAlive += e.type === 'birth' ? 1 : -1;
      if (isl.alive() !== bfL.peaks.length) fail(g, conn, `t=${t} alive ${isl.alive()} vs BFS ${bfL.peaks.length}`);
      if (evAlive !== isl.alive()) fail(g, conn, `t=${t} event sum ${evAlive} vs alive ${isl.alive()}`);
      for (let i = 0; i < W * H; i++) {
        const e = isl.islandOf(i);
        if (e !== bfL.cellIsland[i]) { fail(g, conn, `t=${t} islandOf(${i})=${e} vs BFS ${bfL.cellIsland[i]}`); break; }
      }
    }
    dump.push({ W, H, connectivity: conn, heights: Array.from(a), bars: eng, births: res.stats.births });
  }
}
for (const g of adversarial) check(g);
const kinds = ['ties', 'ints', 'float', 'plateau', 'lowborder'];
for (let r = 0; r < 150; r++) check(gen(kinds[r % kinds.length]));
// engine on larger grids vs brute force (fewer, bigger)
for (let r = 0; r < 10; r++) {
  const W = ri(11, 16), H = ri(11, 16), a = new Float32Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = ri(0, 5);
  check({ W, H, a, kind: 'large-ties' });
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(dump));
console.log(`grids=${grids} (x2 connectivities) levelChecks=${levelChecks} displayBars=${totalBars} zeroLength=${totalZero} failures=${failures}`);
process.exit(failures ? 1 : 0);
