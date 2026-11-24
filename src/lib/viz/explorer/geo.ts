import type { ColoradoMeta } from './types.ts';

/**
 * Grid geometry (docs/data.md, meta.cellCenter): cell i = y·W + x, row 0 north. Cell (x, y)
 * covers native pixel columns 30x … 30x+29 and rows 30y … 30y+29 of the clipped native raster
 * (fewer in the last column and row); its centre is the centre of those pixels.
 */
export interface GridGeo {
  W: number;
  H: number;
  /** Native pixels per cell side (30). */
  block: number;
  nativeW: number;
  nativeH: number;
  pixelDeg: number;
  /** West and north pixel edges of the native raster (degrees). */
  west: number;
  north: number;
  south: number;
  east: number;
  centerLat: number;
}

export function gridGeo(meta: ColoradoMeta): GridGeo {
  const block = Math.round(meta.cellDeg / meta.native.pixelDeg);
  const [west, south, east, north] = meta.native.extent;
  return {
    W: meta.width,
    H: meta.height,
    block,
    nativeW: meta.native.width,
    nativeH: meta.native.height,
    pixelDeg: meta.native.pixelDeg,
    west,
    north,
    south,
    east,
    centerLat: meta.center.lat,
  };
}

/** Native pixel range [c0, c1) of column x (or row y with the native height). */
export function blockSpan(k: number, block: number, nativeLen: number): [number, number] {
  const a = Math.min(k * block, nativeLen);
  return [a, Math.min(a + block, nativeLen)];
}

export interface LatLon {
  lat: number;
  lon: number;
}

/** Centre of cell i (degrees). Matches meta.min / meta.max and docs/data.md's lakes table. */
export function cellCenter(i: number, g: GridGeo): LatLon {
  const y = Math.floor(i / g.W);
  const x = i - y * g.W;
  const [c0, c1] = blockSpan(x, g.block, g.nativeW);
  const [r0, r1] = blockSpan(y, g.block, g.nativeH);
  return {
    lon: g.west + ((c0 + c1) / 2) * g.pixelDeg,
    lat: g.north - ((r0 + r1) / 2) * g.pixelDeg,
  };
}

/**
 * Display aspect (width / height) of the equirectangular map scaled by cos(centre latitude),
 * computed from the native footprint. meta.derived.displayAspect records the same value (≈ 0.63).
 */
export function displayAspect(g: GridGeo): number {
  return ((g.east - g.west) / (g.north - g.south)) * Math.cos((g.centerLat * Math.PI) / 180);
}

/** Cell under a point given as fractions (0–1) of the map's width and height, or −1 outside. */
export function cellAtFraction(fx: number, fy: number, g: GridGeo): number {
  if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return -1;
  const x = Math.min(g.W - 1, Math.floor(Math.floor(fx * g.nativeW) / g.block));
  const y = Math.min(g.H - 1, Math.floor(Math.floor(fy * g.nativeH) / g.block));
  return y * g.W + x;
}

/** Map-space fraction (0–1) of the left edge of each column 0…W (length W+1), and likewise rows. */
export function cellEdges(g: GridGeo): { xs: Float64Array; ys: Float64Array } {
  const xs = new Float64Array(g.W + 1);
  const ys = new Float64Array(g.H + 1);
  for (let x = 0; x <= g.W; x++) xs[x] = Math.min(x * g.block, g.nativeW) / g.nativeW;
  for (let y = 0; y <= g.H; y++) ys[y] = Math.min(y * g.block, g.nativeH) / g.nativeH;
  return { xs, ys };
}

/**
 * Relative ground area of each cell: (pixels wide × pixels tall) × cos(latitude of its centre).
 * Used for "% of area flooded" (cells are smaller in the north and at the partial edges).
 */
export function cellAreas(g: GridGeo): Float64Array {
  const out = new Float64Array(g.W * g.H);
  const rad = Math.PI / 180;
  for (let y = 0; y < g.H; y++) {
    const [r0, r1] = blockSpan(y, g.block, g.nativeH);
    const lat = g.north - ((r0 + r1) / 2) * g.pixelDeg;
    const rowW = (r1 - r0) * Math.cos(lat * rad);
    for (let x = 0; x < g.W; x++) {
      const [c0, c1] = blockSpan(x, g.block, g.nativeW);
      out[y * g.W + x] = (c1 - c0) * rowW;
    }
  }
  return out;
}

/** Which rectangle edge(s) a cell lies on, e.g. "east edge", or "" if it is inside. */
export function edgeOf(i: number, W: number, H: number): string {
  const y = Math.floor(i / W);
  const x = i - y * W;
  const parts: string[] = [];
  if (y === 0) parts.push('north');
  if (y === H - 1) parts.push('south');
  if (x === 0) parts.push('west');
  if (x === W - 1) parts.push('east');
  return parts.length ? `${parts.join('-')} edge` : '';
}
