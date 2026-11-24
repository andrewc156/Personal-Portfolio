// F3 checker tool: independent brute-force H0 (BFS relabelling at every sweep step and at every
// distinct height level), compared with the TS engine (src/lib/tda) and pipeline/tda_ref.py.
// Usage: node docs/checks/tools/f3_bruteforce.mjs [nGrids=120]
// Written by the checker; does not use any builder test helper.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeH0, Flood, allFiniteBars } from '../../../src/lib/tda/index.ts';

const N = Number(process.argv[2] ?? 120);
let seed = 987654321;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function makeGrid(c) {
  const kinds = ['int', 'plateau', 'float', 'quarter', 'signedzero', 'constant', 'strip'];
  const kind = kinds[c % kinds.length];
  let W = ri(1, 22),
    H = ri(1, 22);
  if (c % 17 === 3) (W = 30), (H = 30);
  if (c === 0) (W = 1), (H = 1);
  if (kind === 'strip') rnd() < 0.5 ? (W = 1) : (H = 1);
  const h = new Float32Array(W * H);
  if (kind === 'int' || kind === 'strip') {
    const m = ri(2, 6);
    for (let i = 0; i < h.length; i++) h[i] = ri(0, m);
  } else if (kind === 'plateau') {
    const bw = ri(1, 4),
      bh = ri(1, 4);
    const vals = {};
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const key = `${Math.floor(x / bw)},${Math.floor(y / bh)}`;
        vals[key] ??= ri(0, 5);
        h[y * W + x] = vals[key];
      }
  } else if (kind === 'float') {
    for (let i = 0; i < h.length; i++) h[i] = rnd() * 1000 - 500; // tie-free (almost surely)
  } else if (kind === 'quarter') {
    for (let i = 0; i < h.length; i++) h[i] = ri(-8, 8) / 4;
  } else if (kind === 'signedzero') {
    for (let i = 0; i < h.length; i++) h[i] = [-0, 0, 1, -1, 0.5][ri(0, 4)];
  } else {
    h.fill(ri(-3, 3));
  }
  return { kind, W, H, h };
}

