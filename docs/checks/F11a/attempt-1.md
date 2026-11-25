# Check report — F11a Islands barcode engine (stretch S2, engine part) — attempt 1

Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit (559 in tests/unit/tda, 278 of them islands) ✅ · pytest (563) ✅ · build n/a · e2e n/a · axe n/a · lighthouse n/a · links n/a · visual n/a · content n/a · tda ✅ (own oracle: 177 grids × 2 connectivities, 9,002 level checks, 0 failures) · data n/a

Repo-wide gates were clean at check time (2026-11-24): `npm run check` gave 0 errors, 0 warnings and 0 hints over 135 files. `npm run lint` passed eslint and prettier. `npx tsc --noEmit -p .` was clean. `ruff check pipeline` passed, including `pipeline/basin_mask.py`. The F10 and F12a failures listed in the builder report are no longer present, so nothing had to be attributed to other features.

## Acceptance criteria

1. ✅ **API and docs. H0 is unchanged.**
   - `git status` shows that `h0.ts`, `flood.ts`, `order.ts` and every tracked file under `tests/unit` and `tests/fixtures` are unmodified.
   - The `index.ts` and `types.ts` diffs only add code. The only removed lines in `pipeline/tda_ref.py` and `test_tda_ref.py` are the old `__all__` and import lines, which were widened. In `bench-tda.mjs` the only removed line is the import, which was widened. In `docs/tda.md` the only removed lines are the title and intro, which now carry a pointer to the islands section.
   - The existing H0 Vitest and pytest suites pass unchanged.
   - The new docs/tda.md section "Islands (H1), stretch S2" covers:
     - the definition;
     - the tie rule (reverse ≺, mainland eldest, then the ≺-greatest peak);
     - connectivity (water 4 with land 8, or water 8 with land 4);
     - the half-open level convention `birth ≤ t < death`;
     - the API, edge cases and bar order.
   - `computeH1Islands` and `Islands` are typed.
   - My probe (`docs/checks/tools/f11a_probe.mjs`) confirmed that input validation throws `RangeError` for bad connectivity, a size mismatch, a NaN height and a NaN level. Reusing `order` from `computeH0` gives identical bars. Moving the level down resets correctly, and the 1×1 and ±∞ cases behave.
2. ✅ **Python matches TS.**
   - Vitest and pytest both pass on the 250-case `islands.json`.
   - I regenerated the fixture into the scratchpad with the builder's generator. Its sha1 `330ba9cc…` is byte-identical to the committed file.
   - On my own 354 grid/connectivity cases, `compute_islands` matches the TS engine on every bar (birth, death, peak, saddle, mergedInto, zero-length included) and on births: 0 mismatches (`docs/checks/tools/f11a_py_cmp.py`).
3. ✅ **Own brute-force oracle** (`docs/checks/tools/f11a_islands_oracle.mjs`). It shares no code with the engine.
   - **Grids:** 150 random grids from 1×1 to 10×10 in five kinds: ties 0–3, ints 0–9, tie-free floats, block plateaus, and low border. There are also 10 grids from 11×11 to 16×16 with ties, and 17 adversarial cases: 1×1, 1×7, 7×1, 2×6, all-equal 5×5 and 3×3, a diagonal peak chain, a diagonal plateau chain, a hill linked to the corner only diagonally, an apex on the border, a whole border that floods first with two central peaks, a central plateau, 4×4 and 5×5 checkerboards, a ring, signed zero with negatives, and the dual checkerboard. Each grid runs at water 4 and water 8.
   - **Per-level check:** at −∞, every distinct level, every midpoint, max+1 and 4 random non-monotone levels:
     - the BFS of land `{h>t}` with the complementary connectivity gives a set of non-border component peaks equal to the engine's set of live-bar peaks;
     - `Islands.alive()` equals the BFS count;
     - `islandOf(i)` equals the BFS island for every cell;
     - the event sum equals `alive()`.
   - **Elder rule:** a cell-step brute force (full BFS relabel after each cell in descending (h, i)) applies the elder rule with the mainland first, then the ≺-greatest peak. Its births, deaths, mergedInto values and zero-length counts match the engine as multisets.
   - **Result:** 0 failures over 9,002 level checks (777 display bars and 175 zero-length bars).
   - **Sensitivity:** mutating the oracle (same connectivity for land and water, the border flag ignored, `>` changed to `≥`) gives 7,515, 22,732 and 2,783 failures. So the oracle detects connectivity, mainland and level-convention errors.
   - **Fixtures through my own brute force:** `docs/checks/tools/f11a_fixture_oracle.mjs` runs the builder's 250 fixtures and 12 goldens through my brute force: 0 mismatches.
   - **GUDHI 3.13.0** (`docs/checks/tools/f11a_gudhi.py`): H1 intervals from `vertices=` (water 4) and `top_dimensional_cells=` (water 8) match the engine on 44 tie-free grids of at least 3×3: 0 mismatches.
