// F4b checker: run committed TS engine (src/lib/tda) on grid.f32, compare with barcode.json and my pairs.
import { readFileSync } from 'node:fs';
import { computeH0 } from '../../../src/lib/tda/index.ts';
const [gridPath, bcPath, minePath] = process.argv.slice(2);
const buf = readFileSync(gridPath);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const W = 326, H = 414, n = W * H;
const h = new Float32Array(n);
for (let i = 0; i < n; i++) h[i] = dv.getFloat32(i * 4, true);
const t0 = performance.now();
const r = computeH0(h, W, H);
const ms = performance.now() - t0;
const kept = r.bars.filter((b) => b.death === Infinity || b.death - b.birth >= 1)
  .map((b) => [b.birth, b.death === Infinity ? null : b.death, b.birthCell, b.deathCell, b.mergedInto]);
const bc = JSON.parse(readFileSync(bcPath, 'utf8'));
const cols = bc.b.map((_, k) => [bc.b[k], bc.d[k], bc.bi[k], bc.di[k], bc.mi[k]]);
const mine = JSON.parse(readFileSync(minePath, 'utf8')).all.filter((x) => x[1] === null || x[1] - x[0] >= 1);
const eq = (a, b) => a.length === b.length && a.every((x, k) => x.every((v, j) => v === b[k][j]));
console.log(`TS computeH0 ${ms.toFixed(0)} ms; stats`, JSON.stringify(r.stats));
console.log('TS kept', kept.length, '| TS == barcode.json (ordered, exact):', eq(kept, cols), '| TS == my union-find:', eq(kept, mine));
