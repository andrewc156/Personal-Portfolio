/*
 * F10 checker: independent numerical checks of the extra hero modes.
 * Bundle + run:
 *   npx esbuild docs/checks/tools/f10-math.ts --bundle --platform=node --format=esm \
 *     --outfile=<scratch>/f10-math.mjs && node <scratch>/f10-math.mjs
 * Uses the builder's modules only as the thing under test; every oracle here is my own.
 */
import { streamField, velocityAt, DyeField } from '../../../src/lib/viz/hero/modes/dye.ts';
import {
  kochSnowflake,
  rasterize,
  pondPolygon,
  WaveField,
  POND_COURANT,
  MAX_COURANT,
} from '../../../src/lib/viz/hero/modes/pond.ts';
import { scheidegger, strahler, rowY } from '../../../src/lib/viz/hero/modes/rivers.ts';
import { reverseTree, collatzStep } from '../../../src/lib/viz/hero/modes/collatz.ts';

let fails = 0;
function ok(cond: boolean, msg: string): void {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
}
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 1. Curl field ---------------- */
{
  const r = rng(1);
  let maxDiv = 0;
  let maxGrad = 0;
  let maxJump = 0;
  let maxWall = 0;
  let maxFlux = 0;
  const v = new Float64Array(2);
  const vel = (psi: Float32Array, W: number, H: number, x: number, y: number) => {
    velocityAt(psi, W, H, x, y, v);
    return [v[0], v[1]];
  };
  for (const [W, H, seed] of [
    [80, 50, 1],
    [200, 120, 7],
    [33, 17, 12345],
  ] as const) {
    const psi = streamField(W, H, seed);
    // (a) pointwise divergence by central differences, kept inside one cell
    for (let n = 0; n < 4000; n++) {
      const i = Math.floor(r() * W);
      const j = Math.floor(r() * H);
      const x = i + 0.05 + 0.9 * r();
      const y = j + 0.05 + 0.9 * r();
      const h = 1e-3;
      const [ue] = vel(psi, W, H, x + h, y);
      const [uw] = vel(psi, W, H, x - h, y);
      const [, vs] = vel(psi, W, H, x, y + h);
      const [, vn] = vel(psi, W, H, x, y - h);
      const div = (ue - uw) / (2 * h) + (vs - vn) / (2 * h);
      maxDiv = Math.max(maxDiv, Math.abs(div));
      maxGrad = Math.max(maxGrad, Math.abs((ue - uw) / (2 * h)), Math.abs((vs - vn) / (2 * h)));
    }
    // (b) normal velocity continuous across interior cell edges
    for (let n = 0; n < 2000; n++) {
      const i = 1 + Math.floor(r() * (W - 2));
      const y = 0.01 + r() * (H - 0.02);
      const e = 1e-7;
      const [a] = vel(psi, W, H, i - e, y);
      const [b] = vel(psi, W, H, i + e, y);
      maxJump = Math.max(maxJump, Math.abs(a - b));
      const j = 1 + Math.floor(r() * (H - 2));
      const x = 0.01 + r() * (W - 0.02);
      const [, c] = vel(psi, W, H, x, j - e);
      const [, d] = vel(psi, W, H, x, j + e);
      maxJump = Math.max(maxJump, Math.abs(c - d));
    }
    // (c) no flow through the walls
    for (let n = 0; n < 1000; n++) {
      const y = r() * H;
      const x = r() * W;
      maxWall = Math.max(
        maxWall,
        Math.abs(vel(psi, W, H, 0, y)[0]),
        Math.abs(vel(psi, W, H, W, y)[0]),
        Math.abs(vel(psi, W, H, x, 0)[1]),
        Math.abs(vel(psi, W, H, x, H)[1]),
      );
    }
    // (d) my own boundary line integral of u·n over random cells (Gauss-Legendre 3 pts)
    const gl = [
      [0.5 - Math.sqrt(0.15), 5 / 18],
      [0.5, 8 / 18],
      [0.5 + Math.sqrt(0.15), 5 / 18],
    ];
    for (let n = 0; n < 500; n++) {
      const i = Math.floor(r() * W);
      const j = Math.floor(r() * H);
      let f = 0;
      const e = 1e-9;
      for (const [t, w] of gl) {
        f += w * vel(psi, W, H, i + 1 - e, j + t)[0];
        f -= w * vel(psi, W, H, i + e, j + t)[0];
        f += w * vel(psi, W, H, i + t, j + 1 - e)[1];
        f -= w * vel(psi, W, H, i + t, j + e)[1];
      }
      maxFlux = Math.max(maxFlux, Math.abs(f));
    }
  }
  ok(maxDiv < 1e-6 * Math.max(1, maxGrad), `curl: max |div u| = ${maxDiv.toExponential(2)} (max |∂u/∂x| ${maxGrad.toFixed(3)})`);
  ok(maxJump < 1e-4, `curl: normal-velocity jump across edges ≤ ${maxJump.toExponential(2)}`);
  ok(maxWall < 1e-9, `curl: wall-normal velocity ≤ ${maxWall.toExponential(2)}`);
  ok(maxFlux < 1e-5, `curl: per-cell net boundary flux (own quadrature) ≤ ${maxFlux.toExponential(2)}`);

  // Brownian: with the current switched off, displacement variance ≈ 2 D t
  const f = new DyeField(400, 400, 3);
  (f.psi as Float32Array).fill(0);
  // freeze the current: zero both blend fields
  (f as unknown as { a: Float32Array }).a.fill(0);
  (f as unknown as { b: Float32Array }).b.fill(0);
  // release a cloud at the centre and track variance growth over 120 steps
  f.release(200, 200);
  const x0 = Float64Array.from(f.px);
  const y0 = Float64Array.from(f.py);
  const born = Int32Array.from(f.born);
  const steps = 120;
  for (let k = 0; k < steps; k++) f.step();
  let s = 0;
  let cnt = 0;
  for (let k = 0; k < f.px.length; k++) {
    if (born[k] !== 0) continue; // only the released cloud at step 0
    s += (f.px[k] - x0[k]) ** 2 + (f.py[k] - y0[k]) ** 2;
    cnt++;
  }
  const varPerAxis = s / cnt / 2;
  const expect = 2 * 0.5 * (steps / 60);
  ok(Math.abs(varPerAxis / expect - 1) < 0.12, `brownian: per-axis var ${varPerAxis.toFixed(3)} vs 2DΔt·n ${expect.toFixed(3)} (n=${cnt})`);
}

