# Check report — F11b Islands barcode (stretch S2) — attempt 1

Verdict: FAIL

Gates: check ✅ · lint ✅ · unit ✅ (795) · pytest ✅ (606) · Ruff ✅ · build ✅ (10 pages) · e2e ✅ (165 on clean production rerun, 8 Wrangler-only skips) · axe ✅ · Lighthouse ✅ (100 performance/accessibility/best practices/SEO, CLS 0) · links ✅ (27) · visual ✅ (13 screenshots) · content ❌ (caption describes the wrong barcode) · TDA ✅ · data n/a

Checked the isolated F11b candidate on top of accepted F12b commit `f0060bb`.

## Acceptance criteria

1. ✅ **Engine agreement.** A checker-owned oracle removes successive flooded cells in ascending (height, index) order and relabels dry components from scratch with BFS. It identified the same peak, cutoff, parent, birth and death as the engine for 144 random grids in both complementary connectivities, including ties and zero-length intervals. The tied 3×3 cone independently gives an island from level 1 to 3. Run `node docs/checks/tools/f11b-bfs.mjs`.
2. ✅ **Displayed geometry and live counts.** At 375, 768 and 1280 in both themes, seed 42 yields respectively 23, 91 and 73 positive engine intervals. The view displays 10, 17 and 17 after the 10 m persistence threshold and 30-bar cap. An independent sort agrees with the controller rows, and recorded production canvas rectangles agree with the independently projected intervals at 72% and 100% water level. Paused summaries agree with the engine's live count and displayed rows.
3. ✅ **Interaction, defaults and accessibility.** The production test confirms keyboard inspection, filtering, fixed strip size, and return to both original lake views. The independent probe also confirms pointer inspection, pause under reduced motion, clean axe results in both themes with islands selected in the panel or strip, and the static hero with JavaScript disabled. The full browser suite verifies the original mode selector and mode regressions.
4. ❌ **Copy.** The settings prose exactly matches the approved DECISIONS #81 wording and is referenced by the canvas description. When the settings panel is closed, the visible figure caption still says that the displayed barcode records each lake's lifetime. The new value switches the canvas to island intervals without updating the caption.
5. ✅ **Performance and stability.** At 1280×800, 300 frame intervals have p95 16.70 ms with the islands strip playing. After scrolling away, no frames draw over the next 400 ms. All six visual configurations have zero page overflow and no console errors or foreign requests. Default-home referenced scripts total 15,158 gzip bytes. The extra-mode chunk stays out of initial HTML and Lighthouse requests. Four mobile Lighthouse runs scored 100 across all four categories, with CLS 0 in all runs. Across 45 fresh direct-mode loads, max CLS was 0.037715 at 375, 0.028882 at 768 and 0.045173 at 1280, all below 0.05.
6. ✅ **Visual and site regression.** Inspected the islands strip and settings at 375×812, 768×1024 and 1280×800 in both themes, plus a mobile close-up of the approved settings copy. Canvas and labels are legible, and the settings and strip fit. The full production suite checked content hygiene, links to the other views and the absence of draft/placeholder text. The separate link crawl scanned 27 internal links.

## Blocking fixes

1. `src/components/hero/hero-client.ts:147–156` only updates the figure caption by animation mode. `src/components/hero/Hero.astro:78–83` renders that caption directly below the active strip. Expected: selecting Islands barcode presents the approved islands explanation in the visible caption and preserves the explorer link, with the lake caption restored on the other Rising water views or reset. Actual: after closing settings the canvas is labelled “Islands barcode” but the caption says “the barcode records each lake's lifetime.” Reproduce on preview at `/?seed=42`: open Art settings, set Barcode → View to Islands barcode, close settings and read the caption. The checker repro is `node docs/checks/tools/f11b-caption.mjs http://localhost:4321`. Recheck restoration when returning from an extra mode, plus direct-mode CLS and mobile layout after changing the caption.

## Notes

- The first full run finished with 164 passes, 8 hosting-only skips and an existing F12b mask test timeout at `e2e/explorer.spec.ts:666`. The trace shows the checkbox uncheck action completed after reload, with the expected off state timing out. Explorer test/source files are byte-identical on baseline and candidate. The candidate's explorer entry script matches after normalizing shared asset names. The test passed in all five isolated repeats on each snapshot and on the clean full rerun. Cause of the single timeout was not established.
- Browser and performance measurements are Chromium results. The eight Wrangler-specific tests are outside this hero feature's hosting scope.

Artifacts: `docs/checks/F11b/attempt-1/` contains static, e2e, Lighthouse, links, BFS, CLS, canvas and caption logs, 13 PNGs and contact sheets. Checker probes are under `docs/checks/tools/f11b-*`. Large browser traces and raw Lighthouse files are local snapshot artifacts.
