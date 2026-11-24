// F3 checker: TS engine vs pipeline/tda_ref.py on the full Colorado grid.f32, both connectivities.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { computeH0, allFiniteBars } from '../../../src/lib/tda/index.ts';
const buf = readFileSync('public/data/colorado/grid.f32');
const h = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const W = 326, H = 414;
const py = `
import sys,json,numpy as np
sys.path.insert(0,'.')
from pipeline.tda_ref import compute_h0
a=np.fromfile('public/data/colorado/grid.f32',dtype='<f4').reshape(414,326)
out={}
for c in (4,8):
  r=compute_h0(a,c)
  out[c]={'f':[[b.birth_cell,b.death_cell,b.merged_into,b.birth,b.death] for b in r.finite],'e':[b.birth_cell for b in r.essential],'n':r.births,'z':len(r.zero_length),'o':r.order.tolist()}
print(json.dumps(out))`;
const P = JSON.parse(execFileSync('pipeline/.venv/bin/python', ['-c', py], { maxBuffer: 1 << 28 }).toString());
let ok = true;
for (const c of [4, 8]) {
  const R = computeH0(h, W, H, { connectivity: c });
  const f = allFiniteBars(R).map((b) => [b.birthCell, b.deathCell, b.mergedInto, b.birth, b.death]);
  const e = R.bars.filter((b) => b.death === Infinity).map((b) => b.birthCell);
  const same = JSON.stringify(f) === JSON.stringify(P[c].f) && JSON.stringify(e) === JSON.stringify(P[c].e)
    && R.stats.births === P[c].n && R.stats.zeroLength === P[c].z && JSON.stringify([...R.order]) === JSON.stringify(P[c].o);
  ok &&= same;
  const vis = R.bars.filter((b) => b.death !== Infinity);
  console.log(`c${c}: births=${R.stats.births} finite=${f.length} visible=${vis.length} zeroLength=${R.stats.zeroLength} essential=${e} (h=${h[e[0]]}) maxPers=${Math.max(...vis.map(b=>b.death-b.birth)).toFixed(3)} identical=${same}`);
}
process.exit(ok ? 0 : 1);
