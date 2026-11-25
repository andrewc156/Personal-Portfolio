/**
 * Persistence engine: 0-dimensional persistent homology of sublevel sets of a height grid (lakes),
 * plus the islands (H1) barcode of the flooded region.
 * Semantics: portfolio-megaprompt.md §6.1; documentation: docs/tda.md.
 */
export { computeH0, allFiniteBars, isEssential, persistence } from './h0.ts';
export { Flood } from './flood.ts';
export { computeH1Islands, islandPersistence, Islands } from './h1.ts';
export type { FloodOptions } from './flood.ts';
export { sortCells, sortCellsByComparator, rankOf, validateGrid } from './order.ts';
export type {
  Bar,
  Connectivity,
  H0Options,
  H0Result,
  H0Stats,
  IslandBar,
  IslandEvent,
  IslandsOptions,
  IslandsResult,
  IslandsStats,
  MergeEvent,
} from './types.ts';
