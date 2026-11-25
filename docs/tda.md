# Persistence engine (F3, islands: F11a)

The engine computes 0-dimensional persistent homology (H0) of the sublevel-set filtration of a height grid. In plain terms: water rises over a landscape, lakes are born and merge, and the barcode records each lake's lifetime. It also computes the islands barcode (H1 of the flooded region, stretch S2); see [Islands (H1)](#islands-h1-stretch-s2).

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

## Islands (H1), stretch S2

**Definition.** As the water rises, an island is born when the water closes a ring around a hill, which cuts that land off from the land connected to the grid border. It dies when its hilltop goes under.

Precisely, at water level `t`:
- **Water** is `{x : h(x) ≤ t}`, with the H0 connectivity: 4 by default, 8 if `{ connectivity: 8 }`.
- **Land** is `{x : h(x) > t}`, with the *complementary* connectivity: 8 when the water is 4, 4 when the water is 8. In the default mode, two land cells that touch only at a corner stay joined, because 4-connected water cannot pass between them. This pairing (4/8 or 8/4) is the one for which every land component enclosed by water is a hole in the water and vice versa.
- **Mainland** is any land component that contains a border cell (row 0, row H−1, column 0 or column W−1). The land beyond the grid edge is treated as mainland.
- **An island** is a land component with no border cell. The number of islands at `t` equals the number of holes (β1) of the flooded region. A test checks this through the Euler characteristic: islands = lakes − χ(water).

**Level convention.** An island bar `[birth, death)` is alive at `t` iff `birth ≤ t < death`. This is the same half-open convention as the H0 lakes, where a cell is wet iff `h ≤ t`. So at `t = birth`, the saddle cell is already wet and the island exists. At `t = death`, the hilltop is wet and the island is gone.

**Method (Alexander duality).** The engine runs H0 of the *superlevel* filtration relative to the border:
- Cells are added in the exact reverse of ≺, by descending `(h[i], i)`. With tied heights, the higher index goes first.
- A virtual **mainland node** at +∞ is joined to every border cell, so it is always the eldest component.
- When cell `i` is added, the engine collects the distinct roots of its already-added land neighbours, plus the mainland if `i` is on the border.
  - **No roots:** a hill component is born with peak `i`. This only happens for a non-border cell with no ≻-later land neighbour.
  - **One or more roots:** `i` joins the eldest. The mainland is eldest of all. Otherwise the eldest is the root whose peak is ≺-greatest: the higher peak, or the higher index on a tie. Every other root dies at `i` (the elder rule).
- A hill with peak `p` that dies at cell `s` gives the island bar `(birth = h[s], death = h[p], peakCell = p, saddleCell = s)`. `mergedInto` is the peak it joined, or −1 for the mainland.
- In water-rising terms, there are two kinds of birth:
  - `mergedInto = −1`: the island is cut off from the mainland when the water reaches `s`;
  - `mergedInto = q`: when the water reaches `s`, the island splits from a taller island `q`. Island `q` continues and keeps its identity, the elder rule run in reverse.
- Every island dies at its own hilltop, so `death = h[peakCell]` always.
- The grid is connected and every component eventually reaches the border, so every hill component dies. **There is no essential island bar.** `stats.finite == stats.births`.
- **Zero-length bars** (`death == birth`) happen on plateaus, when a tied cell starts a component that is absorbed at the same height. As with H0, they are left out of `bars`, kept in `zeroLength`, and counted in `stats.zeroLength`. They are never alive at any level.

**Why this mapping is correct.** At level `t`, the reverse sweep has added exactly the cells with `h > t` (all of them come before any cell with `h ≤ t` in descending order, ties included). So its components, minus the mainland, are exactly the islands at `t`. A component is alive in that state iff its peak has been added (`h[p] > t`) and its death cell has not (`h[s] ≤ t`). That is `birth ≤ t < death`. The tests check this against brute force at every distinct level and at every single cell step.

