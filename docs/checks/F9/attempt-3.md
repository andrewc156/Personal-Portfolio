# Check report — F9 Final audit — attempt 3

Verdict: PASS_WITH_NOTES

Audited the integrated site after F9 fix round 2, including the C1 CV content. Fresh full-site checks ran on macOS with Node 26.13.0 and Chromium.

Gates: check ✅ (0 diagnostics, 120 files) · lint ✅ · unit (462) ✅ · pytest (294) ✅ · Ruff ✅ · build ✅ (default and SITE_URL) · e2e ✅ (125 passed, 8 skipped on preview; headers 8/8 passed against Wrangler) · axe ✅ · Lighthouse ✅ · links ✅ (27) · visual ✅ (60 reviewed) · content ✅ · TDA ✅ · data ✅ · hosting ✅

## Gate results

1. **Static checks.** `npm run check`, `npm run lint`, `npm test`, `pipeline/.venv/bin/python -m pytest pipeline -q`, and `pipeline/.venv/bin/ruff check pipeline` passed. Results were 0 Astro diagnostics, 462 unit tests, and 294 Python tests.

2. **Build and browser.** `npm run build` produced all 10 routes. The full production Playwright suite passed 125 tests with 8 Wrangler-only tests skipped. The separate Wrangler suite passed all 8. The former mobile navigation and OwlPath assertions now pass. Font-delay CLS tests passed on `/`, `/garden/`, `/cv/`, and `/rising-water/`.

3. **Lighthouse.** Four runs per route, discarding one warm-up. All ten audited routes met their budgets. Median scores were 100 in every category on nine routes. `/rising-water/` scored 96 performance, 100 accessibility, 96 best practices, and 100 SEO. Maximum CLS was 0.0000 on every route. The explorer's `image-aspect-ratio` audit is a non-blocking Lighthouse note. Full medians are in `lighthouse-summary.txt`.

4. **Links.** `npm run links` scanned 27 links without failures.

5. **Visual review.** Captured all ten routes at 375×812, 768×1024, and 1280×800 in both themes. I opened six contact sheets covering all 60 screenshots. Pages had no horizontal overflow, clipped content, broken fonts, blank canvas, JavaScript errors, or third-party requests. Geometry data is in `pages.json`.

6. **Content integrity.** The CV and page content match the supplied CV and documented project facts. The OwlPath link from the supplied CV appears in its project entry. All ten pages have no visible TODO, TBD, lorem, placeholder, draft badges, or phone links. No references section or private contact digits appear in the source, tests, reports, or rendered site. Collaborators appear only as coauthors.

7. **TDA correctness.** The independent prefix-by-prefix BFS oracle agreed with the engine on 128 random tied and tie-free grids in 4- and 8-connectivity. Golden and checkerboard cases passed. On the Colorado grid, TypeScript matched all 600 published bars in order and values. The sorted independent comparison matched all 599 finite bars at least 1 m. The Python reference agrees with the independent result after sorting. TypeScript `computeH0` measured 28.4 ms.

8. **Explainer and data.** TDA explanations were checked against §6.6 in F9 attempt 1 and have not changed. The current values trace to the data files. The grid is 326×414, the bbox equals §6.4, and the grid hash matches the reference barcode. Minimum, summit location, lake geography, and Copernicus attribution were verified in the earlier F9 audit against USGS GNIS and the Copernicus licence page. Assets are within their 600 KB limits.

9. **Performance and hosting.** Page JavaScript gzip, map transfer, and frame-time measurements meet §7 budgets. Wrangler served the production build with the required CSP, cache and security headers. The unknown route returned the custom 404 and status 404. A `SITE_URL=https://portfolio.example` build emitted that origin in canonical URLs and the sitemap.

## Notes

- Lighthouse reports an `image-aspect-ratio` best-practices audit on `/rising-water/`, while the route scores 96 and meets the required budget.
- The F9 attempt-2 Python comparison initially reported an ordering-only mismatch. The sorted comparison passed and the discrepancy is documented in that report.

Artifacts: `docs/checks/F9/attempt-3/`, including 60 screenshots, six reviewed contact sheets, `pages.json`, and `lighthouse-summary.txt`. Historical source checks and primary references are documented in `docs/checks/F9/attempt-1.md` and `docs/checks/F9/attempt-2.md`.
