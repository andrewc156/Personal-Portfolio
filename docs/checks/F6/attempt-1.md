# Check report — F6 Colorado explorer — attempt 1
Verdict: FAIL

Gates: check ✅ · lint ✅ · unit (439) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ · e2e (96/96, twice; 19 explorer tests) ✅ · axe ✅ (in e2e) · lighthouse /rising-water/ (11 runs: perf 97×5, 82×5, 54×1; a11y 100, BP 96, SEO 100) ✅ with a note · / (4 runs: 100/100/100/100) ✅ · links (23 scanned, 0 broken) ✅ · visual ✅ · content ✅ · tda ✅ · data ✅ · corrupted-grid behaviour ❌

The only blocking item is Fix 1, the corrupted-grid behaviour. Everything else passed. I reproduced it all with my own tools, not the builder's helpers.

Environment: Apple M3, macOS, Node 26, Playwright Chromium (headless). Preview ran on :4321, one server at a time. The port is free now.

## Acceptance criteria
1. **§6.4 works: ✅, except Fix 1.** `docs/checks/F6/attempt-1/{probe,behaviour,perf}.txt`:
   - **Readouts:** I compared level (m and ft), percentile, number of lakes and % area flooded against my own BFS (`f6_probe.mjs`). Area is weighted by cos(lat) × the native-pixel extent of each cell, from my own geometry.
     - Paused: 20 slider positions × both pacings, all exact. My level-at-position formula agrees with the page.
     - During play at 4×, both pacings: 21/21 readout updates equal my BFS at a level shown ≤ 15 ms earlier, and the value after pause is exact.
     - Keyboard slider: correct one frame after the keypress.
   - **Units toggle:** level, alternate unit, card and table all switch. The card reads 4,185 / 5,484 / 1,299 ft for lake 3, which matches my m ÷ 0.3048.
   - **Min persistence and top-N:** I tried 7 combinations ((10,40), (1,600), (50,600), (100,5), (200,100), (400,600), (1,5)). The drawn rows equal my own selection every time (essential plus longest bars with p ≥ min, capped at N), and the "N bars (k shown)" output is right.
   - **Map hover:** elevation in both units and cell-centre lat/lon are exact at 12 reachable cells, including the min cell 133025, the max cell 56383 and pits. Cells under the stage's rounded corners can't be hovered (note 2).
   - **Keyboard is scoped to the stage:**
     - Space on the body scrolls the page and doesn't play.
     - On the stage, the keys behave as documented: Space, → +0.005, Shift+→ +0.05, ←, End, Home, ↓ selects, Esc clears.
     - Space on the units button only toggles units.
   - **Reduced motion (1280 and 375):** paused at 0.45 with a Play button. Frames go 1 → 2 (one ResizeObserver re-render), then stay static.
   - **Off-screen:** running=false and frames stay 159 → 159, then it resumes.
   - **Hidden tab (emulated):** frames stay 190 → 190 and running=false.
   - **DPR:** capped at 2.000 with DPR 3.
   - **Summary (aria-live polite):** 0 updates during 2 s of play, 1 on pause, 1 after the scrub debounce.
   - **CLS (PerformanceObserver, through data load + 1.5 s):** 0.00004–0.00013.
   - **Console:** 0 errors in every probe. No third-party requests.
2. **Live barcode = barcode.json: ✅.**
   - In the browser, `__explorer.result.bars` equals my independent union-find (`f6_ref.py` → `f4b_h0.h0_unionfind`, validated against BFS in F4b). That's 1,010 bars (1,009 positive plus the essential bar), tuple-identical (b, d, bi, di, mi) and in order.
   - Its ≥ 1 m subset equals barcode.json exactly: 600/600, with no rounding.
   - The status line reads "600 of 600 bars identical". JS = Python on the Colorado grid.
