import { describe, expect, it } from 'vitest';
import {
  collatzStep,
  layoutTree,
  reverseChildren,
  reverseTree,
  stoppingTime,
  subtreeSizes,
} from '../../../../src/lib/viz/hero/modes/collatz.ts';

describe('reverse Collatz generator', () => {
  it('children: 2n always, (n − 1)/3 only when it is an odd integer > 1', () => {
    const out: number[] = [];
    expect(reverseChildren(1, out)).toBe(1);
    expect(out[0]).toBe(2);
    expect(reverseChildren(4, out)).toBe(1); // (4 − 1)/3 = 1 is excluded
    expect(reverseChildren(16, out)).toBe(2);
    expect(out.slice(0, 2)).toEqual([32, 5]);
    expect(reverseChildren(10, out)).toBe(2); // 3 is odd and 3·3 + 1 = 10
    expect(out.slice(0, 2)).toEqual([20, 3]);
    expect(reverseChildren(7, out)).toBe(1); // (7 − 1)/3 = 2 is even
    expect(reverseChildren(8, out)).toBe(1); // 7/3 is not an integer
  });

  it('matches the forward Collatz map on every node', () => {
    const t = reverseTree(40, 20000);
    expect(t.count).toBeGreaterThan(1000);
    expect(t.value[0]).toBe(1);
    for (let i = 1; i < t.count; i++) {
      expect(collatzStep(t.value[i])).toBe(t.value[t.parent[i]]);
      expect(t.depth[i]).toBe(t.depth[t.parent[i]] + 1);
    }
  });

  it('level d holds exactly the numbers whose Collatz path reaches 1 in d steps', () => {
    const D = 16;
    const t = reverseTree(D, 1e9);
    expect(t.maxDepth).toBe(D);
    // Every n with stopping time d ≤ D satisfies n ≤ 2^d, so brute force over 1 … 2^D.
    const want: number[][] = Array.from({ length: D + 1 }, () => []);
    for (let n = 1; n <= 2 ** D; n++) {
      const s = stoppingTime(n);
      if (s <= D) want[s].push(n);
    }
    for (let d = 0; d <= D; d++) {
      const got = Array.from(t.value.subarray(t.levelStart[d], t.levelStart[d + 1])).sort(
        (a, b) => a - b,
      );
      expect(got).toEqual(want[d]);
    }
    // No number appears twice.
    expect(new Set(t.value).size).toBe(t.count);
  });

  it('stops at whole levels within the node cap', () => {
    const t = reverseTree(50, 5000);
    expect(t.count).toBeLessThanOrEqual(5000);
    expect(t.levelStart[t.maxDepth + 1]).toBe(t.count);
    for (let i = 0; i < t.count; i++) expect(Number.isSafeInteger(t.value[i])).toBe(true);
  });

  it('subtree sizes sum up to the trunk', () => {
    const t = reverseTree(20, 1e6);
    const s = subtreeSizes(t);
    expect(s[0]).toBe(t.count);
  });

  it('layout turns one way on even steps and the other on odd steps', () => {
    const t = reverseTree(6, 1000); // 1 2 4 8 16 {32, 5} …
    const even = 0.1;
    const odd = 0.25;
    const pos = layoutTree(t, { even, odd, heading: 0, shrink: 1 });
    const heading = (i: number) => {
      const p = t.parent[i];
      return Math.atan2(pos[2 * i + 1] - pos[2 * p + 1], pos[2 * i] - pos[2 * p]);
    };
    const idx = (v: number) => Array.from(t.value).indexOf(v);
    // 1 → 2 is the first step (even child): heading 0 + 0.1.
    expect(heading(idx(2))).toBeCloseTo(even, 9);
    expect(heading(idx(32)) - heading(idx(16))).toBeCloseTo(even, 9);
    expect(heading(idx(5)) - heading(idx(16))).toBeCloseTo(-odd, 9);
  });
});
