# Check report — CI3 Explorer place labels robust to font metrics — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check ✅ (146 files, 0/0/0) · lint ✅ · unit ✅ (27 files, 811) · pytest ✅ (606) + ruff ✅ · build ✅ · e2e ⚠️ 167 passed / 10 failed / 8 skipped (all 10 failures are in e2e/hero.spec.ts, and are environmental: see Note 1; all 45 explorer tests pass, including the 8 new 320/375/768/1280 × light/dark separation tests) · axe ✅ (part of e2e) · lighthouse ✅ /rising-water/ perf 96 · a11y 100 · BP 96 · SEO 100 · CLS 0; / perf 100 · 100 · 100 · 100 · CLS 0 · links ✅ (27 internal, 0 broken) · visual ✅ · content n/a · tda n/a · data n/a (GNIS credit verified)

Scope: uncommitted diff to labels.ts, PlaceLabels.astro, place-labels-client.ts and e2e/explorer.spec.ts, plus new label-metrics.test.ts and place-label-widths.json. Nothing was modified outside docs/checks/, and the working tree was not changed. HEAD comparisons ran in a throwaway copy under ~/.hermes/cache/scratch, which has since been deleted.

## Acceptance criteria
1. **All 14 P1 labels placed at 320/375/768/1280 under Plex, DejaVu Sans Bold, Verdana, Arial, and with Plex blocked (fallback stack): ✅.** I used my own probe, `docs/checks/tools/ci3-probe.mjs`, on preview :4321. It covered 80 runs (5 fonts × 4 widths × light/dark × mask on/off). Every run had P1 14/14 and 0 geometry issues. CDP reported "IBM Plex Sans SemiBold" for the site default, and DejaVu was a data-URL @font-face of DejaVuSans-Bold.ttf 2.37. Placed totals were: 320: 22 (Plex) / 20 (DejaVu, Verdana) / 21 (Arial) / 22 (blocked). 375: 25 / 24 / 24 / 25 / 25. 768: 35/34/34/35/35. 1280: 32/33/32/32/32. Light/dark and mask on/off were identical. The 39 widths I measured match the builder's fixture to ≤0.01 px. DejaVu/Plex = 1.22×.
   - Linux caveat: no Docker or Linux VM is available here, so "Linux-like" means DejaVu Bold forced in Chromium on macOS. After this change the placards use self-hosted Plex on Linux too. DejaVu only matters if Plex fails to load, which the forced-DejaVu runs cover. Hosted CI is the final confirmation.
2. **Separation, bounds and leaders: ✅.** The probe checks the rendered SVG independently:
   - in-bounds;
   - strict rect overlap;
   - marker (r + 0.75) under another placard;
   - exact Liang–Barsky leader/placard crossing;
   - each leader ends on its own placard;
   - rect width = ceil(textLength) + 8 (no stale widths).

   All 80 runs had 0 violations. Longest leader in the browser runs: 50 px (Grand Canyon, DejaVu at 320). Las Vegas is at x = 3 with a 7 px leader at 320 (all fonts) and with DejaVu/Verdana at 375; its leader is 34 px with Plex/Arial at 375. I opened all 10 screenshots: 320/375 × light/dark × mask on/off in Plex, plus DejaVu at 320 and 375 (light, mask on). No overlap, clipping, hidden marker, crossing leader or contrast problem. Las Vegas is present in every one.
3. **Unchanged where HEAD succeeded: ✅ on real data.** My harness `docs/checks/tools/ci3-compare.test.ts` runs HEAD `labels.ts` beside the new one on real labels.json positions. It covered my 5 measured width tables × layer widths 250–1300 px (step 3) × scale 0.9–1.3: 8,775 cases.
   - In all 7,943 cases where HEAD placed every P1 label, the output was byte-identical.
   - The new code never placed fewer P1 labels than HEAD.
   - The independent geometry checks passed in every case.
   - The new code misses P1 in only 16 cases, all at layer widths 250–265 px (viewport < 300, below the supported 320 px).
   - In 4,000 random synthetic layouts, every one of the 3,400 cases where HEAD succeeded was identical, and output did not depend on input order. See Note 2 for one synthetic regression.
