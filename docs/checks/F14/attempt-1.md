# Check report — F14 Homepage animation toolbar — attempt 1

Verdict: PASS_WITH_NOTES

Gates: check ✅ (0 errors, warnings or hints) · lint ✅ · unit ✅ (799) · pytest ✅ (606) · Ruff ✅ · build ✅ (10 pages) · e2e ✅ (174 preview passes and 8 Wrangler header passes) · axe ✅ · Lighthouse ✅ (100 performance, accessibility, best practices and SEO on both tested URLs) · links ✅ (27) · visual ✅ (16 screenshots) · content ✅ · TDA n/a · data n/a

Checked an isolated candidate based on `aa6b3da`. The six F14 source and test paths matched the main worktree byte for byte at completion.

## Acceptance criteria

1. ✅ **Visible controls above the hero.** Built HTML contains one native select labeled Animation and two triggers for one settings panel. Independent browser geometry put the labeled dropdown and Settings button on one row above the canvas at 320, 375, 768 and 1280 px in both themes, with no overlap or horizontal overflow and 44 px high controls. The dropdown lists Rising water, Dye spill, Fractal pond, Random rivers and Collatz delta.
2. ✅ **Animation selection and fallback.** Production Playwright and the checker browser probe initialized a direct Dye spill link, selected each mode from the visible dropdown and returned to Rising water via Reset. Lazy loading and offscreen, hidden tab and reduced motion behavior passed the full browser suite. With JavaScript disabled, the static terrain is visible and the two toolbar controls remain disabled.
3. ✅ **Shared settings state and keyboard use.** Enter on the Settings button and Space on the header gear opened the same panel. Both `aria-expanded` attributes tracked its state, the panel heading received focus on open, and Escape or the close button restored focus to the trigger that opened it. A reload restored open or closed state as expected. The panel still supplies the barcode and islands views, and both production islands tests passed.
4. ✅ **Browser presentation and accessibility.** Reviewed all 16 captures via four contact sheets. The closed toolbar is legible and fits, desktop opens a side drawer and mobile opens a bottom sheet, and no canvas was blank. The independent axe probe found zero violations in all eight open configurations. Existing axe checks also passed with the panel closed in both themes.
5. ✅ **Performance and origin.** Lighthouse mobile ran four times per URL. The median after warm-up was 100 in each category for `/` and `/?mode=rivers&seed=42`, with CLS 0 and 0.029804 respectively. In 45 direct-load samples spanning all five modes, maximum CLS was 0.028021 at 375 px, 0.022931 at 768 px and 0.039080 at 1280 px, all below 0.05. Five existing assertions for p95 animation frame time ≤22 ms passed at 1280×800. All emitted JavaScript files together total 45,282 gzip bytes, below the 120 KB per-page ceiling. The checker probe recorded no page errors or requests to third-party origins.
6. ✅ **Hosting and CSP.** Wrangler Pages preview passed all eight header tests. An independent toolbar smoke check under the served CSP exercised all five modes, both triggers, keyboard focus, persistence and Reset with zero CSP violations. The custom 404 and security headers passed. Linkinator scanned 27 internal links with no failures.
7. ✅ **Content.** The only new visible control labels are Animation and Settings. All ten built HTML pages passed the forbidden-copy probe and full browser content checks.

## Notes

- Direct links to an alternate mode still produce a measurable layout shift when the animation chrome updates. The highest observed value, 0.039080, was below the 0.05 budget.
- Browser and rendering measurements used Chromium. No separate Firefox, Safari or iOS run was available in this environment.

Artifacts: `docs/checks/F14/attempt-1/` contains the 16 PNG screenshots, four contact sheets, Lighthouse summary, direct-load CLS, browser, header and gate logs. Reproduction scripts are `docs/checks/tools/f14-*` and the existing `f10-retry-cls.mjs`. Full Lighthouse JSON and HTML remain in the isolated snapshot under `attempt-1/lh/`.
