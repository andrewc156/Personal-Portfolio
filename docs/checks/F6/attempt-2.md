# Check report — F6 Colorado explorer — attempt 2
Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit (439) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ · e2e (98/98, twice; 21 explorer tests) ✅ · axe ✅ (in e2e) · lighthouse /rising-water/ (15 runs: perf 97×14, 58×1; a11y 100, BP 96, SEO 100) ✅ with note 1 · / (3 runs: 100/100/100/100) ✅ · links (23 scanned, 0 broken) ✅ · visual ✅ · content ✅ · tda ✅ · data ✅ · corrupted-data behaviour ✅

Blocking fix 1 from attempt 1 is fixed. An integrity failure now stops the explorer before anything from the grid is drawn. I tested this with four corruptions of my own plus the two from attempt 1. Every hard gate passes. Three non-blocking notes follow.

Environment: Apple M3, macOS, Node 26, Playwright Chromium (headless). Preview ran on :4321, one server at a time. No servers are running now and port 4321 is free.

## Blocking fix 1: corrupted data
I wrote my own probe, `docs/checks/tools/f6a2_corrupt.mjs`. It intercepts the request with `page.route` and uses its own corruptions, not the builder's e2e ones. Output is in `attempt-2/corrupt.txt`.

| Case | Status message | console.error | Controller | Painted px (map, strip) | Controls disabled | Table buttons disabled | Readouts | rAF after check |
|---|---|---|---|---|---|---|---|---|
| (a) low mantissa bit, cell 70000 (XOR 0x01) | SHA-256 mismatch | 1 | none | 0, 0 | 10/10 | 21/21 | – – – – | 0 new |
| (b) exponent byte of lake 3's pit, 17991 (XOR 0x40) | SHA-256 mismatch | 1 | none | 0, 0 | 10/10 | 21/21 | – – – – | 0 new |
| (b2) exponent byte of rank-1 pit 58027, taken from barcode.json | SHA-256 mismatch | 1 | none | 0, 0 | 10/10 | 21/21 | – – – – | 0 new |
| (c) grid.f32 truncated by 4 bytes | "wrong size" (539,852 vs 539,856) | 1 | none | 0, 0 | 10/10 | 21/21 | – – – – | 0 new |
| (d) barcode.json `di[7]` += 1, grid intact | "599 of 600 bars identical" | 1 | none | 0, 0 | 10/10 | 21/21 | – – – – | 0 new |
| normal | "600 of 600 bars identical" | 0 | running | 19,299, 7,857 | 0/10 | 0/21 | 231.1 m / 758 ft / 3.8 / 7 / 3.9 % | running |

What every failed case also showed:
- **The error status:** it is visible, has `role=status` and `data-kind=error`, and sets `data-match=false` and `data-ready=false`.
- **The level output** reads "–".
- **Interaction does nothing:** I clicked the table buttons (forced), pressed keys on the stage and hovered the map. Nothing started.
- **The static parts still render** from the published files: the "Longest-lived lakes" table (20 lakes plus the lowest lake), all 9 "How to read" items and "About the data" (4,118 chars).
- **The hillshade still shows,** with no water on it. Screenshots: `error-{375,768,1280}-{light,dark}.png` and `error-full-*`.

**Previous checker's section B:** `f6a2_behaviour.mjs` is attempt 1's tool, unchanged except for the output path. Both variants now pass: "explorer NOT started on unverified data (hasEx=false, play disabled=true, lakes "–", painted px 0)". Attempt 1 failed both.

**Error copy** (explorer-client.ts:150): "The elevation data failed its integrity check (<reason>), so the live map and barcode are not shown. The table and the sections below come from the published files." It is accurate in every case, and the attempt-1 claim "The map shows the live computation" is gone.

## Acceptance criteria
1. **§6.4 works: ✅.** My re-runs of attempt 1's independent tools are in `attempt-2/probe.txt` (FAILS 0, 92 OK) and `behaviour.txt`.
   - **Readouts:** 20 slider positions × both pacings equal my own BFS, and the overlay equals {h ≤ t} with 0 colour or elder errors.
   - **During play:** 21/21 readout updates match at both pacings, ≤ 15 ms lag.
   - **Min persistence and top-N:** 7 combinations, all equal to my own selection.
   - **Units:** lake 3 reads 4,185 / 5,484 / 1,299 ft.
   - **Keyboard:** scoped to the stage. Space on the body scrolls the page, and the stage keys behave as documented.
   - **Pausing:** off-screen and in a hidden tab (emulated), frames stay frozen.
   - **DPR:** capped at 2.000.
   - **Summary cadence:** 0 updates during play, 1 on pause, 1 after the scrub debounce.
   - **CLS:** 0.00004–0.00013.
   - **Map hover:** exact at 14 cells, including the corners, the min and the max.
   - **The 3 FAIL lines in behaviour.txt are the same probe artefacts as in attempt 1:**
     - "slider arrow scrubs (1→1)": the slider was already at End.
     - "reduced motion frames 1→2": one ResizeObserver re-render. It is paused at 0.45 with a Play button, as attempt 1 accepted.
     - `f6_slider.mjs` confirms the slider works from the keyboard: 0.5 → 0.502 after two →, and Space doesn't play.
