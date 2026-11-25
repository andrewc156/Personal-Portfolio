# Portfolio final audit: F9 attempt 4 (after the stretch features)

**Verdict: PASS_WITH_NOTES.** A fresh checker audited the whole site at `5c54ee2` and nothing blocks it. The site now includes the extra hero animations, the islands barcode, the basin mask, the GNIS place labels, the animation toolbar, footer and nav changes, and the Personal portfolio entry. All of these were judged against your recorded decisions.

**What passed**
- **Code checks:** type check, lint, 811 unit tests, and 606 Python tests plus Ruff.
- **Production build:** builds cleanly. With `SITE_URL=https://andrewchincea.com` set, the build writes the correct canonical URLs and sitemap.
- **Browser tests:** 169 passed locally. Hosted GitHub CI is fully green (177 of 177). The 8 local failures are animation-timing tests. This Mac's headless browser draws frames only every 50 ms even on a blank page, and the same tests pass on CI.
- **Security headers:** all 8 tests pass when the site is served with Wrangler.
- **Lighthouse (mobile):** every page scores 100 in all four categories, except the Colorado explorer at 96 / 100 / 96 / 100. Layout shift is 0 on every page.
- **Internal links:** all 27 are clean.
- **Visual review:** 10 pages at 3 widths in light and dark, plus the new hero modes and explorer states, with every screenshot opened. Nothing is clipped, overlapping or blank. There is no sideways overflow, no errors, and no third-party requests.
- **Facts:** everything on the site traces to the spec or your CV. There are no drafts, placeholders or phone numbers.
- **Explainer text:** stays within the approved statements, and the islands text is exactly the copy you approved.
- **Persistence math:** an independent brute-force check matched the engine on 320 random grids, for both lakes and islands. On the Colorado grid, the TypeScript engine, the Python reference and the published barcode agree exactly.
- **Data:**
  - The bounding box is exact.
  - The lowest point is at the Colorado delta. The highest raw point is about 100 m from Uncompahgre Peak's surveyed summit (NGS datasheet).
  - The Copernicus notice matches the licence page word for word.
  - 40 of 40 sampled basin-mask cells match the live USGS watershed service.
  - All 39 place labels match USGS GNIS records exactly.
- **Live site:** andrewchincea.com is up with the latest content and its security headers.

**What you need to do**
1. In the Cloudflare Workers build settings, set `SITE_URL=https://andrewchincea.com` and rebuild. Until then, the live canonical links and sitemap still point to localhost.
2. Your disk is about 100% full (about 300 MB free). Free some space before the next full `npm run verify`.
3. Optional copy decisions:
   - The Personal portfolio description is written in the first person ("my research") and overlaps the Rising water entry.
   - On phones, the nav row scrolls sideways.

**Small fix for later (viz-builder):** three places on /rising-water/ are missing a space, so the text runs together:
- "…clicking its bar does.With the basin mask on…"
- "tda_ref.py.Repository"
- "browser.Source"

Full report: `docs/checks/F9/attempt-4.md`. Screenshots: `docs/checks/F9/attempt-4/`.
