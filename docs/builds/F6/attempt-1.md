# Build report — F6 Colorado explorer — attempt 1

Summary: `/rising-water/` is built. It shows a portrait map (the hillshade plus a live water overlay) beside a column with a "verified" status line, readouts, the barcode or diagram strip, an info card and the controls. Below come the "Longest-lived lakes" table, "How to read the barcode", "About the data" and "Code". After the page loads, and when the browser is idle, the page fetches `grid.f32`, `meta.json` and `barcode.json`. It checks the grid's byte length and SHA-256, then runs the F3 engine (`computeH0` + `Flood`) on the grid in the browser. It compares every exported bar with `barcode.json`: 600 of 600 are identical, (bi, di, mi) and exact b/d. It then shows the result visibly. On a mismatch it shows a polite error state and logs `console.error`. Every number on the page comes from the data files.

Files changed (all new):
- `src/lib/viz/explorer/`. The pure parts are unit-tested.
  - `types.ts`: file shapes.
  - `data.ts`: grid decode (little-endian `DataView`), byte and SHA-256 checks, `compareBarcode`, `barsFromFile`.
  - `geo.ts`: cell centre per `meta.cellCenter`, including partial edge blocks; display aspect; pointer→cell; cell edges; cos-latitude cell areas; edge names.
  - `model.ts`: lake ranking (stable, by persistence); identity slots (the lowest lake plus ranks 1–11, K = 12); row selection; `LevelScale` (level ↔ scrubber for both pacings, percentile, area-weighted % flooded); `nextDown`.
  - `text.ts`: number/unit formatting with NBSP and a real minus; info card; readouts; hover; summary; table rows; strip label.
  - `palette.ts`: 12 identity colours per theme and the neutral water colour.
  - `about.ts`: an ATTRIBUTION.md block parser. It fails the build if the required notice isn't quoted verbatim.
  - `strip.ts`: barcode and diagram drawing and hit testing.
  - `map.ts`: `WaterPainter`, which allocates nothing per frame; lake and basin masks; outline tracing.
  - `controller.ts`: the runtime.
- `src/components/explorer/`:
  - `Explorer.astro` and `explorer-client.ts`: loading, verification, wiring, and the `__explorer` test hook.
  - `LakesTable.astro`, `AboutData.astro`, `build-data.ts`: build-time reads of `public/data/colorado/`.
- `src/pages/rising-water/index.astro`.
- `tests/unit/viz/explorer/`: helpers, data, geo, model, render and text tests (66 tests).
- `e2e/explorer.spec.ts`: 23 tests, not run (checker only).
- `docs/builds/F6/screens/*.png`: 18 self-check screenshots (gitignored).

How to verify:
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 15 files, 439 passed, of which 66 are in `tests/unit/viz/explorer`.
- Checker: `npm run build && npx playwright test e2e/explorer.spec.ts`, then Lighthouse with `LHCI_URLS=/rising-water/`.
- Self-checks I ran: Playwright scripts against `npx astro dev --port 4406`. The server is now stopped and the port is free.

