# Persistence engine (F3)

The engine computes 0-dimensional persistent homology (H0) of the sublevel-set filtration of a height grid. In plain terms: water rises over a landscape, lakes are born and merge, and the barcode records each lake's lifetime.

- TypeScript engine: `src/lib/tda/` (`index.ts` re-exports everything)
- Independent Python reference: `pipeline/tda_ref.py`
- Tests: `tests/unit/tda/` (Vitest), `pipeline/tests/test_tda_ref.py` (pytest)
- Shared fixtures: `tests/fixtures/tda/` (`golden.json`, `agreement.json`, and `generate_fixtures.py`)
- Benchmark: `node scripts/bench-tda.mjs`

## Semantics (spec §6.1)

- **Grid.** Heights `h` on a W×H grid. Cell index `i = y·W + x`, and row 0 is north. Heights are float32 and must be finite. NaN and ±∞ are rejected, because `death = +∞` is reserved for essential bars.
- **Total order.** `i ≺ j` iff `(h[i], i) < (h[j], j)` lexicographically. Every tie is broken this way. `-0` and `+0` count as equal heights.
- **Connectivity.** 4-neighbor (N, S, E, W) by default. 8-neighbor is opt-in (`{ connectivity: 8 }` / `connectivity=8`).
- **Sweep.** Cells are added in ≺ order. When cell `i` is added, the engine collects the distinct roots of its already-added neighbors:
  - **No roots:** a lake is born at `h[i]`, with birth cell `i`.
  - **One or more roots:** `i` joins the oldest root, the one whose birth cell is smallest under ≺. Every other root dies at `h[i]` with death cell `i` (the elder rule).
- **Bars.** Each death is a bar `(birth, death, birthCell, deathCell)`. The engine also records `mergedInto`, the birth cell of the older lake that absorbed it.
- **Zero-length bars.** On plateaus a bar can have `death == birth`. These bars are left out of `bars` (the display list) but kept in `zeroLength` and counted in `stats.zeroLength`.
- **Essential bar.** After the sweep, each connected domain keeps one bar with `death = +∞`. A full grid is connected, so there is exactly one, born at the global ≺-minimum cell.
- **Persistence.** `death − birth`: how deep a basin sits below its spill point.
- **Lakes.** At level `t` the flooded region is `{x : h(x) ≤ t}`, and its connected components are the lakes.

**Conventions both implementations share (needed for exact agreement):**
- Bars are listed in sweep order: by the ≺-rank of the death cell. When several lakes die at the same cell, they are listed oldest first, by the ≺-rank of their birth cells.
- Essential bars come last, in ≺ order of their birth cells.
- A lake's id is its birth cell. In the TypeScript engine, the union-find root is always the birth cell, so `componentOf(i)` returns the lake id directly.

## TypeScript API (spec §6.2)

```ts
import { computeH0, Flood } from '../lib/tda/index.ts';

computeH0(heights: Float32Array, W: number, H: number, opts?: { connectivity?: 4 | 8 }): H0Result

interface H0Result {
  bars: Bar[];            // finite bars with death > birth (sweep order), then essential bars
  zeroLength: Bar[];      // finite bars with death == birth (debug only)
  order: Uint32Array;     // cells sorted by ≺
  rank: Uint32Array;      // rank[i] = position of cell i in order
  stats: { cells, connectivity, births, finite, zeroLength, essential };
}
interface Bar { birth; death; birthCell; deathCell; mergedInto }  // essential: death = Infinity, deathCell = mergedInto = -1
```

Helpers: `isEssential(bar)`, `persistence(bar)`, `allFiniteBars(result)` (display plus zero-length bars, in sweep order), `sortCells(heights)`, `rankOf(order)`, `validateGrid(...)`.

```ts
const flood = new Flood(heights, W, H, { connectivity?: 4 | 8, order?: Uint32Array /* reuse computeH0().order */ });
flood.reset();                    // dry grid, level −∞
flood.advanceTo(level);           // → MergeEvent[] (births and merges, in sweep order)
flood.componentOf(i);             // lake id (birth cell) = union-find root, path-compressed; −1 if dry
flood.isWet(i);                   // h[i] ≤ level
flood.levelAtPercentile(p);       // p ∈ [0, 100] → height of the cell at that rank of `order`
flood.alive();                    // number of lakes now
flood.level; flood.wetCount;      // current level, number of wet cells

interface MergeEvent { type: 'birth' | 'merge'; level; cell; lake; into }
// birth: lake = cell, into = −1.  merge: lake `lake` dies at pass `cell` and joins lake `into`.
```

