# Check report — F7 Polish, SEO, performance and accessibility pass — attempt 1

Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit (439) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ (default and SITE_URL builds) · e2e (111/111, twice) ✅ · axe ✅ (in the e2e suite) · lighthouse ✅ (11 pages, median of 3 after a warm-up; table below) · links ✅ (25 scanned, 0 broken) · visual ✅ · content ✅ · tda n/a · data n/a

## Acceptance criteria

1. **Every page meets the §7 budgets.** ✅
   - **Lighthouse:** `LHCI_URLS=<all 11> npx lhci collect --config=./lighthouserc.cjs --numberOfRuns=4`. Per DECISIONS #50 I discarded run 1 and took the median of runs 2–4, using my own summarizer (docs/checks/tools/f7-lh/summarize.mjs).

     | Page | Perf | A11y | BP | SEO | CLS | LCP |
     |---|---|---|---|---|---|---|
     | / | 100 | 100 | 100 | 100 | 0.0001 | 902 ms |
     | /garden/ | 100 | 100 | 100 | 100 | 0.0001 | 752 ms |
     | /research/ | 100 | 100 | 100 | 100 | 0.0001 | 751 ms |
     | /research/water-quality/ | 100 | 100 | 100 | 100 | 0.0006 | 751 ms |
     | /research/tda-rivernets/ | 100 | 100 | 100 | 100 | 0.0005 | 751 ms |
     | /research/number-theory/ | 100 | 100 | 100 | 100 | 0.0006 | 752 ms |
     | /research/spectral-fractals/ | 100 | 100 | 100 | 100 | 0.0006 | 752 ms |
     | /cv/ | 100 | 100 | 100 | 100 | 0.0001 | 751 ms |
     | /about/ | 100 | 100 | 100 | 100 | 0.0006 | 751 ms |
     | /rising-water/ | 97 | 100 | 96 | 100 | 0.0001 | 2552 ms |
     | /404.html | 100 | 100 | 100 | 100 | 0.0006 | 751 ms |

     - The warm-up runs gave the same scores.
     - Judged perf was identical across the 3 runs on every page; /rising-water/ was 97, 97, 97.
     - The only weighted non-perf audit below 1, on any page, is `image-aspect-ratio` on /rising-water/. That is the known deliberate case and still gives BP 96 ≥ 95.
     - /404.html SEO is 100 with no noindex (#53).
     - The highest CLS across all 44 runs is 0.0006.
   - **Third-party requests:** none in any Lighthouse network log.
   - **Social card never loaded:** no page requests social-card.png in any Lighthouse network log. In dist it appears only in og:image/twitter:image `<meta>` tags, never in an `<img>`, `<link>`, CSS or JS.
   - **Page JS (gzip):** the whole of `dist/_astro/*.js` is 24.5 KB together, so every page is far under 120 KB.

     | Chunk | gzip |
     |---|---|
     | BaseLayout | 432 B |
     | color | 2.0 KB |
     | Explorer | 12.6 KB |
     | Hero | 11.1 KB |
     | settings | 0.9 KB |

     Inline scripts are 172 B per page (905 B on /garden/).

2. **Meta, OG, canonical and sitemap are valid and built from SITE_URL.** ✅
   - **(B) `SITE_URL=https://example-check.pages.dev npm run build`, then dist inspected directly:**
     - The canonical, og:url, og:image and twitter:image on all 10 public pages use `https://example-check.pages.dev/<path>/`, with the right path and a trailing slash.
     - sitemap-index.xml points to `https://example-check.pages.dev/sitemap-0.xml`. sitemap-0.xml has exactly the 10 public `<loc>` entries and no 404.
     - robots.txt contains `User-agent: *`, `Allow: /` and `Sitemap: https://example-check.pages.dev/sitemap-index.xml`.
     - `grep -r localhost dist` finds 0 matches.
   - **(A) Default build (SITE_URL unset):** everything uses `http://localhost:4321`. The final dist/ was built with `env -u SITE_URL npm run build` and has 0 `example-check` strings.
   - **Tag counts per page:** exactly 1 description, 1 `<title>`, 1 h1 and 0 robots meta on every page. Each public page has exactly 1 canonical and 1 og:url. /404.html has 0 canonical and 0 og:url.
   - **Descriptions:** all are page-specific and distinct. The longest is /rising-water/ at 148 characters. The About description is clamped to the first §3 bio sentence (141 characters).
   - **og:image:**
     - absolute;
     - served from preview with 200, `image/png`, 172,683 B (≤ 300 KB);
     - `file` reports a 1200 × 630, 8-bit RGB PNG.
   - **404 on preview:** `/no-such-page/` returns HTTP 404 with the custom page. It has no canonical, no og:url and no robots meta (#53).
   - **e2e/seo.spec.ts:** it asserts all of the above and passed in both full runs.
   - **BaseLayout theme script:** the inline script is byte-identical to HEAD. The shasum of the extracted `<script is:inline>` is the same: 1c8e8cf5…. `git diff HEAD` on BaseLayout touches only the Seo import and the `<Seo …/>` line (2 insertions, 1 deletion).

3. **Internal links are clean.** ✅
   - `npm run links` scanned 25 links with 0 broken.
   - My own static crawl of dist (every href/src, including fragment ids) found 28 distinct internal references and 0 broken. That includes /about/ (the new footer link), /#mission, /#work, /#research and /#open-science.
   - The external links are the Copernicus/AWS/DOI links from F6; they were not crawled.

4. **A social card exists as a static PNG of a hero frame.** ✅
   - **What it shows:** I opened public/og/social-card.png. It is a real hero frame: the synthetic terrain with three coloured lakes, plus the barcode strip with the water-level line at 280 m.
   - **Text, all traceable:** "Andrew Chincea" (§3 display name), "Mathematics, statistics, and water." (§3 tagline option 1, `confirmed: false` in profile.yaml) and "RISING WATER" (§3 project name). It makes no other claims.
   - **Reproducibility:** I started my own preview on :4321 and ran `node scripts/og-image.mjs --base http://localhost:4321 --out <scratch>/og1.png` twice. `cmp` against the committed PNG reported both outputs byte-identical.

## Other requested verifications
- **Anchor test** (e2e/shell.spec.ts:150–225). Using docs/checks/tools/f7-anchor/, I ran one control copy and two sabotaged copies against the production preview:
  - **Control:** passes. The logged landings are #mission top 15.81 px (margin 16, scrollY 684, not at bottom) and #work top 15.97 px (margin 16, scrollY 967). Both are checked by the strict "top at margin ±2" branch. #research and #open-science land at max scroll (the end-of-page branch).
  - **Sabotage A** (nav clicks cancelled; hash set via replaceState, no scroll): **fails** with `#mission: page scrolled — Expected > 0, Received 0`.
  - **Sabotage B** (clicks cancelled; scrolled to the wrong place, 120 px below the margin): **fails** with `#mission: top lands at the viewport top — Expected <= 2, Received 119.81`.
  - So the test now proves #mission and #work really scroll to the right place. The F2 note is resolved.
- **Rising water "Nov 2026":** present on / (Recent work, data-id project-rising-water), /garden/ (first row) and /cv/ (Projects). It is the only "Nov 2026" on each page.
- **Content:**
  - The footer reads "© 2026 Andrew Chincea · About · Built with help from Claude Code". The name and credit come from profile.yaml.
  - The Garden meta description says "posters and projects", which matches the 2 production items (the poster and Rising water).
  - `grep -riE 'TODO|TBD|lorem|placeholder' dist` finds 0 matches.
  - No drafts in dist: no OwlPath, talk, preprint item, RiverNets poster, Michael Liu, Yunus Kaya or Draft badge. The only "draft"/"preprint" hits are a CSS class name, the `data-types` attribute and the confirmed number-theory one-liner.
- **e2e:** `npx playwright test` (whole suite) passed 111/111 on both run 1 and run 2.

## Visual
All 18 PNGs were opened.
- **Footer:** shot on / and /about/ at 375/768/1280, light and dark. The About link is underlined and in the accent colour (light rgb(11,79,122), dark rgb(115,182,230)). No overflow, no clipping, and the separators are consistent.
- **Garden:** shot at 375/768/1280, light and dark, with the Rising water row (PROJECT · Nov 2026) first. The layout is clean.

## Blocking fixes
None.

## Notes (non-blocking)
1. **Footer at 375 px wraps onto two lines:** "© 2026 Andrew Chincea · About · Built with help from" / "Claude Code" (src/components/site/Footer.astro:10–26; screenshot footer-home-375-light.png). The wrap is clean and readable. The builder report says "still one line", which is true only from 768 px up. If the line should stay whole at 375, wrap the credit `<span>` with the separator in a nowrap group, or accept the wrap.
2. **Garden lede** "Ongoing projects come first…" describes nothing visible in production while OwlPath is a draft. Control already chose to leave it.
3. **Social card can go stale:** it bakes in the draft display name and tagline (`confirmed: false`), and nothing automated checks it against profile.yaml. Whoever confirms the tagline must rerun `node scripts/og-image.mjs` (needs a running server). Consider listing this in QUESTIONS.md and docs/deploy.md.
4. **Home meta description** is only the tagline (35 characters). It is valid and page-specific, but short for a search snippet. Optional: use the mission sentence instead.
5. **One social card for the whole site,** with `og:type website` everywhere. Fine for now.

## Artifacts
- **Screenshots:**
  - /Users/andrewchincea/personalPortfolio/docs/checks/F7/attempt-1/footer-{home,about}-{375,768,1280}-{light,dark}.png
  - /Users/andrewchincea/personalPortfolio/docs/checks/F7/attempt-1/garden-{375,768,1280}-{light,dark}.png
- **Tools:**
  - /Users/andrewchincea/personalPortfolio/docs/checks/tools/f7-anchor/ (gen.mjs, playwright.config.ts, control/sabotageA/sabotageB specs)
  - /Users/andrewchincea/personalPortfolio/docs/checks/tools/f7-lh/summarize.mjs
  - /Users/andrewchincea/personalPortfolio/docs/checks/tools/f7-visual/shots.mjs
- **Raw Lighthouse:** /Users/andrewchincea/personalPortfolio/.lighthouseci/ (gitignored)
- **State at hand-off:** port 4321 is free. The final dist/ was built with SITE_URL unset. Nothing outside docs/checks/ was edited.
