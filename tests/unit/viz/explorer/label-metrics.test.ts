import { describe, expect, it } from 'vitest';
import labels from '../../../../public/data/colorado/labels.json';
import meta from '../../../../public/data/colorado/meta.json';
import widths from './place-label-widths.json';
import {
  LABEL_MARKER_RADIUS,
  labelAttachment,
  placeFraction,
  placeLabelBoxes,
  type LabelBox,
  type LabelCandidate,
  type PlaceLabelsFile,
} from '../../../../src/lib/viz/explorer/labels.ts';
import { displayAspect, gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import type { ColoradoMeta } from '../../../../src/lib/viz/explorer/types.ts';

// CI3: label widths depend on the face the browser draws with. Ubuntu's DejaVu Sans Bold
// is ~14% wider than macOS SF and ~22% wider than Plex Sans 600, and used to drop
// Las Vegas (a marker on the far west edge) at 320 and 375 px.
const places = labels as PlaceLabelsFile;
const geo = gridGeo(meta as unknown as ColoradoMeta);
const aspect = Number(displayAspect(geo).toFixed(5));
type WidthTable = Record<string, number>;
const plex = widths.plexSans600 as WidthTable;
const dejaVu = widths.dejaVuSansBold as WidthTable;

// The map layer is 34 px narrower than the viewport on mobile (measured: 286 at 320, 341 at 375).
const layerFor = (viewport: number) => {
  const width = viewport - 34;
  return { width, height: width / aspect };
};

function candidatesFor(width: number, height: number, table: WidthTable, scale: number) {
  return places.labels.map((place): LabelCandidate => {
    const { x, y } = placeFraction(place, geo);
    return {
      id: place.id,
      priority: place.priority,
      x: x * width,
      y: y * height,
      textWidth: table[String(place.id)] * scale,
    };
  });
}

/** The same separation rules the e2e test checks on the rendered SVG. */
function expectSeparated(
  candidates: LabelCandidate[],
  boxes: LabelBox[],
  width: number,
  height: number,
) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const radius = LABEL_MARKER_RADIUS + 0.625;
  const right = (b: LabelBox) => b.left + b.width;
  const bottom = (b: LabelBox) => b.top + b.height;
  for (const box of boxes) {
    const point = byId.get(box.id)!;
    const tip = labelAttachment(point, box);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(right(box)).toBeLessThanOrEqual(width);
    expect(bottom(box)).toBeLessThanOrEqual(height);
    const steps = Math.ceil(Math.hypot(tip.x - point.x, tip.y - point.y));
    for (const other of boxes) {
      if (other === box) continue;
      const inside = (x: number, y: number) =>
        x >= other.left && x <= right(other) && y >= other.top && y <= bottom(other);
      expect(
        box.left < right(other) &&
          other.left < right(box) &&
          box.top < bottom(other) &&
          other.top < bottom(box),
      ).toBe(false);
      expect(
        point.x - radius < right(other) &&
          point.x + radius > other.left &&
          point.y - radius < bottom(other) &&
          point.y + radius > other.top,
      ).toBe(false);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        expect(inside(point.x + (tip.x - point.x) * t, point.y + (tip.y - point.y) * t)).toBe(
          false,
        );
      }
    }
  }
}

const topIds = places.labels.filter((p) => p.priority === 1).map((p) => p.id);

