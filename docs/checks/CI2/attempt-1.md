# Check report — CI2 random-grid test timeouts — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check ✅ (0 errors, warnings or hints) · lint ✅ · unit ✅ (799 passed across 26 files, plus 14 targeted with one worker) · pytest n/a · build n/a · e2e n/a · axe n/a · Lighthouse n/a · links n/a · visual n/a · content n/a · TDA ✅ (existing seeded BFS oracles) · data n/a

**Acceptance criteria**

- ✅ Diagnosed the hosted failure independently with `gh run view 45532297932 --repo andrewc156/Personal-Portfolio --log-failed`. Both failures were Vitest’s 5000 ms timeout in the 4-connectivity random-level flood and elder-rule tests. The remaining 797 tests passed. [GitHub CI #35](https://github.com/andrewc156/Personal-Portfolio/actions/runs/45532297932)
- ✅ Compared the isolated candidate at baseline `aa6b3da` with both main-worktree test files and the original test bodies. The two files match the originals after removing the scoped timeout options, two explanatory comments, and formatting. The grid seeds, counts (120 flood and 602 elder-rule grids per connectivity), oracle helpers, branches, assertions and diagnostics are preserved. Both 4- and 8-connectivity instances get a finite 20-second timeout. The default timeout, package scripts, workflow and production engine are unchanged.
- ✅ `npm run check`, `npm run lint` and `npm test` passed in the isolated snapshot. The complete unit suite took 4.70 s and passed all 799 tests.
- ✅ A second run of both affected files with `vitest run tests/unit/tda/flood.test.ts tests/unit/tda/properties.test.ts --maxWorkers 1 --reporter=verbose` passed all 14 tests in 7.52 s. The flood cases took 1.631 s and 1.513 s, and the elder-rule cases took 1.902 s and 1.483 s for 4- and 8-connectivity respectively.

**Notes (non-blocking)**

- Local timings use macOS and Node v26.13.0. The local runs did not reproduce the elapsed time on the hosted Linux runner. Verify the fresh hosted CI run after pushing the checked commit.
- This change is scoped to test execution. The upcoming full-site audit covers the unrelated runtime and hosting gates.

**Artifacts**

- `docs/checks/CI2/attempt-1/hosted.log` records the filtered hosted failure.
- `docs/checks/CI2/attempt-1/diff.log` records the baseline and configuration comparisons.
- `docs/checks/CI2/attempt-1/{check,lint,unit,focused}.log` record the local gates.
