// Compare TS computeH0 with GUDHI dumps from f3_gudhi.py (finite bars as multisets, tol 1e-9).
import { readFileSync } from 'node:fs';
import { computeH0, allFiniteBars } from '../../../src/lib/tda/index.ts';
const cases = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ms = (a) => a.map((p) => [p[0], p[1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
let bad = { 4: 0, 8: 0 }, ess = 0, nb = 0;
for (const c of cases) {
  const h = Float32Array.from(c.h);
  for (const [conn, key] of [[4, 'v'], [8, 't']]) {
    const R = computeH0(h, c.W, c.H, { connectivity: conn });
    const mine = ms(allFiniteBars(R).filter((b) => b.death > b.birth).map((b) => [b.birth, b.death]));
    const ref = ms(c[key].filter((p) => p[1] !== null && p[1] > p[0]));
    const ok = mine.length === ref.length && mine.every((p, k) => Math.abs(p[0] - ref[k][0]) <= 1e-9 && Math.abs(p[1] - ref[k][1]) <= 1e-9);
    if (!ok) bad[conn]++;
    if (conn === 4) { nb += mine.length;
      const ge = c[key].filter((p) => p[1] === null).map((p) => p[0]);
      const me = R.bars.filter((b) => b.death === Infinity).map((b) => b.birth);
      if (JSON.stringify(ge) !== JSON.stringify(me)) ess++; }
  }
}
console.log(`cases=${cases.length} finite bars (4c)=${nb} mismatches: 4c-vs-vertices=${bad[4]} 8c-vs-top_dimensional_cells=${bad[8]} essential(4c) mismatches=${ess}`);
process.exit(bad[4] + bad[8] + ess ? 1 : 0);
