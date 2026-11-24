// F9: compare src/lib/tda (TS) against brute_h0.py cases (independent reference).
import { readFileSync } from 'node:fs';
import { computeH0, allFiniteBars } from '../../../../src/lib/tda/index.ts';
const cases = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let bad = 0, nb = 0;
const key = (b) => `${b[2]}|${b[3]}|${b[0]}|${b[1]}`;
for (const [k, c] of cases.entries()) {
  const r = computeH0(new Float32Array(c.h), c.W, c.H, { connectivity: c.conn });
  const fin = allFiniteBars(r).map((b) => [b.birth, b.death, b.birthCell, b.deathCell]);
  const ess = r.bars.filter((b) => b.death === Infinity).map((b) => [b.birth, null, b.birthCell, -1]);
  const got = [...fin, ...ess].map(key).sort();
  const exp = c.bars.map((b) => [Math.fround(b[0]), b[1] === null ? null : Math.fround(b[1]), b[2], b[3]]).map(key).sort();
  nb += exp.length;
  const ok = got.length === exp.length && got.every((g, i) => g === exp[i]) && r.stats.births === c.births;
  if (!ok) { bad++; if (bad < 4) console.log('MISMATCH', k, c.W, c.H, c.conn, { got, exp, births: [r.stats.births, c.births] }); }
}
console.log(`TS vs brute: ${cases.length} cases, ${nb} bars, ${bad} mismatches`);
