# Check report — F9 Final audit (post-stretch) — attempt 4

Verdict: PASS_WITH_NOTES

This was a fresh, independent full-site audit of `main` at `a6b56bb` (code `5c54ee2` plus docs). It covers F1–F8, C1, D1, CI1–CI3, and the approved stretch and requested work F10–F18. Each item was judged against its recorded decision (DECISIONS #78, #81–#84). The audit ran on macOS with Node 26.13.0 and Playwright Chromium. Every gate ran one at a time on port 4321. Nothing is listening on 4321 now. The other session's `astro dev --port 4411` (pid 23366) was left alone.

Gates: check ✅ (146 files, 0/0/0) · lint ✅ · unit (811) ✅ · pytest (606) ✅ + ruff ✅ · build ✅ (default and `SITE_URL=https://andrewchincea.com`) · e2e ⚠️ 169 passed / 8 failed / 8 skipped. All 8 failures are environmental `hero.spec.ts` timing tests (Note 1). Hosted CI run 45557116146 on `5c54ee2` passes 177/177 including them. · headers spec under Wrangler ✅ 8/8 · axe ✅ (in e2e) · Lighthouse ✅ (all 10 routes, table below) · links ✅ (27 scanned, 0 broken) · visual ✅ (60 full-page and 32 stretch-state screenshots, all opened) · content ✅ · explainer ✅ · TDA ✅ · data ✅ · budgets ✅ · hosting ✅ (canonical/sitemap open as Needs Andrew)

## Gate results (§11)

1. **Static checks.**
   - `npm run check`: 0 errors, 0 warnings, 0 hints across 146 files.
   - `npm run lint`: clean.
   - `npm test`: 27 files, 811 tests passed.
   - `pipeline/.venv/bin/python -m pytest pipeline -q`: 606 passed.
   - `pipeline/.venv/bin/ruff check pipeline`: all checks passed.
   - Logs: `attempt-4/gate-{check,lint,unit,pytest,ruff}.log`.
2. **Build and e2e.**
   - `npm run build` built 10 pages. write-headers added 3 script hashes, 9 style hashes and 0 attribute or handler hashes. The CSP line is 890/2000 characters.
   - `npm run e2e` on preview port 4321: 169 passed, 8 failed, 8 skipped. The 8 skipped tests are the Wrangler-only headers spec, which ran separately in step 11.
   - Failures:
     - `hero.spec.ts:541` and `:1008` × 4: p95 frame time for the rising, dye, pond, rivers and collatz modes.
     - `hero.spec.ts:918` × 3 (pond, rivers, collatz): the reduced-motion check `frames − a.frames ≤ 2` received 3.
   - Everything else passed:
     - every explorer test, including the CI3 place-label separation tests, the basin mask and GNIS labels;
     - axe;
     - the CLS font-delay tests;
     - the shell, Garden, SEO and site specs.
   - Log: `attempt-4/gate-e2e.log`. Diagnosis is in Note 1.
3. **Lighthouse (mobile, `staticDistDir`).**
   - `LHCI_URLS=<all 10 routes> npm run lhci`: assertions passed. The only warning was the global 0.9 performance warning on `/rising-water/` (one run, 81), and that route's budget is 80.
   - Budget protocol (DECISIONS #50): 4 runs per route, first run discarded, median of 3. Run with `docs/checks/tools/f9a4-lhci.cjs` in two foreground batches, summarised by `f9a4_lh_summary.py`.

   | Route | Perf | A11y | BP | SEO | max CLS |
   |---|---|---|---|---|---|
   | `/` | 100 | 100 | 100 | 100 | 0 |
   | `/garden/` | 100 | 100 | 100 | 100 | 0 |
   | `/research/` | 100 | 100 | 100 | 100 | 0 |
   | `/research/water-quality/` | 100 | 100 | 100 | 100 | 0 |
   | `/research/number-theory/` | 100 | 100 | 100 | 100 | 0 |
   | `/research/spectral-fractals/` | 100 | 100 | 100 | 100 | 0 |
   | `/rising-water/` | 96 | 100 | 96 | 100 | 0 |
   | `/cv/` | 100 | 100 | 100 | 100 | 0 |
   | `/about/` | 100 | 100 | 100 | 100 | 0 |
   | `/404.html` | 100 | 100 | 100 | 100 | 0 |

   The only failing audit anywhere is `image-aspect-ratio` on `/rising-water/` (known; within budget). Summary: `attempt-4/lighthouse-summary.json`.
4. **Links.** `npm run links` scanned 27 links with 0 failures. Port 4321 was free afterwards.
5. **Visual review.**
   - **Full-page captures:** 10 routes × 375×812, 768×1024 and 1280×800 × light and dark gives 60 PNGs (`attempt-4/<route>-<w>-<theme>.png`). I cut them into 104 review sheets (`attempt-4/sheets/`), opened every sheet, and zoomed where needed.
   - **Stretch states:** 32 shots in `attempt-4/stretch/`, all opened:
     - the four extra hero modes;
     - the islands view with the settings drawer or bottom sheet open;
     - the explorer with the basin mask, place labels and a selected lake.

     Each was taken at 375 and 1280, in light and dark.
   - **Findings:**
     - No overlapping or clipped text, blank or frozen canvas, broken fonts, misalignment, poor contrast, or controls that don't fit.
     - Document horizontal overflow is false in all 60 captures (`pages.json`).
     - Every page had 0 JavaScript errors, 0 third-party requests and 0 failed requests. The only console error is the expected 404 status on the unknown route.
     - Every canvas has pixel variance above 2,000.
     - Elements past the viewport edge (`f9a4-outside.mjs`) are only intentional scrollers: the mobile nav row (F17 design, with an edge fade) and `.lakes__scroll`.
     - GNIS labels don't collide. The basin hatching is visible. The selected lake shows an outline, a label and an info card.
     - One text-joining defect: see Note 2.
6. **Content integrity.**
   - Every rendered fact traces to §3, `src/content/**` or `src/data/*.yaml`. C1 CV facts are [C] (DECISIONS #68). F15, F16 and F17 follow DECISIONS #83.
   - Across the 10 built pages there is no visible TODO, TBD, lorem, placeholder or "Draft" text, and nothing matching a phone number.
   - Production shows 9 Garden items, all `draft: false`.
   - Michael Liu and Yunus Kaya appear only as authors. Tsz Ho Chan appears as coauthor and as the advisor recorded from the CV.
   - There is no footer Claude Code credit (F15).
   - The nav order is Mission · Work · Research · Open science · Garden · Rising water · CV (DECISIONS #83 supersedes §4.3).
7. **TDA correctness** (own oracle, `docs/checks/tools/f9a4-bruteforce.mjs`).
   - **H0 oracle:** add cells in (h, i) order. After each addition, relabel every component with BFS from scratch (no union-find) and apply the elder rule by ≺-minimum cell. Compare the full multiset of (b, d, birthCell, deathCell, mergedInto), zero-length bars included. Also check that, at every distinct level, the component count of {h ≤ t} equals the number of alive bars.
   - **H1 islands oracle (F11):** at every distinct level, run BFS on the land {h > t} using the complementary 8-neighbourhood. Islands are the land components that touch no border cell. Their ≺-maximum cells must equal the engine's alive peaks.
   - **Random grids:** 320 runs (160 grids from 1×1 to 9×9, half with heavy ties, × 4- and 8-connectivity) gave 0 failures, with 313 island bars checked. A mutation test (elder rule and peak rule flipped) produced 357 failures, so the oracle is sensitive.
   - **Fixed cases:**
     - Golden: 5→6 (5,4), 3→8 (3,2), and 1→∞ (cell 1).
     - Checkerboard: 0→1 plus ∞ with 4-connectivity; only ∞ with 8-connectivity.
   - **Colorado** (`f9a4-colorado.mjs`):
     - The grid sha256 matches `barcode.json`.
     - The engine produces 1,217 bars: 1,009 positive finite, 207 zero-length finite, and 1 essential. As sorted triples, they equal both my own union-find and Python `tda_ref.compute_h0`. The concatenated order differs only because I joined `bars` and `zeroLength`.
     - With persistence ≥ 1 m, the engine output equals all 600 `barcode.json` bars, in order, with exact float32 values. The essential bar sits at the global-minimum cell 133025.
     - BFS component counts match the alive bars at 400 percentile levels (0 mismatches).
     - TS islands (2,993 positive + 7 zero-length) equal Python `compute_islands` (3,000).
     - `computeH0` takes 29.9 ms.
8. **Explainer audit (§6.6).**
   - "How to read the barcode" states facts 1–9 almost word for word. The only additions describe the UI: the diagram view, and "(the Min persistence control)".
   - The hero caption matches §6.3.
   - The hero islands explainer (`src/lib/viz/hero/text.ts:23-24`) is exactly the copy Andrew approved (HANDOFF, DECISIONS #81). Its meaning is what my H1 oracle verified.
   - The hero and explorer readouts and strip labels stay within §6.6.
   - Info-card numbers come from the data. For example, Lake 3: "Born at 1,275.7 m near 40.7704° N, 113.6646° W … persistence 395.8 m" matches `barcode.json` and the `meta.json` cell centres.
9. **Performance and budgets.**
   - Page JavaScript, gzip (own import-graph walk, `f9a4_js_budget.py`): `/` 18.2 KB, `/rising-water/` 20.3 KB, other pages 1.7–2.4 KB. All `_astro/*.js` together are 44.4 KB, so even the worst case is under 120 KB.
   - Explorer data is 820,883 B in total, under the 3 MB limit:
     - `grid.f32` 539,856 B and `hillshade.webp` 179,574 B, each within its 600 KB limit;
     - `barcode.json` 33,492 B.
   - CLS is 0 everywhere. Initial compute takes 29.9 ms against a 500 ms limit.
   - Frame time can't be measured on this Mac (Note 1). Hosted CI shows p95 ≤ 22 ms for all five modes.
10. **Data audit** (`f9a4_data_audit.py`, output in `attempt-4/data-audit.json`).
    - **Grid and extremes:**
      - `meta.bbox` equals the §6.4 bbox exactly. The grid is 326×414 = 134,964 cells with no NaN.
      - The minimum is −2.885 m at cell 133025 (31.9454° N, 114.7646° W), at the Colorado delta in the south-west.
      - The grid maximum is 3,697.8 m (lower because of the block minimum). The raw maximum is 4,339.0 m at 38.0708° N, 107.4617° W.
      - NGS datasheet JL0798 places Uncompahgre Peak at 38°04′17.97″ N, 107°27′43.52″ W, 4,365.0 m NAVD 88. GNIS 1867584 gives 38.0714529, −107.4625289. The raw maximum is within about 100 m of the summit and about 26 m lower, which is plausible for a 90 m DSM on EGM2008.
    - **Top lakes:** Lake 3 is born at 40.77° N, 113.66° W, in the Great Salt Lake Desert / Bonneville. That point is in WBD HU-2 16 (Great Basin), a closed basin as §6.4 expects.
    - **Copernicus attribution:** fetched the licence page live. Its "adapted or modified … WorldDEM-90" notice matches `ATTRIBUTION.md` and `meta.licence.requiredNotice` word for word.
    - **WBD mask (F12):**
      - Decoding `basin-mask.bin` gives 97,311 cells, equal to `stats.basinCells`. Plane 1 is 0 outside the basin, and the padding is 0.
      - I point-queried 40 random interior cells against the live USGS WBD HU-2 MapServer. All 40 agree on in/out and on 14 vs 15.
      - The sources cite the WBD 14/15 zips (pubdate 20250108) with sha256 hashes and the USGS credit.
      - The scope matches DECISIONS #78: 14 + 15, confirmed by Andrew.
    - **GNIS labels (F13):** downloaded the 5 cited DomesticNames files (AZ, CO, NV, UT, WY; 114,444 records). All 39 labels match GNIS `feature_id`, exact `feature_name` and `feature_class`, and the unrounded `prim_lat_dec`/`prim_long_dec`. Each grid (x, y) recomputes from the stated rule. 9 labels are anchored at stream mouths.
11. **Hosting.**
    - **Wrangler:** `npx wrangler pages dev dist --port 4321` served the site, and `HEADERS_BASE_URL=http://localhost:4321 npx playwright test e2e/headers.spec.ts` passed 8/8. curl confirmed:
      - a hashed self-only CSP (no `'unsafe-hashes'`), nosniff, Referrer-Policy and Permissions-Policy;
      - `/_astro/*` cached `max-age=31536000, immutable`;
      - `/data/*` cached `max-age=86400, must-revalidate`;
      - an unknown route returns 404 with the custom page.

      Wrangler was stopped afterwards.
    - **Build with SITE_URL:** `SITE_URL=https://andrewchincea.com npm run build` emits that origin in the canonical, the sitemap and the robots `Sitemap:` line. I then rebuilt dist with the default.
    - **Live site** (read-only, browser user agent):
      - `/`, `/rising-water/`, `/garden/`, `/data/colorado/meta.json` and `/sitemap-index.xml` return 200, and `/no-such-page/` returns 404.
      - CSP, nosniff, Referrer-Policy and X-Frame-Options are present.
      - The content is current: the F16 entry and the F17 Garden link are live.
    - **Open, Needs Andrew:** the live canonical and sitemap still use `http://localhost:4321/`. This is unchanged.

## Acceptance criteria (F9)

- Every §11 gate on every page passed. The exception is the environmental local hero timing tests (Note 1), which pass on hosted CI.
- Visual review, every page × 3 widths × 2 themes: ✅ 60 captures plus 32 stretch states, all opened.
- Content audit against §3 and src/content: ✅ (step 6).
- Explainer audit against §6.6, including the approved F11 copy: ✅ (step 8).
- TDA correctness with my own brute force, and JS = Python on Colorado: ✅ (step 7).
- Data audit, including WBD mask and GNIS sourcing: ✅ (step 10).
- Every budget in §7: ✅ (steps 3 and 9).

Blocking fixes: none.

## Notes (non-blocking; owners per §8.2)

1. **The local hero e2e failures are environmental.**
   - On a blank page, headless Chromium's rAF runs at a median of 50 ms (p95 66.7 ms; `f9a4-hero-env.mjs`, `attempt-4/hero-env.json`), so no page can reach p95 ≤ 22 ms here.
   - The 3 reduced-motion failures are a startup race, not autoplay. In my probe all four extra modes stay `paused` with `running=false`, and the render count is fixed at 4 from 300 ms to 5 s. Only the settle frames fall inside the test's 800 ms window.
   - Hosted CI (`gh run view 45557116146`, `5c54ee2`, ubuntu) is green: 177 e2e passed and 8 skipped, including these 8. The Wrangler headers step also passed 8/8.
   - Optional hardening, owner viz-builder: wait for the settle frames before reading `a.frames` in `e2e/hero.spec.ts:918-928`.
2. **Missing spaces before JSX expressions** (owner viz-builder; F6/F12b files). Astro drops the newline before `{…}`, so these render joined:
   - `src/components/explorer/LakesTable.astro:36-37`: expected "…as clicking its bar does. With the basin mask on…", actual "does.With".
   - `src/pages/rising-water/index.astro:126-127`: actual "pipeline/tda_ref.py.Repository".
   - `src/pages/rising-water/index.astro:131-132`: actual "runs in your browser.Source".
   - Repro: `node docs/checks/tools/f9a4-spacing.mjs` with preview on 4321.
   - Fix: add `{' '}` before each expression.
3. **Lighthouse note:** `image-aspect-ratio` on `/rising-water/` (known; best practices 96 is within budget).
4. **Needs Andrew:** set `SITE_URL=https://andrewchincea.com` in the Cloudflare Workers build variables and rebuild. Verify with `curl -s https://andrewchincea.com/ | grep canonical`.
5. **Andrew's call, carried from F16/F17:**
   - The "Personal portfolio" description is in the first person ("for my research") and overlaps "Rising water".
   - At 375 px the nav row scrolls sideways behind an edge fade, so "Rising water" and "CV" start off-screen. This is the F17 design.
6. **Disk is almost full:** about 310 MB free, 100% used. The first multi-run Lighthouse attempt failed with ENOSPC (`attempt-4/lhci-collect.log`). I deleted only my own `.lighthouseci` output and scratch downloads, then reran in foreground batches, which completed. Andrew should free disk before the next `npm run verify`.
7. **Carried CI3 notes:**
   - In 1 of 4,000 synthetic layouts, a rescue slot costs one priority-1 label (`labels.ts:283-290`).
   - The `loadingdone` listener is never removed (`place-labels-client.ts:77`).

## Artifacts

- **Logs** in `docs/checks/F9/attempt-4/`:
  - `gate-{check,lint,unit,pytest,ruff,build,build-siteurl,e2e,links,lhci,headers}.log`;
  - `lhci-collect{,-a,-b}.log`;
  - `wrangler.log`.
- **Results** in the same folder: `pages.json`, `lighthouse-summary.json`, `tda-bruteforce.json`, `tda-colorado.json`, `py-colorado.json`, `data-audit.json`, `js-budget.json`, `hero-env.json`, `spacing.txt`.
- **Screenshots** in the same folder: 60 full-page PNGs; `sheets/` (104); `stretch/` (32 shots, sheets and `log.json`).
- **Tools** in `docs/checks/tools/`: `f9a4-bruteforce.mjs`, `f9a4-colorado.mjs`, `f9a4_py_colorado.py`, `f9a4-hero-env.mjs`, `f9a4-shots.mjs`, `f9a4_sheets.py`, `f9a4-stretch-shots.mjs`, `f9a4_stretch_sheets.py`, `f9a4-outside.mjs`, `f9a4-spacing.mjs`, `f9a4-lhci.cjs`, `f9a4_lh_summary.py`, `f9a4_js_budget.py`, `f9a4_data_audit.py`.
- **Primary sources:**
  - Copernicus COP-DEM licence page (dataspace.copernicus.eu, fetched 2026-11-25);
  - NGS datasheet JL0798 (Uncompahgre Peak);
  - USGS GNIS DomesticNames for AZ, CO, NV, UT and WY (pubdate 20261102);
  - USGS WBD MapServer layer 1 (HU-2).
