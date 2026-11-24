import { readFileSync } from 'node:fs';
import { computeH0 } from '../../../../src/lib/tda/index.ts';
const buf = readFileSync('public/data/colorado/grid.f32');
const h = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const t0 = performance.now(); const r = computeH0(h, 326, 414); const ms = performance.now() - t0;
const bj = JSON.parse(readFileSync('public/data/colorado/barcode.json', 'utf8'));
const ts = r.bars.filter((b) => b.death === Infinity || b.death - b.birth >= 1);
let same = ts.length === bj.bi.length;
for (let k = 0; same && k < ts.length; k++) {
  const b = ts[k];
  same = b.birthCell === bj.bi[k] && b.deathCell === bj.di[k] && b.mergedInto === bj.mi[k] && b.birth === bj.b[k] && (bj.d[k] === null ? b.death === Infinity : b.death === bj.d[k]);
}
const mine = JSON.parse(readFileSync(process.argv[2], 'utf8')).map((m) => m.join(',')).sort();
const tsp = ts.filter((b) => b.death !== Infinity).map((b) => [b.birthCell, b.deathCell, b.mergedInto].join(',')).sort();
console.log(`TS computeH0 ${ms.toFixed(1)} ms; TS == barcode.json in order and exact values: ${same} (${ts.length} bars); TS == my UF (sorted): ${JSON.stringify(mine) === JSON.stringify(tsp)}`);
