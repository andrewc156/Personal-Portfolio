import { mulberry32 } from '../../common/rng.ts';
import { grouped } from './meta.ts';
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

/** Reverse-Collatz children of n into out[0..]; returns how many (1 or 2). */
export function reverseChildren(n: number, out: number[]): number {
  out[0] = 2 * n;
  const m = (n - 1) / 3;
  if (Number.isInteger(m) && m > 1 && m % 2 === 1) {
    out[1] = m;
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
  const depthCap = Math.min(50, Math.max(0, Math.floor(maxDepth)));
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
  const pos = new Float64Array(2 * t.count);
  const head = new Float64Array(t.count);
  head[0] = s.heading;
  for (let i = 1; i < t.count; i++) {
    const p = t.parent[i];
    const turn = t.value[i] % 2 === 0 ? s.even : -s.odd;
    const h = head[p] + turn;
    head[i] = h;
    const len = Math.pow(s.shrink, t.depth[i]);
    pos[2 * i] = pos[2 * p] + len * Math.cos(h);
    pos[2 * i + 1] = pos[2 * p + 1] + len * Math.sin(h);
  }
  return pos;
}

/** Descendant counts (node included), for trunk widths. */
export function subtreeSizes(t: CollatzTree): Int32Array {
  const size = new Int32Array(t.count).fill(1);
  // BFS order: children always come after parents, so a reverse sweep is upstream-first.
  for (let i = t.count - 1; i > 0; i--) size[t.parent[i]] += size[i];
  return size;
}

export const COLLATZ_STEP_HZ = 60;
/** Seconds for the delta to grow at speed 1×. */
export const COLLATZ_GROW_S = 9;
const MAX_NODES = 5000;
const DEG = Math.PI / 180;

export class CollatzSim implements ModeSim {
  readonly id = 'collatz' as const;
  readonly interactive = false;
  readonly stepHz = COLLATZ_STEP_HZ;
  tree!: CollatzTree;
  shape!: DeltaShape;
  private pos: Float64Array = new Float64Array(0);
  private size: Int32Array = new Int32Array(0);
  private cssW = 1;
  private cssH = 1;
  private steps = 0;
  private totalSteps = COLLATZ_GROW_S * COLLATZ_STEP_HZ;
  private layer: HTMLCanvasElement | null = null;
  private layerCtx: CanvasRenderingContext2D | null = null;
  /** Levels already drawn onto the layer. */
  private drawnLevels = 0;
  private layerKey = '';
  private colors: ModeColors | null = null;
  private strokes: string[] = [];
  private bgFill = '#000';
  /** Screen transform: x' = ox + k·x, y' = oy + k·y (CSS px). */
  private k = 1;
  private ox = 0;
  private oy = 0;
  private largest = 1;

  build(seed: number, cssW: number, cssH: number): void {
    const rand = mulberry32((seed ^ 0x9b05688c) >>> 0);
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.tree = reverseTree(30, MAX_NODES);
    const even = (5 + 6 * rand()) * DEG;
    this.shape = {
      even,
      odd: even * (1.7 + 0.7 * rand()),
      heading: (-90 + (rand() - 0.5) * 40) * DEG,
      shrink: 0.985 + 0.01 * rand(),
    };
    this.pos = layoutTree(this.tree, this.shape);
    this.size = subtreeSizes(this.tree);
    let big = 1;
    for (let i = 0; i < this.tree.count; i++) big = Math.max(big, this.tree.value[i]);
    this.largest = big;
    this.fit();
    this.steps = 0;
    this.drawnLevels = 0;
    this.layerKey = '';
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
      this.layerKey = '';
    }
    return false;
  }

  warm(still: boolean): void {
    this.steps = still ? this.totalSteps : Math.round(this.totalSteps * 0.3);
  }

  restart(): void {
    this.steps = 0;
    this.layerKey = '';
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
    const D = Math.max(1, this.tree?.maxDepth ?? 30);
    for (let d = 0; d <= 50; d++) this.strokes.push(cssMix(a, b, Math.min(1, d / D)));
    this.layerKey = '';
  }

  private widthOf(i: number): number {
    return 0.6 + 0.55 * Math.log2(this.size[i]);
  }

  private strokeLevel(ctx: CanvasRenderingContext2D, d: number, frac: number, dpr: number): void {
    const t = this.tree;
    const a = t.levelStart[d];
    const b = t.levelStart[d + 1];
    const p = this.pos;
    const k = this.k * dpr;
    const ox = this.ox * dpr;
    const oy = this.oy * dpr;
    ctx.strokeStyle = this.strokes[Math.min(this.strokes.length - 1, d)];
    for (let i = a; i < b; i++) {
      const q = t.parent[i];
      const x0 = ox + k * p[2 * q];
      const y0 = oy + k * p[2 * q + 1];
      const x1 = ox + k * p[2 * i];
      const y1 = oy + k * p[2 * i + 1];
      ctx.lineWidth = this.widthOf(i) * dpr;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
      ctx.stroke();
    }
  }

  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number): void {
    if (!this.layer) {
      this.layer = document.createElement('canvas');
      this.layerCtx = this.layer.getContext('2d');
    }
    const lc = this.layerCtx;
    if (!lc || !this.colors) return;
    const key = `${cw}x${ch}`;
    const front = this.front();
    const full = Math.min(this.tree.maxDepth, Math.floor(front));
    if (this.layerKey !== key || this.drawnLevels > full) {
      this.layer.width = cw;
      this.layer.height = ch;
      lc.fillStyle = this.bgFill;
      lc.fillRect(0, 0, cw, ch);
      lc.lineCap = 'round';
      this.drawnLevels = 0;
      this.layerKey = key;
    }
    // Completed levels go onto the cached layer once; only the growing level is redrawn.
    while (this.drawnLevels < full) {
      this.drawnLevels++;
      this.strokeLevel(lc, this.drawnLevels, 1, dpr);
    }
    ctx.drawImage(this.layer, 0, 0);
    if (full < this.tree.maxDepth) {
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
    const n = this.tree.levelStart[d + 1];
    return `${grouped(n)} numbers within ${d} steps of 1 · even steps turn ${Math.round(
      this.shape.even / DEG,
    )}°, odd steps ${Math.round(this.shape.odd / DEG)}°`;
  }

  summary(): string {
    const t = this.tree;
    return `A Collatz delta: every number that reaches 1 within ${t.maxDepth} Collatz steps, ${grouped(
      t.count,
    )} numbers in all, the largest ${grouped(this.largest)}. Each path bends ${Math.round(
      this.shape.even / DEG,
    )} degrees one way after an even step and ${Math.round(
      this.shape.odd / DEG,
    )} degrees the other way after an odd step, and all paths join one trunk at 1.`;
  }

  label(): string {
    return 'Collatz delta: bending paths that join one trunk at 1.';
  }
}