/* ---------------- 2. Wave scheme ---------------- */
{
  // own von Neumann check: max |g| over all wavenumbers for leapfrog 5-point
  const amp = (C: number) => {
    let m = 0;
    for (let a = 0; a <= 200; a++)
      for (let b = 0; b <= 200; b++) {
        const kx = (Math.PI * a) / 200;
        const ky = (Math.PI * b) / 200;
        const s = 4 * C * C * (Math.sin(kx / 2) ** 2 + Math.sin(ky / 2) ** 2);
        // g² − (2 − s) g + 1 = 0
        const B = 2 - s;
        const disc = B * B - 4;
        const g = disc <= 0 ? 1 : Math.max(Math.abs((B + Math.sqrt(disc)) / 2), Math.abs((B - Math.sqrt(disc)) / 2));
        m = Math.max(m, g);
      }
    return m;
  };
  ok(POND_COURANT === 0.5 && Math.abs(MAX_COURANT - Math.SQRT1_2) < 1e-15, `wave: chosen C = ${POND_COURANT}, limit ${MAX_COURANT}`);
  ok(amp(POND_COURANT) <= 1 + 1e-12, `wave: von Neumann max|g| at C=0.5 is ${amp(0.5)}`);
  ok(amp(0.75) > 1.01, `wave: von Neumann max|g| at C=0.75 is ${amp(0.75).toFixed(3)} (> 1, unstable)`);

  // own leapfrog reference vs the builder's field, on a Koch mask, no damping
  const W = 120;
  const H = 90;
  const mask = rasterize(pondPolygon(W, H, 4, 0.3), W, H);
  const f = new WaveField(W, H, mask, 0.5, 0);
  f.drop(60.3, 44.7);
  f.drop(40.5, 50.2, 0.7, 2);
  const m = f.mask;
  let u = Float64Array.from(f.u);
  let p = Float64Array.from(f.prev);
  const c2 = 0.25;
  const energy = (uu: Float64Array, pp: Float64Array) => {
    let kin = 0;
    let pot = 0;
    for (let k = 0; k < W * H; k++) kin += (uu[k] - pp[k]) ** 2;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (i + 1 < W) pot += (uu[k + 1] - uu[k]) * (pp[k + 1] - pp[k]);
        if (j + 1 < H) pot += (uu[k + W] - uu[k]) * (pp[k + W] - pp[k]);
      }
    return 0.5 * kin + 0.5 * c2 * pot;
  };
  const E0 = energy(u, p);
  let maxDev = 0;
  let maxDiff = 0;
  let wallMax = 0;
  let maxAmp = 0;
  for (let s = 0; s < 20000; s++) {
    const nx = new Float64Array(W * H);
    for (let k = 0; k < W * H; k++) {
      if (!m[k]) continue;
      nx[k] = 2 * u[k] - p[k] + c2 * (u[k - 1] + u[k + 1] + u[k - W] + u[k + W] - 4 * u[k]);
    }
    p = u;
    u = nx;
    f.step();
    if (s % 500 === 0 || s === 19999) {
      const E = energy(u, p);
      maxDev = Math.max(maxDev, Math.abs(E / E0 - 1));
      for (let k = 0; k < W * H; k++) {
        maxDiff = Math.max(maxDiff, Math.abs(u[k] - f.u[k]));
        if (!m[k]) wallMax = Math.max(wallMax, Math.abs(f.u[k]));
        maxAmp = Math.max(maxAmp, Math.abs(f.u[k]));
      }
    }
  }
  ok(maxDev < 1e-6, `wave: own discrete energy drift over 20,000 steps ${maxDev.toExponential(2)}`);
  ok(maxDiff < 1e-3, `wave: builder field vs own float64 leapfrog, max diff ${maxDiff.toExponential(2)}`);
  ok(wallMax === 0, `wave: wall cells stay exactly 0 (max ${wallMax})`);
  ok(maxAmp < 3, `wave: amplitude bounded (max |u| ${maxAmp.toFixed(3)})`);
  // the production damping only removes energy
  const g = new WaveField(W, H, mask, 0.5, 0.0018);
  g.drop(60.3, 44.7);
  let last = Infinity;
  let mono = true;
  for (let s = 0; s < 3000; s++) {
    g.step();
    if (s % 100 === 99) {
      const E = g.energy();
      if (E > last * (1 + 1e-6)) mono = false;
      last = E;
    }
  }
  ok(mono, `wave: damped energy non-increasing (100-step samples), final ${last.toExponential(2)}`);
  let threw = false;
  try {
    new WaveField(W, H, mask, 0.72, 0);
  } catch {
    threw = true;
  }
  ok(threw, 'wave: constructor rejects C = 0.72 > 1/√2');
}