4. ✅ **Goldens verified by hand.**
   - **Ring ridge (7×7):**
     - The border is at 9, so it stays mainland. The basin ring is at 1, except gap cell 9 (h=2), which is 4-adjacent to cell 2 on the border and to cell 16 of the inner block.
     - For 1 ≤ t < 2, cell 9 keeps the inner block on the mainland.
     - At t=2 the 4-connected water ring closes. No inner-block cell has a land 8-neighbour outside the block, so an island is born.
     - From t=3 only cell 24 (h=5) is left, and it dies at 5.
     - So the bar is [2,5), peak 24, saddle 9, mergedInto −1. This matches the golden.
   - **Two hills (9×5):**
     - The border is all 0. At t=0 the whole interior (all values > 0) is one 8-connected component. Its peak is 20 (h=9).
     - In the reverse sweep it first touches the mainland at the highest-index border cell 44, which is diagonal to cell 34. So the bar is [0,9) with saddle 44.
     - Cells 13 and 31 (h=1) flood at t=1, but cell 22 (h=4) still joins the two halves.
     - At t=4 column 4 is all water, and the right hill (peak 24, h=7) splits off with mergedInto 20. That gives the bar [4,7).
     - So the counts are 1 → 2 → 1 → 0 at 0, 4, 7 and 9. This matches the golden.
   - **Central cone:** I also checked it by hand. Its last link to the mainland is border cell 14 (h=1.5), which gives [1.5,3) for peak 12.
5. ✅ **Performance** (`node scripts/bench-tda.mjs`, Apple M3, Node v26.13.0, with other agents active).
   - Warm medians at 200×200 (40k cells), H1 vs H0:

     | terrain | H1 | H0 | ratio |
     |---|---|---|---|
     | value noise | 7.29 ms | 6.58 ms | 1.11× |
     | white noise | 9.40 ms | 8.58 ms | 1.10× |
     | Colorado | 7.58 ms | 6.88 ms | 1.10× |

   - At 326×414 the ratio is 1.07–1.11×.
   - The Islands frame p95 is 0.27–0.70 ms at 40k cells and 0.78–1.82 ms at 135k. The bench prints "PASS: all targets met".
   - `package.json` and `package-lock.json` are unchanged, so there are no new dependencies.
6. ✅ **Gates.**
   - `npx vitest run tests/unit/tda`: 5 files, 559 tests passed.
   - `pipeline/.venv/bin/python -m pytest pipeline -q`: 563 passed.
   - `ruff check pipeline` and `ruff check tests/fixtures/tda` are clean. `ruff format --check` passes on the 3 F11a Python files.
   - `npx eslint` and `npx prettier --check` are clean on src/lib/tda, tests/unit/tda and scripts/bench-tda.mjs.
   - `npm run check` and `npm run lint` are clean repo-wide.

**Central-cone note.** The builder says a central cone becomes an island once the whole border floods. This is consistent with the S2 definition as given. When every border cell is wet, the border cells form a closed 4-connected water ring, and that ring cuts the interior land off from the land connected to the grid border (the "mainland"). The behaviour is documented clearly in three places:
- the docs/tda.md Edge cases bullet "A central cone…";
- the definition bullet "The land beyond the grid edge is treated as mainland";
- the golden "central cone: island once the whole border has flooded", with a contrasting golden for an apex on the border.

The oracle's "border floods first" and "central plateau" adversarial cases agree.

## Blocking fixes
None.

## Notes (non-blocking)
1. **Explainer copy is needed before any islands UI.** The rule that the off-grid area counts as mainland is a modelling choice. On cropped DEMs it makes every interior massif an island once its border link floods, and Colorado gives 2,993 bars > 0 at 326×414. Any user-facing copy (F11b) needs approved §6.6-style H1 statements and probably a persistence threshold. The builder already flagged this.
2. **The JSON fixtures are not Prettier-formatted.** `prettier --check` warns on `islands_golden.json` and `islands.json`, and on F3's existing `agreement.json`. They are outside the `npm run lint` scope, so I'm treating this as cosmetic only.
3. **My bench absolute times are about 1.3× the builder's,** with the same H1/H0 ratios. The machine was shared with concurrent builders.
4. **`islandOf` shares the cost of a cache miss.** On a miss it walks the merge tree and memoises the path for the current level. I verified it against BFS for every cell at every checked level, including after lowering the level.

## Artifacts
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f11a_islands_oracle.mjs (brute-force oracle with the adversarial cases)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f11a_fixture_oracle.mjs (builder fixtures and goldens through my brute force)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f11a_py_cmp.py (Python vs TS on the oracle dump; run with `PYTHONPATH=<repo>`)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f11a_gudhi.py (GUDHI H1 cross-check)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f11a_probe.mjs (API edge cases)
- The oracle dump is at /private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/acaf7aa2-48fe-4f69-befb-0d96137cc7af/scratchpad/f11a_dump.json. It is a scratch file; regenerate it with `node docs/checks/tools/f11a_islands_oracle.mjs <path>`.
