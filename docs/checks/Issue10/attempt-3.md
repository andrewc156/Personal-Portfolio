# Check report — Issue #10 candidate 2 — attempt 3

Verdict: PASS.

Gates: check ✅ (171 files, no diagnostics) · lint ✅ · build ✅ · Lighthouse ✅ (six runs) · visual and geometry ✅ · explorer e2e and axe ✅ (54 passed). Unrelated repository gates are outside the scope of this check.

## Lighthouse mobile

Same build, serving, and Lighthouse settings as attempt 1. The image aspect audit passed in all six runs. The hillshade remained the LCP element.

| Candidate 2 | Performance | Accessibility | Best practices | SEO | Simulated LCP (ms) | TBT (ms) | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Light 1 | 96 | 100 | 100 | 100 | 2856 | 2 | 0 |
| Light 2 | 96 | 100 | 100 | 100 | 2853 | 0 | 0 |
| Light 3 | 96 | 100 | 100 | 100 | 2855 | 0 | 0 |
| Dark 1 | 96 | 100 | 100 | 100 | 2854 | 0 | 0 |
| Dark 2 | 96 | 100 | 100 | 100 | 2854 | 0 | 0 |
| Dark 3 | 96 | 100 | 100 | 100 | 2853 | 0 | 0 |

- All six reports meet the /rising-water/ mobile performance budget of 80. The median simulated LCP was 2855 ms light and 2854 ms dark, comparable to the current main baseline (2854 ms in both themes). Total transfer was 776,248 bytes in each run, within the 3 MB budget.
- Observed hillshade paint preceded the grid request by 7–38 ms in all six runs. In the six current-main baselines the grid request started before paint and finished just after it. In the historical light outlier and all six candidate 1 runs, the grid completed before observed paint and modeled LCP was about 5.26 s.
- Lighthouse's installed Lantern code uses the observed LCP time as the cutoff for its paint dependency graph. A fetch that ends before that cutoff can enter the simulated graph. This fits the timing split between the roughly 2.85 s and 5.26 s groups. The specific reason for the historical light trace's higher observed render delay remains unverified.

## Geometry, visual review, and fallback

- Measured the image, map, and overlay against main at 375, 768, and 1280 CSS pixels in both themes on Chromium and WebKit. The canvas rectangle still matches the map exactly. The projected hillshade rectangle changed by at most 0.021 CSS px. Intrinsic dimensions, clipping, and theme filter remained correct. All 12 cases rendered without horizontal page overflow or page errors.
- Reviewed the six Chromium viewport screenshots. The map and surrounding layout rendered at all three widths in both themes.
- Aborted the hillshade request in Chromium and WebKit. In both engines, the explorer reached its ready state and the level control became usable.
- Simulated animation-frame suspension at startup in Chromium and WebKit. The grid request was deferred until frames resumed, after which the explorer became ready. This probe emulates frame suspension as one part of background-tab behavior.

## Explorer suite

`PW_BASE_URL=http://127.0.0.1:4321 npx playwright test e2e/explorer.spec.ts --project=chromium` passed all 54 tests against the candidate Astro preview. The suite includes barcode parity, controls, map interaction, layout and axe, pausing, and the no-JavaScript fallback. Another worktree occupied IPv6 localhost during the initial geometry and e2e attempt. The successful retry used the candidate's explicit IPv4 binding and checked its HTML marker before running e2e.

Artifacts: Lighthouse JSON, static/build/e2e logs, geometry JSON, and screenshots in `/tmp/portfolio-issue-10-metrics/`.
