// F5 checker tool: independent brute-force H0 (spec §6.1), written from scratch for the F5 check.
// No import from src/lib/tda or any builder helper.
// Method: add cells one at a time in (h, i) order; after every step, relabel ALL wet cells by
// BFS (4-connectivity), then read the old labels inside the new component of the added cell.
// Label of a component = its ≺-minimum cell (= its birth cell). Elder rule: survivor = ≺-min label.

export function myOrder(h) {
  const idx = Array.from({ length: h.length }, (_, i) => i);
  idx.sort((a, b) => (h[a] < h[b] ? -1 : h[a] > h[b] ? 1 : a - b));
  const rank = new Int32Array(h.length);
  idx.forEach((c, k) => (rank[c] = k));
  return { idx, rank };
}

/** Returns { finite: [{birth, death, birthCell, deathCell, survivor}], essential: [{birth, birthCell}] }
 *  finite includes zero-length bars. */
export function bruteH0(h, W, H) {
  const n = W * H;
  const { idx, rank } = myOrder(h);
  const wet = new Uint8Array(n);
  let label = new Int32Array(n).fill(-1);
  let next = new Int32Array(n);
  const q = new Int32Array(n);
  const finite = [];
  const nb = (i, out) => {
    const x = i % W,
      y = (i - x) / W;
    let k = 0;
    if (y > 0) out[k++] = i - W;
    if (y < H - 1) out[k++] = i + W;
    if (x > 0) out[k++] = i - 1;
    if (x < W - 1) out[k++] = i + 1;
    return k;
  };
  const tmp = new Int32Array(4);
  for (let step = 0; step < n; step++) {
    const c = idx[step];
    wet[c] = 1;
    // Full relabel by BFS, seeding in ≺ order so each component's label is its ≺-min cell.
    next.fill(-1);
    for (let s = 0; s <= step; s++) {
      const seed = idx[s];
      if (next[seed] !== -1) continue;
      let hd = 0,
        tl = 0;
      q[tl++] = seed;
      next[seed] = seed;
      while (hd < tl) {
        const u = q[hd++];
        const m = nb(u, tmp);
        for (let j = 0; j < m; j++) {
          const v = tmp[j];
          if (wet[v] && next[v] === -1) {
            next[v] = seed;
            q[tl++] = v;
          }
        }
      }
    }
    // Old labels inside the new component of c (scan everything: brute force).
    const L = next[c];
    const olds = new Set();
    for (let i = 0; i < n; i++) if (next[i] === L && label[i] !== -1) olds.add(label[i]);
    if (olds.size > 0) {
      const arr = [...olds].sort((a, b) => rank[a] - rank[b]);
      const surv = arr[0];
      for (const d of arr.slice(1))
        finite.push({ birth: h[d], death: h[c], birthCell: d, deathCell: c, survivor: surv });
    }
    const t = label;
    label = next;
    next = t;
  }
  const roots = new Set();
  for (let i = 0; i < n; i++) roots.add(label[i]);
  const essential = [...roots].map((r) => ({ birth: h[r], birthCell: r }));
  return { finite, essential, rank };
}

/** Level-based cross-check: BFS of {h ≤ t} at levels; returns component count and ≺-min labels. */
export function componentsAt(h, W, H, t, rank) {
  const n = W * H;
  const lab = new Int32Array(n).fill(-1);
  const cells = [];
  for (let i = 0; i < n; i++) if (h[i] <= t) cells.push(i);
  cells.sort((a, b) => rank[a] - rank[b]);
  let count = 0;
  const q = [];
  for (const s of cells) {
    if (lab[s] !== -1) continue;
    count++;
    lab[s] = s;
    q.length = 0;
    q.push(s);
    for (let k = 0; k < q.length; k++) {
      const u = q[k],
        x = u % W,
        y = (u - x) / W;
      for (const v of [y > 0 ? u - W : -1, y < H - 1 ? u + W : -1, x > 0 ? u - 1 : -1, x < W - 1 ? u + 1 : -1]) {
        if (v >= 0 && h[v] <= t && lab[v] === -1) {
          lab[v] = s;
          q.push(v);
        }
      }
    }
  }
  return { count, lab };
}
