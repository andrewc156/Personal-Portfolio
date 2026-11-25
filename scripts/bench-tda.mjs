// Benchmark for the persistence engine (spec §6.2, F3 criterion 7).
// Usage: node scripts/bench-tda.mjs   (Node ≥ 22.18 / 23.6 runs the .ts sources via type stripping)
//
// Measures, at 326×414 = 134,964 cells:
//   - computeH0: one cold call, then repeated warm calls (median / p95).
//   - Flood per frame: advanceTo(next level) + a recolor-equivalent pass over every cell
//     (isWet + componentOf per cell, writing a packed RGBA Uint32Array), for 600 frames per sweep
//     from the minimum to the maximum level, under both linear and percentile pacing.
//   - Islands (H1, stretch S2): computeH1Islands cold + warm, and an Islands frame
//     (advanceTo + islandOf for every cell) under linear pacing, at 326×414 and at 200×200
//     (40k cells), next to computeH0 on the same grid for comparison.
// Terrains: seeded fractal value noise (hero-like), white noise (worst case: most minima), and
// the Colorado grid if public/data/colorado/grid.f32 exists.
import { existsSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { computeH0, computeH1Islands, Flood, Islands } from '../src/lib/tda/index.ts';

const W = 326;
const H = 414;
const N = W * H;
const FRAMES = 600;
const SWEEPS = 5;
const H0_RUNS = 25;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed) {
  const r = mulberry32(seed);
  const h = new Float32Array(N);
  let amp = 1;
  for (let octave = 0, cell = 64; octave < 6; octave++, cell /= 2, amp *= 0.5) {
    const gw = Math.ceil(W / cell) + 2;
    const gh = Math.ceil(H / cell) + 2;
    const lattice = Float32Array.from({ length: gw * gh }, () => r());
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fx = x / cell;
        const fy = y / cell;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const sx = (fx - x0) * (fx - x0) * (3 - 2 * (fx - x0));
        const sy = (fy - y0) * (fy - y0) * (3 - 2 * (fy - y0));
        const a = lattice[y0 * gw + x0];
        const b = lattice[y0 * gw + x0 + 1];
        const c = lattice[(y0 + 1) * gw + x0];
        const d = lattice[(y0 + 1) * gw + x0 + 1];
        h[y * W + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
  }
  for (let i = 0; i < N; i++) h[i] = Math.round(h[i] * 1000) / 10; // "metres", with ties
  return h;
}

function whiteNoise(seed) {
  const r = mulberry32(seed);
  return Float32Array.from({ length: N }, () => r() * 3000);
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, median: q(0.5), p95: q(0.95), max: s[s.length - 1], min: s[0] };
}

const fmt = (x) => x.toFixed(3).padStart(8);

function benchH0(heights) {
  const t0 = performance.now();
  const first = computeH0(heights, W, H);
  const cold = performance.now() - t0;
  const times = [];
  for (let k = 0; k < H0_RUNS; k++) {
    const t = performance.now();
    computeH0(heights, W, H);
    times.push(performance.now() - t);
  }
  return { cold, warm: stats(times), result: first };
}

function benchFlood(heights, order, pacing) {
  const flood = new Flood(heights, W, H, { order });
  const pixels = new Uint32Array(N);
  const lakeColor = new Uint32Array(N); // per-lake colour, indexed by root (birth cell)
  for (let i = 0; i < N; i++) lakeColor[i] = 0xff000000 | ((i * 2654435761) >>> 8);
  const LAND = 0xff7f9f6f;
  const lo = heights[order[0]];
  const hi = heights[order[N - 1]];
  const levelAt = (f) =>
    pacing === 'linear'
      ? lo + ((hi - lo) * f) / FRAMES
      : flood.levelAtPercentile((100 * f) / FRAMES);
  const times = [];
  let checksum = 0;
  let maxEvents = 0;
  for (let sweep = 0; sweep < SWEEPS + 1; sweep++) {
    flood.reset();
    for (let f = 1; f <= FRAMES; f++) {
      const t = performance.now();
      const events = flood.advanceTo(levelAt(f));
      for (let i = 0; i < N; i++) {
        pixels[i] = flood.isWet(i) ? lakeColor[flood.componentOf(i)] : LAND;
      }
      const dt = performance.now() - t;
      if (sweep > 0) times.push(dt); // sweep 0 is JIT warm-up
      if (events.length > maxEvents) maxEvents = events.length;
      checksum = (checksum + pixels[(f * 7919) % N]) >>> 0;
    }
  }
  const over = times.filter((t) => t > 6).length;
  return { ...stats(times), over, maxEvents, checksum };
}

