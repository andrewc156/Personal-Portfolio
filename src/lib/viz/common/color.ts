/**
 * Colour maths shared by the canvases: hex parsing, packed RGBA for ImageData, WCAG contrast,
 * CIELAB / CIEDE2000, and colour-vision-deficiency simulation (Machado, Oliveira & Fernandes
 * 2009, severity 1.0, applied in linear RGB). Pure functions, no DOM.
 */

export type RGB = readonly [number, number, number];

/** '#rrggbb' or '#rgb' → [r, g, b] in 0–255. */
export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new RangeError(`bad hex colour: ${hex}`);
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (x: number) =>
    Math.round(Math.min(255, Math.max(0, x)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Pack an opaque colour for a Uint32Array view over ImageData (little-endian: ABGR in memory
 * order RGBA). Every browser the site targets is little-endian.
 */
export function packRgb(r: number, g: number, b: number): number {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Piecewise-linear ramp through `stops` at t ∈ [0, 1]. */
export function rampRgb(stops: readonly RGB[], t: number): RGB {
  if (stops.length === 1) return stops[0];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(x));
  return mixRgb(stops[k], stops[k + 1], x - k);
}

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function fromLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
}

/** WCAG 2 relative luminance. */
export function luminance(rgb: RGB): number {
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

/** WCAG 2 contrast ratio (1–21). */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type CvdKind = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Machado et al. (2009) simulation matrices, severity 1.0, for linear RGB. */
export const CVD_MATRICES: Record<CvdKind, readonly number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

/** Simulate how `rgb` looks with the given colour-vision deficiency. */
export function simulateCvd(rgb: RGB, kind: CvdKind): RGB {
  const m = CVD_MATRICES[kind];
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  return [
    fromLinear(m[0] * r + m[1] * g + m[2] * b),
    fromLinear(m[3] * r + m[4] * g + m[5] * b),
    fromLinear(m[6] * r + m[7] * g + m[8] * b),
  ];
}

/** sRGB → CIELAB (D65). */
export function rgbToLab(rgb: RGB): [number, number, number] {
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference between two sRGB colours. */
export function deltaE2000(c1: RGB, c2: RGB): number {
  return deltaE2000Lab(rgbToLab(c1), rgbToLab(c2));
}

/** CIEDE2000 (Sharma, Wu & Dalal 2005) between two CIELAB colours. */
export function deltaE2000Lab(
  [L1, a1, b1]: readonly [number, number, number],
  [L2, a2, b2]: readonly [number, number, number],
): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? hbp + 360 : hbp - 360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/** Smallest pairwise ΔE2000 in a set of colours, optionally after CVD simulation. */
export function minPairwiseDeltaE(colors: readonly RGB[], kind?: CvdKind): number {
  const cs = kind ? colors.map((c) => simulateCvd(c, kind)) : colors;
  let min = Infinity;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) min = Math.min(min, deltaE2000(cs[i], cs[j]));
  }
  return min;
}
