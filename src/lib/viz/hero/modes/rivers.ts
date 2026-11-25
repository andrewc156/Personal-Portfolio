import { mulberry32 } from '../../common/rng.ts';
import { grouped } from './meta.ts';
import { cssMix, rgbOf } from './pixels.ts';
import type { ModeColors, ModeSim } from './types.ts';

/**
 * Random rivers: the Scheidegger model, a coalescing random walk. Nodes sit on a staggered
 * lattice of W columns × H rows (odd columns are shifted half a row). Flow runs west → east:
 * every node drains to exactly one of its two neighbours in the next column, chosen with a
 * fair coin (forced at the top and bottom edges). Because each node has one receiver, paths
 * that meet never split again, so they merge into a river tree; nodes in the last column are
 * the outlets. Streams are coloured and widened by Strahler order.
 *
 * Generic tree helpers (topological order, Strahler order, drainage area) take any receiver
 * array (receiver[i] = downstream node, −1 at an outlet) and are tested on hand-built trees.
 */

/** Row position of node (x, k) on the staggered lattice. */
export function rowY(x: number, k: number): number {
  return k + (x & 1 ? 0.5 : 0);
}

/** Scheidegger receivers on a W × H staggered lattice; node index i = k·W + x. */
export function scheidegger(W: number, H: number, seed: number): Int32Array {
  const rand = mulberry32((seed ^ 0x1f83d9ab) >>> 0);
  const rec = new Int32Array(W * H);
  for (let k = 0; k < H; k++) {
    for (let x = 0; x < W; x++) {
      const i = k * W + x;
      if (x === W - 1) {
        rec[i] = -1;
        continue;
      }
      // Neighbours in column x + 1: rows k−1 and k from an even column, k and k+1 from an odd one.
      const lo = x & 1 ? k : k - 1;
      const hi = lo + 1;
      const coin = rand() < 0.5;
      let r = coin ? lo : hi;
      if (lo < 0) r = hi;
      else if (hi > H - 1) r = lo;
      rec[i] = r * W + x + 1;
    }
  }
  return rec;
}

/** Upstream-first order of a forest (Kahn). Throws if `receiver` has a cycle. */
export function topoOrder(receiver: Int32Array): Int32Array {
  const n = receiver.length;
  const indeg = new Int32Array(n);
  for (let i = 0; i < n; i++) if (receiver[i] >= 0) indeg[receiver[i]]++;
  const order = new Int32Array(n);
  let tail = 0;
  for (let i = 0; i < n; i++) if (indeg[i] === 0) order[tail++] = i;
  for (let head = 0; head < tail; head++) {
    const r = receiver[order[head]];
    if (r >= 0 && --indeg[r] === 0) order[tail++] = r;
  }
  if (tail !== n) throw new Error('receiver graph has a cycle');
  return order;
}

/**
 * Strahler order: sources are 1; where streams join, the order is the largest incoming order,
 * plus one if two or more incoming streams share that largest order.
 */
export function strahler(receiver: Int32Array, order = topoOrder(receiver)): Uint8Array {
  const n = receiver.length;
  const ord = new Uint8Array(n);
  const best = new Uint8Array(n);
  const ties = new Uint8Array(n);
  for (let q = 0; q < n; q++) {
    const i = order[q];
    ord[i] = best[i] === 0 ? 1 : ties[i] >= 2 ? best[i] + 1 : best[i];
    const r = receiver[i];
    if (r < 0) continue;
    if (ord[i] > best[r]) {
      best[r] = ord[i];
      ties[r] = 1;
    } else if (ord[i] === best[r]) {
      ties[r] = Math.min(255, ties[r] + 1);
    }
  }
  return ord;
}

/** Number of nodes draining through each node (itself included). */
export function drainageArea(receiver: Int32Array, order = topoOrder(receiver)): Int32Array {
  const area = new Int32Array(receiver.length).fill(1);
  for (let q = 0; q < order.length; q++) {
    const i = order[q];
    const r = receiver[i];
    if (r >= 0) area[r] += area[i];
  }
  return area;
}

