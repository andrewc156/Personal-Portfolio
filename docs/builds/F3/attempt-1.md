# Build report — F3 Persistence engine — attempt 1

Summary: F3 is built and every criterion passes on my self-check. The TypeScript H0 engine in `src/lib/tda/` provides the §6.2 API: `computeH0`, plus a `Flood` class with `reset`, `advanceTo`, `componentOf`, `isWet`, `levelAtPercentile` and `alive`. It follows the §6.1 rules: ties broken by (height, index), 4-connectivity by default with 8 as an option, and the elder rule. Zero-length bars are kept out of `bars` but counted in `stats.zeroLength`. An independent Python reference, `pipeline/tda_ref.py`, has a function API and a CLI. Both suites read the same 250 seeded fixtures and agree exactly on (birthCell, deathCell, mergedInto). GUDHI's `vertices=` cubical construction matches 4-connectivity, confirmed with the checkerboard test, and agrees with the 4-connected mode on 100 tie-free grids. Measured on an Apple M3 at 326×414 cells: `computeH0` takes about 20 ms and a Flood frame plus recolor about 0.5 ms.

Files changed:
- src/lib/tda/index.ts, types.ts, order.ts, flood.ts, h0.ts (new)
- tests/unit/tda/helpers.ts, golden.test.ts, properties.test.ts, flood.test.ts, agreement.test.ts (new)
- tests/fixtures/tda/golden.json, agreement.json (274 KB, 250 cases), generate_fixtures.py (new)
- pipeline/tda_ref.py, pipeline/tests/test_tda_ref.py (new)
- scripts/bench-tda.mjs (new)
- docs/tda.md (new)
- docs/builds/F3/attempt-1.md (this report)

