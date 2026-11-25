# Check report — F11b Islands barcode (stretch S2) — attempt 2

Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit ✅ (795) · pytest ✅ (606) · Ruff ✅ · build ✅ (10 pages) · e2e ✅ (166 passed, 8 Wrangler-only skips) · axe ✅ · Lighthouse ✅ (100 performance/accessibility/best practices/SEO, CLS 0) · links ✅ (27) · visual ✅ (18 screenshots) · content ✅ · TDA ✅ · data n/a

Checked the isolated F11b attempt-2 candidate on accepted main `d11e026`.

## Acceptance criteria

1. ✅ **Visible approved copy.** In all six viewport/theme combinations, my production probe closed settings and compared the displayed caption with the full islands explanation approved in DECISIONS #81. The Colorado River Basin link remained visible and pointed to `/rising-water/`. The six caption captures confirm the text and link fit at 375, 768 and 1280 px in both themes. Run `sh docs/checks/tools/f11b-r2-preview.sh browser`.
2. ✅ **Caption restoration.** The new browser regression passed. Hiding and showing the selected islands strip restores the lake or island caption as appropriate. Switching to Fractal pond hides the explorer link and shows the pond caption. Switching back preserves the Islands selection and restores its caption and link. Changing to either lake view or resetting returns the original lake caption. The no-JavaScript probe confirmed the static hero, lake caption and explorer link.
3. ✅ **Math and rendering.** The checker-owned high-set BFS in `docs/checks/tools/f11b-bfs.mjs` agreed with H1 on every peak, saddle, parent and level across 144 grids in both complementary connectivities and the tied 3×3 cone. For seed 42, the six production probes matched sampled canvas rectangles at 72% and 100% water, filtered row geometry and pause summaries to the independently sorted engine rows. They found 23, 91 and 73 positive intervals at the three widths, with 10, 17 and 17 displayed after the default filter and cap.
4. ✅ **Controls and accessibility.** Settings selection preserves the strip height and exposes the islands explanation through the canvas description. Probe keyboard and pointer inspection worked. Axe found zero serious or critical findings in the checked light/dark settings and closed-strip states. Reduced motion paused playback. The full 166-test preview run was clean, including the prior transient basin-mask hash assertion and the existing extra-mode tests.
5. ✅ **Performance and stability.** The independent 300-frame playback probe measured rAF p95 of 16.70 ms at 1280×800, within 22 ms, and no off-screen draws over 400 ms. The default homepage references 15,305 gzip bytes of JavaScript. Its lazy extra modes were absent from initial HTML and all four Lighthouse runs. Mobile Lighthouse scored 100/100/100/100 every run with CLS 0. Across 45 cold Chromium loads, the maximum direct-mode CLS was 0.037715 at 375 px, 0.028882 at 768 px and 0.045173 at 1280 px. All were below 0.05.
6. ✅ **Visual and content.** Reviewed contact sheets covering the 18 captures at 375×812, 768×1024, and 1280×800 in light and dark. The panel help fits when scrolled into view. The islands strip, text, endpoint markers and explorer link are legible with settings closed. Probes found no horizontal page overflow, page errors or third-party requests. The ten built pages passed the unfinished-copy and draft scan, and Linkinator scanned 27 internal links successfully. The islands wording follows the approved explainer and its displayed numbers trace to the engine.

## Notes

- The worst direct-mode CLS remains 0.045173 at desktop, close to the 0.05 budget and consistent with F10. Keep the cold direct-mode check in the integrated audit.
- The browser and performance metrics are from Chromium. Wrangler-specific checks were skipped by the preview suite and are outside this hero caption change.

Artifacts: `docs/checks/F11b/attempt-2/` contains the four contact sheets and logs for static gates, Playwright, Lighthouse, links, the independent canvas and BFS probes, and direct-link CLS. The full PNGs and raw Lighthouse reports are local artifacts. Reproduction tools are in `docs/checks/tools/f11b-r2-*` and `docs/checks/tools/f11b-bfs.mjs`.
