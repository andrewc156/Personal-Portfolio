import { hexToRgb, packRgb, type RGB } from '../../common/color.ts';

/**
 * A W × H cell image (one pixel per cell) blitted, smoothed, onto the full canvas. Created on
 * first use and reused while the grid size holds, so frames don't allocate.
 */
export class PixelGrid {
  W = 0;
  H = 0;
  pixels = new Uint32Array(0);
  private image: ImageData | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  ensure(W: number, H: number): void {
    if (this.image && this.W === W && this.H === H) return;
    this.W = W;
    this.H = H;
    this.image = new ImageData(W, H);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.canvas ??= document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
  }

  blit(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
    if (!this.image || !this.ctx || !this.canvas) return;
    this.ctx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, cw, ch);
  }
}

/** Parse a hex colour, falling back if it isn't one. */
export function rgbOf(hex: string, fallback: RGB = [128, 128, 128]): RGB {
  try {
    return hexToRgb(hex);
  } catch {
    return fallback;
  }
}

/** Packed mix of two colours at t ∈ [0, 1]. */
export function packMix(a: RGB, b: RGB, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return packRgb(
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  );
}

/** CSS rgb() string for a mix of two colours. */
export function cssMix(a: RGB, b: RGB, t: number): string {
  const u = Math.min(1, Math.max(0, t));
  const c = (k: 0 | 1 | 2) => Math.round(a[k] + (b[k] - a[k]) * u);
  return `rgb(${c(0)} ${c(1)} ${c(2)})`;
}
