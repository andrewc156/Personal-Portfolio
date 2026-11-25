import { mulberry32 } from '../../common/rng.ts';
import { COLLATZ_DEFAULT_STEPS, COLLATZ_MAX_STEPS, grouped } from './meta.ts';
import { cssMix, rgbOf } from './pixels.ts';
import type { ModeColors, ModeSim } from './types.ts';

/**
 * Collatz delta: the reverse Collatz tree grown from 1. The forward map is n → n/2 for even n
 * and n → 3n + 1 for odd n. Reversed, every n has the child 2n, and also (n − 1)/3 when that
 * is an odd integer greater than 1 (excluding 1 avoids the 1 → 4 → 2 → 1 loop). Applying the
 * forward map to any child gives back its parent (tested on every node).
 *
 * Drawing: each edge is a short segment that turns by `even` radians when the child is even
 * and by −`odd` when it is odd, so the paths fan out and then braid back toward one trunk.
 */

export function collatzStep(n: number): number {
  return n % 2 === 0 ? n / 2 : 3 * n + 1;
}

const EXACT_DEPTH = 50;

/** An odd child > 1 exists exactly when n ≡ 4 (mod 6) and n > 4. */
function hasOddChild(n: number): boolean {
  return n > 4 && n % 6 === 4;
}

/** Reverse-Collatz children of n into out[0..]; returns how many (1 or 2). */
export function reverseChildren(n: number, out: number[]): number {
  out[0] = 2 * n;
  if (hasOddChild(n)) {
    out[1] = (n - 1) / 3;
    return 2;
  }
  return 1;
}

export interface CollatzTree {
  count: number;
  value: Float64Array;
  parent: Int32Array;
  depth: Uint8Array;
  /** Nodes per depth level: level d occupies [levelStart[d], levelStart[d + 1]). */
  levelStart: Int32Array;
  maxDepth: number;
}

/**
 * Breadth-first reverse tree from 1, level by level, up to `maxDepth` levels or until the next
 * full level would exceed `maxNodes`. Values stay below 2^maxDepth ≤ 2^50 (exact in doubles).
 */
export function reverseTree(maxDepth: number, maxNodes: number): CollatzTree {
  const depthCap = Math.min(EXACT_DEPTH, Math.max(0, Math.floor(maxDepth)));
  const value: number[] = [1];
  const parent: number[] = [-1];
  const depth: number[] = [0];
  const levelStart: number[] = [0, 1];
  const kids: number[] = [0, 0];
  let d = 0;
  while (d < depthCap) {
    const a = levelStart[d];
    const b = levelStart[d + 1];
    const nv: number[] = [];
    const np: number[] = [];
    for (let i = a; i < b; i++) {
      const k = reverseChildren(value[i], kids);
      for (let c = 0; c < k; c++) {
        nv.push(kids[c]);
        np.push(i);
      }
    }
    if (value.length + nv.length > maxNodes) break;
    for (let c = 0; c < nv.length; c++) {
      value.push(nv[c]);
      parent.push(np[c]);
      depth.push(d + 1);
    }
    d++;
    levelStart.push(value.length);
  }
  return {
    count: value.length,
    value: Float64Array.from(value),
    parent: Int32Array.from(parent),
    depth: Uint8Array.from(depth),
    levelStart: Int32Array.from(levelStart),
    maxDepth: d,
  };
}

let exactCounts: Int32Array | undefined;

/** Visit the full logical tree through 50 once, retaining only cumulative counts. Each node
 * has exactly one forward parent, so excluding the root loop makes a visited set unnecessary. */
function exactCount(depth: number): number {
  if (!exactCounts) {
    const totals = new Int32Array(EXACT_DEPTH + 1);
    const visit = (n: number, d: number): void => {
      totals[d]++;
      if (d === EXACT_DEPTH) return;
      visit(2 * n, d + 1);
      if (hasOddChild(n)) visit((n - 1) / 3, d + 1);
    };
    visit(1, 0);
    for (let d = 1; d <= EXACT_DEPTH; d++) totals[d] += totals[d - 1];
    exactCounts = totals;
  }
  return exactCounts[depth];
}

type TreeGeometry = Omit<CollatzTree, 'value'>;
interface SampledTree extends TreeGeometry {
  readonly value: readonly bigint[];
}

const MAX_LEVEL_WIDTH = 96;
interface Candidate {
  value: bigint;
  parent: number;
  rank: number;
  order: number;
}

