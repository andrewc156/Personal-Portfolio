# Build report — F11b Islands barcode — attempt 2

## Summary

The hero caption now shows Andrew's approved island explanation whenever the islands strip is visible. The Colorado River Basin link stays alongside it. Settings changes, reset, and animation-mode transitions keep the caption aligned with the active view.

## Files changed

- `src/components/hero/hero-client.ts` updates the caption from the selected view and the strip's visibility. It uses the same approved text as the settings and canvas description. Extra modes still use their own captions.
- `e2e/hero.spec.ts` adds a browser regression for the visible caption with settings closed, the Colorado link, hide and show, mode round trip, both original views, and reset.

## How to verify

- `npm run check`
- `npm run lint`
- `npx vitest run tests/unit/viz/model.test.ts tests/unit/viz/text.test.ts tests/unit/viz/markers.test.ts`
- Checker on port 4321: `npm run build`, then `npx playwright test e2e/hero.spec.ts -g 'islands barcode'`. Recheck the three viewport sizes, both themes, axe, and cold `/?mode=` layout stability.

## Acceptance criteria (self-check)

- ✅ **Visible and accurate caption.** With settings closed, the dev screenshots at 375 and 1280 px show the full approved explanation immediately below the islands strip. See `caption-375.png` and `caption-1280.png` in this directory.
- ✅ **View and mode synchronization.** The existing caption span and separate Colorado link are retained. The derived caption uses the lake text for the lake views and when the islands strip is hidden. Reset restores the lake view. Returning from an extra mode preserves the form selection and displays the corresponding Rising water caption. These transitions are covered by the browser regression for checker verification.
- ✅ **Accessibility and layout.** The settings help and canvas description from attempt 1 are retained. The retry uses the existing caption element and typography. It runs on settings and animation-mode changes, and the server-rendered default figure and strip dimensions are unchanged.
- ✅ **Builder gates.** Astro check found zero diagnostics across 143 files. Lint passed. All 27 focused unit tests passed.

## Needs Andrew

None. The explanation was approved in DECISIONS #81.

## Requests to Control

None.

## Known limitations

The mobile dev toolbar partially overlays the link in the screenshot at 375 px. The link remains in the figure DOM, and it is unobstructed in the 1280 px capture. Production browser, accessibility, visual, and direct-mode CLS verification remain for the checker.
