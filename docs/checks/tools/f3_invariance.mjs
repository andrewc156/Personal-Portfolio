// F3 checker: (birthCell, deathCell) pairs invariant under strictly increasing maps (exact in float32).
import { computeH0, allFiniteBars } from '../../../src/lib/tda/index.ts';
let s = 7; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const maps = [(v) => 3 * v + 11, (v) => v * v * v, (v) => (v < 2 ? v : 100 + v * 7), (v) => -1000 + Math.exp(v)];
let bad = 0, n = 0;
for (let g = 0; g < 300; g++) {
  const W = 1 + Math.floor(r() * 40), H = 1 + Math.floor(r() * 40), m = 1 + Math.floor(r() * 8);
  const h = Float32Array.from({ length: W * H }, () => Math.floor(r() * m) - 3);
  for (const conn of [4, 8]) {
    const key = (x) => JSON.stringify([allFiniteBars(x).map((b) => [b.birthCell, b.deathCell]), x.bars.filter((b) => b.death === Infinity).map((b) => b.birthCell)]);
    const base = key(computeH0(h, W, H, { connectivity: conn }));
    for (const f of maps) { n++; if (key(computeH0(Float32Array.from(h, f), W, H, { connectivity: conn })) !== base) bad++; }
  }
}
console.log(`invariance checks=${n} mismatches=${bad}`); process.exit(bad ? 1 : 0);
