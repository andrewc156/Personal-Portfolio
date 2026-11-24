# Check report — F9 Final audit — attempt 1

Verdict: FAIL (one blocking fix: font-swap layout shift on every page, which turns the GitHub CI Lighthouse gate red; everything else passes)

Audited: HEAD dc8e61c (main tree; `.claude/worktrees/` and Control's uncommitted ignore-file edits excluded). Machine: macOS (Darwin 27.2), Node 26.13.0, Playwright Chromium.

Gates: check ✅ (0/0/0, 114 files) · lint ✅ · unit (441) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ (default, plus a throwaway SITE_URL build) · e2e ✅ (111 passed, 8 skipped, run twice; the 8 headers specs pass 8/8 against wrangler) · axe ✅ (inside e2e) · lighthouse ✅ locally / ❌ in CI (table below; CI CLS 0.2116 on `/`, reproduced, see Blocking fix 1) · links ✅ (25 scanned, 0 broken; my static crawl: 30 refs incl. fragments, 0 broken) · visual ✅ (156 PNGs, all opened) · content ✅ · tda ✅ · data ✅ · hosting ✅

## Gate results

**1. Static.** `npm run check` 0 errors, 0 warnings, 0 hints · `npm run lint` clean · `npm test` 16 files, 441 passed · `pytest pipeline -q` 292 passed · `ruff check pipeline` clean.

**2. Build + e2e.** `env -u BASE_PATH -u SITE_URL npm run build` gives 11 pages; write-headers reports a CSP line of 1678/2000. `npx playwright test` run 1 and run 2: 111 passed, 8 skipped. The skips are e2e/headers.spec.ts, which needs HEADERS_BASE_URL. Against `wrangler pages dev dist --port 8788` it passes 8/8.

**3. Lighthouse mobile, all 11 pages** (#50 protocol: `lhci collect --numberOfRuns=4`, run 1 discarded, median of runs 2–4; summarizer docs/checks/tools/f9/lh-summarize.mjs)

| Page | Perf | A11y | BP | SEO | CLS (max of 4) | LCP | 3rd-party |
|---|---|---|---|---|---|---|---|
| / | 100 | 100 | 100 | 100 | 0.0001 | 902 ms | 0 |
| /garden/ | 100 | 100 | 100 | 100 | 0.0001 | 751 | 0 |
| /research/ | 100 | 100 | 100 | 100 | 0.0001 | 751 | 0 |
| /research/water-quality/ | 100 | 100 | 100 | 100 | 0.0006 | 752 | 0 |
| /research/tda-rivernets/ | 100 | 100 | 100 | 100 | 0.0005 | 752 | 0 |
| /research/number-theory/ | 100 | 100 | 100 | 100 | 0.0006 | 751 | 0 |
| /research/spectral-fractals/ | 100 | 100 | 100 | 100 | 0.0006 | 752 | 0 |
| /cv/ | 100 | 100 | 100 | 100 | 0.0001 | 752 | 0 |
| /about/ | 100 | 100 | 100 | 100 | 0.0006 | 751 | 0 |
| /rising-water/ | 97 | 100 | 96 | 100 | 0.0001 | 2553 | 0 |
| /404.html | 100 | 100 | 100 | 100 | 0.0006 | 751 | 0 |

- Every page meets §7 locally. The only weighted non-perf audit below 1 is `image-aspect-ratio` on /rising-water/, the known deliberate case.
- **In CI it fails.** GitHub CI run 45476952307 (ubuntu-latest) has `cumulative-layout-shift` = 0.2116 on `/`, and `npm run verify` exits 1. I reproduced and diagnosed this; see Blocking fix 1.

**4. Links.** `npm run links`: 25 links scanned, 0 broken. My own crawl of every href/src in dist (docs/checks/tools/f9, inline in the report run) found 30 distinct internal refs, including `#fragment` targets, and 0 broken. The only external links are the Copernicus, AWS and DOI anchors.

**5. Visual.** I ran docs/checks/tools/f9/shots.mjs against preview on 4321:
- 11 pages × 375×812 / 768×1024 / 1280×800 × light/dark, each as a viewport shot and a full-page shot (132 PNGs);
- 24 state shots: settings panel open, hero bar highlight, hero diagram, explorer bar-click card, explorer diagram, at every width and theme.

I opened every PNG. The /rising-water/ full pages were too tall to inspect at once, so I sliced them into readable segments (slices/) and opened each slice.

What I found:
- Horizontal overflow is 0 on all 66 page loads, with no clipped text and the webfonts loaded.
- The only console error is the 404 page's own "404 (Not Found)" document status.
- At 375 px the lakes table scrolls inside its own container; the page does not overflow.
- No overlap, clipping, low contrast, blank canvas or misalignment.
- The explorer card values for lake 3 match the data: born 1,275.7 m at 40.7704° N, 113.6646° W; merged at 1,671.5 m at 37.5704° N, 113.1896° W into the lowest lake (133025); persistence 395.8 m.
- Focus returns to the gear button after Esc in every state run.

**6. Content integrity** (visible text plus aria/alt/meta extracted from every dist page into docs/checks/F9/attempt-1/visible-text.txt)
- Every rendered fact traces to §3 or src/content and src/data. That covers: the name; KSU; both degrees; junior in 2026–27; the four research one-liners; the fractal poster (title, 104th MAA SE, High Point University, Mar 2025); Rising water (Nov 2026, per #51); keywords; the hero question; the mission and bio drafts; and the open-science draft.
- `TODO|TBD|lorem|placeholder` has 0 matches in visible text and 0 in any dist file.
- Drafts are absent: no OwlPath, talk, preprint, RiverNets poster, Michael Liu, Yunus Kaya or "Draft" badge.
- Collaborators appear only in the draft content files' `authors`.
- No invented titles, dates or links.
- **Copying check:** 8-word shingle overlap against richpauloo.com, samzipper.com, /research and /publications is 0. The palette names are the §4.2 ones.

**7. TDA correctness** (my own tools, docs/checks/tools/f9/)
- **brute_h0.py:** for each prefix of the (h, i) order, components are recomputed from scratch by BFS, with the elder rule applied, plus a level-by-level BFS cross-check. I ran it on 80 random grids (1×1 to 12×12: heavy ties, tie-free, half-steps, ±0) × 4- and 8-connectivity = 160 cases, plus golden and checkerboard.
  - Golden `[10,1,8,3,6,5,10]`: (5→6, bi 5, di 4), (3→8, bi 3, di 2), essential at 1 in cell 1. ✅
  - Checkerboard `[[0,1],[1,0]]`: 4-conn gives one finite 0→1 plus the essential bar; 8-conn gives the essential bar only. ✅
  - TS `computeH0` (incl. zero-length bars) vs brute force: 163 cases, 1,456 bars, 0 mismatches. `pipeline/tda_ref.py` vs brute force: 0 mismatches. So JS = Python. ✅
- **Colorado** (colorado_ref.py, my own union-find with no project imports):
  - Mine = tda_ref = TS engine = barcode.json: 599 finite bars ≥ 1 m plus the essential bar at 133025, with identical (bi, di, mi).
  - TS also matches barcode.json in file order. Every b and d equals the float32 `grid.f32` height exactly (#35).
  - The grid SHA-256 matches barcode.json and meta.json.
  - There are 1,217 births and 207 zero-length bars.
- **Explorer live:** "600 of 600 bars identical" in every screenshot run and on the live GitHub Pages site.
- **Hero** (hero_bars.mjs): on 6 live terrains (141×71), the drawn rows (bi, di, birth, death) are identical to my own union-find H0 with the §6.3 selection (min persistence 10 m, max 30 bars). ✅

**8. Explainer audit vs §6.6.** I checked every TDA sentence:
- /: caption, canvas and strip aria-labels, keyboard help, readouts, the diagram legend ("One point per lake. Height above the diagonal is persistence."), and the runtime summary and readout templates in src/lib/viz/hero/*.ts;
- /rising-water/: lede, legend, table intro, edge note, the nine "How to read" bullets, card, status and summary templates;
- /research/tda-rivernets/.

All of it is §6.6 items 1–9 or a neutral description of the UI. Additions such as "In the diagram view each bar is a point, birth level across and death level up" and "(the Min persistence control)" describe controls and make no new claims. Every Colorado number traces to meta.json or barcode.json. "6 of the 10 longest-lived lakes are born on the edge" is correct: lakes 1, 2, 4, 8, 9 and 10.

**9. Performance**
- **Page JS (gzip):** home 14.4 KB (Hero 11.0 + color 2.0 + settings 0.9 + BaseLayout 0.4); /rising-water/ 15.1 KB (Explorer 12.7 + color 2.0 + BaseLayout 0.4); other pages 0.4 KB. Budget is 120 KB.
- **Hero frame times** (docs/checks/tools/f5_perf.mjs, 1280×800, 700 frames per run): rAF p95 16.8 ms in 3 runs and 16.7 ms at 4× CPU throttle. The hero's own work is p95 ≤ 0.8 ms. Budget is p95 ≤ 22 ms.
- **Explorer** (f6_perf.mjs):
  - compute 18 ms (62–64 ms at 4×), ready at 95–111 ms;
  - rAF p95 16.8 ms, render p95 ≤ 2.1 ms;
  - 759,197 B transferred cold (budget ≤ 3 MB);
  - 0 third-party requests.
- **Data on disk:** grid.f32 539,856 B; hillshade.webp 179,574 B; barcode.json 33,492 B; meta.json 8,711 B (each ≤ 600 KB).

**10. Data audit**
- **Grid:** `meta.bbox` = [-115.201667, 31.8175, -107.060833, 42.1575], identical to the spec. 326 × 414 = 134,964 cells, 0 NaN.
- **Minimum:** −2.885 m at cell 133025 (31.9454° N, 114.7646° W): the south-west corner at the Colorado delta, at sea level.
- **Raw maximum:** I scanned all 108 cached tiles myself, clipped to the bbox. It is 4,339.0 m at 38.07083° N, 107.46167° W.
  - USGS GNIS feature 188678 (Uncompahgre Peak), via [TopoQuest's GNIS record](https://topoquest.com/place-detail.php?id=188678), gives 38.07166° N, 107.46200° W. That is 96 m away; the GNIS web app itself is JavaScript-only.
  - [Wikipedia](https://en.wikipedia.org/wiki/Uncompahgre_Peak) gives 14,315.8 ft (4,363.5 m), so the DEM pixel is about 25 m low, as expected at 90 m resolution.
  - The second-highest is Mount Wilson (4,298 m at 37.839° N, 107.992° W), so the maximum is unambiguous.
- **Top lakes:** I recomputed the top 20 from my own pairs, and they match the site table and docs/data.md to 0.1 m and 0.0001°. The site's −107.0692° for east-edge cells correctly uses the 19-px partial block.
  - #3 (birth 40.77° N, 113.66° W) is the Bonneville / Great Salt Lake Desert basin.
  - #6 is at Bingham Canyon Mine and #7 at the Sierrita mine. Their coordinates are consistent with those mines' published positions.
  - Edge-born lakes: 6 of the top 10.
  - The Great Divide Basin is rank 47, as docs/data.md says.
  - That geography makes sense.
- **Attribution:** I fetched the raw licence page (dataspace.copernicus.eu … /COP-DEM), "User Obligations". The required WorldDEM-90 notice "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" is byte-identical to ATTRIBUTION.md, meta.json and the rendered page. DOI 10.5270/ESA-c5d3d65 appears on the same page. The AWS registry entry links to this licence page.

**11. Hosting**
- `npx wrangler pages dev dist --port 8788` (no login) serves the site.
- For `/*`, `/_astro/*`, `/data/*`, `/og/*` and `/favicon.svg`, every header in dist/_headers is served with an identical value.
- docs/checks/tools/f8/csp_hashes.py independently recomputes the hashes and reports MATCH: no missing or extra hashes, and `'unsafe-hashes'` is present and needed.
- `/no-such-page/` returns 404 with a body byte-identical to dist/404.html.
- **SITE_URL:** `SITE_URL=https://f9-check.example.pages.dev npm run build` puts that origin in every canonical, og:url, og:image and twitter:image, in the 10 sitemap `<loc>` entries, in sitemap-index and in robots.txt. No localhost remains, and 404 has no canonical. I then rebuilt with `env -u BASE_PATH -u SITE_URL npm run build`; the final dist/ is the default build (canonical `http://localhost:4321/`, 0 `f9-check` strings).

**§13 "Never".**
- No tracked file and no blob in history is over 5 MB. The largest are docs/checks/F6/attempt-*/ref.json at 2.72 MB and old Playwright trace.zip blobs at 1.7 MB.
- No `.tif`, `.env` or keys anywhere in history; the secret-pattern grep is clean.
- No trackers and no third-party runtime origins: there are no absolute URLs in JS or CSS; the dist HTML has only anchors and SITE_URL meta; and 0 third-party requests appear in Lighthouse, perf runs or the live site.

**Live GitHub Pages** (https://andrewc156.github.io/Personal-Portfolio/; read-only, docs/checks/tools/f9/live_ghp.mjs)
- All 10 pages return 200 and /no-such-page/ returns 404 with the custom page.
- 0 console errors, apart from the 404 document status.
- 0 third-party or failed requests.
- The hero draws (565×283 canvas), and the explorer shows "600 of 600 bars identical".

**GitHub Actions** (`gh run list --limit 5`, read-only)
- CI 45476952307 (F8 commit): **failure**, failing only at `npm run lhci` with CLS 0.2116 on `/`.
- Deploy to GitHub Pages 45476952215: success.
- D1 deploy 45474947932: success.
- Nothing was re-run.

## Acceptance criteria (F9)
- Every §11 gate on every page: all pass locally. The CI Lighthouse CLS fails and is reproduced → Blocking fix 1.
- Full visual review: 11 pages × 3 widths × 2 themes, plus key states. 156 PNGs opened, in docs/checks/F9/attempt-1/. ✅
- Content audit vs §3: ✅ (details in gate 6).
- Explainer audit vs §6.6: ✅ (gate 8).
- Data audit, §11 step 10: ✅ (gate 10).
- Every §7 budget: JS, data, perf, a11y, BP, SEO and local Lighthouse CLS ✅. CLS < 0.05 ❌ when the webfont swaps in late over a wide fallback font → Blocking fix 1.

## Blocking fixes

1. **Webfont swap shifts the layout on every page (CLS up to 0.21; the CI Lighthouse gate fails).** Owner: **site-builder** (F1 files).
   - **Where:**
     - src/styles/global.css:2–5 imports @fontsource with `font-display: swap` and has no metric-matched fallback;
     - src/styles/tokens.css:35 `--font-sans: 'IBM Plex Sans', system-ui, …`;
     - src/layouts/BaseLayout.astro:28–42 has no `<link rel="preload">` for the critical woff2;
     - src/components/site/Header.astro:105–113 and 141–163: on ≤ 52rem the nav `ul` is `flex-wrap: wrap`, so its row count depends on font width.
   - **Expected:** CLS < 0.05 on every page (§7), including when Plex arrives after first paint over the platform's fallback font. On Linux, system-ui is usually DejaVu Sans, which is much wider than Plex.
   - **Actual:** GitHub CI (ubuntu-latest) Lighthouse gives CLS 0.2116 on `/`, so `npm run verify` fails.
   - **Reproduction:** I emulated Lighthouse mobile (412×823, DPR 1.75) with webfonts delayed 1.5 s and a Vera/DejaVu-width fallback (Verdana): `/` 0.2114, which matches CI's 0.2116.
     - The same condition elsewhere: /garden/ 0.2122, /rising-water/ 0.1625, /research/ 0.1356, /research/water-quality/ 0.0833, /research/tda-rivernets/ 0.0807, /cv/ 0.0810, /about/ 0.0619, 404 0.0286.
     - The shift sources are the header nav items (`li` y 87→56). The nav wraps to an extra row in the wide fallback, then un-wraps when Plex loads. That pushes everything below up by about 29 px: on `/` the hero figure and keyword list, on /garden/ the filters and list, on /rising-water/ the whole explorer section.
     - Controls: baseline, CPU 4×, fonts delayed with the normal macOS fallback, and fonts blocked all give ≤ 0.0001. An Arial-width fallback gives ≤ 0.018. So this only bites with a wide fallback, which is exactly the Linux CI runner and Linux desktop users.
   - **How to reproduce:** `npm run build && npm run preview -- --port 4321 --ignore-lock`, then:
     - `node docs/checks/tools/f9/cls_probe.mjs /` (all variants, home);
     - `node docs/checks/tools/f9/cls_allpages.mjs` (wide fallback, every page).
     - Read-only CI evidence: `gh run view 45476952307 -R andrewc156/Personal-Portfolio --log-failed`.
   - **Suggested fix** (any one should do; together is safest):
     - (a) Add metric-matched fallback faces, for example `@font-face { font-family: 'IBM Plex Sans Fallback'; src: local('Arial'); size-adjust / ascent-override / descent-override / line-gap-override` tuned to Plex }, and put them in `--font-sans` right after 'IBM Plex Sans', before system-ui. Do the same for Mono.
     - (b) Preload `ibm-plex-sans-latin-400-normal` and `-600-normal` woff2 in BaseLayout.
     - (c) Make the mobile nav row's height independent of font width, for example a single non-wrapping, horizontally scrollable row, or a reserved two-row min-height.
     - Then re-run my two probes (target < 0.05 everywhere) and push so CI's lhci goes green. Consider adding an e2e CLS test with delayed fonts so this can't regress.

## Notes (non-blocking), by owning role

Queued notes: I confirmed each one; refuted none.

**site-builder**
- F7: the footer wraps at 375 px. "… Built with help from / Claude Code" is clean but on two lines (Footer.astro; every 375 screenshot).
- F7: the home meta description is only the tagline, "Mathematics, statistics, and water." (BaseLayout.astro:21 defaults to `profile.tagline.text`).
- F2: the Garden lede "Ongoing projects come first, then everything else, newest first." (src/pages/garden/index.astro:40) describes nothing visible in production, where the two items are both dated.
- New: Open science says "The source code for this site is public…" but shows no link, because src/data/open-science.yaml URLs and profile `site.source_url` are empty, pending Andrew. The footer "Source" link is hidden for the same reason. Consider showing the repo link once Andrew confirms (QUESTIONS.md already asks).
- F7: the social card still bakes in the draft name and tagline. Rerun scripts/og-image.mjs after Andrew confirms them.

**viz-builder**
- F8/#62: `'unsafe-hashes'` is still required by `onsubmit="return false"` (src/components/explorer/Explorer.astro:144) plus 15 style-attribute hashes (the legend swatches' `style="--sw-l…; --sw-d…"` on /rising-water/). Replace them with addEventListener and CSS/CSSOM.
- F5: the pit and pass markers sit close together when adjacent. They stay legible in all 24 state shots, but the pass diamond can touch the pit ring (state-hero-highlight-*).
- F5: no NBSP before units. src/lib/viz/hero/text.ts:11–12 builds `${r} m` with a plain space, so "17 / m" can wrap.
- F5: `destroy()` (src/lib/viz/hero/controller.ts:302–305) cancels rAF and listeners but not `resizeTimer`, `readoutTimer` or `summaryTimer` (set at :477, :709, :753).
- F6: e2e has no size-mismatch or barcode-mismatch rejection case. Only the grid-corruption hash path is covered (e2e/explorer.spec.ts:139).
- F6: in the error state the map hint "Point at or tap the map…" stays visible. `reject()`/`fail()` in src/components/explorer/explorer-client.ts:144–152 and :295–301 don't hide `[data-ex-hover]`.

**data-engineer**
- F4b: LANDMARKS coordinates come from Wikipedia, not USGS GNIS or MRDS (pipeline/barcode.py:190–199). They are close enough, and no conclusion changes.
- F4b: docs/data.md:181 says "≈ 40 m", but step 2 says "≈ 34–46 m". Unify the wording.
- New, optional: docs/data.md says the Rocky Mountain National Park and Wind River expectations were "not tested". They follow directly from the bbox (the Colorado's source is near 105.8° W, east of 107.06° W; the Wind River Range is around 43° N, north of 42.16° N) and could be stated with a source.
- New, optional: several other top-20 lakes are 1–2-cell pits near known open-pit copper mines. #18 is near Bagdad, AZ; #14 near Santa Rita/Chino, NM; #11 near the Mission complex, AZ. I have not checked these against primary sources, so treat them as hints for docs/data.md only. The site copy ("some deep lakes … are mine pits") is already safe.

**control**
- CI is red on main because of Blocking fix 1. After the fix, confirm the next CI run is green; read-only, I didn't trigger anything.

## Artifacts
- **Screenshots** (gitignored PNGs):
  - /Users/andrewchincea/personalPortfolio/docs/checks/F9/attempt-1/ holds `<page>-<w>-<theme>.png`, `…-full.png` and `state-*.png`;
  - /Users/andrewchincea/personalPortfolio/docs/checks/F9/attempt-1/slices/ holds the explorer full-page slices.
- **Logs:**
  - /Users/andrewchincea/personalPortfolio/docs/checks/F9/attempt-1/shots-log.txt
  - /Users/andrewchincea/personalPortfolio/docs/checks/F9/attempt-1/lighthouse-summary.txt
  - /Users/andrewchincea/personalPortfolio/docs/checks/F9/attempt-1/visible-text.txt
- **Tools** (all mine, independent of builder helpers): /Users/andrewchincea/personalPortfolio/docs/checks/tools/f9/
  - brute_h0.py, cmp_engines.mjs, cmp_py.py, colorado_ref.py, colorado_ts.mjs
  - hero_bars.mjs, shots.mjs, visible_text.py
  - cls_probe.mjs, cls_allpages.mjs, cls_allpages_arial.mjs
  - live_ghp.mjs, lh-summarize.mjs
- **Reused earlier-checker tools:** docs/checks/tools/f5_perf.mjs, f6_perf.mjs, f8/csp_hashes.py, f8/pw-nowebserver.config.ts.
- **Raw Lighthouse:** /Users/andrewchincea/personalPortfolio/.lighthouseci/ (gitignored).
- **State at hand-off:**
  - ports 4321 and 8788 are free;
  - dist/ is the default build (`env -u BASE_PATH -u SITE_URL npm run build`);
  - nothing outside docs/checks/ was edited;
  - nothing was pushed, deployed or triggered.

Sources: [Copernicus DEM licence page](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) · [AWS registry](https://registry.opendata.aws/copernicus-dem/) · [TopoQuest GNIS 188678](https://topoquest.com/place-detail.php?id=188678) · [Uncompahgre Peak (Wikipedia)](https://en.wikipedia.org/wiki/Uncompahgre_Peak) · [GNIS 188678](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/188678)
