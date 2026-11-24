# Check report — F3 Persistence engine — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit (281) ✅ · pytest (282) ✅ · ruff ✅ · build n/a · e2e n/a · axe n/a · lighthouse n/a · links n/a · visual n/a · content n/a · tda ✅ · data n/a · bench ✅
(This was an engine-only check, so build, preview, e2e and Lighthouse were not run, as instructed. I did not judge F2's uncommitted files. Machine: Apple M3, 8 cores, 16 GB, macOS 27.2, Node v26.13.0.)

## Static gates (§11 step 1)
- `npm run check`: 0 errors, 0 warnings, 2 hints. Both hints are in docs/checks/tools/*.mjs, not in F3 files.
- `npm run lint`: ESLint is clean and Prettier reports "All matched files use Prettier code style!"
- `npm test`: 4 files, 281/281 passed.
- `pipeline/.venv/bin/python -m pytest pipeline -q`: 282 passed, 0 skipped, so the GUDHI tests ran.
- `pipeline/.venv/bin/ruff check pipeline`: All checks passed.

## Acceptance criteria
1. ✅ **API and docs.**
   - `computeH0(heights, W, H, {connectivity})` returns `{bars, order, …}`.
   - `Flood` provides `reset`, `advanceTo`, `componentOf` (with path compression, flood.ts:132–142), `isWet`, `levelAtPercentile` and `alive`.
   - The sweep in flood.ts:144–190 matches §6.1: rank order (h, i), distinct neighbour roots sorted oldest-first, the cell joins the oldest root, and every other root dies at h[i].
   - Because the root of each tree is always its birth cell, the elder comparison by rank is exactly the comparison by (birthHeight, birthCell).
   - `docs/tda.md` documents the semantics, both APIs, and the golden and checkerboard examples worked step by step.
   - DECISIONS #31 accepts the API additions (`mergedInto`, `MergeEvent.type`).
   - I read the concept copy in docs/tda.md against §6.6 and found no contradictions: sublevel-set lakes, the elder rule, persistence as depth below the spill point, and one essential bar.
2. ✅ **Golden.** My own tool (`node docs/checks/tools/f3_bruteforce.mjs`) prints the golden bars `[[5,6,5,4],[3,8,3,2],[1,∞,1,-1]]`. My brute force and the Python reference give the same result.
3. ✅ **Checkerboard.**
   - With 4-connectivity: `[[0,1,3,1],[0,∞,0,-1]]`, which is one finite bar 0→1 plus the essential bar.
   - With 8-connectivity: `[[0,∞,0,-1]]`, so no finite bar.
4. ✅ **Properties.**
   - Builder suite: 600+2 grids per connectivity, 1×1 to 40×40, with and without ties. All pass.
   - My brute force independently confirms the same facts on 142 grids × 2 connectivities:
     - births equal the components with no earlier member, which is the same as no ≺-earlier neighbour;
     - finite + essential = births;
     - at every death, the survivor is the ≺-oldest of ≥ 2 distinct old components;
     - every death kills a younger lake.
   - My own invariance check (`node docs/checks/tools/f3_invariance.mjs`) applied 4 strictly increasing maps that are exact in float32 to 300 tie-heavy grids at both connectivities: 2,400 checks, 0 changes in (birthCell, deathCell) or the essential cells.
5. ✅ **TS ↔ Python.**
   - `tests/fixtures/tda/agreement.json` has 250 cases: 200 with 4-connectivity, of which 196 have ties, and 50 with 8-connectivity. Both suites pass on it.
   - The fixtures are deterministic. I regenerated them twice to the scratchpad (the generator was loaded with OUT redirected), and both copies had sha1 8760e7ec…, byte-identical to the committed file.
   - Colorado grid (`node docs/checks/tools/f3_colorado.mjs`): TS and Python agree exactly at both connectivities on the full ordered list of [birthCell, deathCell, mergedInto, birth, death], the essential cells, births, the zero-length count, and the whole `order` array.

     | connectivity | births | positive bars | zero-length | essential |
     |---|---|---|---|---|
     | 4 | 1217 | 1009 | 207 | 1, at cell 133025 |
     | 8 | 580 | 487 | 92 | 1, at cell 133025 |

     Cell 133025 is the meta.json minimum cell, at −2.885 m.
6. ✅ **GUDHI 3.13.0.** This is my own script (`docs/checks/tools/f3_gudhi.py` plus `f3_gudhi_cmp.mjs`), with a different seed from the builder's.
   - On the checkerboard, `CubicalComplex(vertices=)` gives the finite bar (0, 1) plus zero-length pairs, so it is 4-connected.
   - `top_dimensional_cells=` gives only zero-length pairs plus (0, ∞), so it is 8-connected.
   - On 100 tie-free float32 grids from 1×1 to 40×40 (8,116 positive finite bars), TS 4-connectivity against `vertices=` gave 0 multiset mismatches at 1e-9, and the essential births matched.
   - As an extra check, TS 8-connectivity against `top_dimensional_cells=` also gave 0 mismatches.
7. ✅ **Benchmark.** I ran `npm run bench:tda` 3 times. Each grid is 326×414, with 4-connectivity. A Flood frame is `advanceTo` plus a full `isWet`/`componentOf` recolor pass into a Uint32Array, measured over 3,000 frames.

   | terrain | computeH0 cold | computeH0 warm median / p95 | Flood frame median / p95 / max (linear and percentile pacing) |
   |---|---|---|---|
   | value noise | 20.6–22.2 ms | 16.2–17.2 / 17.0–18.7 ms | 0.50–0.55 / 0.62–0.64 / ≤ 2.03 ms |
   | white noise | 22.4–22.8 ms | 22.0–22.9 / 23.0–24.6 ms | 0.77–0.78 / 0.95–0.96 / ≤ 1.20 ms |
   | Colorado | 20.0–20.2 ms | 19.5 / 19.7–19.8 ms | 0.40–0.47 / 0.49–0.50 / ≤ 0.63 ms |

   - Targets: computeH0 ≤ 300 ms and Flood ≤ 6 ms per frame. Both are met with wide headroom.
   - No frame went over 6 ms in any of my 3 runs (0 of 18,000 per run). Every run printed "PASS: all targets met".

## TDA correctness (§11 step 7): my own brute force
- **Tool:** `docs/checks/tools/f3_bruteforce.mjs`. It is self-contained and imports only the public engine API, not the builder's helpers.
- **Grids:** 142, compared at both connectivities. They are integer, block-plateau, tie-free float, quarter-step, ±0 mixes, constant and 1×n / n×1 strips, from 1×1 to 30×30, plus the golden and checkerboard grids.
  - 112 of the grids have ties.
  - 572 zero-length bars occur in total.
- **Brute force A (rank steps):** after each cell is added in (h, i) order, the tool relabels every component from scratch with BFS. A component's id is its ≺-minimum cell, and old ids are grouped under the elder rule. A mutation that picks the survivor by index made the tool's own consistency assertion fire, so the tool catches elder-rule errors.
- **Brute force B (distinct height levels):** the tool runs BFS on {h ≤ t} at every distinct height and compares the positive bars (birth, death, birthCell) with brute force A. They agree.
- **Results against brute force A**, all at both connectivities:
  - TS `computeH0`: identical ordered finite bars including zero-length ones (birthCell, deathCell, mergedInto, birth, death), identical `order`, essential cells, `stats.births/finite/zeroLength/essential`, and zero-length counts.
  - `bars` never contains a zero-length bar, and they are all kept in `zeroLength`. So zero-length bars are dropped from display but counted.
  - `pipeline/tda_ref.py`: identical ordered finite bars, essential cells, births and zero-length counts.
- **Flood API:** I checked 5,112 levels, given in shuffled order so the level moves both forward and backward. They include −∞, +∞, exact heights and values between heights. Then I called `reset()`. At every level:
  - `isWet(i)` ⇔ h[i] ≤ t;
  - `componentOf(i)` equals the BFS component label, so the components partition exactly and each lake's id is its ≺-oldest cell; it returns −1 for dry cells;
  - after each `componentOf`, `parent[i] === root`, which confirms path compression;
  - `alive()` equals the number of BFS components, and `wetCount` equals |{h ≤ t}|;
  - the `advanceTo` events equal brute force A's birth and merge events for the newly added ranks. After a backward move they equal a full replay from rank 0.
  - In total I made 798,120 `componentOf` checks.
  - `levelAtPercentile(p)` for p ∈ {−5, 0, 12.5, 33, 50, 99.9, 100, 150} returns h[order[round(clamp(p)/100·(n−1))]], and flooding to that level wets at least that many cells.
  - Result: **ALL OK.**

## Code review notes
- `tda_ref.py` is genuinely independent of the TypeScript:
  - it sorts with numpy `lexsort`;
  - it uses union-by-size with path halving, so its roots are not birth cells, and a separate `eldest[]` array stores each component's birth cell;
  - it collects neighbours in a dict;
  - it imports nothing from the TS side.
- Hot path: `addNext` and `find` allocate nothing. They use preallocated Int32Array roots, parent, dx and dy, and the destructuring `const { … } = this` creates no object.

## Blocking fixes
None.

## Notes (non-blocking)
1. `src/lib/tda/flood.ts:82–91`: `advanceTo` allocates a new `sink` closure on every call, as well as the events array and one object per event.
   - This is still within "small event arrays" in spirit, and the bench shows no GC-driven spikes.
   - But `docs/tda.md` ("A frame allocates only its event array") is slightly inaccurate.
   - Optional fix: hoist the sink to a field, or correct the sentence.
2. After a backward `advanceTo` (flood.ts:83–86), the returned events are a full replay from the bottom (every birth and merge up to the new level), not a delta.
   - docs/tda.md says "resets and replays" but doesn't say what the returned events contain.
   - F5/F6 consumers should know this. I suggest one sentence in docs/tda.md.
3. The benchmark runs in Node, not in Chromium on a mid-range laptop as §6.2 specifies. The headroom is about 6–10× at p95, but browser frame timing should be confirmed in the F5/F6 checks (§11 step 9).
4. `levelAtPercentile` takes p in [0, 100] and clamps values outside it. With ties, flooding to that level can wet more than p % of the cells. Both behaviours are documented.

## Artifacts
- docs/checks/tools/f3_bruteforce.mjs (brute force A and B, TS and Python comparison, Flood API checks)
- docs/checks/tools/f3_colorado.mjs (TS vs Python on the Colorado grid.f32, both connectivities)
- docs/checks/tools/f3_gudhi.py and docs/checks/tools/f3_gudhi_cmp.mjs (independent GUDHI agreement and checkerboard construction test)
- docs/checks/tools/f3_invariance.mjs (strictly increasing transform invariance)
- docs/checks/F3/attempt-1.md (this report)