How to verify:
- `npm run check` → 0 errors, 0 warnings. Its 2 hints are in docs/checks/tools/*.mjs, not in F3 files.
- `npm run lint` → clean (ESLint + Prettier).
- `npm test` → 4 files, 281 tests passed.
- `pipeline/.venv/bin/python -m pytest pipeline/tests/test_tda_ref.py -q` → 265 passed.
- `pipeline/.venv/bin/ruff check pipeline/tda_ref.py pipeline/tests/test_tda_ref.py` → All checks passed. `ruff format` was also applied.
- `node scripts/bench-tda.mjs` → prints "PASS: all targets met". It exits 1 if a target is missed.
- Optional: `pipeline/.venv/bin/python tests/fixtures/tda/generate_fixtures.py` regenerates `agreement.json` byte-for-byte (sha1 8760e7ec…, checked twice).

Acceptance criteria (self-check):
1. ✅ API per §6.2 and semantics per §6.1, documented in docs/tda.md.
   - The doc covers the semantics, the TS and Python APIs, the shared ordering conventions, the golden example worked step by step, the checkerboard, the GUDHI findings and the benchmark.
   - Two additions to the spec: `Bar.mergedInto` (the absorbing lake's birth cell, for the F6 info card) and `MergeEvent.type` (`'birth' | 'merge'`).
2. ✅ Golden test: `[10,1,8,3,6,5,10]` gives 5→6 (cells 5, 4), 3→8 (cells 3, 2), and the essential bar born at 1 in cell 1.
   - Checked in `golden.test.ts`, `test_golden_explicit`, and `golden.json`, which both suites read.
3. ✅ Checkerboard `[[0,1],[1,0]]`: with 4-connectivity, one finite bar 0→1 (birthCell 3, deathCell 1) plus the essential bar; with 8-connectivity, no finite bar. Checked in both suites.
4. ✅ Property tests on 602 random grids per connectivity (1×1 to 40×40, half with ties, including a 1×1 grid and a constant 40×40 grid), all passing:
   - births = cells with no ≺-earlier neighbor, and that set equals the set of bar birth cells;
   - finite bars (including zero-length) + essential bars = births;
   - an independent BFS of `{j ≺ deathCell}` at every death cell confirms ≥ 2 distinct neighbor components, that the survivor is the ≺-oldest, and that every dying lake is younger;
   - pairs are unchanged under random strictly increasing maps and under 3x + 11.
   - A mutation check (ordering roots by index instead of rank) fails 223 of 281 tests, so the suite catches elder-rule errors.
5. ✅ TS ↔ Python agreement on `tests/fixtures/tda/agreement.json`: 200 grids with 4-connectivity (≥ 190 with ties) and 50 with 8-connectivity, with 980 zero-length bars in total.
   - `agreement.test.ts` and `test_fixture_agreement` both compare the exact ordered (birthCell, deathCell, mergedInto) list, the essential cells, the births and the zero-length count.
   - One-off extra check: on the full 326×414 Colorado `grid.f32` and on a 326×414 white-noise grid, TS and Python gave identical full pair lists at both connectivities.
6. ✅ GUDHI 3.13.0 agreement:
   - The checkerboard test showed that `CubicalComplex(vertices=…)` is 4-connected (finite bar (0, 1)) and `top_dimensional_cells=` is 8-connected (no finite bar). The test asserts this.
   - On 100 tie-free grids, 4-connected `compute_h0` matches `vertices=` as multisets to within 1e-9, essential births included.
   - As an extra check, on 100 more tie-free grids the 8-connected mode matches `top_dimensional_cells=`.
   - A Kruskal-style brute-force comparison also passes on 100 grids at each connectivity, so the check does not depend on GUDHI.
7. ✅ Benchmark at 326×414, measured on an Apple M3 (8 cores, 16 GB), macOS 27.2, Node v26.13.0:
   - **computeH0:** cold call 23.4 / 23.7 / 28.1 ms. Warm median / p95: value noise 17.7 / 20.8 ms, white noise 23.4 / 31.7 ms, Colorado grid 20.0 / 22.3 ms. Target ≤ 300 ms.
   - **Flood frame** (`advanceTo` over 1/600 of the range plus an `isWet`/`componentOf` recolor pass over all 134,964 cells into a `Uint32Array`, 3,000 measured frames): median 0.40–0.81 ms, p95 0.49–1.09 ms. Target ≤ 6 ms.
   - 0–4 isolated frames per 3,000 went over 6 ms, with a maximum of 16.2 ms. They don't line up with GC (checked with `--trace-gc`) and don't repeat at the same frame, so they look like OS scheduling noise. They are reported as measured, not filtered out.
   - Python `compute_h0` on the Colorado grid takes 0.20 s (4-connectivity) and 0.28 s (8-connectivity).

Needs Andrew: none.

Requests to Control:
- None required. The code works whether or not `pipeline/__init__.py` and `pipeline/tests/__init__.py` exist, because the tests import `from pipeline.tda_ref import …` with the repo root as cwd.
- Optional: add `npm run bench:tda` = `node scripts/bench-tda.mjs` to package.json.
- For F4b (data-engineer): call `compute_h0(grid_2d_float32)` and use `res.visible` with persistence ≥ 1 plus `res.essential`, or the CLI: `python -m pipeline.tda_ref public/data/colorado/grid.f32 326 414 --min-persistence 1`. It prints columnar `{b, d, bi, di}` with `d = null` for the essential bar.

Known limitations:
- Finite heights are required: NaN and ±Infinity are rejected in both engines, because `death = +∞` marks essential bars. The pipeline already maps ocean nodata to 0 m.
- The benchmark runs in Node, not in Chromium on a mid-range laptop as §6.2 specifies. The checker or viz-builder should confirm in the browser during F5/F6. The headroom is about 6× at p95.
- The packed-key sort is exact up to 2^21 cells. Larger grids use a slower comparator sort, which a test checks against the packed sort.
- `advanceTo` to a lower level replays the sweep from the bottom. That costs O(cells added) and is fine for scrubbing. `levelAtPercentile(p)` takes p in [0, 100], and with ties it can flood more than p % of the cells.
- The Colorado `grid.f32` used in the benchmark and in the one-off agreement check is the data-engineer's in-progress F4a output. The bench picks it up only if `meta.json` says 326×414.