Acceptance criteria (self-check):
1. ✅ §6.4 works:
   - **Label:** "Colorado River Basin study area (RiverNets coverage)" is the h1, taken from `meta.label`.
   - **Layout:** at ≥ 56rem the map column and side column are 55fr / 45fr; at 375 and 768 the pieces stack.
   - **Readouts:** level in m and ft, percentile (share of cells at or below the level), number of lakes (`Flood.alive()`), and % of area flooded. The area is weighted by cos(lat) × the native-pixel extent of each cell, so it differs slightly from the percentile.
   - **Controls:** play/pause, speed (0.25–4×), level scrubber, pacing (percentile by default, or linear metres), min persistence (1–400 m), top bars (5–600), units m/ft, and view barcode/diagram.
   - **Hover:** shows elevation (both units) and the lat/lon of the cell centre, plus dry, or under water with the lake rank.
   - **Identity colours:** the 12 identity lakes are labelled at their pits ("lowest", 1–11) while alive.
   - **Selection:** the selected lake gets an outline (dashed once it has merged), a pit ring, a pass diamond and labels.
   - **Keyboard:** scoped to the focused map: Space, ←/→ (Shift for bigger steps), Home/End, ↑/↓ to select a bar, Esc to clear. Pressing Space on the body doesn't start playback.
   - **Hidden summary:** `aria-live` polite; updated on pause, scrub (300 ms debounce), selection and settings changes.
   - **Readouts:** correct immediately whenever not playing; during play, throttled to 150 ms with a trailing update.
   - **Reduced motion:** paused at 0.45, frames 1 → 2 (the second is the ResizeObserver's initial measure), and a Play button.
   - **Off-screen:** running=false and frames stay 324 → 324, then it resumes.
   - **Hidden tab (emulated):** running=false.
   - **DPR:** capped at 2.
   - **Console:** no errors in any run.
2. ✅ Live barcode = `barcode.json`.
   - **Unit tests on the real `grid.f32`:** 600/600 bars identical, with exact b/d equality (no rounding needed, DECISIONS #35) and column-by-column `bi`/`di`/`mi`/`b`/`d`. The births, zero-length and finite counts equal the file's stats. The SHA-256 equals both `meta` and `barcode.json`. Tampered-file tests confirm the check fails.
   - **In the browser:** `data-match="true"`, with the status line "Computed in your browser in 17 ms: the live barcode matches barcode.json (600 of 600 bars identical)."
3. ✅ Bar click and table button.
   - The level jumps to `nextDown(death)`, the largest double below the death level. A test confirms the lake is still its own component there and merges at the death level.
   - Lake 3 card, read in the browser: "Born at 1,275.7 m near 40.7704° N, 113.6646° W, merged at 1,671.5 m at 37.5704° N, 113.1896° W into the lowest lake (cell 133025), persistence 395.8 m."
   - A unit test reproduces the docs/data.md lakes table (parsed from the file, not retyped) for all 10 rows: cells, lat/lon, elevations, persistence and merge target.
   - The lowest lake's card says "It never merges: its bar is infinite, because it eventually holds all the water." Selecting it sets the level to the top.
   - Clicking a bar on the canvas and clicking a table button were both verified. The buttons have unique names, "Show lake N on the map".
4. ✅ Copy.
   - "How to read the barcode" is §6.6 items 1–9, lightly rephrased. The only additions describe the UI: the diagram view, and that the Min persistence control is the threshold.
   - "About the data" is generated:
     - key facts from `meta.json`;
     - the attribution blocks from `ATTRIBUTION.md`, with the required notice verbatim in a `<blockquote data-required-notice>`, checked against `meta.licence.requiredNotice` at build time;
     - `meta.processing` and `meta.limitations` verbatim. The limitations include the edge-closed valleys, the surface model, the mines and vertical accuracy.
   - No place names appear on the map or in the table; lakes are identified by rank and cell id.
   - The table note says "6 of the 10 longest-lived lakes are born on the edge of the rectangle". The 6 is computed from the data, and the wording follows `meta.limitations`.
   - "Code" describes `pipeline/` and `src/lib/tda/` without links, because the URLs in `open-science.yaml` and `profile.yaml` are empty. Links render automatically once they are set.
5. ✅ Map aspect: the CSS box uses `displayAspect` computed from `meta.native.extent` and cos(`meta.center.lat`), which is 0.62889 against `meta.derived.displayAspect` 0.6289. Measured box ratios were 0.62890 (375), 0.62888 (768) and 0.62889 (1280). The water overlay maps one cell to 30 native pixels, with the partial last column and row clipped. The hillshade is scaled the same way (9770/9769 and 12410/12408), so it isn't distorted.
   - **Overflow:** `scrollWidth == clientWidth` at 375, 768 and 1280 in both themes. I fixed one bug before this: visually-hidden button text escaped the table's scroll box until I made it `position: relative`.
   - **Screenshots:** `docs/builds/F6/screens/{v,sel,diag}-{375,768,1280}-{light,dark}.png`.
   - **CLS** (PerformanceObserver, through data load and first frames): 0.00004 at 375 and 0.00013 at 1280.
6. ⚠️ I couldn't run Lighthouse (checker only). Indicators:
   - **Page JS for the explorer client:** about 14.1 KB gzip (esbuild minified bundle of `explorer-client.ts`, engine included).
   - **Data transferred (dev server):** HTML 151 KB (dev build), hillshade 180 KB, grid 540 KB, barcode 34 KB, meta 9 KB, fonts 62 KB. That is about 0.98 MB, plus dev-only Vite modules that production won't have. No third-party requests.
   - **axe:** no violations at 1280 light and 375 dark, after transitions settle. One false hit appeared mid-transition on a pressed button, so the e2e waits for animations to finish (DECISIONS #41).
   - **Timings** (Chromium headless, Apple M3, 1280×800):

     | Measure | Unthrottled | 4× CPU throttle |
     |---|---|---|
     | `computeH0` | 17–22 ms | 63 ms |
     | Setup + first frame | 12–25 ms | 43 ms |
     | Fetch | 2–11 ms (local) | – |
     | rAF interval during play, p50 / p95 / max | 16.7 / 16.7 / 16.8 ms | p95 16.8 ms |
     | `render()`, p50 / p95 / max (300 frames) | 0.9–1.5 / 1.3–2.2 / ≤ 2.6 ms | – |

   - **Compute timing:** compute starts after `load` + `requestIdleCallback`, so it is off the LCP path. The single long task under 4× is about 63 ms.

Needs Andrew: the repository URLs (`open-science.yaml`, `profile.yaml site.source_url`), if the "Code" section should link out. It already renders links whenever they are non-empty.

Requests to Control: none required.
- Optional: F2's Rising water project entry can get its date (DECISIONS #23).
- Optional, for F7: the global `.btn` background transition means a pressed toggle briefly has low contrast mid-transition. That's harmless, but axe can catch it if a test doesn't wait.

Known limitations:
- **Identity colours:** 12 colours tested at ΔE2000 ≥ 10 under normal vision and simulated protanopia, deuteranopia and tritanopia, including against the neutral water colour, and ≥ 3:1 on the strip. Some are saturated. The labels and outlines carry identity too.
- **Lake labels:** the "lowest"/1–11 labels avoid each other where they can. Several top lakes sit on the east edge, so at high levels a label can still sit close to another.
- **"Just below the death level":** `nextDown(d)`. With exact height ties at the pass height, cells with h = d and a smaller index are not yet wet, so the outline can differ by those tie cells from docs/data.md's ≺-based "lake just before it spills". Tests on the top 15–25 lakes show no difference.
- **Playback:** stops at the top (no loop). Play from the top restarts from the bottom.
- **Hidden-tab testing:** only by emulating `visibilityState`, as in F5.
- **Map size:** at 1280×800 the portrait map (about 590 × 938 px) is taller than the viewport, by design (55% width, portrait).
