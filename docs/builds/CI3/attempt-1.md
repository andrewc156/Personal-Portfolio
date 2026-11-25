# Build report — CI3 Explorer place labels robust to font metrics — attempt 1

Summary: Hosted CI dropped the priority-1 label "Las Vegas" at 375px because the placards used `600 11px system-ui`. On Ubuntu that resolves to DejaVu Sans Bold, which is about 14% wider. Before this change the label was also dropped on macOS at 320px, with every font. The placards now render and measure in the site's self-hosted Plex stack (`600 11px var(--font-sans)`), and are laid out again once the webfont is ready or any font finishes loading. Placement now guarantees priority 1 robustly. If the greedy pass leaves out a priority-1 label, priority 1 is laid out again with the missing labels moved to the front (bounded and deterministic). A priority-1 label whose standard 32 slots all fail also tries edge-aware "rescue" slots: the placard slides along each side of the marker, out to 125px. Whenever the old algorithm already placed every priority-1 label, the layout is byte-identical: across 6,995 width/scale/font cases, the old and new outputs matched exactly.

Files changed:
- src/lib/viz/explorer/labels.ts: `placeLabelBoxes` refactored into `slots` + `placeOne`, with a priority-1 retry pass and priority-1 rescue slots. The public API and output shape are unchanged, and output is sorted by (priority, id).
- src/components/explorer/PlaceLabels.astro: the placard text uses `font: 600 11px var(--font-sans)`.
- src/components/explorer/place-labels-client.ts: on enable, layout runs after `document.fonts.load("600 11px 'IBM Plex Sans'")`, after `document.fonts.ready`, and on every `loadingdone` while labels are on.
- tests/unit/viz/explorer/label-metrics.test.ts (new, 11 tests) and tests/unit/viz/explorer/place-label-widths.json (new). The JSON holds the measured Chromium widths of all 39 names in Plex Sans 600 and DejaVu Sans Bold.
- e2e/explorer.spec.ts (place-label test only): the separation test now also runs at **320px**. It also asserts that the placards are drawn in "IBM Plex Sans", that the face is loaded, and that every placed rect width equals `ceil(getComputedTextLength()) + 8` (no stale measurement).
- docs/builds/CI3/: this report, `place-label-probe.mjs` (the checker's font probe, extended to 320/375 and with an optional `--dump` and `WIDTHS`), `font-swap-probe.mjs`, `probe-before.json`, `probe-after.json`, and `labels-320-{plex,dejavu}.png` (gitignored).

How to verify:
- `npm run check` → 0 errors, 0 warnings, 0 hints (146 files)
- `npm run lint` → clean (ESLint + Prettier)
- `npm test` → 27 files, 811 tests passed
- `npx vitest run tests/unit/viz/explorer/label-metrics.test.ts` → 11 passed. Against the HEAD `labels.ts`, 8 of the 11 fail (confirmed RED).
- Font probe, with a dev server running: `BASE=http://localhost:44NN DEJAVU_DIR=<dejavu-2.37>/ttf node docs/builds/CI3/place-label-probe.mjs`. Add `WIDTHS=768,1280` for desktop widths.
- Font-swap relayout: `BASE=… DEJAVU_DIR=… node docs/builds/CI3/font-swap-probe.mjs`
- Checker: `npx playwright test e2e/explorer.spec.ts -g "place labels"`

Probe results (Chromium on macOS, basin mask on; light and dark identical):

| width | font | before: placed / P1 | after: placed / P1 |
|---|---|---|---|
| 320 | default (before: SF; after: Plex) | 21/39 · **13/14** (Las Vegas) | 22/39 · **14/14** |
| 320 | Arial | 21/39 · 13/14 | 21/39 · 14/14 |
| 320 | DejaVu Sans Bold | 20/39 · 13/14 | 20/39 · 14/14 |
| 320 | Verdana | 20/39 · 13/14 | 20/39 · 14/14 |
| 375 | default (before: SF; after: Plex) | 26/39 · 14/14 | 25/39 · 14/14 |
| 375 | Arial | 25/39 · 14/14 | 25/39 · 14/14 |
| 375 | DejaVu Sans Bold | 24/39 · **13/14** (Las Vegas) | 24/39 · **14/14** |
| 375 | Verdana | 24/39 · **13/14** (Las Vegas) | 24/39 · **14/14** |
| 768 / 1280 | all four fonts | n/a | 14/14 everywhere |

CDP `getPlatformFontsForNode` now reports "IBM Plex Sans SemiBold" for the placards (before: ".SF NS").

Font-swap probe at 375px: labels were on in Plex (25 placed, sum of rect widths 2047). A late DejaVu webfont was then swapped in without toggling the checkbox, and the labels were laid out again automatically (24 placed, sum 2316, 14/14 P1, 0 stale rects).

Acceptance criteria (self-check):
- ✅ (a) Labels render and measure in the site's Plex stack. `var(--font-sans)` is the same token as the body text, and the probe reports "IBM Plex Sans SemiBold". Layout re-runs after `fonts.load`/`fonts.ready`/`loadingdone`, and the font-swap probe shows 0 stale rects.
- ✅ (b) Every priority-1 label is placed at 320 and 375px with Plex, Arial, DejaVu Sans Bold, Verdana, Plex ×1.2 and DejaVu ×1.05. Unit tests cover this, plus a sweep over 320–440px viewports at ×1.0–1.25.
- ✅ All existing invariants still hold. The unit tests re-check the same rules as the e2e test: in bounds, no placard overlap, no marker under another placard, no leader crossing a placard. The two existing label unit tests pass unchanged.
- ✅ (c) New unit tests in tests/unit/viz/explorer/label-metrics.test.ts. They use widths inflated by 20% (DejaVu-like) and real DejaVu widths at 320 and 375px, and assert that every priority-1 label is placed with no overlaps. Two synthetic cases (found by search) exercise each mechanism on its own: rescue slots for an edge marker, and the retry order.
- ✅ Behaviour is otherwise unchanged. Wherever the old layout already placed every priority-1 label, the output is identical (6,995/6,995 cases). The GNIS attribution, About-the-data list, toggle, status text and basin mask are untouched.
- ✅ No CLS: the SVG is an absolutely positioned overlay, and relayout only moves elements inside it.
- ✅ Reduced motion: no animation was added. The layer stays `aria-hidden`, and the status line still reports "N of M place labels shown".
- ⚠️ e2e was not run by me (checker only). The new 320px case and the font assertion are untested in CI.

Needs Andrew: none.

Requests to Control: none. No shared files or dependencies changed. Note: `npx astro dev --port 4417` refused to start because another session's dev server was already running on :4411 for this tree. I used that server for the probes and did not stop it.

Known limitations:
- The guarantee is empirical, not a proof. The approach is greedy plus at most N+1 bounded priority-1 retries and rescue slots. It holds for the published 14 priority-1 labels at every tested width (320–1280px) and font scale (×0.9–1.3). A future, much denser priority-1 set could still fail, and the new unit tests would catch that.
- Rescue slots can give an edge label a longer leader (up to 125px). With current data, Las Vegas at 320 and 375px is placed by the retry pass. It gets a short leader above its marker (labels-320-dejavu.png).
- The fixture widths were measured in Chromium on macOS. On other browsers Plex widths differ by sub-pixel amounts, which the ×1.2 test covers.
- If Plex fails to load entirely, the placards fall back to the size-matched `IBM Plex Sans Fallback` faces from fonts.css, then to system-ui. The layout is measured from whatever face is drawn.
