# Final audit summary, for Andrew (F9, attempt 1)

(Written by the F9 checker; saved by Control because the checker could not write this file. Note: the "What needs you" list below predates your CV upload. Most of those items are now answered and are being applied in task C1.)

**Verdict: FAIL, with one fix needed.** On Linux the page layout jumps when the site's font loads, and that is what turns GitHub's CI check red. The fix is small and belongs to the site-builder. Everything else passed.

## What's built
- **Home (/)**: an animated "Rising water" hero with a live barcode and an art-settings panel, then Mission, Recent work, Research cards and Open science.
- **/garden/**: all work, filterable by type and research area. Also works without JavaScript.
- **/research/** and the topic pages, **/cv/** and **/about/**, generated from the content files.
- **/rising-water/**: the Colorado River Basin explorer. Built from real Copernicus DEM data, it computes the barcode in your browser and checks it against the published file ("600 of 600 bars identical").
- **Custom 404, sitemap, robots, social card, and Cloudflare headers** (CSP, caching).
- **GitHub Pages test site:** live at https://andrewc156.github.io/Personal-Portfolio/. Every page loads, with no errors and no third-party requests.

## Check results
| Feature | Verdict | Attempts |
|---|---|---|
| F1 Site shell | PASS_WITH_NOTES | 2 |
| F2 Content and pages | PASS_WITH_NOTES | 2 |
| F3 Persistence engine | PASS_WITH_NOTES | 1 |
| F4a Colorado DEM → grid | PASS_WITH_NOTES | 1 |
| F4b Reference barcode | PASS_WITH_NOTES | 1 |
| F5 Synthetic hero | PASS_WITH_NOTES | 2 |
| F6 Colorado explorer | PASS_WITH_NOTES | 2 |
| F7 SEO / polish | PASS_WITH_NOTES | 1 |
| F8 Cloudflare Pages setup | PASS_WITH_NOTES | 1 |
| D1 GitHub Pages base path | PASS_WITH_NOTES | 1 |
| **F9 Final audit** | **FAIL** (1 blocking fix) | 1 |

Passed in the audit:
- **Code checks and tests:** type-checks, lint, 441 unit tests, 292 Python tests, and the 111-test browser suite run twice.
- **Lighthouse:** 100 on almost every page; the explorer scores 97/100/96/100.
- **Links:** 0 broken.
- **Screenshots:** 156, all reviewed.
- **Persistence math:** checked against an independent implementation on 160 random grids, on the real Colorado grid and on the live hero.
- **Data:** the bbox is exact. The lowest point is at sea level by the Colorado delta. The highest point is within about 100 m of Uncompahgre Peak (USGS GNIS). The licence notice matches the Copernicus page word for word.
- **Security and privacy:** no secrets, no trackers, no large files committed.

## The one fix (site-builder)
While IBM Plex is still loading, a wide fallback font (Linux's default) makes the mobile menu wrap onto two rows. When Plex arrives the menu drops back to one row and the page jumps up by about 29 px. Lighthouse scores that as layout shift 0.21; the budget is 0.05. GitHub CI hit exactly this. On a Mac the fallback font is close enough to Plex that nothing moves. The fix is a size-matched fallback font, a font preload, and a menu row whose height doesn't depend on the font. Details are in attempt-1.md.

## What needs you
See docs/QUESTIONS.md. Since this audit, your CV answered most of the content items (C1).

## Known non-blocking issues (queued for the fix round)
- **Site-builder:** the footer wraps on phones; the home search description is just the tagline.
- **Viz-builder:** an inline form handler and inline styles force `'unsafe-hashes'` in the CSP; hero markers can touch each other; units need non-breaking spaces; timers aren't cleared on teardown; two explorer error cases have no tests; the map hint stays visible after a data error.
- **Data-engineer:** use USGS coordinates for the landmarks; make the "≈ 40 m" wording in docs/data.md consistent.

Full report: docs/checks/F9/attempt-1.md · screenshots: docs/checks/F9/attempt-1/
