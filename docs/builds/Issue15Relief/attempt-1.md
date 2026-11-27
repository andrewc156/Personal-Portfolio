# Build report for Issue #15 light-theme hero relief, attempt 1

The hero's light-theme terrain uses 25% less shadow strength and 22% less highlight strength, rounded to the nearest percent. Both adjustments are applied when the renderer prepares its land colors.

## Files changed

- `src/lib/viz/hero/render-map.ts`

## Verification

- `npx vitest run tests/unit/viz/model.test.ts tests/unit/viz/terrain.test.ts` passed all 22 tests.
- `npx eslint src/lib/viz/hero/render-map.ts` and `npx prettier --check src/lib/viz/hero/render-map.ts` passed.
- A Node comparison of the previous and current renderers across all palettes confirmed that light-theme shadow and highlight pixels move closer to flat ground. Flat-ground, dark-theme, and fully wet pixels matched exactly in the sampled cases.

## Acceptance criteria

- ✅ Light-theme relief is softer. The shadow coefficient changed from 1.4 to 1.05 and the highlight coefficient from 0.45 to 0.35.
- ✅ Dark-theme relief uses its original coefficients.
- ✅ The frame loop and water color tables retain their existing code.

## Known limitations

Visual inspection and frame timing are pending checker verification.