/* ---------------- 3. Koch geometry ---------------- */
{
  for (let n = 0; n <= 5; n++) {
    const P = kochSnowflake(n);
    const N = P.length / 2;
    const side0 = Math.hypot(P[2] - P[0], P[3] - P[1]);
    // own edge lengths, perimeter
    let minE = Infinity;
    let maxE = 0;
    let per = 0;
    for (let k = 0; k < N; k++) {
      const q = (k + 1) % N;
      const e = Math.hypot(P[2 * q] - P[2 * k], P[2 * q + 1] - P[2 * k + 1]);
      minE = Math.min(minE, e);
      maxE = Math.max(maxE, e);
      per += e;
    }
    // own signed area
    let a = 0;
    for (let k = 0; k < N; k++) {
      const q = (k + 1) % N;
      a += P[2 * k] * P[2 * q + 1] - P[2 * q] * P[2 * k + 1];
    }
    a = Math.abs(a) / 2;
    const s = Math.sqrt(3); // level-0 side of a unit-circumradius triangle
    const A0 = (Math.sqrt(3) / 4) * s * s;
    const An = A0 * (1 + (3 / 5) * (1 - (4 / 9) ** n));
    const okN = N === 3 * 4 ** n;
    const okE = Math.abs(minE - s / 3 ** n) < 1e-9 && Math.abs(maxE - s / 3 ** n) < 1e-9;
    const okP = Math.abs(per - 3 * s * (4 / 3) ** n) < 1e-9;
    const okA = Math.abs(a / An - 1) < 1e-9;
    ok(okN && okE && okP && okA, `koch level ${n}: verts ${N}, edge ${minE.toFixed(6)}…${maxE.toFixed(6)} (want ${(s / 3 ** n).toFixed(6)}), perimeter ${per.toFixed(6)}, area ${a.toFixed(6)} vs ${An.toFixed(6)}`);
    void side0;
    // 120° rotational symmetry: rotating vertex k by 120° gives vertex k + N/3
    let sym = 0;
    const c = Math.cos((2 * Math.PI) / 3);
    const sn = Math.sin((2 * Math.PI) / 3);
    for (let k = 0; k < N; k++) {
      const q = (k + N / 3) % N;
      const x = c * P[2 * k] - sn * P[2 * k + 1];
      const y = sn * P[2 * k] + c * P[2 * k + 1];
      sym = Math.max(sym, Math.hypot(x - P[2 * q], y - P[2 * q + 1]));
    }
    ok(sym < 1e-9, `koch level ${n}: 120° symmetry error ${sym.toExponential(2)}`);
    // simple polygon (no edge crossings) for n ≤ 3, brute force
    if (n <= 3) {
      let cross = 0;
      const seg = (k: number) => [P[2 * k], P[2 * k + 1], P[2 * ((k + 1) % N)], P[2 * ((k + 1) % N) + 1]];
      const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
        Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
      for (let i = 0; i < N; i++)
        for (let j = i + 2; j < N; j++) {
          if (i === 0 && j === N - 1) continue;
          const [a1, a2, a3, a4] = seg(i);
          const [b1, b2, b3, b4] = seg(j);
          const o1 = orient(a1, a2, a3, a4, b1, b2);
          const o2 = orient(a1, a2, a3, a4, b3, b4);
          const o3 = orient(b1, b2, b3, b4, a1, a2);
          const o4 = orient(b1, b2, b3, b4, a3, a4);
          if (o1 * o2 < 0 && o3 * o4 < 0) cross++;
        }
      ok(cross === 0, `koch level ${n}: no self-intersections (${cross})`);
    }
  }
  // rasterize vs own winding-number point-in-polygon on cell centres
  const W = 150;
  const H = 100;
  const poly = pondPolygon(W, H, 4, 0.4);
  const m = rasterize(poly, W, H);
  const N = poly.length / 2;
  let diff = 0;
  let inside = 0;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = i + 0.5;
      const y = j + 0.5;
      let wn = 0;
      for (let k = 0; k < N; k++) {
        const q = (k + 1) % N;
        const ax = poly[2 * k];
        const ay = poly[2 * k + 1];
        const bx = poly[2 * q];
        const by = poly[2 * q + 1];
        const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
        if (ay <= y) {
          if (by > y && cr > 0) wn++;
        } else if (by <= y && cr < 0) wn--;
      }
      const ins = wn !== 0 ? 1 : 0;
      inside += ins;
      if (ins !== m[j * W + i]) diff++;
    }
  ok(diff === 0, `koch raster: ${diff} cells differ from own winding test (${inside} inside of ${W * H})`);
}

