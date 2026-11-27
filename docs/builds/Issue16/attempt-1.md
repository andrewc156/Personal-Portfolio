# Build report — Issue #16 Header icon alignment — attempt 1

The sun, crescent moon, and Settings gear now use a 24-unit viewBox, a 1.5-unit stroke, and centered 19-unit outline extents. The sun's larger core balances the gear, and the gear's centered outline removes its downward offset. The shell tests compare the visible icon's ink bounds with the gear's in both themes at 1280 × 800.

## Files changed

- `src/components/site/Header.astro` contains the centered gear artwork.
- `src/components/site/ThemeToggle.astro` contains the revised moon and sun artwork.
- `e2e/shell.spec.ts` compares the stroked width, height, offsets from button centers, and vertical row alignment within 1 CSS px.

## How to verify

- `npm run check` passed with zero diagnostics.
- `npm run lint` passed.
- `npm test` passed with 913 tests.
- For the checker, run `npm run build`, then `npm run e2e -- e2e/shell.spec.ts`. The shell checks named `theme and Settings icon ink aligns` cover this issue.

## Acceptance criteria

- ✅ Each icon uses the same viewBox and stroke width. The revised gear, moon, and sun have outline extrema at 2.5 and 21.5 on both axes.
- ✅ The regression check covers the visible crescent and sun with the required 1 CSS px tolerance. Browser execution is assigned to the checker.
- ✅ The existing button markup, focus and pressed states, and theme selection still use the same controls.

Needs Andrew and requests to Control for shared-file changes or dependencies are empty. The bounds check calculates stroke extents from SVG geometry and round caps and joins.
