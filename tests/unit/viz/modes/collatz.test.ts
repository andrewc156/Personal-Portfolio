import { describe, expect, it } from 'vitest';
import {
  COLLATZ_GROW_S,
  COLLATZ_STEP_HZ,
  CollatzSim,
  collatzStep,
  layoutTree,
  reverseChildren,
  reverseTree,
  stoppingTime,
  subtreeSizes,
} from '../../../../src/lib/viz/hero/modes/collatz.ts';

describe('Collatz delta', () => {
  it('starts normal playback with exactly one complete layer', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450);
    sim.warm(false);
    expect(sim.front()).toBe(1);
    expect(sim.readout()).toBe('2 numbers within 1 step of 1');
  });

  it('opens reduced-motion Collatz on the first complete layer', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450, 120);
    sim.warm(true);
    expect(sim.front()).toBe(1);
    expect(sim.summary()).toContain('1 of 120 levels are fully drawn');
  });

  it('replays from layer one and extends the next edge gradually at depth 120', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450, 120);
    for (let i = 0; i < COLLATZ_GROW_S * COLLATZ_STEP_HZ; i++) sim.step();
    sim.restart();
    expect(sim.front()).toBe(1);
    sim.step();
    expect(sim.front()).toBeGreaterThan(1);
    expect(sim.front()).toBeLessThan(2);
  });

  it('defaults to exactly 30 mathematical steps without changing the animation clock', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450);
    sim.restart();
    expect(COLLATZ_GROW_S).toBe(9);
    expect(COLLATZ_STEP_HZ).toBe(60);
    for (let i = 0; i < 539; i++) sim.step();
    expect(sim.finished()).toBe(false);
    expect(sim.shownDepth).toBe(29);
    sim.step();
    expect(sim.finished()).toBe(true);
    expect(sim.shownDepth).toBe(30);
    expect(sim.readout()).toContain('3,518 numbers within 30 steps');
    expect(sim.summary()).toContain('3,518 numbers');
  });

  it('draws connected, exact reverse paths at the bounded 120-step setting', () => {
    const shallow = new CollatzSim();
    shallow.build(42, 1280, 450, 50);
    const deep = new CollatzSim();
    deep.build(42, 1280, 450, 1e9);
    deep.previewDepth();
    expect(deep.shownDepth).toBe(120);
    expect(deep.readout()).toMatch(/^Sampled branches · 120 steps/);
    expect(deep.summary()).toContain('not a total');
    expect(deep.summary()).not.toContain('379,600');
    const t = deep.tree;
    expect(t.value.slice(0, shallow.tree.count)).toEqual(shallow.tree.value);
    expect(t.parent.slice(0, shallow.tree.count)).toEqual(shallow.tree.parent);
    expect(t.value.some((v) => v > BigInt(Number.MAX_SAFE_INTEGER) && v % 2n === 1n)).toBe(true);
    for (let d = 1; d <= t.maxDepth; d++) {
      const start = t.levelStart[d];
      const end = t.levelStart[d + 1];
      expect(end - start).toBeLessThanOrEqual(96);
      expect(t.value[start]).toBe(2n ** BigInt(d));
      for (let i = start; i < end; i++) {
        const v = t.value[i];
        expect(v % 2n === 0n ? v / 2n : 3n * v + 1n).toBe(t.value[t.parent[i]]);
        expect(t.depth[t.parent[i]]).toBe(d - 1);
      }
    }
  });

  it('reports the exact number at each reachable level through 50 regardless of sampling', () => {
    const whole = reverseTree(50, 379_600);
    expect(whole.maxDepth).toBe(50);
    const sim = new CollatzSim();
    for (let d = 1; d <= whole.maxDepth; d++) {
      sim.build(42, 1280, 450, d);
      sim.previewDepth();
      const total = Number(sim.readout().split(' ')[0].replaceAll(',', ''));
      expect(total).toBe(whole.levelStart[d + 1]);
    }
    expect(sim.readout()).toContain('379,600 numbers within 50 steps');
    expect(sim.readout()).toContain('drawn');
    expect(sim.summary()).toContain('379,600 numbers');
  });

  it('switches to a sampled readout at 51 steps', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450, 51);
    sim.previewDepth();
    expect(sim.readout()).toBe('Sampled branches · 51 steps');
  });

  it('shows every node at the one-step minimum', () => {
    const sim = new CollatzSim();
    sim.build(42, 1280, 450, -5);
    expect(sim.front()).toBe(1);
    expect(sim.shownDepth).toBe(1);
    expect(sim.tree.count).toBe(2);
    expect(sim.readout()).toBe('2 numbers within 1 step of 1');
    for (let i = 0; i < 539; i++) sim.step();
    expect(sim.finished()).toBe(false);
    sim.step();
    expect(sim.finished()).toBe(true);
    expect(sim.front()).toBe(1);
  });
});

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