/* ---------------- 4. Scheidegger + Strahler ---------------- */
{
  // own recursive Strahler
  const ownStrahler = (rec: Int32Array): number[] => {
    const n = rec.length;
    const kids: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) if (rec[i] >= 0) kids[rec[i]].push(i);
    const memo = new Array<number>(n).fill(0);
    const go = (i: number): number => {
      if (memo[i]) return memo[i];
      // iterative-safe for small trees
      const ks = kids[i].map(go);
      let o = 1;
      if (ks.length) {
        const mx = Math.max(...ks);
        o = ks.filter((x) => x === mx).length >= 2 ? mx + 1 : mx;
      }
      memo[i] = o;
      return o;
    };
    for (let i = 0; i < n; i++) go(i);
    return memo;
  };
  // hand-made trees (receiver arrays) with expected orders
  const hand: [number[], number[]][] = [
    [[-1], [1]],
    [[2, 2, -1], [1, 1, 2]],
    [[1, -1], [1, 1]],
    // two order-2 streams meet → 3; plus an order-1 tributary that doesn't raise
    [[2, 2, 6, 5, 5, 6, -1, 6], [1, 1, 2, 1, 1, 2, 3, 1]],
    // three sources into one → 2 (not 3)
    [[3, 3, 3, -1], [1, 1, 1, 2]],
    // order-2 meets order-1 → stays 2; then it meets only order-1 streams → still 2
    [[2, 2, 4, 4, 7, 7, 7, -1, 7], [1, 1, 2, 1, 2, 1, 1, 2, 1]],
  ];
  for (const [rec, want] of hand) {
    const r = Int32Array.from(rec);
    const got = Array.from(strahler(r));
    const own = ownStrahler(r);
    ok(JSON.stringify(got) === JSON.stringify(own) && JSON.stringify(own) === JSON.stringify(want), `strahler hand tree ${JSON.stringify(rec)}: builder ${JSON.stringify(got)} own ${JSON.stringify(own)} (my hand expectation ${JSON.stringify(want)})`);
  }
  // random forests
  const r = rng(99);
  let bad = 0;
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(r() * 60);
    const rec = new Int32Array(n);
    for (let i = 0; i < n; i++) rec[i] = i === n - 1 || r() < 0.1 ? -1 : i + 1 + Math.floor(r() * (n - 1 - i));
    if (JSON.stringify(Array.from(strahler(rec))) !== JSON.stringify(ownStrahler(rec))) bad++;
  }
  ok(bad === 0, `strahler: 300 random forests vs own recursion, ${bad} mismatches`);

  // Scheidegger lattice
  for (const [W, H, seed] of [
    [60, 40, 1],
    [142, 160, 42],
    [9, 4, 3],
  ] as const) {
    const rec = scheidegger(W, H, seed);
    let badRec = 0;
    let badOut = 0;
    const outlets = new Set<number>();
    for (let k = 0; k < H; k++)
      for (let x = 0; x < W; x++) {
        const i = k * W + x;
        if (x === W - 1) {
          if (rec[i] !== -1) badRec++;
          continue;
        }
        const t = rec[i];
        const tx = t % W;
        const tk = Math.floor(t / W);
        if (tx !== x + 1 || Math.abs(rowY(tx, tk) - rowY(x, k)) !== 0.5 || tk < 0 || tk >= H) badRec++;
        // own walk to the outlet
        let c = i;
        let steps = 0;
        while (rec[c] !== -1 && steps <= W) {
          c = rec[c];
          steps++;
        }
        if (rec[c] !== -1 || c % W !== W - 1) badOut++;
        outlets.add(c);
      }
    // strahler on the lattice vs own
    const own = ownStrahler(rec);
    const got = strahler(rec);
    let sm = 0;
    for (let i = 0; i < rec.length; i++) if (own[i] !== got[i]) sm++;
    ok(badRec === 0 && badOut === 0 && sm === 0, `scheidegger ${W}×${H} seed ${seed}: bad receivers ${badRec}, bad outlet walks ${badOut}, outlets ${outlets.size}, strahler mismatches ${sm}`);
  }
}