3. **Bar click and table button: ✅.** I checked 9 table buttons (ranks 1, 2, 3, 5, 8, 13, 17, 20 and the lowest lake) and 8 real mouse clicks on bars (ranks 4, 6, 7, 9, 10, 11, 14, 22). For each lake:
   - The level equals my own nextDown(d), the largest double below the death level.
   - The highlighted mask equals my BFS basin {h < d} containing the pit, cell for cell (sizes 107, 1,060, 12,278, 2, 20, 674, 21, 125, 192, 2, 2, 9, 308, 4, 3, 2).
   - The card string equals the one I built from my own numbers: born X m near lat/lon, merged Y m at lat/lon, into lake Z (cell), persistence P. It uses the cell-centre convention from docs/data.md.
   - The lowest lake goes to the top level, and its card says it never merges.
   - The table's 20 rows match my reference exactly (rank, persistence, birth/death m, lat/lon, merge target, cell). Rows 1–10 also equal docs/data.md.
4. **Copy and "About the data": ✅.**
   - "How to read the barcode" matches §6.6 items 1–9 sentence by sentence, with light rephrasing. The only additions describe the UI: the diagram view ("each bar is a point, birth level across and death level up") and "(the Min persistence control)". Neither adds a TDA claim.
   - "About the data" is rendered from meta.json (facts, processing, limitations) and ATTRIBUTION.md.
   - The required notice is word for word the same as the Copernicus licence page's "User Obligations" notice for adapted or modified data, which I fetched today: "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved".
   - The label is exact.
   - Geography: the page's only place claim is meta.limitations' "about 1 km from … Utah's Bingham Canyon Mine". USGS-quad coordinates (TopoQuest, 40.52217° N, 112.14939° W) put the mine 0.85 km from birth cell 21312, so the claim holds.
   - "6 of the 10 … born on the edge" equals ranks 1, 2, 4, 8, 9 and 10, which I recomputed myself.
   - The dist grep for TODO|TBD|lorem|placeholder finds 0.
5. **Aspect and layout: ✅.**
   - Map box aspect is 0.62888–0.62890 against meta 0.6289, at DPR 1 and 3 and at 375, 768 and 1280.
   - The hillshade is scaled anisotropically by cos(lat), as intended.
   - Every screenshot has scrollWidth = clientWidth.
   - I opened all 66 PNGs: initial, bar click (card + highlight), diagram + ft, east-edge labels and zooms, high water, table, how-to, about and full page, at 3 widths × 2 themes. There is no clipped or overlapping text. The east-edge labels "1" and "9" at 3,000 m are clamped inside the canvas and don't collide.
6. **Data transferred and Lighthouse: ✅ (note 1 on headroom).**
   - **Cold cache on the production preview:** 758,724 B over the wire (gzip). That's about 0.98 MB raw; grid 466,678 B encoded, hillshade 179,844 B.
   - **JS on /rising-water/, gzip -9:** Explorer 12.5 KB + color 2.0 KB + settings 1.3 KB + BaseLayout 0.4 KB ≈ 16 KB.
   - **No third-party requests.**
   - **Compute (Chromium, desktop):** computeH0 17.5–17.6 ms and setup 12 ms (4× CPU: 63 ms + 43–53 ms).
   - **rAF during play:**
     - 700 frames × 2 runs: p50 16.7, p95 16.7–16.8, max 16.8 ms; render p95 1.1 ms.
     - At 4× CPU, 650 × 2: p95 16.7 ms.
   - **Lighthouse:** see the table below.
   - **Console:** no errors.

## Lighthouse (mobile, staticDistDir; raw in attempt-1/lh/, gitignored)
| /rising-water/ runs | perf | a11y | BP | SEO | CLS | TBT | LCP |
|---|---|---|---|---|---|---|---|
| run 1 | **54** | 100 | 96 | 100 | 0.0001 | 2,124 ms | 4,961 ms |
| runs 2, 5, 6, 8, 11 | 82 | 100 | 96 | 100 | 0.0001 | 30–32 ms | 4,957–4,964 ms |
| runs 3, 4, 7, 9, 10 | 97 | 100 | 96 | 100 | 0.0001 | 29–31 ms | 2,554–2,557 ms |
| / (runs 1, 2, 3, 9–11) | 100 | 100 | 100 | 100 | 0.0001 | 0–2 ms | 903 ms |

BP 96 on /rising-water/ comes from `image-aspect-ratio` on the hillshade, which is deliberately stretched by cos(lat) (note 3).