function neighbors(i, W, H, conn) {
  const x = i % W,
    y = (i - x) / W;
  const out = [];
  const d4 = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  const d8 = [...d4, [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of conn === 4 ? d4 : d8) {
    const nx = x + dx,
      ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
  }
  return out;
}

// Own total order: comparator on (h, i). -0 and +0 compare equal under `<`.
function myOrder(h) {
  const idx = [...h.keys()];
  idx.sort((a, b) => (h[a] < h[b] ? -1 : h[a] > h[b] ? 1 : a - b));
  const rank = new Array(h.length);
  idx.forEach((c, k) => (rank[c] = k));
  return { order: idx, rank };
}

// BFS labelling of the set `inSet`; returns label array (-1 outside) with label = ≺-min cell.
function bfsLabels(inSet, W, H, conn, rank) {
  const n = W * H;
  const lab = new Array(n).fill(-1);
  const seen = new Array(n).fill(false);
  for (let s = 0; s < n; s++) {
    if (!inSet[s] || seen[s]) continue;
    const comp = [s];
    seen[s] = true;
    for (let q = 0; q < comp.length; q++)
      for (const j of neighbors(comp[q], W, H, conn))
        if (inSet[j] && !seen[j]) {
          seen[j] = true;
          comp.push(j);
        }
    let m = comp[0];
    for (const c of comp) if (rank[c] < rank[m]) m = c;
    for (const c of comp) lab[c] = m;
  }
  return lab;
}

// Brute-force sweep: BFS from scratch at every rank step k.
function bruteRank(h, W, H, conn) {
  const n = W * H;
  const { order, rank } = myOrder(h);
  const inSet = new Array(n).fill(false);
  let prev = new Array(n).fill(-1);
  const events = []; // per step
  const finite = [];
  let births = 0;
  for (let k = 0; k < n; k++) {
    const c = order[k];
    inSet[c] = true;
    const lab = bfsLabels(inSet, W, H, conn, rank);
    const ids = new Set();
    for (let j = 0; j < n; j++) if (j !== c && lab[j] === lab[c] && prev[j] >= 0) ids.add(prev[j]);
    const sorted = [...ids].sort((a, b) => (process.env.MUTATE ? a - b : rank[a] - rank[b]));
    if (sorted.length === 0) {
      births++;
      events.push({ k, type: 'birth', cell: c, lake: c, into: -1, level: h[c] });
      if (lab[c] !== c) throw new Error('brute: birth cell not min');
    } else {
      if (lab[c] !== sorted[0]) throw new Error('brute: survivor not elder');
      for (const id of sorted.slice(1)) {
        finite.push([id, c, sorted[0], h[id], h[c]]);
        events.push({ k, type: 'merge', cell: c, lake: id, into: sorted[0], level: h[c] });
      }
    }
    prev = lab;
  }
  const ess = [...new Set(prev)].sort((a, b) => rank[a] - rank[b]);
  return { order, rank, finite, ess, births, events };
}

// Level-granularity brute force: BFS at every distinct height; positive bars (birth, death, birthCell).
function bruteLevel(h, W, H, conn, rank) {
  const n = W * H;
  const levels = [...new Set([...h].map((v) => (v === 0 ? 0 : v)))].sort((a, b) => a - b);
  let prev = new Array(n).fill(-1);
  const bars = [];
  for (const t of levels) {
    const inSet = [...h].map((v) => v <= t);
    const lab = bfsLabels(inSet, W, H, conn, rank);
    const groups = new Map();
    for (let j = 0; j < n; j++)
      if (prev[j] >= 0) {
        if (!groups.has(lab[j])) groups.set(lab[j], new Set());
        groups.get(lab[j]).add(prev[j]);
      }
    for (const ids of groups.values()) {
      const s = [...ids].sort((a, b) => rank[a] - rank[b]);
      for (const id of s.slice(1)) bars.push(`${h[id]}|${t}|${id}`);
    }
    prev = lab;
  }
  return bars.sort();
}

const fails = [];
const fail = (m) => {
  if (fails.length < 40) console.log('FAIL', m);
  fails.push(m);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const grids = [];
for (let c = 0; c < N; c++) grids.push(makeGrid(c));
// golden + checkerboard
grids.push({ kind: 'golden', W: 7, H: 1, h: Float32Array.from([10, 1, 8, 3, 6, 5, 10]) });
grids.push({ kind: 'checker', W: 2, H: 2, h: Float32Array.from([0, 1, 1, 0]) });

// Python reference outputs
const dir = mkdtempSync(join(tmpdir(), 'f3chk-'));
writeFileSync(
  join(dir, 'grids.json'),
  JSON.stringify(grids.map((g) => ({ W: g.W, H: g.H, h: [...g.h].map((v) => (Object.is(v, -0) ? '-0' : v)) }))),
);
const py = `
import json,sys,numpy as np
sys.path.insert(0,'.')
from pipeline.tda_ref import compute_h0
gs=json.load(open(sys.argv[1])); out=[]
for g in gs:
  a=np.array([-0.0 if v=='-0' else v for v in g['h']],dtype=np.float32).reshape(g['H'],g['W'])
  row={}
  for c in (4,8):
    r=compute_h0(a,c)
    row[c]={'finite':[[b.birth_cell,b.death_cell,b.merged_into,b.birth,b.death] for b in r.finite],
            'ess':[b.birth_cell for b in r.essential],'births':r.births,'zl':len(r.zero_length),
            'vis':len([b for b in r.visible if not b.essential])}
  out.append(row)
json.dump(out,open(sys.argv[2],'w'))
`;
writeFileSync(join(dir, 'drv.py'), py);
execFileSync('pipeline/.venv/bin/python', [join(dir, 'drv.py'), join(dir, 'grids.json'), join(dir, 'py.json')], {
  stdio: 'inherit',
});
const pyOut = JSON.parse(readFileSync(join(dir, 'py.json'), 'utf8'));

let tieGrids = 0,
  zlTotal = 0,
  floodChecks = 0,
  compChecks = 0;
for (let g = 0; g < grids.length; g++) {
  const { W, H, h, kind } = grids[g];
  if (new Set([...h].map((v) => (v === 0 ? 0 : v))).size < h.length) tieGrids++;
  for (const conn of [4, 8]) {
    const tag = `grid ${g} (${kind} ${W}x${H}) c${conn}`;
    const B = bruteRank(h, W, H, conn);
    const R = computeH0(h, W, H, { connectivity: conn });
    // order
    if (!eq([...R.order], B.order)) fail(`${tag}: order differs`);
    const all = allFiniteBars(R).map((b) => [b.birthCell, b.deathCell, b.mergedInto, b.birth, b.death]);
    if (!eq(all, B.finite)) fail(`${tag}: TS finite bars differ from brute`);
    const ess = R.bars.filter((b) => b.death === Infinity);
    if (!eq(ess.map((b) => b.birthCell), B.ess)) fail(`${tag}: TS essential differ`);
    if (ess.some((b) => b.deathCell !== -1 || b.mergedInto !== -1 || b.birth !== h[b.birthCell]))
      fail(`${tag}: essential fields`);
    const zl = B.finite.filter((b) => b[3] === b[4]).length;
    zlTotal += zl;
    if (R.stats.zeroLength !== zl || R.zeroLength.length !== zl) fail(`${tag}: zeroLength count`);
    if (R.bars.some((b) => b.death === b.birth)) fail(`${tag}: zero-length bar in display list`);
    if (R.bars.length !== B.finite.length - zl + B.ess.length) fail(`${tag}: display count`);
    if (R.stats.births !== B.births || R.stats.finite !== B.finite.length || R.stats.essential !== B.ess.length)
      fail(`${tag}: stats`);
    if (B.births !== B.finite.length + B.ess.length) fail(`${tag}: brute births identity`);
    // Python
    const P = pyOut[g][conn];
    if (!eq(P.finite, B.finite)) fail(`${tag}: Python finite bars differ from brute`);
    if (!eq(P.ess, B.ess) || P.births !== B.births || P.zl !== zl) fail(`${tag}: Python ess/births/zl`);
    // level-based brute
    const L = bruteLevel(h, W, H, conn, B.rank);
    const pos = B.finite.filter((b) => b[4] > b[3]).map((b) => `${b[3]}|${b[4]}|${b[0]}`).sort();
    if (!eq(L, pos)) fail(`${tag}: level-BFS positive bars differ from rank-BFS`);

    // Flood API
    const fl = new Flood(h, W, H, { connectivity: conn, order: g % 2 ? R.order : undefined });
    const hs = [...h].sort((a, b) => a - b);
    const lv = [hs[0] - 1, hs[hs.length - 1] + 1];
    for (let q = 0; q < 14; q++) {
      const v = hs[ri(0, hs.length - 1)];
      lv.push(rnd() < 0.5 ? v : v + (rnd() - 0.5));
    }
    lv.push(-Infinity, Infinity);
    // random order: shuffle so we go forward and backward
    for (let q = lv.length - 1; q > 0; q--) {
      const r = ri(0, q);
      [lv[q], lv[r]] = [lv[r], lv[q]];
    }
    let prevAdded = 0;
    for (let rep = 0; rep < lv.length + 1; rep++) {
      if (rep === lv.length) {
        fl.reset();
        if (fl.alive() !== 0 || fl.wetCount !== 0 || fl.isWet(B.order[0]) || fl.componentOf(B.order[0]) !== -1)
          fail(`${tag}: reset state`);
        prevAdded = 0;
        continue;
      }
      const t = lv[rep];
      const ev = fl.advanceTo(t);
      const wet = [...h].map((v) => v <= t);
      const nWet = wet.filter(Boolean).length;
      const start = nWet < prevAdded ? 0 : prevAdded;
      const exp = B.events
        .filter((e) => e.k >= start && e.k < nWet)
        .map(({ type, level, cell, lake, into }) => ({ type, level, cell, lake, into }));
      if (!eq(ev, exp)) fail(`${tag}: events at t=${t} (prev ${prevAdded}, now ${nWet})`);
      prevAdded = nWet;
      const lab = bfsLabels(wet, W, H, conn, B.rank);
      if (fl.wetCount !== nWet) fail(`${tag}: wetCount at ${t}`);
      if (fl.alive() !== new Set(lab.filter((x) => x >= 0)).size) fail(`${tag}: alive at ${t}`);
      for (let i = 0; i < h.length; i++) {
        if (fl.isWet(i) !== wet[i]) fail(`${tag}: isWet(${i}) at ${t}`);
        const r = fl.componentOf(i);
        if (r !== lab[i]) fail(`${tag}: componentOf(${i})=${r} want ${lab[i]} at ${t}`);
        if (r >= 0 && fl.parent[i] !== r) fail(`${tag}: no path compression at ${i}`);
        compChecks++;
      }
      floodChecks++;
    }
    for (const p of [-5, 0, 12.5, 33, 50, 99.9, 100, 150]) {
      const q = Math.min(100, Math.max(0, p));
      const want = h[B.order[Math.round((q / 100) * (h.length - 1))]];
      const got = fl.levelAtPercentile(p);
      if (!Object.is(got === 0 ? 0 : got, want === 0 ? 0 : want)) fail(`${tag}: levelAtPercentile(${p})`);
      fl.advanceTo(got);
      if (fl.wetCount < Math.round((q / 100) * (h.length - 1)) + 1) fail(`${tag}: percentile flood too small`);
    }
  }
}
// golden explicit
const G = computeH0(Float32Array.from([10, 1, 8, 3, 6, 5, 10]), 7, 1);
console.log(
  'golden bars:',
  JSON.stringify(G.bars.map((b) => [b.birth, b.death, b.birthCell, b.deathCell])),
);
for (const c of [4, 8]) {
  const C = computeH0(Float32Array.from([0, 1, 1, 0]), 2, 2, { connectivity: c });
  console.log(`checkerboard c${c}:`, JSON.stringify(C.bars.map((b) => [b.birth, b.death, b.birthCell, b.deathCell])));
}
console.log(
  `grids=${grids.length} (x2 connectivities), with ties=${tieGrids}, zero-length bars (both conn)=${zlTotal}, flood levels checked=${floodChecks}, componentOf checks=${compChecks}`,
);
console.log(fails.length ? `FAILURES: ${fails.length}` : 'ALL OK');
process.exit(fails.length ? 1 : 0);
