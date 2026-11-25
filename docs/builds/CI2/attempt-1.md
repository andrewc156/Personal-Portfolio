# Build report — CI2 random-grid test timeouts — attempt 1

Summary: GitHub Actions CI #35 hit Vitest’s 5-second timeout in two existing 4-connectivity checks that repeatedly run a breadth-first search oracle. Both randomized checks now have a 20-second timeout for each connectivity variant. Their generators, sample counts, assertions, and failure diagnostics are unchanged. [GitHub Actions CI #35](https://github.com/andrewc156/Personal-Portfolio/actions/runs/45532297932)

Files changed:
- `tests/unit/tda/flood.test.ts` sets the timeout on the random-level flood check for 4- and 8-connectivity.
- `tests/unit/tda/properties.test.ts` sets the timeout on the elder-rule check for 4- and 8-connectivity.
- `docs/builds/CI2/attempt-1.md` records the change and focused validation.

How to verify:
- `node_modules/.bin/vitest run tests/unit/tda/flood.test.ts tests/unit/tda/properties.test.ts --reporter=verbose`
- `node_modules/.bin/eslint tests/unit/tda/flood.test.ts tests/unit/tda/properties.test.ts`
- `node_modules/.bin/prettier --check tests/unit/tda/flood.test.ts tests/unit/tda/properties.test.ts`
- `git diff --check -- tests/unit/tda/flood.test.ts tests/unit/tda/properties.test.ts docs/builds/CI2/attempt-1.md`

Acceptance criteria (self-check):
- ✅ Timeout is scoped to four test instances across the two generated cases. The 20-second timeout allows for slower runners while retaining a finite bound. No runner configuration changed.
- ✅ Both connectivity variants still exercise the same 120 seeded grids each in the flood check and the same 602 grids each in the property check. The independent breadth-first search oracles and every assertion are preserved. No engine or Python changes.
- ✅ All 14 tests across the two files passed in 4.12 seconds with Node 26.13.0 and Vitest 5.1.1 on an Apple M3 Mac using macOS arm64. The flood case took 1.690 s for 4-connectivity and 1.663 s for 8-connectivity. The elder-rule case took 1.925 s and 1.260 s, respectively.
- ✅ Scoped ESLint, Prettier and diff whitespace checks passed.

Needs Andrew: Nothing.

Requests to Control: Send CI2 to an independent checker and verify the hosted CI run after a checked commit.

Known limitations: The focused local run passed below the old timeout, so it did not reproduce the Linux runner’s slower execution. It did not run the full suite while the F14 audit was active.