/** The outlet each node finally drains to. */
export function outletOf(receiver: Int32Array, order = topoOrder(receiver)): Int32Array {
  const out = new Int32Array(receiver.length);
  for (let q = order.length - 1; q >= 0; q--) {
    const i = order[q];
    const r = receiver[i];
    out[i] = r < 0 ? i : out[r];
  }
  return out;
}

/** Seconds for the network to appear at speed 1×, then the shell holds and loops. */
export const RIVERS_GROW_S = 7;
export const RIVERS_STEP_HZ = 60;
/** Node spacing in CSS px: columns (downstream) and rows. Each step moves half a row. */
const COL_PX = 5;
const ROW_PX = 5;
const MAX_NODES = 40_000;

/** Lattice size for a canvas of cssW × cssH CSS px. */
export function riverGrid(cssW: number, cssH: number): { W: number; H: number } {
  let W = Math.max(8, Math.round(cssW / COL_PX));
  let H = Math.max(4, Math.round(cssH / ROW_PX));
  while (W * H > MAX_NODES) {
    W = Math.max(8, Math.floor(W * 0.9));
    H = Math.max(4, Math.floor(H * 0.9));
  }
  return { W, H };
}

export class RiversSim implements ModeSim {
  readonly id = 'rivers' as const;
  readonly interactive = false;
  readonly stepHz = RIVERS_STEP_HZ;
  W = 0;
  H = 0;
  receiver: Int32Array = new Int32Array(0);
  order: Uint8Array = new Uint8Array(0);
  area: Int32Array = new Int32Array(0);
  maxOrder = 1;
  maxArea = 1;
  /** Nodes sorted by drainage area, largest first: the reveal order. */
  private byArea = new Int32Array(0);
  /** Nodes revealed so far (prefix of byArea). */
  revealed = 0;
  private steps = 0;
  private totalSteps = RIVERS_GROW_S * RIVERS_STEP_HZ;
  private layer: HTMLCanvasElement | null = null;
  private layerCtx: CanvasRenderingContext2D | null = null;
  private drawnTo = 0;
  private layerKey = '';
  private colors: ModeColors | null = null;
  private strokes: string[] = [];
  private bgFill = '#000';

  build(seed: number, cssW: number, cssH: number): void {
    const { W, H } = riverGrid(cssW, cssH);
    this.W = W;
    this.H = H;
    this.receiver = scheidegger(W, H, seed);
    const topo = topoOrder(this.receiver);
    this.order = strahler(this.receiver, topo);
    this.area = drainageArea(this.receiver, topo);
    let mo = 1;
    let ma = 1;
    for (let i = 0; i < W * H; i++) {
      if (this.order[i] > mo) mo = this.order[i];
      if (this.area[i] > ma) ma = this.area[i];
    }
    this.maxOrder = mo;
    this.maxArea = ma;
    const area = this.area;
    this.byArea = Int32Array.from({ length: W * H }, (_, i) => i).sort(
      (a, b) => area[b] - area[a] || a - b,
    );
    this.revealed = 0;
    this.steps = 0;
    this.drawnTo = 0;
    this.layerKey = '';
    if (this.colors) this.setColors(this.colors);
  }

  needsRebuild(cssW: number, cssH: number): boolean {
    const { W, H } = riverGrid(cssW, cssH);
    return W !== this.W || H !== this.H;
  }

  warm(still: boolean): void {
    this.steps = still ? this.totalSteps : Math.round(this.totalSteps * 0.2);
    this.reveal();
  }

  restart(): void {
    this.steps = 0;
    this.revealed = 0;
    this.drawnTo = 0;
    this.layerKey = '';
  }

  finished(): boolean {
    return this.steps >= this.totalSteps;
  }

  /** Area threshold falls geometrically from the largest river to single nodes. */
  private reveal(): void {
    const p = Math.min(1, this.steps / this.totalSteps);
    const threshold = Math.pow(this.maxArea, 1 - p);
    const by = this.byArea;
    let r = this.revealed;
    while (r < by.length && (p >= 1 || this.area[by[r]] >= threshold)) r++;
    this.revealed = r;
  }

