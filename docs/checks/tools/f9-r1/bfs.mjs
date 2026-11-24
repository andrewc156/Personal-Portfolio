import assert from 'node:assert/strict';
import { computeH0 } from '../../../../src/lib/tda/h0.ts';

// Re-label the entire wet set at each filtration step. Breaking ties one cell
// at a time also recovers ephemeral bars born and killed on the same plateau.
function check(values, width, connectivity) {
  const height = values.length / width;
  const older = (a, b) => values[a] - values[b] || a - b;
  const wet = new Set();
  let previous = new Set();
  const pairs = [];
  for (const next of [...values.keys()].sort(older)) {
    wet.add(next);
    const unseen = new Set(wet);
    const survivors = new Set();
    for (const start of unseen) {
      const queue = [start];
      unseen.delete(start);
      let birth = start;
      for (const cell of queue) {
        if (older(cell, birth) < 0) birth = cell;
        for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
          if (connectivity === 4 && dx && dy) continue;
          const x = cell % width + dx;
          const y = Math.floor(cell / width) + dy;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const neighbor = y * width + x;
          if (unseen.delete(neighbor)) queue.push(neighbor);
        }
      }
      survivors.add(birth);
    }
    for (const birth of previous) if (!survivors.has(birth)) pairs.push([birth, next]);
    previous = survivors;
  }
  for (const survivor of previous) pairs.push([survivor, -1]);
  const result = computeH0(Float32Array.from(values), width, height, {connectivity});
  assert.deepEqual([...result.bars, ...result.zeroLength].map(b => [b.birthCell, b.deathCell]).sort(), pairs.sort());
  return pairs;
}
assert.deepEqual(check([10,1,8,3,6,5,10],7,4), [[1,-1],[3,2],[5,4]]);
assert.deepEqual(check([0,1,1,0],2,4), [[0,-1],[3,1]]);
assert.deepEqual(check([0,1,1,0],2,8), [[0,-1]]);
let state = 190731;
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 2 ** 32;
}
for (let i = 0; i < 128; i++) {
  const width = 1 + Math.floor(random() * 9);
  const height = 1 + Math.floor(random() * 9);
  const values = Array.from({length: width * height}, () => i % 2 ? Math.floor(random() * 5) : random());
  for (const connectivity of [4,8]) check(Float32Array.from(values),width,connectivity);
}
console.log('128 grids × 2 connectivities, golden and checkerboards passed');
