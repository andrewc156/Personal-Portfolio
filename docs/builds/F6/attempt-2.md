# Build report — F6 Colorado explorer — attempt 2

Summary: I fixed the blocking defect from docs/checks/F6/attempt-1.md. The explorer is now created only after every check passes: byte length, then SHA-256, then the comparison of the live barcode with barcode.json. If any check fails, the page shows a polite visible error and logs exactly one `console.error`. It draws nothing: no controller, the controls stay disabled, the readouts stay at "–", and the map shows only the hillshade. Two new e2e tests cover this, using `page.route` on grid.f32. I also handled the four non-blocking notes:
- main-thread yields between steps, plus a hillshade preload;
- square map corners, so every cell can be seen and hovered;
- an accurate lede;
- exact test counts.

Files changed:
- `src/components/explorer/explorer-client.ts`
  - `load()` now runs in order: fetch → byte check → SHA-256 → decode → `computeH0` → `compareBarcode` → controller.
  - It yields (`scheduler.yield()`, or `setTimeout 0`) between steps.
  - It stops at the first failed check, in the new `reject()`. That function logs one console.error and shows the error status ("The elevation data failed its integrity check (…), so the live map and barcode are not shown. The table and the sections below come from the published files."). It never creates or wires the controller.
  - The old "The map shows the live computation" text is gone. The `fail()` copy (load error) was reworded the same way.
  - `data-match` is now `"true"`, `"false"` or `"error"`, and `data-ready="true"` is set only once the explorer is running.
- `src/lib/viz/explorer/data.ts`: `decodeGrid` takes a fast path on little-endian platforms (one buffer copy); the DataView fallback is kept.
- `src/components/explorer/Explorer.astro`
  - The readouts and the level output render "–" until verified data exist. Before, the level showed the grid minimum.
  - The stage has square corners and no clipping radius.
- `src/pages/rising-water/index.astro`
  - New lede: "The water on the map and the barcode are computed in your browser from the same 326 × 414 elevation grid; the shaded relief under the water is precomputed."
  - New `<link rel="preload" as="image" type="image/webp" fetchpriority="high">` for the hillshade, in the layout's head slot. The `<img>` already has `fetchpriority="high"` and explicit width and height.
- `e2e/explorer.spec.ts`: new describe block "explorer: corrupted grid is rejected", with 2 tests:
  - (a) the low mantissa bit of cell 70000 (byte 4·70000, XOR 0x01), so only the hash fails;
  - (b) the exponent byte of lake 3's pit (byte 4·17991+3, XOR 0x40), so a bar changes.
  - Each asserts: the error status is visible with `role=status` and `data-kind=error`; exactly one console error; Play, the level slider and the table buttons are disabled; all four readouts are "–"; 0 painted pixels on the overlay canvas; no `__explorer`; `data-ready="false"`.

How to verify:
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 15 files, 439 tests passed. `tests/unit/viz/explorer` has 5 files and 66 tests (unchanged).
- e2e/explorer.spec.ts now has **21** tests (attempt 1 had 19; the checker's count was right and my report's 23 was wrong):
  - 2 load tests;
  - 2 corrupted-grid tests;
  - 7 interaction tests;
  - 2 motion tests;
  - 6 layout/axe tests (3 widths × 2 themes);
  - 1 DPR test;
  - 1 "About the data" test.
  - I didn't run it (checker only).
- I ran section B of the checker's `docs/checks/tools/f6_behaviour.mjs` unchanged, apart from the port (4406) and the import path, against `npx astro dev --port 4406`. Both variants: `match=false`, status visible, `role=status`, exactly 1 console.error, `hasEx=false`, Play disabled, lakes readout "–", 0 painted map pixels. **fails 0** (attempt 1: 2 FAIL).
- The dev server is stopped and port 4406 is free.

Acceptance criteria (self-check):
1. ✅ §6.4 works; the corrupted-grid fix is above. I re-ran my attempt-1 probes on the normal path:
   - **Reduced motion:** paused at 0.45, Play button shown.
   - **Off-screen:** frames stay 319 → 319, running=false, then it resumes.
   - **Hidden tab (emulated):** running=false.
   - **Keyboard:** Space, ↓ (selects), Esc and Home work.
   - **Hover:** elevation in m and ft plus lat/lon.
   - **Units:** switching to ft changes the readouts and the table ("1,299 ft" for lake 3).
   - **Console:** 0 errors.
   - **Corner cells:** all 4 corner cells are now hoverable. At 375: cells 0, 325, 134638, 134963, and `elementFromPoint` at the corners hits the canvas. At 1280 the top corners (0, 325) are hoverable; the bottom ones were below the 900 px viewport.
2. ✅ The live barcode equals barcode.json (unchanged): unit tests on the real grid, and the page status reads 600/600.
3. ✅ Bar click and table button (unchanged): the lake 3 card matches docs/data.md, and the lowest lake never merges.
4. ✅ The copy uses only §6.6. "About the data" is generated (unchanged). The lede no longer says the whole map is computed in the browser.
5. ✅ The map box aspect is 0.62890 / 0.62888 / 0.62889 at 375 / 768 / 1280, against meta 0.6289. `scrollWidth == clientWidth` at all 3 widths in both themes. Screenshots: `docs/builds/F6/screens/{v,sel,diag}-{375,768,1280}-{light,dark}.png`. CLS is 0.00004 at 375 and 0.00013 at 1280.
6. ⚠️ Lighthouse is checker-only. Changes aimed at headroom:
   - The work is split into 5 tasks with yields between them: hash (async), decode (one copy), `computeH0`, compare, then setup and first frame.
   - The heaviest single task is `computeH0`: 17.3–17.5 ms unthrottled and 62.8 ms at 4× CPU. Setup and first frame take 11.8 ms, and 44.1 ms at 4×.
   - Loading still starts after `load` plus `requestIdleCallback`, so after the hillshade, the likely LCP element, has loaded.
   - The hillshade is now preloaded with high priority from the head.
   - During play, the rAF p95 is 16.7–16.8 ms and `render()` p95 is 1.2–1.4 ms (2.1 ms max at 4×).
   - Data and JS are unchanged (about 0.76 MB over the wire per the checker; JS about 16 KB gzip). There are no third-party requests.

Needs Andrew: the repository URLs, if the "Code" section should link out (unchanged from attempt 1).

Requests to Control: none.

Known limitations:
- **Hash failure ends the checks early.** When the SHA-256 check fails, the barcode comparison is skipped, because nothing is computed from an unverified grid. The error names the failed check rather than a bar count. If Web Crypto isn't available (only on a non-secure origin), the hash check is skipped. The byte-length check and the full barcode comparison still gate the explorer.
- **Square corners.** The map now has square corners inside a 1 px border, a small visual change from the rounded cards around it.
- **Lighthouse variance.** Lighthouse's LCP estimate for the 180 KB hillshade may still vary between runs. I didn't change the data files, as instructed.
- **Best-practices audit.** `image-aspect-ratio` is still flagged, because the hillshade is deliberately stretched by cos(lat) (BP 96, checker note 3).
- **Hidden tab.** Still tested only by emulating `visibilityState`.
