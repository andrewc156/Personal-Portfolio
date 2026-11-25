import { islandPersistence, type IslandBar } from '../../tda/index.ts';

/** Keep the longest positive intervals above the threshold, then draw them in birth order. */
export function selectIslandBars(
  bars: readonly IslandBar[],
  minPersistence: number,
  maxBars: number,
): IslandBar[] {
  const birthOrder = (a: IslandBar, b: IslandBar) =>
    a.birth - b.birth || a.saddleCell - b.saddleCell || a.peakCell - b.peakCell;
  return bars
    .filter((bar) => bar.death > bar.birth && islandPersistence(bar) >= minPersistence)
    .sort((a, b) => islandPersistence(b) - islandPersistence(a) || birthOrder(a, b))
    .slice(0, maxBars)
    .sort(birthOrder);
}
