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

/** Lay out priority groups in order, with stable feature-ID ties and in-bounds label boxes. */
export function placeLabelBoxes(
  candidates: readonly LabelCandidate[],
  width: number,
  height: number,
): LabelBox[] {
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority || a.id - b.id);
  const placed: LabelBox[] = [];
  const markers = sorted.filter((p) => p.priority === 1).map(markerBox);
  const leaders: Leader[] = [];

  for (const candidate of sorted) {
    const { id, priority, x, y, textWidth } = candidate;
    const marker = markerBox(candidate);
    // A label whose anchor is covered by an earlier placard would be misleading.
    if (placed.some((box) => overlaps(marker, box))) continue;
    if (leaders.some((leader) => leaderHits(leader, marker))) continue;
    const boxWidth = Math.ceil(textWidth) + LABEL_TEXT_PAD * 2;
    if (boxWidth > width - PAD * 2 || LABEL_HEIGHT > height - PAD * 2) continue;

    // Higher priority places can reach a little farther from the marker when crowded.
    for (const distance of priority === 1 ? [7, 19, 34, 50] : [7, 19]) {
      const left = x - boxWidth - distance;
      const right = x + distance;
      const top = y - LABEL_HEIGHT - distance;
      const bottom = y + distance;
      const midX = x - boxWidth / 2;
      const midY = y - LABEL_HEIGHT / 2;
      const options = [
        [right, midY],
        [left, midY],
        [midX, top],
        [midX, bottom],
        [right, top],
        [left, top],
        [right, bottom],
        [left, bottom],
      ];
      const fit = options
        .map(([l, t]) => ({
          id,
          left: Math.max(PAD, Math.min(l, width - PAD - boxWidth)),
          top: Math.max(PAD, Math.min(t, height - PAD - LABEL_HEIGHT)),
          width: boxWidth,
          height: LABEL_HEIGHT,
        }))
        .find((box) => {
          const leader = { from: candidate, to: labelAttachment(candidate, box) };
          return (
            !placed.some((other) => overlaps(box, other) || leaderHits(leader, other)) &&
            !markers.some((point) => overlaps(box, point)) &&
            !overlaps(box, marker) &&
            !leaders.some((other) => leaderHits(other, box)) &&
            !markers.some((point) => point.id !== id && leaderHits(leader, point))
          );
        });
      if (fit) {
        placed.push(fit);
        leaders.push({ from: candidate, to: labelAttachment(candidate, fit) });
        if (priority !== 1) markers.push(marker);
        break;
      }
    }
  }
  return placed;
}
