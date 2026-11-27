# Check report — Issue #17 Safari select alignment — attempt 1

**Verdict: PASS**

## Gates

| Gate | Result |
|---|---|
| Astro check and lint | PASS. 171 files had zero errors, warnings, or hints. ESLint and Prettier passed. |
| Unit tests | PASS. 913 tests across 37 files. |
| Static build | PASS. Ten HTML pages built. The generated CSP recorded zero inline style attributes. |
| Browser tests | PASS. All 8 select-control tests passed across Chromium 159 and WebKit 27.2. All 30 targeted Chromium QA-13, explorer, Settings, and accessibility tests passed. |
| axe | PASS. Zero serious or critical violations across the targeted hero, open Settings, and explorer runs. |
| Mobile Lighthouse | PASS. Home scored 100/100/100/100, and Rising water scored 81/100/96/100 for performance/accessibility/best practices/SEO. CLS was 0 on both. |
| Internal links | PASS. Linkinator checked 30 internal URLs with zero failures. |
| Visual | PASS. Inspected all 14 WebKit captures of the hero toolbar, explorer toolbar, and Settings select row in light and dark themes. |

Python, TDA correctness, data provenance, and canvas frame time were outside the scope of this control-style change.

## Acceptance criteria

- At 1280 × 800 in both themes, the WebKit Animation select and Settings button measured exactly 44 px high, with the same top at 109 px and bottom at 153 px. The field had a 4 px radius. The custom chevron was visible in light and dark. Restoring native appearance and the former padding in a browser-only override recreated a 23 px field in both themes.
- The hero and header gear SVGs both measured 20 × 20 px in the two regression-test engines. Selecting Random rivers changed the running hero mode in WebKit. The select accepted focus and showed a focus outline. Chromium forced-colors mode restored the native arrow and still changed modes.
- Explorer Speed and Pacing measured 36 px each and shared top and bottom edges with Play at desktop and tablet widths. Selecting 2× and Linear (metres) worked. At 375 px the Pacing group wrapped intact.
- All four displayed Settings selects measured 36 px. Animation, Settings, and explorer selects computed to 16 px with coarse-pointer emulation and 14 px with a fine pointer.
- No control clipping or page overflow at 320, 360, 369, 375, 768, or 1280 px in either theme in the independent probe. At 369 px the longest Animation label measured 103.8 px in a 109 px text area. At 320 px the rearranged toolbar left 133 px of text area. Both still had fully reserved chevron space.

## Notes

- The first Lighthouse home run scored 80 with 850 ms total blocking time. The repeat against the same build scored 100, matching the 100 from the earlier Issue #16 baseline. Rising water met its 80 minimum.
- Mobile coverage used WebKit touch and viewport emulation. A physical iPhone was outside this check.

## Artifacts

Local logs, the independent WebKit and forced-colors probe, and all 14 images are in `docs/checks/Issue17/attempt-1/`. The browser regression command was `npx playwright test e2e/select-controls.spec.ts`. Adjacent coverage used `npx playwright test e2e/hero.spec.ts e2e/explorer.spec.ts e2e/shell.spec.ts --grep 'QA-13|axe|selects are at least|selects keep'`.
