# Build report — F11a Islands barcode engine (stretch S2, engine part) — attempt 1

Summary: I added an islands (H1) engine next to the H0 engine without changing H0 behaviour or its API. It has three parts:
- `computeH1Islands(heights, W, H, { connectivity?, order? })`, which returns bars with `birth`, `death`, `peakCell`, `saddleCell` and `mergedInto`.
- An incremental `Islands` class: `reset`, `advanceTo` returning events, `alive`, and `islandOf(i)`.
- An independent Python `compute_islands`.

The method is the recommended duality mapping: a superlevel union-find over cells in descending (h, index) order, using land connectivity (8 when the water is 4) and a mainland node at +∞ joined to every border cell. I checked the mapping and found it correct for every case, including a central cone, which correctly becomes an island once the whole border floods. It is verified against brute-force BFS, the shared TS/Python fixtures, hand-built goldens, an Euler-characteristic link to the H0 `Flood`, and GUDHI H1.

Files changed:
- src/lib/tda/h1.ts (new): `computeH1Islands`, `islandPersistence`, `class Islands`
- src/lib/tda/types.ts: added `IslandsOptions`, `IslandBar`, `IslandsStats`, `IslandsResult`, `IslandEvent` (additive)
- src/lib/tda/index.ts: new exports (additive)
- pipeline/tda_ref.py: added `IslandBar`, `IslandsResult`, `compute_islands` (additive; H0 code untouched)
- pipeline/tests/test_tda_ref.py: islands tests (additive)
- tests/unit/tda/islands.test.ts (new)
- tests/fixtures/tda/islands_golden.json (new, hand-derived), tests/fixtures/tda/islands.json (new, 250 cases), tests/fixtures/tda/generate_islands_fixtures.py (new)
- scripts/bench-tda.mjs: islands section added; the H0 section is unchanged
- docs/tda.md: new "Islands (H1), stretch S2" section; H0 text unchanged apart from a one-line pointer in the intro
- docs/builds/F11a/attempt-1.md

How to verify:
- `npx vitest run tests/unit/tda` → 5 files, 559 tests pass. Of these, `islands.test.ts` has 278.
- `pipeline/.venv/bin/python -m pytest pipeline -q` → 563 passed.
- `pipeline/.venv/bin/ruff check pipeline --exclude pipeline/basin_mask.py && pipeline/.venv/bin/ruff check tests/fixtures/tda` → clean. See the notes for why I excluded `basin_mask.py`.
- `npx eslint src/lib/tda tests/unit/tda scripts/bench-tda.mjs && npx prettier --check src/lib/tda tests/unit/tda scripts/bench-tda.mjs` → clean.
- `node scripts/bench-tda.mjs` → PASS.
- `pipeline/.venv/bin/python tests/fixtures/tda/generate_islands_fixtures.py` regenerates `islands.json` byte-for-byte (seeded).

Acceptance criteria (self-check):
1. ✅ **TS API.** `computeH1Islands` plus the incremental `Islands` class:
   - `advanceTo` moves two pointers over the precomputed bars.
   - `islandOf` walks the merge tree, memoised per level in typed arrays.
   - Both are typed and follow the H0 style (`order` reuse, input validation, `zeroLength` kept separately, `stats`).
   - docs/tda.md documents the definition, the tie rule, the connectivity pairing, the level convention, why the mapping is correct, and the edge cases. The details:
     - Tie rule: the sweep runs in exact reverse ≺. Elder = mainland, then the ≺-greatest peak.
     - Connectivity: water 4 with land 8 (default), or water 8 with land 4.
     - Level convention: an island is alive for `birth ≤ t < death`, with birth = h[saddle] and death = h[peak]. This is the same half-open convention as H0.
2. ✅ **Independent Python reference.** It uses reversed `lexsort`, union by size with path halving, and a separate peak per root, with the mainland as node W·H.
   - `islands.json` holds 250 seeded grids with ties (200 water-4, 50 water-8; 4,128 bars, 606 zero-length).
   - Both suites require the identical ordered `(peakCell, saddleCell, mergedInto)` list, plus the births and zero-length counts.
