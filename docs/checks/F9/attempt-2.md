# Check report — F9 Final audit — attempt 2

Verdict: FAIL

Audited: integrated main at be62c1e, with the checked C1 content and F9-R1 changes. Machine: macOS, Node 26.13.0, Chromium.

Gates: check ✅ (0 diagnostics, 120 files) · lint ✅ · unit (462) ✅ · pytest (294) ✅ · ruff ✅ · build ✅ (default and SITE_URL production) · e2e ❌ (123 passed, 8 skipped, 2 failed) · axe ✅ in passing suites · Lighthouse ✅ (all budgets) · links ✅ (27 passed) · visual ✅ (60 screenshots reviewed) · content ✅ · TDA ✅ · data ✅ · hosting ✅

## Gate results

1. **Static.** `npm run check`, `npm run lint`, `npm test`, `pipeline/.venv/bin/python -m pytest pipeline -q`, and `pipeline/.venv/bin/ruff check pipeline` all passed. Vitest reports 462 tests and pytest reports 294.

2. **Build and browser.** `npm run build` produced ten routes. The browser suite had 123 passes, 8 hosting skips, and 2 failures. The skips are `e2e/headers.spec.ts`, which requires Wrangler. The failures are blocking:
   1. `e2e/shell.spec.ts:232` expects all six navigation links to be fully in the viewport at 375 px. The mobile nav is horizontally scrollable and its final links are initially offscreen. Reproduce with `npx playwright test e2e/shell.spec.ts -g 'nav stays usable on mobile'`. Update the assertion to verify scroll interaction and keyboard reachability.
   2. `e2e/site.spec.ts:585` cannot find an OwlPath link inside `[data-id="project-owlpath"]` on one of `/garden/` and `/cv/`, despite the project link rendering on both pages. Reproduce with `npx playwright test e2e/site.spec.ts -g 'OwlPath links'`. Scope assertions to the rendered link markup and verify both destinations.

3. **Lighthouse mobile.** One warm-up plus three measured runs on ten routes. Every median performance, accessibility, best-practices and SEO score meets its budget. Home and content route CLS max was 0.0000. `/rising-water/` median performance was 82, accessibility 100, best-practices 96 and SEO 100. The deliberate `image-aspect-ratio` audit is the sole weighted best-practices note on that route. Full summary is in `lighthouse-summary.txt`.

4. **Links.** `npm run links` scanned 27 links with no failures.

5. **Visual.** Captured all ten routes at 375×812, 768×1024 and 1280×800 in light and dark. Opened contact sheets covering all 60 images and reviewed the home mobile screenshot. There was no horizontal overflow, blank canvas, clipped page content, broken font, or console error. Mobile navigation has horizontal scroll, as noted in the failing e2e expectation. Geometry data and screenshots are in this attempt folder.

6. **Content integrity.** Integrated pages contain no visible TODO, TBD, lorem, placeholder or draft badges. The supplied CV content and OwlPath project link are represented. The C1 report found no personal phone digits in source, tests, reports, or rendered pages. The F9 screenshot run recorded no third-party requests.

7. **TDA correctness.** `docs/checks/tools/f9-r1/bfs.mjs` compared the engine with an independent prefix-by-prefix BFS oracle on 128 random grids in 4- and 8-connectivity, including tied heights, and reran the golden and checkerboard examples. All passed. On the Colorado grid, TypeScript matched all 600 reference bars and the independent union-find pairs. A sorted comparison of Python and independent union-find also matched all 599 finite bars at least 1 m. The first comparison script had an ordering-sensitive check and printed a false mismatch before sorting; the corrected comparison passed. TS `computeH0` took 28.4 ms.

8. **Explainer.** The F9 attempt 1 audit checked every hero and explorer TDA sentence against §6.6. F9-R1 did not change the explanations. Current numbers were traced to `meta.json` and `barcode.json`.

9. **Performance and data sizes.** Screenshot probes recorded maximum page JavaScript gzip of 16,226 bytes, zero page overflow, zero browser errors and zero external requests. The Rising water route transferred below the 3 MB budget in the accepted F6 audit. Colorado assets are within their 600 KB limits. Existing F5/F6 frame-time evidence is recorded in their accepted check reports.

10. **Data audit.** Grid dimensions are 326×414 and `meta.bbox` matches the spec. The global minimum, summit coordinates, lake geography and licence text were audited in F9 attempt 1 and remain unchanged. The raw grid hash agrees with `barcode.json`; TS output matches the reference in order and exact heights.

11. **Hosting.** Wrangler served the built site with required CSP and security headers. An unknown route returned HTTP 404 and the custom site page. A production build with `SITE_URL=https://portfolio.example` emitted that origin in the canonical URL and sitemap.

## Blocking fixes

1. `e2e/shell.spec.ts:232`. The test expects each nav link in the initial 375 px viewport, while the horizontal scroller exposes later links by scrolling. Verify that the scroller works by keyboard and links can be brought into view. Reproduce with the command in gate 2.
2. `e2e/site.spec.ts:585`. The OwlPath test uses a selector that does not resolve on one tested route. Locate the actual project link and assert its href on both Garden and CV. Reproduce with the command in gate 2.

Artifacts: `docs/checks/F9/attempt-2/`, including 60 screenshots, `pages.json`, Lighthouse results, browser logs, Colorado comparison logs and Wrangler responses.
