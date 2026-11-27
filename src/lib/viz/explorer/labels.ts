import { cellAtFraction, gridGeo, type GridGeo } from './geo.ts';
import type { ColoradoMeta } from './types.ts';

export interface PlaceLabel {
  id: number;
  name: string;
  display?: string;
  priority: 1 | 2 | 3;
  lat: number;
  lon: number;
  x: number;
  y: number;
  anchor?: 'mouth';
}

export interface PlaceLabelsFile {
  count: number;
  grid: {
    sha256: string;
    width: number;
    height: number;
    cellDeg: number;
    extent: number[];
  };
  source: { name: string; page: string };
  attribution: { credit: string };
  labels: PlaceLabel[];
}

export const placeName = (place: PlaceLabel): string => place.display ?? place.name;

export function placeFraction(place: Pick<PlaceLabel, 'lat' | 'lon'>, geo: GridGeo) {
  return {
    x: (place.lon - geo.west) / (geo.east - geo.west),
    y: (geo.north - place.lat) / (geo.north - geo.south),
  };
}

/** Fail the build if the locally published labels would be placed over a different grid. */
export function checkPlaceLabels(file: PlaceLabelsFile, meta: ColoradoMeta): void {
  const geo = gridGeo(meta);
  const g = file.grid;
  if (
    g?.sha256 !== meta.files['grid.f32']?.sha256 ||
    g.width !== geo.W ||
    g.height !== geo.H ||
    g.cellDeg !== meta.cellDeg ||
    g.extent?.length !== 4 ||
    !meta.native.extent.every((v, k) => g.extent[k] === v)
  ) {
    throw new Error('labels.json grid does not match meta.json');
  }
  if (
    !file.attribution?.credit ||
    !file.source?.page ||
    !file.source.name ||
    !Array.isArray(file.labels) ||
    file.count <= 0 ||
    file.count !== file.labels.length
  ) {
    throw new Error('labels.json is missing its labels or source credit');
  }
  const ids = new Set<number>();
  for (const label of file.labels) {
    const { id, name, display, priority, x, y, anchor } = label;
    const p = placeFraction(label, geo);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      ids.has(id) ||
      typeof name !== 'string' ||
      !name.trim() ||
      (display !== undefined && (typeof display !== 'string' || !display.trim())) ||
      ![1, 2, 3].includes(priority) ||
      (anchor !== undefined && anchor !== 'mouth') ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= geo.W ||
      y < 0 ||
      y >= geo.H ||
      cellAtFraction(p.x, p.y, geo) !== y * geo.W + x
    ) {
      throw new Error(`labels.json has an invalid place record (${id})`);
    }
    ids.add(id);
  }
}

export interface LabelCandidate {
  id: number;
  priority: number;
  x: number;
  y: number;
  textWidth: number;
}

