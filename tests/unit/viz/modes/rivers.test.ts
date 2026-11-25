import { describe, expect, it } from 'vitest';
import {
  drainageArea,
  outletOf,
  rowY,
  scheidegger,
  strahler,
  topoOrder,
} from '../../../../src/lib/viz/hero/modes/rivers.ts';

const rec = (a: number[]) => Int32Array.from(a);

describe('Strahler order on hand-built trees', () => {
  it('a single source is order 1', () => {
    expect([...strahler(rec([-1]))]).toEqual([1]);
  });

  it('a chain keeps order 1', () => {
    // 0 → 1 → 2 (outlet)
    expect([...strahler(rec([1, 2, -1]))]).toEqual([1, 1, 1]);
  });

  it('two order-1 streams make order 2 (Y junction)', () => {
    // 0 → 2, 1 → 2, 2 → 3
    expect([...strahler(rec([2, 2, 3, -1]))]).toEqual([1, 1, 2, 2]);
  });

  it('three order-1 streams still make order 2', () => {
    expect([...strahler(rec([3, 3, 3, -1]))]).toEqual([1, 1, 1, 2]);
  });

  it('order 2 meeting order 1 stays order 2', () => {
    // 0,1 → 2 (order 2); 2 → 4, 3 → 4
    expect([...strahler(rec([2, 2, 4, 4, -1]))]).toEqual([1, 1, 2, 1, 2]);
  });

  it('two order-2 streams make order 3; the full binary tree of depth 3 is order 4', () => {
    // Two Y junctions (2 and 5) meet at 6.
    expect([...strahler(rec([2, 2, 6, 5, 5, 6, -1]))]).toEqual([1, 1, 2, 1, 1, 2, 3]);
    // Perfect binary tree with 8 leaves (heap order, children of k are 2k+1, 2k+2; root 0).
    const n = 15;
    const r = new Int32Array(n);
    r[0] = -1;
    for (let k = 1; k < n; k++) r[k] = (k - 1) >> 1;
    const o = strahler(r);
    expect(o[0]).toBe(4);
    for (let k = 7; k < 15; k++) expect(o[k]).toBe(1);
  });

  it('works on a forest and in any index order', () => {
    // Two trees: {3 ← 0, 3 ← 1} and {4 ← 2}. Listed sink-first on purpose.
    expect([...strahler(rec([3, 3, 4, -1, -1]))]).toEqual([1, 1, 1, 2, 1]);
  });

  it('rejects cycles', () => {
    expect(() => topoOrder(rec([1, 0]))).toThrow(/cycle/);
  });

  it('drainage area counts every upstream node', () => {
    expect([...drainageArea(rec([2, 2, 4, 4, -1]))]).toEqual([1, 1, 3, 1, 5]);
  });
});

describe('Scheidegger network', () => {
  const W = 90;
  const H = 45;
  const r = scheidegger(W, H, 42);

  it('every cell has exactly one receiver: an adjacent node in the next column', () => {
    for (let k = 0; k < H; k++) {
      for (let x = 0; x < W; x++) {
        const i = k * W + x;
        if (x === W - 1) {
          expect(r[i]).toBe(-1);
          continue;
        }
        const rx = r[i] % W;
        const rk = (r[i] - rx) / W;
        expect(rx).toBe(x + 1);
        expect(rk).toBeGreaterThanOrEqual(0);
        expect(rk).toBeLessThan(H);
        // On the staggered lattice the receiver is half a row up or down.
        expect(Math.abs(rowY(rx, rk) - rowY(x, k))).toBe(0.5);
      }
    }
  });

  it('each cell drains to exactly one outlet in the last column, and paths merge', () => {
    const out = outletOf(r);
    const area = drainageArea(r);
    let total = 0;
    const outlets = new Set<number>();
    for (let i = 0; i < W * H; i++) {
      expect(out[i] % W).toBe(W - 1);
      expect(r[out[i]]).toBe(-1);
      outlets.add(out[i]);
    }
    for (const o of outlets) total += area[o];
    expect(total).toBe(W * H); // every cell counted once, at its one outlet
    // Coalescence: the H sources of the first column reach far fewer than H outlets.
    const fromFirst = new Set<number>();
    for (let k = 0; k < H; k++) fromFirst.add(out[k * W]);
    expect(fromFirst.size).toBeLessThan(H / 3);
    expect(outlets.size).toBe(H); // each last-column node is its own outlet
  });

  it('Strahler order rises only at confluences of equal order', () => {
    const o = strahler(r);
    const best = new Uint8Array(W * H);
    const count = new Uint8Array(W * H);
    const indeg = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (r[i] < 0) continue;
      indeg[r[i]]++;
      if (o[i] > best[r[i]]) {
        best[r[i]] = o[i];
        count[r[i]] = 1;
      } else if (o[i] === best[r[i]]) count[r[i]]++;
    }
    let max = 1;
    for (let i = 0; i < W * H; i++) {
      const want = indeg[i] === 0 ? 1 : count[i] >= 2 ? best[i] + 1 : best[i];
      expect(o[i]).toBe(want);
      max = Math.max(max, o[i]);
    }
    expect(max).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic per seed', () => {
    expect(scheidegger(W, H, 42)).toEqual(r);
    expect(scheidegger(W, H, 43)).not.toEqual(r);
  });
});