- `advanceTo` to a lower level resets and replays from the bottom. If no cell lies between the old and new levels, nothing is replayed.
- All state lives in typed arrays allocated in the constructor. A frame allocates only its event array.
- The `order` comes from a packed sort: order-preserving float32 bits times 2^k, plus the index, sorted as a `Float64Array`. This is exact for up to 2^21 cells. Larger grids fall back to a comparator sort, and a test checks both give the same result.
- At p = 0, `levelAtPercentile` returns the lowest cell's height, and at p = 100 the highest. With ties, the cells flooded at that level can be more than p %.

## Python reference (`pipeline/tda_ref.py`)

```python
from pipeline.tda_ref import compute_h0
res = compute_h0(grid_2d, connectivity=4)  # grid shape (H, W); cast to float32
res.finite      # list[Bar] in sweep order, including zero-length bars
res.essential   # list[Bar], death = math.inf, death_cell = -1
res.visible     # finite with death > birth, then essential
res.zero_length; res.births; res.order; res.pairs()
# Bar(birth, death, birth_cell, death_cell, merged_into), .persistence, .essential
```

CLI (prints columnar JSON `{b, d, bi, di}` with `d = null` for the essential bar):

```
pipeline/.venv/bin/python -m pipeline.tda_ref public/data/colorado/grid.f32 326 414 --min-persistence 1
```

The Python reference is written separately rather than translated from the TypeScript. It sorts with `numpy.lexsort((index, height))` and uses a union-find with union by size and path halving. Its roots are not birth cells: each root stores its component's eldest birth cell separately. On the 326×414 Colorado grid it takes about 0.2 s with 4-connectivity (Apple M3).

## Golden example, worked through

Grid 1×7: `h = [10, 1, 8, 3, 6, 5, 10]` (cells 0–6), 4-connectivity, so the neighbors are left and right.

≺ order: cell 1 (1), cell 3 (3), cell 5 (5), cell 4 (6), cell 2 (8), cell 0 (10), cell 6 (10). The two 10s are tied, and the lower index goes first.

| step | add cell (h) | earlier neighbors' roots | event |
|---|---|---|---|
| 1 | 1 (1) | none | lake 1 born at 1 |
| 2 | 3 (3) | none (cells 2, 4 not yet added) | lake 3 born at 3 |
| 3 | 5 (5) | none (cells 4, 6 not yet added) | lake 5 born at 5 |
| 4 | 4 (6) | 3, 5 | 3 is older (born at 3 < 5): lake 5 dies → bar **5→6, birthCell 5, deathCell 4** |
| 5 | 2 (8) | 1, 3 | 1 is older: lake 3 dies → bar **3→8, birthCell 3, deathCell 2** |
| 6 | 0 (10) | 1 | joins lake 1 |
| 7 | 6 (10) | 1 (via cell 5) | joins lake 1 |

Result: finite bars 5→6 (5, 4) and 3→8 (3, 2), plus the essential bar born at 1 in cell 1. Persistence is 1 and 5. `stats` = 3 births = 2 finite + 1 essential.

**Checkerboard** `[[0,1],[1,0]]` (cells 0 and 3 are the zeros):
- With 4-connectivity, the zeros don't touch. Cell 0 and cell 3 are each born at 0. Cell 1 (h = 1, ≺-first of the 1s) touches both lakes, so lake 3 (the younger) dies at 1. The result is one finite bar 0→1 (birthCell 3, deathCell 1) plus the essential bar.
- With 8-connectivity, the zeros touch diagonally, so cell 3 joins lake 0 on arrival. The result has no finite bar.

Both cases are also stored in `tests/fixtures/tda/golden.json` and checked by both test suites.

## GUDHI findings (GUDHI 3.13.0)

I tested this on the checkerboard rather than assuming it (`test_gudhi_construction_connectivity`):

| construction | checkerboard H0 finite bars | connectivity |
|---|---|---|
| `CubicalComplex(vertices=grid)`: grid values on vertices, edges and squares take the max of their vertices | `[(0, 1)]` | **4** |
| `CubicalComplex(top_dimensional_cells=grid)`: grid values on pixels (squares), lower faces take the min | none | **8**: pixels that share only a corner touch through that vertex |