3. ✅ **Brute-force oracle.** 80 seeded grids from 1×1 to 11×11 (ties, plateaus, tie-free, bumpy), each run at both water connectivities.
   - At every distinct level and at −∞, the set of live-bar peaks equals the set of ≺-maxima of the BFS land components that contain no border cell. So the counts are equal too.
   - Recomputing the BFS from scratch at every cell step of the reverse sweep gives the same multiset of `(peak, saddle, mergedInto)` and the same number of births, zero-length bars included.
   - Also checked: births = non-border cells with no ≻-later land neighbour; pairs are invariant under an increasing transform; islands = `Flood.alive()` − χ(water complex) at every level, for water 4.
   - pytest runs its own independent BFS oracle on 60 grids per connectivity.
   - A mutation check confirmed the oracle catches errors: wrong land connectivity → 207 failures; no mainland node → 271 failures. I restored the code afterwards.
4. ✅ **Goldens** (`islands_golden.json`, checked by both suites):
   - single cone with its apex on the border: no island;
   - central cone: [1.5, 3);
   - ring ridge around a basin with a central peak: [2, 5), peak 24, saddle 9;
   - two hills: [0, 9) for peak 20 via cell 44, and [4, 7) for peak 24 split from 20 at saddle 22. The count goes 1 → 2 → 1 → 0, and this is also checked through `Islands.alive/islandOf`;
   - hill touching the border: [3, 8), so it is not an island for t < 3;
   - a strip;
   - diagonal-only land contact and diagonal contact with the mainland, each at both connectivities;
   - the dual checkerboard.
5. ✅ **Performance.** Measured on an Apple M3 (8 cores, 16 GB), macOS 27.2, Node v26.13.0, 2026-11-24. Warm median times:

   | terrain | grid | computeH1Islands | computeH0 (same grid) |
   |---|---|---|---|
   | value noise | 200×200 | 5.5 ms | 4.9 ms |
   | white noise | 200×200 | 8.9 ms | 8.3 ms |
   | Colorado | 200×200 | 7.3 ms | 6.6 ms |
   | value noise | 326×414 | 21.9 ms | 18.5 ms |
   | white noise | 326×414 | 26.7 ms | 25.3 ms |
   | Colorado | 326×414 | 27.2 ms | 24.7 ms |

   - Cold runs take 6.2–27.4 ms.
   - The `Islands` frame (advanceTo plus `islandOf` for every cell) has a p95 of 0.16–0.36 ms at 40k cells and 0.56–1.77 ms at 135k.
   - Islands cost about 1.1–1.2× H0, against the H0 targets of 300 ms and 6 ms. No new dependencies.
6. ✅ for my paths; ❌ for the repo-wide commands, because of other agents' in-progress files:
   - All existing tda Vitest tests and the Python tests pass unchanged.
   - `npm run check` reports 5 errors, all in `src/lib/viz/hero/modes/{collatz,rivers}.ts` (viz-builder's F10, `Int32Array<ArrayBufferLike>` typing).
   - `npm run lint` flags Prettier issues in `src/lib/viz/hero/modes/{collatz,dye,pond}.ts` (F10).
   - `ruff check pipeline` reports 2 errors in the untracked `pipeline/basin_mask.py` (ISC004, RUF028), which looks like another agent's F12a/S3 work.
   - None of these are in F11a paths. eslint, prettier, tsc and ruff are clean on every file I own.

Needs Andrew: none for the engine. One wording point is for whoever writes the S2 explainer copy. A hill counts as an island as soon as all of its land is cut off from the grid edge, and that includes a single central cone once the edge floods, because the land beyond the grid edge is treated as mainland. Any copy needs a §6.6-style statement Andrew approves, since §6.6 currently covers only H0.

Requests to Control:
- No dependency or shared-file changes needed.
- Please have the checker treat the `npm run check` / `lint` / `ruff` failures listed above as belonging to F10 and the `basin_mask.py` owner, not to F11a.
- `public/data/colorado/meta.json` shows as modified in `git status`. I did not touch it.
- §6.6 has no H1 statements yet. Add approved ones before any UI shows islands copy.

Known limitations:
- Lowering the level in `Islands.advanceTo` resets and replays the pointers, as `Flood` does. That costs O(bars), not O(cells).
- `islandOf` is O(merge-tree depth) on a cache miss, and O(cells + islands) per frame for a full pass.
- Events cover display bars only. Zero-length bars produce no events.
- Bench numbers come from Node, not Chromium. Isolated max-frame outliers (up to 21 ms, value noise 326×414) look like the same scheduling noise noted for H0. The white-noise 200×200 p95 of about 28–36 ms showed up for both engines in the same run.
- `islandOf` resolves a frame without a recolor pass. A viz recolor would add roughly what the H0 `Flood` recolor costs.
- Real DEMs give many small islands; Colorado has 2,993 bars > 0 at 326×414. A display threshold on `islandPersistence` will likely be needed (an F11b/viz decision).