function terrains() {
  const list = [
    ['value noise (seed 1)', valueNoise(1)],
    ['white noise (seed 2)', whiteNoise(2)],
  ];
  const grid = new URL('../public/data/colorado/grid.f32', import.meta.url);
  const meta = new URL('../public/data/colorado/meta.json', import.meta.url);
  if (existsSync(grid) && existsSync(meta)) {
    const m = JSON.parse(readFileSync(meta, 'utf8'));
    const buf = readFileSync(grid);
    if (m.width === W && m.height === H && buf.byteLength === N * 4) {
      const f = new Float32Array(buf.buffer, buf.byteOffset, N);
      list.push(['Colorado grid.f32', Float32Array.from(f)]);
    }
  }
  return list;
}

console.log(`bench-tda: ${W}×${H} = ${N} cells, 4-connectivity`);
console.log(`machine: ${cpus()[0]?.model ?? 'unknown'} (${cpus().length} logical cores)`);
console.log(`node ${process.version}, ${process.platform}/${process.arch}`);
console.log(`targets: computeH0 ≤ 300 ms; Flood frame (advanceTo + recolor pass) ≤ 6 ms\n`);

let ok = true;
for (const [name, heights] of terrains()) {
  const h0 = benchH0(heights);
  const s = h0.result.stats;
  console.log(
    `## ${name}: ${s.births} births, ${h0.result.bars.length - s.essential} bars > 0, ${s.zeroLength} zero-length`,
  );
  console.log(
    `computeH0   cold ${fmt(h0.cold)} ms | warm median ${fmt(h0.warm.median)} ms  p95 ${fmt(h0.warm.p95)} ms  max ${fmt(h0.warm.max)} ms  (n=${h0.warm.n})`,
  );
  ok &&= h0.cold <= 300 && h0.warm.p95 <= 300;
  for (const pacing of ['linear', 'percentile']) {
    const fl = benchFlood(heights, h0.result.order, pacing);
    console.log(
      `Flood/frame ${pacing.padEnd(10)} median ${fmt(fl.median)} ms  p95 ${fmt(fl.p95)} ms  max ${fmt(fl.max)} ms  (n=${fl.n}, ${fl.over} > 6 ms, ≤${fl.maxEvents} events/frame)`,
    );
    ok &&= fl.p95 <= 6;
  }
  console.log('');
}
function benchIslands(heights, w, h) {
  const n = w * h;
  const order = computeH0(heights, w, h).order;
  const t0 = performance.now();
  const first = computeH1Islands(heights, w, h);
  const cold = performance.now() - t0;
  const times = [];
  const h0times = [];
  for (let k = 0; k < H0_RUNS; k++) {
    let t = performance.now();
    computeH1Islands(heights, w, h);
    times.push(performance.now() - t);
    t = performance.now();
    computeH0(heights, w, h);
    h0times.push(performance.now() - t);
  }
  const isl = new Islands(heights, w, h, { order });
  const lo = heights[order[0]];
  const hi = heights[order[n - 1]];
  const frames = [];
  let checksum = 0;
  for (let sweep = 0; sweep < SWEEPS + 1; sweep++) {
    isl.reset();
    for (let f = 1; f <= FRAMES; f++) {
      const t = performance.now();
      isl.advanceTo(lo + ((hi - lo) * f) / FRAMES);
      for (let i = 0; i < n; i++) checksum = (checksum + isl.islandOf(i)) | 0;
      const dt = performance.now() - t;
      if (sweep > 0) frames.push(dt);
    }
  }
  return {
    cold,
    warm: stats(times),
    h0: stats(h0times),
    frame: stats(frames),
    result: first,
    checksum,
  };
}

function crop(heights, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = heights[y * W + x];
  return out;
}

console.log('# Islands (H1)\n');
for (const [name, heights] of terrains()) {
  for (const [w, h] of [
    [W, H],
    [200, 200],
  ]) {
    const g = w === W && h === H ? heights : crop(heights, w, h);
    const b = benchIslands(g, w, h);
    const s = b.result.stats;
    console.log(
      `## ${name} ${w}×${h}: ${s.births} hill births, ${b.result.bars.length} island bars > 0, ${s.zeroLength} zero-length`,
    );
    console.log(
      `computeH1Islands cold ${fmt(b.cold)} ms | warm median ${fmt(b.warm.median)} ms  p95 ${fmt(b.warm.p95)} ms  (computeH0 same grid: median ${fmt(b.h0.median)} ms  p95 ${fmt(b.h0.p95)} ms)`,
    );
    console.log(
      `Islands/frame (advanceTo + islandOf ×${w * h}) median ${fmt(b.frame.median)} ms  p95 ${fmt(b.frame.p95)} ms  max ${fmt(b.frame.max)} ms  (n=${b.frame.n})`,
    );
    ok &&= b.cold <= 300 && b.warm.p95 <= 300 && b.frame.p95 <= 6;
  }
  console.log('');
}

console.log(ok ? 'PASS: all targets met (cold/p95)' : 'FAIL: a target was missed');
process.exitCode = ok ? 0 : 1;
