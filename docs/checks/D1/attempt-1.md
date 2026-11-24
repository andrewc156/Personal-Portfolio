# Check report — D1 GitHub Pages base-path support — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check ✅ (114 files, 0/0/0) · lint ✅ · unit (441) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ (default, base, and a clean `npm ci` base build) · e2e (111 passed, 8 skipped, run twice) ✅ · axe ✅ (inside the e2e suite) · lighthouse ✅ (base build, median of 3 after a warm-up; scores below) · links ✅ (default: 25 scanned, 0 broken; base: 24 OK, 0 broken) · visual ✅ · content n/a · tda n/a · data n/a

## Acceptance criteria

1. **The base build works under /Personal-Portfolio/.** ✅
   - **Build.** I built with `BASE_PATH=/Personal-Portfolio/ SITE_URL=https://andrewc156.github.io npm run build`, copied the output to `<tmp>/ghp/Personal-Portfolio/`, and served it on port 4321 with my own GitHub-Pages-like server, docs/checks/tools/d1/ghp-server.mjs. The server does directory index, a 301 to the trailing slash, and returns the base's 404.html with status 404 for unknown paths under the base.
   - **Static scan of the built files.** docs/checks/tools/d1/urls.mjs read every HTML, XML, TXT, CSS and JS file in dist: 402 URL occurrences in total.
     - No root-relative URL is outside `/Personal-Portfolio/`. The one apparent exception is the JS literal `/data/colorado/` in the Explorer bundle. It is the argument to the inlined `withBase`, which runs with base `"/Personal-Portfolio/"` (verified in the bundle: `var a=i(\`/Personal-Portfolio/\`)`, `=o(\`/data/colorado/\`)`).
     - Every absolute same-origin URL starts with `https://andrewc156.github.io/Personal-Portfolio/`: canonical, og:url, og:image, twitter:image, all 11 sitemap `<loc>` entries, and the robots Sitemap line.
     - CSS `url()` fonts are `/Personal-Portfolio/_astro/*.woff2`. The favicon, the hillshade preload and the `<img>` are all based.
     - 0 localhost URLs.
   - **Browser crawl** (docs/checks/tools/d1/probe.mjs, output in docs/checks/D1/attempt-1/crawl.txt): 28 documents, including the sitemap and robots, reached through every same-origin `<a>`.
     - 0 DOM URLs outside the base.
     - 189 responses, all under the base and all < 400. They include the `_astro` JS/CSS, 4 woff2 files, and data/colorado/{grid.f32, meta.json, barcode.json, hillshade.webp}.
     - 0 third-party requests and 0 console errors.
     - favicon.svg and og/social-card.png both return 200 under the base (checked with curl).
   - **Behaviour** (docs/checks/tools/d1/behave.mjs, output in docs/checks/D1/attempt-1/behaviour.txt):
     - Hero animates: frames 32→122, progress 0.035→0.142, canvas luminance variance 2418.
     - Settings panel: the slider changes 1.5×→1.7×, and Escape closes the panel.
     - Theme toggle: dark persists to /garden/ through localStorage, then toggles back to light.
     - Nav: all 6 hrefs are based. Mission, Research and Work land at the viewport top. Open science lands at the page end (scrollY 1229 = max 1229); that is the same page-end tolerance shell.spec.ts accepts, so my probe's FAIL line for it is a false alarm from my stricter check.
     - `aria-current` is correct on CV and on the wordmark under the base.
     - Garden: the tag chip goes to `/Personal-Portfolio/garden/?tag=water-quality`, and tag + type combine. Rewritten chip hrefs stay under `/Personal-Portfolio/garden/`. Back, back and forward restore both the URL and the visible rows. A `?type&tag` deep link restores the state. The "All" chips return to `/Personal-Portfolio/garden/`.
     - Explorer: "Computed in your browser in 18 ms: … (600 of 600 bars identical)" and `data-match=true`. The hillshade loads from `/Personal-Portfolio/data/colorado/hillshade.webp`. A bar click selects Lake 15 and fills the card. The table has 21 rows, and its "Show lake 1" button fills the card ("merged at …").
     - 404: `/Personal-Portfolio/no/such/page/` returns status 404 with the custom page. Its CSS and Plex fonts load at that deep path, every link is based, the home link goes to `/Personal-Portfolio/`, and the nav link to Rising water works.
     - Console errors: only the 404 document's own status, which is expected. 0 third-party requests.