2. **Live barcode = barcode.json: ✅.**
   - `f6_ref.py` regenerates `ref.json` byte-identical to attempt 1's.
   - Live `__explorer.result.bars` = my union-find, 1010/1010 tuples in order.
   - The ≥ 1 m subset = barcode.json, 600/600 exact.
   - The status reads 600 of 600.
3. **Bar click and table button: ✅.**
   - **Table buttons:** 8 (ranks 1, 2, 3, 5, 8, 13, 17, 20) plus the lowest lake.
   - **Real bar clicks:** 8 (ranks 4, 6, 7, 9, 10, 11, 14, 22).
   - **Level:** equals my nextDown(d) every time.
   - **Highlight:** equals my BFS basin cell for cell (107, 1,060, 12,278, 2, 20, 674, 21, 125, 192, 2, 2, 9, 308, 4, 3, 2).
   - **Card strings:** equal the ones I built from my own numbers.
   - **Lowest lake:** its card says "never merges".
4. **Copy and "About the data": ✅.**
   - "How to read the barcode" still matches §6.6 items 1–9. It renders in all 6 howto screenshots; only the lede changed in index.astro.
   - "About the data" is generated from meta.json and ATTRIBUTION.md.
   - **The required notice is unchanged** in both ATTRIBUTION.md:8 and dist. I re-fetched the Copernicus COP-DEM page today: it gives "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018" / "provided under COPERNICUS by the European Union and ESA; all rights reserved", which is word for word what the site shows.
   - **The label is exact** in the h1.
   - **The lede now reads:** "The water on the map and the barcode are computed in your browser from the same 326 × 414 elevation grid; the shaded relief under the water is precomputed." That is accurate: the overlay and barcode come from grid.f32 in the browser, and hillshade.webp is a precomputed file.
   - **The dist grep** for TODO|TBD|lorem|placeholder finds 0.
5. **Aspect and layout: ✅.**
   - Map aspect is 0.62888–0.62890 against meta 0.6289, at DPR 1 and 3.
   - scrollWidth = clientWidth at 375, 768 and 1280 in both themes, including the error state.
   - I opened every PNG: 66 normal-state and 12 error-state, directly or through the contact sheets in `attempt-2/sheets/`, plus 6 `corrupt-*`. There is no clipped or overlapping text, the canvases aren't blank or frozen and the controls fit.
   - **Square corners: ✅.** The stage border-radius is 0px.
     - `f6_cornercount.mjs` reports 0/288 hidden at 375 and at 768. At 1280 it reports 18 hidden, all in the bottom row (y = 413).
     - That is a tool artefact. Its sample point for row 413 lands at y = 999.66 in a 1000 px viewport, where `elementFromPoint` returns null (`f6a2_cornerwhy.mjs`).
     - With real mouse hovers at the true cell centres (`f6a2_bottomrow.mjs`), all four corners and both bottom-row corner runs return the correct elevation and lat/lon readout at 1280×800, 1280×1000, 768 and 375. For example, cell (0,413) reads 8.0 m at 31.8254° N, 115.1896° W.
     - Attempt 1 had 42/288 hidden at 1280 and 93/288 at 375. Results are in `attempt-2/corners.txt`.
6. **Data transferred and Lighthouse: ✅ (note 1).**
   - **Cold cache:** 758,846 B over the wire, of which grid 466,678 and hillshade 179,844.
   - **Third-party requests:** 0.
   - **Lighthouse a11y:** 100 in all runs.
   - **Console:** 0 errors on the normal path.

