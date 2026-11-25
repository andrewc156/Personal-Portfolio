# Build report — F11b Islands barcode — attempt 1

## Summary

The Rising water settings now offer **Islands barcode** alongside **Barcode** and **Persistence diagram**. The new view uses the same strip, water-level axis, filters and pointer and keyboard controls. It computes the accepted H1 engine's intervals on first use for each terrain, and the approved explanation appears in the settings and describes the strip canvas for assistive technology.

## Files changed

- `src/components/hero/HeroSettings.astro` and `hero-client.ts` add the option and connect the approved explanation to the controller.
- `src/lib/viz/hero/islands.ts` selects the longest positive engine intervals at or above the persistence threshold, up to the existing **Max bars** setting. Equal lengths are ordered by birth level and cutoff cell. Selected rows are drawn in birth order.
- `src/lib/viz/hero/controller.ts` selects the strip data, reuses the map markers for the selected peak and cutoff cell, and updates the readout and pause or scrub summary.
- `src/lib/viz/hero/barcode.ts` and `model.ts` share the interval geometry between the lake and islands views.
- `src/lib/viz/hero/text.ts` supplies the approved explanation, island readout and live summary.
- `tests/unit/viz/model.test.ts` checks the engine intervals against canvas coordinates for five seeds at mid and maximum water levels and exercises filtering and tie order.
- `e2e/hero.spec.ts` covers showing, filtering, and inspecting the islands view, then switching back to both lake views.

## How to verify

- `npm run check` and `npm run lint`
- `npx vitest run tests/unit/viz/model.test.ts tests/unit/viz/text.test.ts tests/unit/viz/markers.test.ts`
- Checker on port 4321: `npm run build`, then `npx playwright test e2e/hero.spec.ts -g 'islands barcode'` and the usual hero and site regressions. Check cold `/?mode=` CLS, frame timing with Islands selected, axe in both themes, and the three viewport sizes from §11.
- For an interactive check, load `/?seed=42`, open Art settings → Barcode → View → Islands barcode and adjust the level. Focus the hero, press End to finish the rise, and press Down Arrow to select the first row. Escape clears the selection.

## Acceptance criteria (self-check)

- ✅ **Engine agreement and filtering.** The new strip draws the direct H1 bar intervals using the same live clipping as the lake barcode. Unit tests verified drawn endpoints for five seeds at two levels, exclusion of zero-length bars, thresholding, the cap and deterministic tie order.
- ✅ **Controls and text.** The settings and canvas description use Andrew's approved DECISIONS #81 copy. I opened the installed dev-server page with reduced motion at 375 and 1280 px, chose Islands, and inspected a finished row by keyboard. The two captures show the highlighted strip bar, the corresponding peak and cutoff markers, and the readout with the actual interval.
- ✅ **Layout and defaults.** The island view reuses the existing canvas and dimensions. The server still renders the unchanged lake view with the new settings explanation hidden. The hero and mode selection code retain the existing no-JS fallback and reduced motion behavior.
- ✅ **Scheduling.** H1 computation is scoped to first use for each terrain and shares the precomputed H0 cell order. The no-highlight draw loop uses the already selected interval rows, and live summaries use the existing refresh triggers. The strip shares the existing off-screen, visibility and DPR handling.
- ✅ **Builder gates.** Astro check found zero diagnostics across 139 files. Lint passed. All 27 focused unit tests passed. Dev screenshot evidence is in `docs/builds/F11b/hero-{375,1280}.png`.

## Needs Andrew

None. The explainer copy was approved in DECISIONS #81.

## Requests to Control

None.

## Known limitations

The map's shoreline and fill show lake flooding. Island selection outlines the corresponding bar and marks its two cells. The numerical island count includes all live engine intervals, including those outside the display threshold or row limit. Independent production browser, CLS, accessibility, visual and performance gates remain for the checker.
