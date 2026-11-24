/**
 * Persistence engine: 0-dimensional persistent homology of sublevel sets of a height grid.
 * Semantics: portfolio-megaprompt.md §6.1; documentation: docs/tda.md.
 */
export { computeH0, allFiniteBars, isEssential, persistence } from './h0.ts';
export { Flood } from './flood.ts';
export type { FloodOptions } from './flood.ts';
export { sortCells, sortCellsByComparator, rankOf, validateGrid } from './order.ts';
export type { Bar, Connectivity, H0Options, H0Result, H0Stats, MergeEvent } from './types.ts';