So:
- The 4-connectivity mode is compared against `vertices=`. This is the comparison criterion 6 asks for.
- As an extra check, the 8-connectivity mode is compared against `top_dimensional_cells=`.
- Each comparison uses 100 tie-free random float32 grids of 1×1 to 40×40 cells. Finite bars with death > birth are compared as multisets, to within 1e-9.
- Essential births are also compared for 4-connectivity.
- Both comparisons pass.
- I added a third, brute-force comparison: a Kruskal-style edge filtration with explicit relabelling, at both connectivities. It doesn't depend on whether GUDHI is installed.

## Verification summary

- **Vitest** (`tests/unit/tda/`, 281 tests):
  - golden and checkerboard tests;
  - zero-length and constant-grid edge cases;
  - input validation;
  - packed sort compared with the comparator sort.
- **Properties** were checked on 602 random grids per connectivity (1×1 to 40×40, half with ties, including a 1×1 grid and a constant 40×40 grid):
  - births = cells with no ≺-earlier neighbor, and that set equals the set of bar birth cells;
  - finite bars (including zero-length) + essential bars = births;
  - for each death, an independent BFS of `{j ≺ deathCell}` confirms:
    - the death cell touches ≥ 2 distinct components;
    - the survivor is the ≺-oldest of them and every dying lake is younger;
    - the number of deaths at that cell is one less than the number of components;
  - `(birthCell, deathCell, mergedInto)` is unchanged under random strictly increasing value maps and under an affine map.
- **Flood** was checked on 120 grids per connectivity against a BFS at random levels: `isWet`, `componentOf` (equal to the ≺-minimum of each BFS component), and `alive`. Its merge events equal `computeH0`'s bars, and lowering the level replays correctly.
- **TS ↔ Python:** `tests/fixtures/tda/agreement.json` holds 250 seeded grids (seed 20261124). There are 200 with 4-connectivity and 50 with 8-connectivity. Their kinds are small-integer, quarter-step, plateau, random-walk, constant and 1×n / n×1 grids, with 980 zero-length bars in total.
  - Expected output comes from `tda_ref.py`.
  - Vitest and pytest both check against the same file: `(birthCell, deathCell, mergedInto)` in order, essential cells, births and zero-length counts.
  - To regenerate: `pipeline/.venv/bin/python tests/fixtures/tda/generate_fixtures.py`. It is deterministic.
- On the 326×414 Colorado `grid.f32` and on a 326×414 white-noise grid, TypeScript and Python gave identical full pair lists at both connectivities (a one-off check during F3). Colorado, 4-connectivity: 1,217 bars (1,009 with death > birth, 207 zero-length, and the essential bar). The essential bar is born at the `argmin` cell.

## Benchmark (`node scripts/bench-tda.mjs`)

Machine: Apple M3 (8 cores, 16 GB), macOS 27.2, Node v26.13.0 (darwin/arm64). Grid: 326×414 = 134,964 cells, 4-connectivity. Measured 2026-11-24.

- **computeH0:** one cold call, then 25 warm calls.
- **Flood frame:** `advanceTo(next level)` plus a recolor-equivalent pass. The pass calls `isWet` and `componentOf` for every cell and writes a packed RGBA `Uint32Array` via a per-lake colour table.
- **Frames:** 600 per sweep from the minimum to the maximum level. There are 5 measured sweeps (3,000 frames) after one warm-up sweep, with linear (metres) and percentile pacing.

| terrain | computeH0 cold | computeH0 warm median / p95 | Flood frame linear median / p95 / max | Flood frame percentile median / p95 / max |
|---|---|---|---|---|
| value noise (1,919 births) | 23.4 ms | 17.7 / 20.8 ms | 0.57 / 0.73 / 16.2 ms | 0.52 / 0.72 / 14.2 ms |
| white noise (27,030 births) | 23.7 ms | 23.4 / 31.7 ms | 0.81 / 1.09 / 14.1 ms | 0.81 / 1.05 / 13.8 ms |
| Colorado `grid.f32` (1,217 births) | 28.1 ms | 20.0 / 22.3 ms | 0.47 / 0.50 / 11.2 ms | 0.40 / 0.49 / 0.57 ms |

Targets: computeH0 ≤ 300 ms, met with about 10× headroom. Flood frame ≤ 6 ms, met at p95 with about 6× headroom.

A few isolated frames (0–4 of 3,000 per run) exceeded 6 ms. They don't recur at the same frame across sweeps and don't line up with GC (checked with `--trace-gc`), so they look like OS scheduling noise. These are Node numbers; the spec's target environment is Chromium on a mid-range laptop.
