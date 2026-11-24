/**
 * Deterministic generative thumbnail for a research area (spec §4.3). The slug seeds a
 * small PRNG; the output is plain SVG markup made at build time, so no runtime JS runs.
 * Colors are CSS custom properties, so the art follows the site theme.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 240;
const H = 120;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A ridge line as a closed path: smooth sum of a few seeded sine waves. */
function ridge(rand: () => number, base: number, amp: number): string {
  const waves = Array.from({ length: 3 }, () => ({
    f: 1 + Math.floor(rand() * 4),
    p: rand() * Math.PI * 2,
    a: amp * (0.3 + rand() * 0.7),
  }));
  const pts: string[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const y = waves.reduce((acc, w) => acc + w.a * Math.sin((x / W) * Math.PI * w.f + w.p), base);
    pts.push(`${r1(x)} ${r1(y)}`);
  }
  return `M${pts.join(' L')} L${W} ${H} L0 ${H} Z`;
}

/** SVG inner markup (no outer <svg>) for the thumbnail of `slug`. Same slug → same markup. */
export function thumbnailMarkup(slug: string): string {
  const rand = mulberry32(hashString(slug));
  const fills = ['var(--color-land-1)', 'var(--color-land-2)', 'var(--color-land-3)'];
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="var(--color-surface-sunken)"/>`];
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const base = H * (0.38 + i * 0.17) + (rand() - 0.5) * 10;
    parts.push(`<path d="${ridge(rand, base, 12 - i * 2)}" fill="${fills[i]}"/>`);
    if (i === 1) {
      const level = r1(base + 6 + rand() * 8);
      parts.push(
        `<rect x="0" y="${level}" width="${W}" height="${r1(H - level)}" fill="var(--color-water)" opacity="0.85"/>`,
      );
    }
  }
  // A few seeded "bars" along the bottom edge, a nod to a persistence barcode.
  const bars = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < bars; i++) {
    const x0 = r1(rand() * W * 0.6);
    const len = r1(16 + rand() * (W - x0 - 16) * 0.8);
    parts.push(
      `<rect x="${x0}" y="${r1(H - 8 - i * 5)}" width="${len}" height="2.5" rx="1" fill="var(--color-water-deep)" opacity="0.7"/>`,
    );
  }
  return parts.join('');
}

export const THUMB_VIEWBOX = `0 0 ${W} ${H}`;