**Edge cases.**
- **A hill whose peak is on the border** is never an island: the peak keeps it on the mainland until the peak floods.
- **A hill that touches the border at lower cells** is not an island while any of its land still includes a border cell. It is born when the last such link floods (golden "hill touching the border").
- **A central cone** is an island once every border cell is wet: born at the height of the highest border link, dead at the apex. A cone only produces no island when its apex sits on the border (golden "cone with apex on the border").
- **Grids with no interior cells** (W ≤ 2 or H ≤ 2, including 1×1 and strips) have no islands, and neither do constant grids.
- **Diagonal contact:** with water 4, a corner-only contact joins two pieces of land, or joins land to a border cell. With water 8, it does not (goldens "diagonal-only land contact" and "diagonal contact with the mainland"). On the dual checkerboard `[[2,0,2],[0,3,0],[2,0,2]]`, water 4 gives one island `[2, 3)`, because the centre touches the corner 2s diagonally. Water 8 gives `[0, 3)`.

**Order of bars (both implementations).** Reverse-sweep order: by descending ≺-rank of the saddle cell. When several islands are cut off at one cell, the eldest (≺-greatest peak) comes first. `bars` and `zeroLength` each keep that order. Python's `IslandsResult.bars` holds both kinds interleaved in that order.

### API

```ts
import { computeH1Islands, Islands } from '../lib/tda/index.ts';

computeH1Islands(heights, W, H, opts?: { connectivity?: 4 | 8 /* water */, order?: Uint32Array }): IslandsResult

interface IslandBar { birth; death; peakCell; saddleCell; mergedInto }  // alive for birth ≤ t < death
interface IslandsResult {
  bars: IslandBar[];       // death > birth, reverse-sweep order
  zeroLength: IslandBar[]; // death == birth (debug only)
  order; rank;             // as in H0 (pass computeH0().order via opts.order to skip the sort)
  joined: Int32Array;      // merge tree: component (peak, or W·H = mainland) each cell joined
  saddleOf: Int32Array;    // for a peak: the cell where it died (−1 for non-peaks)
  intoOf: Int32Array;      // for a peak: the peak it joined (−1 = mainland / non-peak)
  stats: { cells, connectivity, landConnectivity, births, finite, zeroLength };
}
islandPersistence(bar)     // death − birth: how far the hilltop rises above the cut-off level

const isl = new Islands(heights, W, H, opts?);  // computes the barcode once
isl.reset();               // level −∞: all land, all mainland, no islands
isl.advanceTo(level);      // → IslandEvent[] { type: 'birth' | 'death', level, peak, cell }, sorted by level
isl.alive();               // islands at the current level
isl.islandOf(i);           // island id (peak cell) of cell i now; −1 if wet or mainland
isl.level; isl.result;
```

- `advanceTo` only moves two pointers through the bars sorted by birth and by death. Lowering the level resets and replays.
- `islandOf` walks the precomputed merge tree (`joined` → `intoOf` while the saddle is still land) and memoises per level in typed arrays. A full per-cell pass is therefore O(cells + islands) per frame, with no allocation beyond the event array.
- Events cover display bars only.

Python: `compute_islands(grid_2d, connectivity=4)` returns `IslandsResult` with `.bars` (every bar, reverse-sweep order), `.visible`, `.zero_length`, `.births` and `.alive_at(t)`. `IslandBar(birth, death, peak_cell, saddle_cell, merged_into)`. It is written independently: `lexsort` reversed, union by size with path halving, and roots storing the component's peak separately. The mainland is node `W·H`.

### Islands verification

- **Goldens** (`tests/fixtures/tda/islands_golden.json`, checked by Vitest and pytest):
  - cone with its apex on the border (no island);
  - central cone (`[1.5, 3)`);
  - ring ridge around a basin with a central peak (`[2, 5)`, peak 24, saddle 9, the gap in the basin floor);
  - two hills under a saddle (`[0, 9)` for peak 20 via border cell 44, and `[4, 7)` for peak 24 split from 20 at saddle 22, so 1 → 2 → 1 → 0 islands);
  - hill touching the border (`[3, 8)`);
  - a strip;
  - diagonal-only contact and diagonal contact with the mainland, at both connectivities;
  - the dual checkerboard.
