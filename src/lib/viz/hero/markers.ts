/**
 * Placement of the pit/pass markers and their labels on the hero map. Pure geometry (device
 * px): markers are clamped inside the canvas (clear of its rounded corners) and labels are
 * placed so they stay inside the canvas and don't overlap each other or the markers.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clamp a marker centre so a marker of radius r (plus margin) stays fully inside the canvas. */
export function clampMarker(v: number, size: number, r: number, margin: number): number {
  const lo = r + margin;
  const hi = size - r - margin;
  if (hi < lo) return size / 2;
  return Math.min(hi, Math.max(lo, v));
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(a: Box, W: number, H: number, pad: number): boolean {
  return a.x >= pad && a.y >= pad && a.x + a.w <= W - pad && a.y + a.h <= H - pad;
}

/**
 * Place one label (size w × h) next to a marker at (mx, my) with radius r. Tries right, left,
 * above and below (then diagonal offsets) and returns the first box that fits inside the
 * canvas and clears every box in `avoid`. Falls back to the right/left box clamped inside.
 */
export function placeLabel(
  mx: number,
  my: number,
  r: number,
  w: number,
  h: number,
  W: number,
  H: number,
  gap: number,
  pad: number,
  avoid: readonly Box[],
): Box {
  const right = mx + r + gap;
  const left = mx - r - gap - w;
  const midY = my - h / 2;
  const above = my - r - gap - h;
  const below = my + r + gap;
  const centreX = mx - w / 2;
  const candidates: Box[] = [
    { x: right, y: midY, w, h },
    { x: left, y: midY, w, h },
    { x: centreX, y: above, w, h },
    { x: centreX, y: below, w, h },
    { x: right, y: above, w, h },
    { x: right, y: below, w, h },
    { x: left, y: above, w, h },
    { x: left, y: below, w, h },
    { x: right, y: midY - 2 * h, w, h },
    { x: right, y: midY + 2 * h, w, h },
    { x: left, y: midY - 2 * h, w, h },
    { x: left, y: midY + 2 * h, w, h },
  ];
  for (const c of candidates) {
    if (inside(c, W, H, pad) && !avoid.some((a) => overlaps(c, a))) return c;
  }
  // Nothing fits cleanly: clamp inside, preferring a spot that clears the other boxes.
  const clampBox = (b: Box): Box => ({
    x: Math.min(W - pad - w, Math.max(pad, b.x)),
    y: Math.min(H - pad - h, Math.max(pad, b.y)),
    w,
    h,
  });
  for (const c of candidates) {
    const b = clampBox(c);
    if (!avoid.some((a) => overlaps(b, a))) return b;
  }
  return clampBox(candidates[mx + r + gap + w <= W - pad ? 0 : 1]);
}