## Lighthouse (mobile, staticDistDir; raw in attempt-2/lh/run1–15, gitignored; summary in lh-summary.txt)
| /rising-water/ | perf | a11y | BP | SEO | LCP | TBT | Longest main-thread task (simulated) |
|---|---|---|---|---|---|---|---|
| run 1 (first after the e2e/probe session) | **58** | 100 | 96 | 100 | 5,018 ms | 1,192 ms | 1,242 ms, Explorer chunk |
| runs 2–10 (back to back) | 97 | 100 | 96 | 100 | 2,553–2,555 ms | 0 ms | 78–83 ms, unattributable |
| runs 11–13 (each right after a fresh `npm run build`) | 97 | 100 | 96 | 100 | 2,554–2,555 ms | 0 ms | 78–80 ms |
| runs 14–15 (after 5 min idle) | 97 | 100 | 96 | 100 | 2,554–2,555 ms | 28 / 0 ms | 82 / 78 ms (Explorer's own longest: 78 ms) |
| / (runs 1, 14, 15) | 100 | 100 | 100 | 100 | 902 ms | 0 ms | none |

**Distribution:** 14 of 15 runs score 97 (median 97, min 58). The LCP split from attempt 1 (82 vs 97) is gone: every run estimates 2.55 s, which suggests the hillshade preload works. Apart from run 1, the yields keep every Explorer task ≤ 78 ms simulated, and TBT is 0–28 ms.

## Steps 9 and 10
**Step 9, performance** (`attempt-2/perf.txt`):
- **computeH0:** 17.7–18.1 ms on desktop; at 4× CPU, 64–65 ms. The budget is ≤ 500 ms.
- **Setup:** 11.4–12.6 ms; at 4× CPU, 44.5–44.8 ms.
- **rAF during play:** 700 frames × 2 runs at p95 16.7 ms and max 16.8 ms; 650 frames × 2 runs at 4× CPU, p95 16.7–16.8 ms.
- **render():** p95 1.2 ms.
- **Page JS, gzip -9:** Explorer 12,592 + color 2,003 + settings 911 + BaseLayout 432 = 15.9 KB. The budget is ≤ 120 KB.
- **Third-party requests:** 0.

**Step 10, data:** unchanged since attempt 1. The data files are byte-identical, since `ref.json` regenerates identically. The bbox and label are exact.

## Notes (non-blocking)
1. **A first-run Lighthouse outlier remains (58, as attempt 1's run 1 scored 54).**
   - The cause is a single 1,242 ms simulated task (about 310 ms observed) attributed to the Explorer chunk. Explorer scripting was 2,074 ms there, against 884–972 ms in the other runs.
   - **It is not reproducible on demand.** It did not recur in 14 later runs:
     - 9 back to back;
     - 3 each straight after a rebuild;
     - 2 after 5 minutes idle.
   - Both attempts saw it only on the first lhci run of a session, which points to a cold-start effect in the Chromium/V8 environment rather than the page. A yielded compute can't produce a 310 ms task on a warm engine.
   - I judge the budget to be met reliably: 14/15 ≥ 80, median 97, against attempt 1's 10/11 with median 82.
   - **For F7/F9:**
     - Start each Lighthouse session with one discarded warm-up run, or report the median.
     - Optionally move computeH0 into a Worker so no cold run can attribute a long main-thread task to it.
2. **The e2e corrupted-grid tests cover only the hash path.** Both cases fail at SHA-256 before the barcode comparison runs. The size check and the barcode-comparison rejection (my cases c and d) work but aren't covered by e2e. Consider adding a truncated-grid case and a modified barcode.json case to `e2e/explorer.spec.ts`.
3. **Some text shows in the error state that no longer applies:**
   - The map hint still says "Point at or tap the map to read a cell's elevation and coordinates.", although hover does nothing.
   - The Min persistence output shows its default "10.0 m". It is a setting, not data, so this is harmless.
   - Consider hiding the hint when `data-match` is false/error.
4. **Carried over from attempt 1:**
   - BP 96 comes from `image-aspect-ratio` on the deliberately cos(lat)-stretched hillshade.
   - Hidden-tab behaviour is tested only by emulating `visibilityState`.
   - If Web Crypto is unavailable (non-secure origin), the hash check is skipped. The byte-length check and the full barcode comparison still gate the explorer. Production is HTTPS, so this doesn't arise there.

## Artifacts
- Report: `docs/checks/F6/attempt-2.md`.
- `docs/checks/F6/attempt-2/`:
  - logs: `{check,lint,unit,pytest,ruff,build,links}.log`, `e2e-run{1,2}.log`, `lhci-run1–15.log`;
  - results: `corrupt.txt`, `probe.txt`, `behaviour.txt`, `perf.txt`, `corners.txt`, `lh-summary.txt`, `ref.json`;
  - `lh/run1–15/` (gitignored);
  - 84 PNGs:
    - `{initial,initial-full,barclick,barclick-side,diagram-ft,east-labels,east-labels-zoom,high-water,table,about,howto}-{375,768,1280}-{light,dark}.png`;
    - `error{,-full}-{375,768,1280}-{light,dark}.png`;
    - `corrupt-{a,b,b2,c,d,normal}-1280-light.png`;
  - `sheets/` (contact sheets).
- New tools in `docs/checks/tools/`:
  - `f6a2_corrupt.mjs`, `f6a2_errshots.mjs`, `f6a2_bottomrow.mjs`, `f6a2_cornerwhy.mjs`, `f6a2_cornercount_tall.mjs`, `f6a2_lh.py`, `f6a2_sheet.py`;
  - `f6a2_{probe,behaviour,shots}.mjs`: attempt 1's tools, with only the output path changed to attempt-2.
