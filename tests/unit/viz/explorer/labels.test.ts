import { describe, expect, it } from 'vitest';
import labels from '../../../../public/data/colorado/labels.json';
import meta from '../../../../public/data/colorado/meta.json';
import {
  checkPlaceLabels,
  placeFraction,
  placeLabelBoxes,
  placeName,
  type PlaceLabelsFile,
} from '../../../../src/lib/viz/explorer/labels.ts';
import { gridGeo } from '../../../../src/lib/viz/explorer/geo.ts';
import type { ColoradoMeta } from '../../../../src/lib/viz/explorer/types.ts';

const places = labels as PlaceLabelsFile;
const gridMeta = meta as unknown as ColoradoMeta;

describe('explorer place labels', () => {
  it('accepts the published file and rejects the wrong grid or mismapped points', () => {
    expect(() => checkPlaceLabels(places, gridMeta)).not.toThrow();
    expect(() =>
      checkPlaceLabels({ ...places, grid: { ...places.grid, sha256: 'wrong' } }, gridMeta),
    ).toThrow(/grid does not match/);
    const [first, ...later] = places.labels;
    expect(() =>
      checkPlaceLabels({ ...places, labels: [{ ...first, x: first.x + 1 }, ...later] }, gridMeta),
    ).toThrow(/invalid place record/);
  });

  it('uses the precise geographic point and honours shortened display names', () => {
    const mouth = places.labels.find((label) => label.name === 'Colorado River')!;
    const [west, south, east, north] = gridMeta.native.extent;
    expect(placeFraction(mouth, gridGeo(gridMeta))).toEqual({
      x: (mouth.lon - west) / (east - west),
      y: (north - mouth.lat) / (north - south),
    });
    const place = places.labels.find((label) => label.display)!;
    expect(placeName(place)).toBe(place.display);
    expect(placeName(mouth)).toBe(mouth.name);
  });

  it('puts edge labels inside, resolves crowded points by priority, and is input-order independent', () => {
    const candidates = [
      { id: 9, x: 4, y: 14, priority: 1, textWidth: 55 },
      { id: 1, x: 4, y: 14, priority: 3, textWidth: 55 },
    ];
    const boxes = placeLabelBoxes(candidates, 78, 32);
    expect(boxes).toEqual([{ id: 9, left: 11, top: 6, width: 63, height: 16 }]);
    expect(placeLabelBoxes([...candidates].reverse(), 78, 32)).toEqual(boxes);
    expect(placeLabelBoxes(candidates, 50, 32)).toEqual([]);
  });

  it('omits a lower-priority point when its marker would land inside another placard', () => {
    const candidates = [
      { id: 90, x: 20, y: 30, priority: 1, textWidth: 40 },
      { id: 20, x: 42, y: 30, priority: 2, textWidth: 30 },
    ];
    expect(placeLabelBoxes(candidates, 140, 100)).toEqual([
      { id: 90, left: 27, top: 22, width: 48, height: 16 },
    ]);
  });
});