interface SampleCache {
  value: bigint[];
  parent: Int32Array;
  depth: Uint8Array;
  levelStart: Int32Array;
  maxDepth: number;
  frontier: Candidate[];
}

let cachedSample: SampleCache | undefined;

function newSample(): SampleCache {
  const capacity = 1 + MAX_LEVEL_WIDTH * COLLATZ_MAX_STEPS;
  const cache: SampleCache = {
    value: [1n],
    parent: new Int32Array(capacity),
    depth: new Uint8Array(capacity),
    levelStart: new Int32Array(COLLATZ_MAX_STEPS + 2),
    maxDepth: 0,
    frontier: [{ value: 1n, parent: -1, rank: 0, order: 0 }],
  };
  cache.parent[0] = -1;
  cache.levelStart[1] = 1;
  return cache;
}

/** Keep the doubling trunk first on every level; rank other children by a hash of their path,
 * not their position or value. Keeping only children of retained parents connects every edge
 * and keeps the sample a stable prefix as the selected depth changes. */
function extendSample(cache: SampleCache): void {
  const { frontier, levelStart } = cache;
  const depth = ++cache.maxDepth;
  const next: Candidate[] = [];
  const offset = levelStart[depth - 1];
  const add = (value: bigint, parent: number, rank: number, odd: boolean) => {
    const mixed = Math.imul(rank ^ (odd ? 0x9e3779b9 : 0x85ebca6b), 0x21f0aaad);
    // The first candidate is the even child of the trunk, guaranteed to survive ranking.
    next.push({
      value,
      parent,
      rank: next.length ? (mixed ^ (mixed >>> 16)) >>> 0 : -1,
      order: next.length,
    });
  };
  for (let i = 0; i < frontier.length; i++) {
    const { value, rank } = frontier[i];
    add(2n * value, offset + i, rank, false);
    if (value > 4n && value % 6n === 4n) add((value - 1n) / 3n, offset + i, rank, true);
  }
  if (next.length > MAX_LEVEL_WIDTH) {
    next.sort((a, b) => a.rank - b.rank || a.order - b.order);
    next.length = MAX_LEVEL_WIDTH;
    next.sort((a, b) => a.order - b.order);
  }
  cache.frontier = next;
  for (const { value, parent } of next) {
    const i = cache.value.length;
    cache.value.push(value);
    cache.parent[i] = parent;
    cache.depth[i] = depth;
  }
  levelStart[depth + 1] = cache.value.length;
}

function sampledTree(maxDepth: number): SampledTree {
  // No Collatz cache allocation until this mode is actually used.
  const cache = (cachedSample ??= newSample());
  while (cache.maxDepth < maxDepth) extendSample(cache);
  const count = cache.levelStart[maxDepth + 1];
  return {
    maxDepth,
    count,
    value: cache.value.slice(0, count),
    parent: cache.parent.subarray(0, count),
    depth: cache.depth.subarray(0, count),
    levelStart: cache.levelStart.subarray(0, maxDepth + 2),
  };
}

/** Number of forward Collatz steps from n to 1. */
export function stoppingTime(n: number): number {
  let s = 0;
  while (n !== 1) {
    n = collatzStep(n);
    s++;
  }
  return s;
}

export interface DeltaShape {
  /** Turn after an even step (radians, positive = clockwise on screen). */
  even: number;
  /** Turn after an odd step (applied as −odd). */
  odd: number;
  /** Heading of the trunk at 1. */
  heading: number;
  /** Segment shrink per level. */
  shrink: number;
}

/** Node positions (x, y pairs, arbitrary units) for a tree drawn with `shape`. */
export function layoutTree(t: CollatzTree, s: DeltaShape): Float64Array {
  return layout(t, s, (i) => t.value[i] % 2 === 0);
}

function layout(t: TreeGeometry, s: DeltaShape, isEven: (i: number) => boolean): Float64Array {
  const pos = new Float64Array(2 * t.count);
  const head = new Float64Array(t.count);
  const lengths = Float64Array.from({ length: t.maxDepth + 1 }, (_, d) => s.shrink ** d);
  head[0] = s.heading;
  for (let i = 1; i < t.count; i++) {
    const p = t.parent[i];
    const turn = isEven(i) ? s.even : -s.odd;
    const h = head[p] + turn;
    head[i] = h;
    const len = lengths[t.depth[i]];
    pos[2 * i] = pos[2 * p] + len * Math.cos(h);
    pos[2 * i + 1] = pos[2 * p + 1] + len * Math.sin(h);
  }
  return pos;
}

