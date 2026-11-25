# Build report — F23 Collatz default depth — attempt 1

**Summary:** Restored Collatz’s default and Settings reset depth to 30. Startup still draws exactly step 1, the slider remains 1–120, and the readout is exact through depth 50 and sampled from 51.

**Files changed:**
- `src/lib/viz/hero/modes/meta.ts` — shared default set to 30.
- `tests/unit/viz/modes/collatz.test.ts` — updated default assertion; kept explicit depth-50 math and checked depth 51.
- `e2e/hero.spec.ts` — updated startup, same-depth preview, and Settings reset expectations.

**How to verify:**
```sh
npm test -- tests/unit/viz
./node_modules/.bin/eslint src/lib/viz/hero/modes/meta.ts tests/unit/viz/modes/collatz.test.ts e2e/hero.spec.ts
./node_modules/.bin/prettier --check src/lib/viz/hero/modes/meta.ts tests/unit/viz/modes/collatz.test.ts e2e/hero.spec.ts
git diff --check -- src/lib/viz/hero/modes/meta.ts tests/unit/viz/modes/collatz.test.ts e2e/hero.spec.ts
```

**Acceptance criteria (self-check):**
- ✅ Default depth 30: RED reproduced depth 49 instead of 29 one tick before completion; GREEN passed all 253 visualization unit tests, including the depth-30 readout of 3,518 numbers.
- ✅ Settings range and step-one startup: slider min/max and initialization code unchanged; unit coverage passed for depths 1 and 120 and for first-layer startup. Browser expectations were updated but not executed.
- ✅ Exact/sampled boundary: depth 50 still reports 379,600 exact numbers; depth 51 reports sampled branches.
- ✅ Scoped ESLint, Prettier, and diff whitespace checks passed.

**Needs Andrew / Requests to Control:** None.

**Known limitations:** E2E, production build, and preview were not run per scope. No commit or push.