## Blocking fixes
1. **A corrupted grid still starts the explorer and shows wrong data.**
   - **Where:** `src/components/explorer/explorer-client.ts:101–126`. The ExplorerController is created and `wire()`d before `ok` is checked (line 107). The error text at line 122 says "The map shows the live computation."
   - **Expected:** if grid.f32 fails the byte, SHA-256 or barcode check, show the polite visible error and one console.error, and don't render data. Don't create or wire the controller, keep the controls disabled and leave the readouts at "–", as `fail()` already does for a load error.
   - **Actual, with one byte flipped:**
     - The status error and exactly one console.error appear, which is correct.
     - But the controller runs: the map paints 6,230–6,361 water pixels, Play is enabled, and the readouts show values ("Lakes 2").
     - With the exponent byte of lake 3's pit flipped (599/600 bars), the map, hover and cards show heights that disagree with the static table, which is built from barcode.json.
     - With a low mantissa bit flipped (600/600 bars, hash mismatch only), it also runs on unverified data.
   - **Reproduce:**
     1. `npm run build`, then `npm run preview -- --port 4321 --ignore-lock`.
     2. Run `node docs/checks/tools/f6_behaviour.mjs`, section B. It routes `**/data/colorado/grid.f32` and XORs byte 4·17991+3 with 0x40, or byte 4·70000 with 0x01.
     3. Read `docs/checks/F6/attempt-1/behaviour.txt`: "corrupted grid … explorer NOT started on unverified data" is FAIL.
   - **Also:** add an e2e test for this. `e2e/explorer.spec.ts` has no corrupted-grid test.

## Notes (non-blocking)
1. **Lighthouse performance has little headroom.**
   - 10 of 11 runs are ≥ 80 (median 82, five at 97), so the gate passes.
   - Run 1, the first after the build, scored 54. It caught a 2,139 ms simulated long task in the Explorer chunk (the compute ran inside the trace).
   - The 82 vs 97 split comes from Lantern's LCP estimate for the 180 KB hillshade img (4.96 s vs 2.56 s).
   - Consider a smaller or progressive hillshade, or yielding between decode, compute and compare, to give margin on real phones.
2. **The rounded stage corners clip the grid's corner cells.**
   - `.ex-stage { border-radius: var(--radius-lg) (14px); overflow: hidden }` at `Explorer.astro:324–329` hides them, both visually and for hover.
   - 42/288 corner-zone cells are hidden at 1280 and 93/288 at 375. Among them is cell 0, which is lake 12's pit (its ring is clamped inside, so it stays visible).
   - Consider a smaller radius on the map, or an inset.
3. **The hillshade is intentionally anisotropic,** with `image-aspect-ratio` flagged (BP 96 ≥ 95). It's correct for the cos(lat) display. It could be drawn on the canvas or via `object-fit: fill` on a box with the natural ratio, if F7 wants BP 100.
4. **Lede wording,** `src/pages/rising-water/index.astro:42`: "The map and the barcode are computed in your browser". The hillshade is precomputed; only the water overlay is computed. Suggested: "The water on the map and the barcode are computed …".
5. **e2e has 19 explorer tests** (`npx playwright test --list`), not the 23 the build report says.
6. **Hidden-tab behaviour is tested only by emulating `visibilityState`,** as in F5.

## Artifacts
- Report: `docs/checks/F6/attempt-1.md`.
- `docs/checks/F6/attempt-1/`:
  - `probe.txt`, `behaviour.txt`, `perf.txt`, `visible-text.txt`, `ref.json`, `lhci-run*.log`;
  - `lh/run1–11/` (gitignored);
  - 66 screenshots: `{initial,initial-full,barclick,barclick-side,diagram-ft,east-labels,east-labels-zoom,high-water,table,about,howto}-{375,768,1280}-{light,dark}.png`;
  - `zoom/`, and `sheets/` (contact sheets I used to review the remaining PNGs).
- Tools in `docs/checks/tools/`:
  - `f6_ref.py` (independent reference over `f4b_h0.py`);
  - `f6_probe.mjs` (TDA, overlay, readouts, clicks, hover, units, controls);
  - `f6_behaviour.mjs` (play readouts, corrupted grid, keyboard, reduced motion, pausing, DPR, summary, CLS);
  - `f6_perf.mjs`, `f6_shots.mjs`;
  - `f6_corner*.mjs`, `f6_cornercount.mjs`, `f6_slider.mjs`.