4. **New tests are meaningful: ✅.** In the temp copy with HEAD `labels.ts`, label-metrics.test.ts has **10 of 12 failing**: every 320 px case, the 375 px DejaVu / ×1.2 / ×1.05 cases, the 320–440 px sweep (37 misses) and both synthetic cases. Only the widths-present test and 375 px Plex ×1 pass. With the new `labels.ts`, all 96 explorer unit tests pass. (The builder report says "11 tests, 8 of 11 fail"; the file actually has 12 tests and 10 fail. This is a cosmetic report error.)
5. **No CLS, GNIS intact: ✅.** `layout-shift` was 0.0000 across all 10 screenshot sessions and through label toggling. Lighthouse CLS is 0 on /rising-water/. No horizontal overflow and no console errors. The credit "Place names and coordinates: Geographic Names Information System (GNIS) courtesy of the U.S. Geological Survey" is present, and the "GNIS Domestic Names data" and "USGS FAQ on GNIS coordinates" links are intact. The status line reads "N of 39 place labels shown…".
6. **Fonts and CSP: ✅.** `docs/checks/tools/ci3-csp.mjs` injected the built dist/_headers CSP (`font-src 'self'`) and ran 320/375/1280 × light/dark with labels on. It found 0 CSP violations and 0 console errors. Every request went to http://localhost:4321. The only fonts fetched were the 3 existing self-hosted Plex woff2 files (sans 400/600, mono 400), so no new font file is downloaded. The computed placard family starts with "IBM Plex Sans".
   - Relayout on font swap: `ci3-latefont.mjs` turned labels on, then swapped in a late webfont face without toggling. Layout followed, with 0 stale rects and P1 14/14 (320: 22→20 placed; 375: 25→24, width sum 2047→2316).
   - A real held-back Plex can't be staged: the explorer keeps its controls disabled until `load`, so labels can't be turned on before Plex 600 arrives. The relayout is defence in depth.

## Blocking fixes
None.

## Notes (non-blocking)
1. **Hero e2e failures are environmental, not CI3, and AC power did not fix them.** The 10 failures were:
   - five p95 frame-time tests at 66.7 ms (limit 22);
   - "pauses in a hidden tab" (3 frames vs 2);
   - four reduced-motion frame counts (3 vs 2).

   Rerunning that subset gave 8 failures and 3 passes; it's flaky. A blank page in the same headless Chromium shows rAF median 33.4 ms and p95 66.7 ms (`docs/checks/tools/ci3-raf.mjs`). So rAF itself is throttled on this machine even on AC power, with Low Power Mode off. The likely cause is display sleep or occlusion. CI3 doesn't touch any hero file. To judge hero frame times, run them with the display awake or on hosted CI.
2. **Synthetic edge case, `src/lib/viz/explorer/labels.ts:283-290`.** One of 4,000 random layouts (seed 1100: W 411, 19 P1 labels) places fewer P1 labels than HEAD (12 vs 13). Attempt 0 already includes rescue slots: a rescued label can take space that HEAD gave to a later P1 label, and no retry recovers it.
   - A possible hardening: also compute a no-rescue pass and keep it when it has fewer missing labels.
   - It doesn't affect the published labels at any tested width or scale.
3. **Rescue leaders can be long in fringe metrics.** In the real-data sweep, leaders over 50 px appear only at a 286–301 px layer (viewport 320–335) with widths ×1.1 or more: Great Divide Basin 95 px, and Las Vegas 70 or 95 px. With the actual measured metrics, the maximum is 50 px. This is acceptable, but if the P1 set grows, check it visually.
4. `place-labels-client.ts:77` adds a `document.fonts` `loadingdone` listener and never removes it. That's harmless with one explorer per page and no client router.
5. The builder's report miscounts the new test file (see criterion 4).

## Artifacts
- docs/checks/CI3/probe.json (80 runs) and docs/checks/CI3/widths.json (my measured widths)
- docs/checks/CI3/attempt-1/labels-{320,375}-{light,dark}-{mask,nomask}-plex.png and labels-{320,375}-light-mask-dejavu.png (gitignored)
- docs/checks/CI3/e2e.log and docs/checks/CI3/lhci.log; Lighthouse JSON in .lighthouseci/
- Tools: docs/checks/tools/ci3-probe.mjs, ci3-shots.mjs, ci3-latefont.mjs, ci3-csp.mjs, ci3-raf.mjs, ci3-compare.test.ts (run it in a repo copy with `labels-old.ts` = `git show HEAD:src/lib/viz/explorer/labels.ts` and `ci3-widths.json` = widths.json)
- Port 4321 left free. The :4411 dev server was untouched.