describe('explorer place labels under different font metrics', () => {
  it('has measured widths for every published place', () => {
    for (const place of places.labels) {
      expect(plex[String(place.id)]).toBeGreaterThan(0);
      expect(dejaVu[String(place.id)]).toBeGreaterThan(0);
    }
    expect(topIds.length).toBeGreaterThan(0);
  });

  for (const viewport of [320, 375]) {
    for (const [name, table, scale] of [
      ['Plex Sans 600', plex, 1],
      ['Plex Sans 600 inflated 20% (DejaVu-like)', plex, 1.2],
      ['DejaVu Sans Bold', dejaVu, 1],
      ['DejaVu Sans Bold inflated 5%', dejaVu, 1.05],
    ] as const) {
      it(`places every priority-1 label with no overlaps at ${viewport}px: ${name}`, () => {
        const { width, height } = layerFor(viewport);
        const candidates = candidatesFor(width, height, table, scale);
        const boxes = placeLabelBoxes(candidates, width, height);
        const placed = new Set(boxes.map((b) => b.id));
        expect(topIds.filter((id) => !placed.has(id))).toEqual([]);
        expectSeparated(candidates, boxes, width, height);
      });
    }
  }

  it('keeps every priority-1 label across mobile layer widths with wide metrics', () => {
    const missed: string[] = [];
    for (let viewport = 320; viewport <= 440; viewport += 5) {
      for (const scale of [1, 1.1, 1.2, 1.25]) {
        const { width, height } = layerFor(viewport);
        const placed = new Set(
          placeLabelBoxes(candidatesFor(width, height, plex, scale), width, height).map(
            (b) => b.id,
          ),
        );
        if (topIds.some((id) => !placed.has(id))) missed.push(`${viewport}px ×${scale}`);
      }
    }
    expect(missed).toEqual([]);
  });

  it('keeps narrow-map leaders short even with wider fallback font metrics', () => {
    for (const viewport of [320, 325, 330, 335]) {
      const { width, height } = layerFor(viewport);
      for (const scale of [1.1, 1.2, 1.3]) {
        const candidates = candidatesFor(width, height, dejaVu, scale);
        const boxes = placeLabelBoxes(candidates, width, height);
        const placed = new Set(boxes.map((box) => box.id));
        expect(topIds.every((id) => placed.has(id))).toBe(true);
        for (const box of boxes) {
          const point = candidates.find(({ id }) => id === box.id)!;
          const tip = labelAttachment(point, box);
          expect(Math.hypot(tip.x - point.x, tip.y - point.y)).toBeLessThan(70);
        }
        expectSeparated(candidates, boxes, width, height);
      }
    }
  });

  it('retains the priority-1 count available without rescue slots', () => {
    // Seed 1100 from the CI3 checker: standard slots fit 13, while the old rescue pass fit 12.
    let seed = 1100;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const width = 80 + Math.floor(random() * 500);
    const height = 80 + Math.floor(random() * 700);
    const count = 2 + Math.floor(random() * 30);
    const candidates = Array.from({ length: count }, (_, index) => ({
      id: 1 + Math.floor(random() * 100000) * 100 + index,
      priority: 1 + Math.floor(random() * 3),
      x: random() * width,
      y: random() * height,
      textWidth: 20 + random() * 110,
    }));
    const boxes = placeLabelBoxes(candidates, width, height);
    const placed = new Set(boxes.map((box) => box.id));
    expect(
      candidates.filter(({ id, priority }) => priority === 1 && placed.has(id)).length,
    ).toBeGreaterThanOrEqual(13);
    expectSeparated(candidates, boxes, width, height);
    expect(placeLabelBoxes([...candidates].reverse(), width, height)).toEqual(boxes);
  });

  // Small layouts found by search where the previous greedy pass dropped a priority-1 label.
  it('rescues a priority-1 marker near the map edge by sliding its placard inward', () => {
    // Only the rescue slots fit id 2 (5 px from the west edge); reordering alone does not.
    const candidates = [
      { id: 1, priority: 1, x: 47, y: 20, textWidth: 39 },
      { id: 2, priority: 1, x: 5, y: 24, textWidth: 58 },
      { id: 3, priority: 1, x: 84, y: 15, textWidth: 38 },
    ];
    const boxes = placeLabelBoxes(candidates, 120, 100);
    expect(boxes.map((b) => b.id)).toEqual([1, 2, 3]);
    expectSeparated(candidates, boxes, 120, 100);
    expect(placeLabelBoxes([...candidates].reverse(), 120, 100)).toEqual(boxes);
  });

  it('lays out priority 1 again with the dropped label first when greedy order fails', () => {
    // Every slot of id 3 is taken by id 1 or 2 in feature-ID order; placing it first works.
    const candidates = [
      { id: 1, priority: 1, x: 91, y: 54, textWidth: 64 },
      { id: 2, priority: 1, x: 76, y: 82, textWidth: 42 },
      { id: 3, priority: 1, x: 45, y: 71, textWidth: 65 },
    ];
    const boxes = placeLabelBoxes(candidates, 120, 100);
    expect(boxes.map((b) => b.id)).toEqual([1, 2, 3]);
    expectSeparated(candidates, boxes, 120, 100);
    expect(placeLabelBoxes([...candidates].reverse(), 120, 100)).toEqual(boxes);
  });
});
