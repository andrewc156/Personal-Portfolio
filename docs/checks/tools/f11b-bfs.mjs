import assert from 'node:assert/strict';
import { computeH1Islands } from '../../../src/lib/tda/h1.ts';

// Raise the water a cell at a time and reflood every dry component with BFS.
// Tracking component maxima across splits permits independently discovering zero bars.
function oracle(heights, w, h, water) {
  const n = w * h;
  const cells = Array.from({length: n}, (_, i) => i);
  const age = (a, b) => heights[a] - heights[b] || a - b;
  const wet = new Uint8Array(n);
  let owners = new Int32Array(n).fill(-1);
  const births = new Map();
  const neighbors = cells.map((i) => cells.filter((j) => {
    const dx = Math.abs(i % w - j % w);
    const dy = Math.abs(Math.floor(i / w) - Math.floor(j / w));
    return i !== j && dx <= 1 && dy <= 1 && (water === 4 || dx + dy === 1);
  }));
  const border = (i) => i < w || i >= n-w || i % w === 0 || i % w === w-1;
  for (const removed of [...cells].sort(age)) {
    wet[removed] = 1;
    const seen = new Uint8Array(n);
    const after = new Int32Array(n).fill(-1);
    for (const start of cells) {
      if (wet[start] || seen[start]) continue;
      const component = [start];
      let peak = start;
      let mainland = border(start);
      seen[start] = 1;
      for (let head = 0; head < component.length; head++) {
        for (const next of neighbors[component[head]]) {
          if (wet[next] || seen[next]) continue;
          seen[next] = 1;
          component.push(next);
          if (age(next, peak) > 0) peak = next;
          mainland ||= border(next);
        }
      }
      if (mainland) continue;
      for (const i of component) after[i] = peak;
      if (owners[peak] !== peak) {
        assert(!births.has(peak));
        births.set(peak, [peak, removed, owners[peak], heights[removed], heights[peak]]);
      }
    }
    owners = after;
  }
  return [...births.values()].sort((a, b) => a[0] - b[0]);
}
const check = (height, w, h, water) => {
  const result = computeH1Islands(height, w, h, { connectivity: water });
  const actual = [...result.bars, ...result.zeroLength].map(
    ({peakCell, saddleCell, mergedInto, birth, death}) => [peakCell, saddleCell, mergedInto, birth, death],
  ).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(actual, oracle(height, w, h, water), JSON.stringify({ height: [...height], w, h, water }));
};
let state = 789421;
const next = () => (state = (Math.imul(state,1664525) + 1013904223) >>> 0);
for (let i = 0; i < 144; i++) {
  const w = 1 + next() % 7;
  const h = 1 + next() % 8;
  const height = Float32Array.from({length:w*h}, () => i % 2 ? next() % 5 : next() / 0x100000000);
  for (const water of [4,8]) check(height,w,h,water);
}
const cone = Float32Array.from([1,1,1,1,3,1,1,1,1]);
assert.deepEqual(oracle(cone,3,3,4), [[4,8,-1,1,3]]);
check(cone,3,3,4);
console.log('Independent rising high-set BFS: 144 random grids × 2 connectivities and a tied 3×3 cone agree on each peak, saddle, parent and level, including zero bars.');