/* ---------------- 5. Collatz ---------------- */
{
  const t = reverseTree(30, 5000);
  let bad = 0;
  for (let i = 1; i < t.count; i++) if (collatzStep(t.value[i]) !== t.value[t.parent[i]]) bad++;
  // independent forward map
  let bad2 = 0;
  for (let i = 1; i < t.count; i++) {
    const n = t.value[i];
    const f = n % 2 === 0 ? n / 2 : 3 * n + 1;
    if (f !== t.value[t.parent[i]] || t.depth[i] !== t.depth[t.parent[i]] + 1) bad2++;
  }
  ok(bad === 0 && bad2 === 0, `collatz: ${t.count} nodes to depth ${t.maxDepth}; forward map gives parent on all (bad ${bad}/${bad2})`);
  // own brute force: numbers with total stopping time d, for d ≤ maxDepth (bounded by 2^d)
  const st = (n: number) => {
    let s = 0;
    while (n !== 1) {
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
      s++;
    }
    return s;
  };
  let lvlBad = 0;
  const D = Math.min(t.maxDepth, 22);
  for (let d = 0; d <= D; d++) {
    const want: number[] = [];
    for (let n = 1; n <= 2 ** d; n++) if (st(n) === d) want.push(n);
    const got = Array.from(t.value.slice(t.levelStart[d], t.levelStart[d + 1])).sort((a, b) => a - b);
    if (JSON.stringify(want) !== JSON.stringify(got)) lvlBad++;
  }
  ok(lvlBad === 0, `collatz: levels 0…${D} equal brute-force stopping-time sets (${lvlBad} bad)`);
  const vals = new Set(Array.from(t.value));
  ok(vals.size === t.count && t.count <= 5000, `collatz: no duplicates (${vals.size}/${t.count}), ≤ 5000`);
}

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`);
process.exit(fails ? 1 : 0);