  step(): void {
    if (this.steps < this.totalSteps) this.steps++;
    this.reveal();
  }

  setColors(c: ModeColors): void {
    this.colors = c;
    const bg = rgbOf(c.sunken);
    this.bgFill = c.sunken;
    const id = c.palette.identity;
    const muted = rgbOf(c.muted);
    // Orders 1 and 2 are thin threads in two tints of the muted text colour; orders ≥ 3 take
    // the palette's categorical colours (cycling if needed). Width grows with order too, so
    // colour is never the only cue.
    this.strokes = [cssMix(bg, muted, 0.32), cssMix(bg, muted, 0.62)];
    for (let o = 3; o <= 16; o++) this.strokes.push(id[(o - 3) % id.length]);
    this.drawnTo = 0;
    this.layerKey = '';
  }

  /** Line width in CSS px for order o. */
  private widthOf(o: number): number {
    return o <= 1 ? 0.5 : o === 2 ? 0.9 : 0.6 + 0.9 * (o - 1);
  }

  draw(ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number): void {
    const key = `${cw}x${ch}`;
    if (!this.layer) {
      this.layer = document.createElement('canvas');
      this.layerCtx = this.layer.getContext('2d');
    }
    const lc = this.layerCtx;
    if (!lc) return;
    if (this.layerKey !== key || this.drawnTo > this.revealed) {
      this.layer.width = cw;
      this.layer.height = ch;
      lc.fillStyle = this.bgFill;
      lc.fillRect(0, 0, cw, ch);
      this.drawnTo = 0;
      this.layerKey = key;
    }
    if (this.drawnTo < this.revealed) {
      const sx = cw / this.W;
      const sy = ch / this.H;
      lc.lineCap = 'round';
      const { receiver, order, W } = this;
      const by = this.byArea;
      // Batch consecutive segments of the same order into one path.
      let q = this.drawnTo;
      while (q < this.revealed) {
        const o = order[by[q]];
        lc.beginPath();
        while (q < this.revealed && order[by[q]] === o) {
          const i = by[q++];
          const r = receiver[i];
          const x = i % W;
          const k = (i - x) / W;
          const x0 = (x + 0.5) * sx;
          const y0 = (rowY(x, k) + 0.25) * sy;
          let x1: number;
          let y1: number;
          if (r >= 0) {
            const rx = r % W;
            x1 = (rx + 0.5) * sx;
            y1 = (rowY(rx, (r - rx) / W) + 0.25) * sy;
          } else {
            x1 = cw;
            y1 = y0;
          }
          lc.moveTo(x0, y0);
          lc.lineTo(x1, y1);
        }
        lc.strokeStyle = this.strokes[Math.min(this.strokes.length - 1, o - 1)];
        lc.lineWidth = this.widthOf(o) * dpr;
        lc.stroke();
      }
      this.drawnTo = this.revealed;
    }
    ctx.drawImage(this.layer, 0, 0);
  }

  poke(): boolean {
    return false;
  }

  /** Nodes draining to the biggest outlet. */
  get largestArea(): number {
    return this.maxArea;
  }

  readout(): string {
    return `Strahler orders 1–${this.maxOrder} · largest river drains ${grouped(this.maxArea)} of ${grouped(
      this.W * this.H,
    )} cells`;
  }

  summary(): string {
    const pct = Math.round((100 * this.maxArea) / (this.W * this.H));
    return `A random river network on a ${this.W} by ${this.H} grid, flowing left to right. Every cell drains to one of two neighbours downstream, so paths merge into rivers. The highest Strahler order is ${this.maxOrder}, and the largest river drains ${grouped(
      this.maxArea,
    )} cells, ${pct}% of the grid. Bigger rivers appear first.`;
  }

  label(): string {
    return `River network grown from random drainage, flowing left to right. Streams are coloured and widened by Strahler order, from 1 up to ${this.maxOrder}.`;
  }
}