2. **The default build is unchanged from HEAD.** ✅
   - **How I compared.** I built HEAD (e5bdaf9) in a `git worktree` under the scratchpad, with node_modules symlinked, using `env -u BASE_PATH -u SITE_URL npx astro build`. Then I built the current tree with `env -u BASE_PATH -u SITE_URL npm run build` and ran `diff -rq` plus a URL-set diff from urls.mjs, covering HTML, XML, TXT, CSS and JS.
   - **Files.** Every HTML file except rising-water is byte-identical. The other differences are:
     - `_headers` (F8's, new in this tree);
     - the Explorer bundle name, CryGIdCv → B9Pdp-kT, because data.ts now inlines the helper;
     - the `<script src>` reference to that bundle in rising-water/index.html.
   - **URL sets.** 346 vs 346. The only differences are the 3 lines naming that bundle. The bundle's data URL is still `withBase('/data/colorado/')` with base `/`, which returns `/data/colorado/`.
   - No other URL changed. The worktree has been removed and pruned.

3. **The existing suite still passes on the default build.** ✅
   - `npx playwright test` twice: 111 passed and 8 skipped both times. All 8 skips are F8's e2e/headers.spec.ts, which needs HEADERS_BASE_URL.
   - `npm run check`: 0 errors, 0 warnings, 0 hints.
   - `npm run lint`: clean.
   - `npm test`: 441/441, including Control's tests/unit/url.test.ts.
   - pytest: 292 passed. ruff: clean.

4. **Links.** ✅
   - `npm run links` on the default build: 25 scanned, 0 broken.
   - Base build: `npx linkinator http://localhost:4321/Personal-Portfolio/ --recurse --skip '^https?://(?!localhost)'` gave 24 × 200 OK and 71 SKIPPED (external). Output: docs/checks/D1/attempt-1/linkinator-base.csv.
   - My browser crawl (criterion 1) also found 0 broken internal links.

5. **Lighthouse on the base build** (#50 protocol; lighthouse 13.6.0, mobile, simulated throttling; 4 runs per page with run 1 discarded; median of runs 2–4): ✅

   | Page | Judged perf runs | Perf | A11y | BP | SEO | CLS |
   |---|---|---|---|---|---|---|
   | /Personal-Portfolio/ | 100, 100, 100 | 100 | 100 | 100 | 100 | 0.0001 |
   | /Personal-Portfolio/garden/ | 100, 100, 100 | 100 | 100 | 100 | 100 | 0.0001 |
   | /Personal-Portfolio/rising-water/ | 94, 78, 94 | 94 | 100 | 96 | 100 | 0.0001 |

   - All budgets are met (rising-water perf ≥ 80).
   - A second rising-water series gave a warm-up of 78, then 94, 94, 94.
   - BP 96 on rising-water comes from the known `image-aspect-ratio` audit, the same as F7.
   - 0 third-party requests in any Lighthouse network log.
   - Summary: docs/checks/D1/attempt-1/lighthouse-summary.txt.

6. **The workflow is valid.** ✅ (with note 1)
   - The YAML parses (checked with the `yaml` package). It has top-level permissions `contents: read`, `pages: write` and `id-token: write`, a deploy job with environment `github-pages` and `url: ${{ steps.deployment.outputs.page_url }}`, and `needs: build`. This matches the actions/deploy-pages README, which requires `pages: write`, `id-token: write` and the github-pages environment.
   - The pinned tags exist, and each action.yml has the inputs used: setup-node@v4 declares `node-version-file` and `cache`, and upload-pages-artifact@v3 takes `path` (required) and wraps upload-artifact@v4.
   - **`npm ci` works.**
     - The lockfile is v3 and contains the linux-x64 optional binaries: @esbuild/linux-x64 0.28.2, rolldown, lightningcss, the astro compiler binding and sharp.
     - npm 11.20.0, which is what Node 26.13.0 bundles locally, silently skips install scripts that `allowScripts` doesn't list (`npm help install-scripts`). The only packages with install scripts are esbuild@0.28.2, workerd@1.20261123.1 and fsevents@2.3.3, all pinned in `allowScripts`; fsevents is a macOS-only optional package.
     - I ran a real test: I copied the tracked and untracked files (no node_modules or dist) to a fresh scratch directory, ran `npm ci`, which succeeded, then ran the base build. Its dist is byte-identical (`diff -rq`) to the repo's base build.
   - **No Python is needed.** No Python/spawn/child_process appears in src/, astro.config.mjs or scripts/write-headers.mjs, and public/data/colorado/* is committed.
   - The repo URL https://github.com/andrewc156/Personal-Portfolio exists, and its case matches BASE_PATH.

**Helper edge cases (my own tests).**
- docs/checks/tools/d1/url-edge.test.ts, run with docs/checks/tools/d1/vitest.d1.config.ts: 8/8 pass at the root base. Cases covered:
  - query and fragment, `/?seed=7`, already-based paths (`/Personal-Portfolio`, `…?x`, `…#a`, `…/`);
  - idempotence;
  - near-misses (`/Personal-Portfolio-x/`, `/Personal-Portfoliox`, a lowercase variant, `/Personal`), which get prefixed;
  - absolute, mailto, tel, protocol-relative, `#`, `?`, empty and relative inputs, which are left unchanged;
  - base normalisation variants and multi-segment bases;
  - `stripBase` round-trips.
- One assertion failed when I set Vite `base` in the Vitest config: `BASE` was still `/`. That is a Vitest harness artifact, not a product bug. The production bundle inlines `/Personal-Portfolio/` (verified in criterion 1).

**Visual.** Screenshots of home, garden and rising-water at 375 and 1280, light, plus viewport crops of rising-water, all opened and reviewed.
- Plex fonts render everywhere and the hero canvas is live. The hillshade shows with water and the barcode. "Rising water" in the nav is underlined (aria-current).
- No overflow (scrollWidth − innerWidth = 0 on all 6), no clipping, no broken layout.

## Blocking fixes
None.

## Notes (non-blocking)
1. **The pinned actions run on the retired Node 20 runtime.**
   - actions/checkout@v4, actions/setup-node@v4, actions/deploy-pages@v4 and upload-artifact@v4 (used inside upload-pages-artifact@v3) all declare `using: node20` in their action.yml.
   - GitHub made Node 24 the default for JS actions on 2026-06-16 and removed Node 20 from runners on 2026-09-23. Node 20 actions are now forced onto Node 24, and the runner warns about it; reports on deploy-pages#410 show warnings, not failures.
   - Current releases: checkout v7.0.1, setup-node v7.1.0, upload-pages-artifact v5.0.0 and deploy-pages v5.0.1. Bumping them clears the warnings and the risk.
   - upload-pages-artifact v4+ excludes dotfiles by default. dist has none: `_headers` has no leading dot.
   - This change is for Control (shared file .github/workflows/deploy-gh-pages.yml).
2. `concurrency.cancel-in-progress: true` can cancel a Pages deployment that is already running. GitHub's Pages starter workflows use `false` for this reason. This is optional for Control.
3. In the base build, dist/_headers keeps root paths (`/_astro/*`, `/data/*`). GitHub Pages ignores `_headers` (DECISIONS #59), so it has no effect there. It belongs to F8's check.
4. Rising-water perf on my Node static server was 94 (with an occasional 78 run), against 97 under `astro preview` in F7. The difference comes from the test server, not from D1; the HTML is identical apart from paths.
5. HEAD-vs-current: the Explorer bundle now carries the inlined helper, about 300 bytes before compression. That is negligible against the 120 KB budget.

## Artifacts
- Report: /Users/andrewchincea/personalPortfolio/docs/checks/D1/attempt-1.md
- Screenshots: /Users/andrewchincea/personalPortfolio/docs/checks/D1/attempt-1/{home,garden,rising-water}-{375,1280}-light.png, rising-water-{375,1280}-light-viewport.png
- Logs: /Users/andrewchincea/personalPortfolio/docs/checks/D1/attempt-1/{crawl.txt,behaviour.txt,lighthouse-summary.txt,linkinator-base.csv}
- Raw Lighthouse: /Users/andrewchincea/personalPortfolio/docs/checks/D1/attempt-1/lh/, lh-rw2/
- Tools: /Users/andrewchincea/personalPortfolio/docs/checks/tools/d1/{ghp-server.mjs,urls.mjs,probe.mjs,behave.mjs,anchor.mjs,shots.mjs,shots-top.mjs,url-edge.test.ts,vitest.d1.config.ts}
- Final state: dist/ was rebuilt with `env -u BASE_PATH -u SITE_URL npm run build` (default: root hrefs, `Sitemap: http://localhost:4321/sitemap-index.xml`). All servers are stopped, port 4321 is free, and the HEAD worktree has been removed and pruned.

Sources: [deploy-pages README](https://github.com/actions/deploy-pages), [upload-pages-artifact README](https://github.com/actions/upload-pages-artifact), [Node 20 deprecation (GitHub changelog)](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/), [Node 20 removal notice](https://github.blog/changelog/2026-09-23-deprecation-of-node-20-on-github-actions-runners/), [Node 20 no longer available](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions), [deploy-pages#410](https://github.com/actions/deploy-pages/issues/410)