/** Descendant counts (node included), for trunk widths. */
export function subtreeSizes(t: TreeGeometry): Int32Array {
  const size = new Int32Array(t.count).fill(1);
  // BFS order: children always come after parents, so a reverse sweep is upstream-first.
  for (let i = t.count - 1; i > 0; i--) size[t.parent[i]] += size[i];
  return size;
}

export const COLLATZ_STEP_HZ = 60;
/** Seconds for the delta to grow at speed 1×. */
export const COLLATZ_GROW_S = 9;
const DEG = Math.PI / 180;

export class CollatzSim implements ModeSim {
  readonly id = 'collatz' as const;
  readonly interactive = false;
  readonly stepHz = COLLATZ_STEP_HZ;
  tree!: SampledTree;
  shape!: DeltaShape;
  private pos: Float64Array = new Float64Array(0);
  /** Per-level edge indices bucketed by thickness, prepared outside the frame loop. */
  private edges: number[][][] = [];
  private cssW = 1;
  private cssH = 1;
  private steps = 0;
  private totalSteps = COLLATZ_GROW_S * COLLATZ_STEP_HZ;
  private layer: HTMLCanvasElement | null = null;
  private layerCtx: CanvasRenderingContext2D | null = null;
  /** Levels already drawn onto the layer. */
  private drawnLevels = 0;
  private layerDpr = 0;
  private colors: ModeColors | null = null;
  private strokes: string[] = [];
  private bgFill = '#000';
  /** Screen transform: x' = ox + k·x, y' = oy + k·y (CSS px). */
  private k = 1;
  private ox = 0;
  private oy = 0;

  build(seed: number, cssW: number, cssH: number, limit = COLLATZ_DEFAULT_STEPS): void {
    const rand = mulberry32((seed ^ 0x9b05688c) >>> 0);
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    const depth = Number.isNaN(limit)
      ? COLLATZ_DEFAULT_STEPS
      : Math.min(COLLATZ_MAX_STEPS, Math.max(1, Math.trunc(limit)));
    const t = (this.tree = sampledTree(depth));
    const even = (5 + 6 * rand()) * DEG;
    this.shape = {
      even,
      odd: even * (1.7 + 0.7 * rand()),
      heading: (-90 + (rand() - 0.5) * 40) * DEG,
      shrink: 0.985 + 0.01 * rand(),
    };
    this.pos = layout(t, this.shape, (i) => t.value[i] % 2n === 0n);
    const sizes = subtreeSizes(t);
    this.edges = Array.from({ length: depth + 1 }, () => []);
    for (let i = 1; i < t.count; i++) {
      const bucket = 31 - Math.clz32(sizes[i]); // floor(log2(size))
      (this.edges[t.depth[i]][bucket] ??= []).push(i);
    }
    this.fit();
    this.steps = 0;
    this.drawnLevels = 0;
    this.layerDpr = 0;
  }