export interface LabelBox {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const PAD = 3;
const GAP = 3;
export const LABEL_MARKER_RADIUS = 2.5;
// Includes the border stroke.
const MARKER_EXTENT = 3.25;
export const LABEL_HEIGHT = 16;
export const LABEL_TEXT_PAD = 4;

interface Point {
  x: number;
  y: number;
}

function markerBox({ id, x, y }: LabelCandidate): LabelBox {
  return {
    id,
    left: x - MARKER_EXTENT,
    top: y - MARKER_EXTENT,
    width: MARKER_EXTENT * 2,
    height: MARKER_EXTENT * 2,
  };
}

export function labelAttachment({ x, y }: Point, box: LabelBox): Point {
  return {
    x: Math.max(box.left, Math.min(x, box.left + box.width)),
    y: Math.max(box.top, Math.min(y, box.top + box.height)),
  };
}

interface Leader {
  from: Point;
  to: Point;
}

/** Clip the segment to a rectangle expanded by the width of the leader stroke. */
function leaderHits({ from, to }: Leader, box: LabelBox): boolean {
  let start = 0;
  let end = 1;
  for (const [p, delta, low, high] of [
    [from.x, to.x - from.x, box.left - 1, box.left + box.width + 1],
    [from.y, to.y - from.y, box.top - 1, box.top + box.height + 1],
  ]) {
    if (delta === 0) {
      if (p < low || p > high) return false;
    } else {
      const t0 = (low - p) / delta;
      const t1 = (high - p) / delta;
      start = Math.max(start, Math.min(t0, t1));
      end = Math.min(end, Math.max(t0, t1));
      if (start > end) return false;
    }
  }
  return true;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return (
    a.left < b.left + b.width + GAP &&
    b.left < a.left + a.width + GAP &&
    a.top < b.top + b.height + GAP &&
    b.top < a.top + a.height + GAP
  );
}

// Standard slots: 8 positions around the marker at each distance. Priority 1 may reach
// farther when crowded.
const DISTANCES = [7, 19];
const TOP_DISTANCES = [7, 19, 34, 50];
// Rescue slots slide placards along a side of the marker, so an anchor hard against
// the map edge can still be labeled inward.
const NEAR_RESCUE_DISTANCES = [7, 19, 34, 50];
const WIDE_RESCUE_DISTANCES = [...NEAR_RESCUE_DISTANCES, 70, 95, 125];
const RESCUE_SLIDES = [0, 0.25, 0.5, 0.75, 1];
const MAX_COMPACT_LEADER = 65;
// Try intermediate offsets when the normal slots would need a long leader.
const COMPACT_RESCUE_DISTANCES = [
  ...NEAR_RESCUE_DISTANCES,
  ...Array.from({ length: 28 }, (_, i) => 11 + i * 2),
];
const COMPACT_SEARCH_LIMIT = 2500;

interface Placement {
  box: LabelBox;
  leader: Leader;
}

interface Layout {
  placements: Placement[];
  markers: LabelBox[];
}

function slots(
  { priority, x, y }: LabelCandidate,
  boxWidth: number,
  rescueDistances: readonly number[],
): [number, number][] {
  const out: [number, number][] = [];
  for (const distance of priority === 1 ? TOP_DISTANCES : DISTANCES) {
    const left = x - boxWidth - distance;
    const right = x + distance;
    const top = y - LABEL_HEIGHT - distance;
    const bottom = y + distance;
    const midX = x - boxWidth / 2;
    const midY = y - LABEL_HEIGHT / 2;
    out.push(
      [right, midY],
      [left, midY],
      [midX, top],
      [midX, bottom],
      [right, top],
      [left, top],
      [right, bottom],
      [left, bottom],
    );
  }
  if (priority !== 1) return out;
  for (const distance of rescueDistances) {
    const left = x - boxWidth - distance;
    const right = x + distance;
    for (const slide of RESCUE_SLIDES) {
      const along = x - boxWidth * slide;
      const beside = y - LABEL_HEIGHT * slide;
      out.push(
        [along, y - LABEL_HEIGHT - distance],
        [along, y + distance],
        [right, beside],
        [left, beside],
      );
    }
  }
  return out;
}

function* placements(
  candidate: LabelCandidate,
  width: number,
  height: number,
  rescueDistances: readonly number[],
  maxLeaderLength = Infinity,
): Generator<Placement> {
  const { id, x, y, textWidth } = candidate;
  const boxWidth = Math.ceil(textWidth) + LABEL_TEXT_PAD * 2;
  if (boxWidth > width - PAD * 2 || LABEL_HEIGHT > height - PAD * 2) return;

  for (const [left, top] of slots(candidate, boxWidth, rescueDistances)) {
    const box = {
      id,
      left: Math.max(PAD, Math.min(left, width - PAD - boxWidth)),
      top: Math.max(PAD, Math.min(top, height - PAD - LABEL_HEIGHT)),
      width: boxWidth,
      height: LABEL_HEIGHT,
    };
    const to = labelAttachment(candidate, box);
    if ((to.x - x) ** 2 + (to.y - y) ** 2 <= maxLeaderLength ** 2 + 1e-9) {
      yield { box, leader: { from: candidate, to } };
    }
  }
}

function clearsMarkers({ box, leader }: Placement, marker: LabelBox, markers: LabelBox[]) {
  return (
    !overlaps(box, marker) &&
    !markers.some(
      (point) => overlaps(box, point) || (point.id !== marker.id && leaderHits(leader, point)),
    )
  );
}

function compatible(a: Placement, b: Placement) {
  return !overlaps(a.box, b.box) && !leaderHits(a.leader, b.box) && !leaderHits(b.leader, a.box);
}

/** Try the candidate's slots in order; on success, record its placard, leader and marker. */
function placeOne(
  candidate: LabelCandidate,
  width: number,
  height: number,
  layout: Layout,
  rescueDistances: readonly number[],
  maxLeaderLength = Infinity,
): boolean {
  const marker = markerBox(candidate);
  // A label whose anchor is covered by an earlier placard would be misleading.
  if (
    layout.placements.some(({ box, leader }) => overlaps(marker, box) || leaderHits(leader, marker))
  ) {
    return false;
  }

  for (const placement of placements(candidate, width, height, rescueDistances, maxLeaderLength)) {
    if (
      clearsMarkers(placement, marker, layout.markers) &&
      layout.placements.every((other) => compatible(placement, other))
    ) {
      layout.placements.push(placement);
      if (candidate.priority !== 1) layout.markers.push(marker);
      return true;
    }
  }
  return false;
}

/** Retry compact placement with the most constrained anchors first. */
function compactLayout(
  top: LabelCandidate[],
  topMarkers: LabelBox[],
  width: number,
  height: number,
): Layout | undefined {
  const options = top.map((candidate, i) => {
    const seen = new Set<string>();
    const available: Placement[] = [];
    for (const placement of placements(
      candidate,
      width,
      height,
      COMPACT_RESCUE_DISTANCES,
      MAX_COMPACT_LEADER,
    )) {
      const { left, top } = placement.box;
      const key = `${left},${top}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (clearsMarkers(placement, topMarkers[i], topMarkers)) available.push(placement);
    }
    return available;
  });

  const chosen: Placement[] = [];
  let remaining = COMPACT_SEARCH_LIMIT;
  const fit = (available: Placement[][]): boolean => {
    if (!available.length) return true;
    available.sort((a, b) => a.length - b.length);
    const [next, ...rest] = available;
    for (const placement of next) {
      if (remaining === 0) return false;
      remaining--;
      const narrowed = rest.map((options) =>
        options.filter((other) => compatible(placement, other)),
      );
      if (narrowed.some((options) => !options.length)) continue;
      chosen.push(placement);
      if (fit(narrowed)) return true;
      chosen.pop();
    }
    return false;
  };
  return fit(options) ? { placements: chosen, markers: [...topMarkers] } : undefined;
}

/**
 * Lay out priority groups in order, with stable feature-ID ties and in-bounds label boxes.
 * Try compact leaders first, then consider wider or standard-only slots if necessary
 * to keep more priority-1 labels. Lower priorities fill the gaps greedily.
 */
export function placeLabelBoxes(
  candidates: readonly LabelCandidate[],
  width: number,
  height: number,
): LabelBox[] {
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority || a.id - b.id);
  const top = sorted.filter((p) => p.priority === 1);
  const topMarkers = top.map(markerBox);

  const search = (rescueDistances: readonly number[], maxLeaderLength = Infinity) => {
    let order = top;
    let best: Layout = { placements: [], markers: [...topMarkers] };
    for (let attempt = 0; attempt <= top.length; attempt++) {
      const layout: Layout = { placements: [], markers: [...topMarkers] };
      const missing = order.filter(
        (candidate) =>
          !placeOne(candidate, width, height, layout, rescueDistances, maxLeaderLength),
      );
      if (layout.placements.length > best.placements.length) best = layout;
      if (!missing.length) break;
      order = [...missing, ...order.filter((candidate) => !missing.includes(candidate))];
    }
    return best;
  };

  let layout = search(NEAR_RESCUE_DISTANCES, MAX_COMPACT_LEADER);
  if (layout.placements.length < top.length) {
    layout = compactLayout(top, topMarkers, width, height) ?? layout;
  }
  if (layout.placements.length < top.length) {
    const standard = search([]);
    const wide = search(WIDE_RESCUE_DISTANCES);
    if (standard.placements.length > layout.placements.length) layout = standard;
    if (wide.placements.length > layout.placements.length) layout = wide;
  }
  for (const candidate of sorted) {
    if (candidate.priority !== 1) placeOne(candidate, width, height, layout, []);
  }
  const rank = new Map(sorted.map((candidate, k) => [candidate.id, k]));
  return layout.placements.map(({ box }) => box).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
}