- **Brute-force oracle** (Vitest): 80 seeded grids of 1×1 to 11×11 cells, with ties, plateaus, tie-free and bumpy grids, for both water connectivities.
  - At every distinct level (and −∞), the set of live bars' peaks equals the set of ≺-maxima of the BFS land components with no border cell.
  - Rebuilding the components by BFS from scratch at every cell step of the reverse sweep gives the same multiset of `(peakCell, saddleCell, mergedInto)`, zero-length bars included, and the same number of births.
  - Also checked: births = non-border cells with no ≻-later land neighbour; pairs are invariant under a strictly increasing transform; islands = `Flood.alive()` − χ(water complex) at every level.
- **`Islands` class:** `islandOf` for every cell and `alive()` are checked against BFS at all distinct and random levels on 60 grids × 2 connectivities, including lowering the level. Events sum to `alive()`.
- **TS ↔ Python:** `tests/fixtures/tda/islands.json` holds 250 seeded grids (seed 20261125): 200 with water 4 and 50 with water 8. Their kinds are int, plateau, walk, bumps, quarter-step, constant, thin strips and 2×2 / 3×3 grids. In total there are 4,128 bars, of which 606 are zero-length. Both suites require the full `(peakCell, saddleCell, mergedInto)` list in order, plus births and zero-length counts. To regenerate: `pipeline/.venv/bin/python tests/fixtures/tda/generate_islands_fixtures.py`.
- **GUDHI 3.13.0 H1:** the construction's connectivity was confirmed on the dual checkerboard first. `CubicalComplex(vertices=)` gives `[(2, 3)]`, which matches water 4. `top_dimensional_cells=` gives `[(0, 3)]`, which matches water 8. Then 100 tie-free random grids per connectivity agree with GUDHI's dimension-1 intervals as multisets, to within 1e-9.

### Islands benchmark (`node scripts/bench-tda.mjs`)

Machine: Apple M3 (8 cores, 16 GB), macOS 27.2, Node v26.13.0 (darwin/arm64). Measured 2026-11-24.
- 25 warm runs of each function.
- Islands frame = `advanceTo(next level)` plus `islandOf(i)` for every cell. There are 600 frames per sweep and 5 measured sweeps after a warm-up, with linear pacing.
- The 200×200 grids are the north-west crop of the same terrains.

| terrain, grid | computeH1Islands cold | warm median / p95 | computeH0 same grid, median / p95 | Islands frame median / p95 / max |
|---|---|---|---|---|
| value noise, 326×414 | 27.4 ms | 21.9 / 26.0 ms | 18.5 / 19.1 ms | 0.41 / 0.56 / 21.1 ms |
| value noise, 200×200 | 6.2 ms | 5.5 / 6.7 ms | 4.9 / 5.2 ms | 0.12 / 0.16 / 0.62 ms |
| white noise, 326×414 | 26.2 ms | 26.7 / 27.6 ms | 25.3 / 25.8 ms | 1.30 / 1.77 / 11.8 ms |
| white noise, 200×200 | 9.1 ms | 8.9 / 27.9 ms | 8.3 / 36.1 ms | 0.26 / 0.36 / 1.15 ms |
| Colorado `grid.f32`, 326×414 | 27.4 ms | 27.2 / 30.1 ms | 24.7 / 34.6 ms | 0.48 / 0.64 / 1.20 ms |
| Colorado `grid.f32`, 200×200 | 7.8 ms | 7.3 / 7.7 ms | 6.6 / 7.1 ms | 0.10 / 0.17 / 0.28 ms |

`computeH1Islands` costs about 1.1–1.2× `computeH0` on the same grid. The bench applies the H0 targets to it, ≤ 300 ms per call and ≤ 6 ms per frame at p95, and all are met. The isolated max outliers look like the same scheduling noise noted for H0. The white-noise 200×200 p95 of about 28–36 ms appears for both engines in the same run, so it is machine noise rather than anything specific to islands.