  /** Uniform scale and offset so the whole delta fits the canvas with a margin. */
  private fit(): void {
    const p = this.pos;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
    }
    const m = Math.min(this.cssW, this.cssH) * 0.06;
    this.k = Math.min(
      (this.cssW - 2 * m) / Math.max(1e-9, x1 - x0),
      (this.cssH - 2 * m) / Math.max(1e-9, y1 - y0),
    );
    this.ox = this.cssW / 2 - (this.k * (x0 + x1)) / 2;
    this.oy = this.cssH / 2 - (this.k * (y0 + y1)) / 2;
  }

  needsRebuild(cssW: number, cssH: number): boolean {
    if (Math.abs(cssW - this.cssW) > 1 || Math.abs(cssH - this.cssH) > 1) {
      // Same tree and shape; only the fit changes.
      this.cssW = Math.max(1, cssW);
      this.cssH = Math.max(1, cssH);
      this.fit();
      this.layerDpr = 0;
    }
    return false;
  }

  warm(still: boolean): void {
    this.steps = still ? this.totalSteps : Math.round(this.totalSteps * 0.3);
  }

  restart(): void {
    this.steps = 0;
    this.layerDpr = 0;
  }

  finished(): boolean {
    return this.steps >= this.totalSteps;
  }

  step(): void {
    if (this.steps < this.totalSteps) this.steps++;
  }

  /** Growth front in levels (fractional). Eased so the sparse first levels don't dawdle. */
  front(): number {
    const p = Math.min(1, this.steps / this.totalSteps);
    return this.tree.maxDepth * Math.sqrt(p);
  }

  setColors(c: ModeColors): void {
    this.colors = c;
    this.bgFill = c.sunken;
    const a = rgbOf(c.accent);
    const b = rgbOf(c.palette.identity[1] ?? c.accent);
    this.strokes = [];
    const depth = this.tree?.maxDepth ?? COLLATZ_DEFAULT_STEPS;
    for (let d = 0; d <= depth; d++) this.strokes.push(cssMix(a, b, d / depth));
    this.layerDpr = 0;
  }

  private strokeLevel(ctx: CanvasRenderingContext2D, d: number, frac: number, dpr: number): void {
    const t = this.tree;
    const p = this.pos;
    const k = this.k * dpr;
    const ox = this.ox * dpr;
    const oy = this.oy * dpr;
    ctx.strokeStyle = this.strokes[Math.min(this.strokes.length - 1, d)];
    const buckets = this.edges[d];
    for (let b = 0; b < buckets.length; b++) {
      const nodes = buckets[b];
      if (!nodes) continue;
      ctx.lineWidth = (0.6 + 0.55 * b) * dpr;
      ctx.beginPath();
      for (let j = 0; j < nodes.length; j++) {
        const i = nodes[j];
        const q = t.parent[i];
        const x0 = ox + k * p[2 * q];
        const y0 = oy + k * p[2 * q + 1];
        const x1 = ox + k * p[2 * i];
        const y1 = oy + k * p[2 * i + 1];
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
      }
      ctx.stroke();
    }
  }

  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number): void {
    if (!this.layer) {
      this.layer = document.createElement('canvas');
      this.layerCtx = this.layer.getContext('2d', { alpha: false });
    }
    const lc = this.layerCtx;
    if (!lc || !this.colors) return;
    const front = this.front();
    const full = Math.min(this.tree.maxDepth, Math.floor(front));
    if (
      this.layerDpr !== dpr ||
      this.layer.width !== cw ||
      this.layer.height !== ch ||
      this.drawnLevels > full
    ) {
      if (this.layer.width !== cw) this.layer.width = cw;
      if (this.layer.height !== ch) this.layer.height = ch;
      lc.fillStyle = this.bgFill;
      lc.fillRect(0, 0, cw, ch);
      lc.lineCap = 'round';
      this.drawnLevels = 0;
      this.layerDpr = dpr;
    }
    // Completed levels go onto the cached layer once; only the growing level is redrawn.
    while (this.drawnLevels < full) {
      this.drawnLevels++;
      this.strokeLevel(lc, this.drawnLevels, 1, dpr);
    }
    ctx.drawImage(this.layer, 0, 0);
    if (front > full) {
      ctx.lineCap = 'round';
      this.strokeLevel(ctx, full + 1, front - full, dpr);
    }
  }

  poke(): boolean {
    return false;
  }

  /** Levels currently drawn. */
  get shownDepth(): number {
    return Math.min(this.tree.maxDepth, Math.floor(this.front()));
  }

  readout(): string {
    const d = this.shownDepth;
    const steps = `${d} ${d === 1 ? 'step' : 'steps'}`;
    if (this.tree.maxDepth > EXACT_DEPTH) return `Sampled branches · ${steps}`;
    const drawn = this.tree.levelStart[d + 1];
    const n = exactCount(d);
    return `${grouped(n)} numbers within ${steps} of 1${drawn < n ? ` · ${grouped(drawn)} drawn` : ''}`;
  }

  summary(): string {
    const { maxDepth: d, count } = this.tree;
    let detail: string;
    if (d > EXACT_DEPTH) {
      detail = `Sampled branches at the ${d}-step setting. The full drawing shows ${grouped(count)} sampled numbers, not a total.`;
    } else {
      const n = exactCount(d);
      detail = `Exactly ${grouped(n)} numbers reach 1 within ${d} Collatz ${d === 1 ? 'step' : 'steps'}, the largest ${grouped(2 ** d)}. ${count < n ? `The full drawing shows ${grouped(count)} of those numbers.` : 'The full drawing shows them all.'}`;
    }
    return `${detail} ${this.shownDepth} of ${d} levels are fully drawn. Each path bends ${Math.round(
      this.shape.even / DEG,
    )} degrees one way after an even step and ${Math.round(
      this.shape.odd / DEG,
    )} degrees the other way after an odd step, and all paths join one trunk at 1.`;
  }

  label(): string {
    return 'Collatz delta: bending paths that join one trunk at 1.';
  }
}
