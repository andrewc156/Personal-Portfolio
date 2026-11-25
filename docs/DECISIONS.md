# Decisions log

Decisions Control made without asking Andrew (spec §1.5, §9.6). Newest last.

## Phase 0
1. **Git remote and pushing (Andrew's explicit override).** Repo was already on `main` with `origin` = github.com/andrewc156/Personal-Portfolio (public). Control pushes `origin main` after every commit, never force-pushes. Still no deploy, `wrangler login`, other remotes, or Cloudflare connection.
2. **Toolchain.** Node 26.13.0 / npm 11.20.0, Python 3.13.9, git 2.47.0. `.nvmrc` = `26` (current Node LTS line).
3. **Astro 7.4.13**, minimal template, `astro/tsconfigs/strict`. Scaffolded in a scratch folder and copied in with no overwrites (create-astro refuses non-empty dirs). Template README not copied.
4. **npm 11 install-script gating.** Approved install scripts for `esbuild`, `workerd`, `fsevents` (recorded in `package.json` `allowScripts`); Vite and wrangler need them.
5. **`site` fallback.** `astro.config.mjs` uses `SITE_URL`, falling back to `http://localhost:4321` so local builds produce well-formed canonical/sitemap URLs. Cloudflare must set `SITE_URL`.
6. **`trailingSlash: 'always'`, `build.format: 'directory'`** to match the `/garden/`-style routes in spec §5 and Cloudflare Pages' directory serving. Astro emits `404.html` at the root, which Pages serves for unknown routes.
7. **Extra devDependencies:** `typescript-eslint` and `@typescript-eslint/parser` (needed for ESLint flat config over TS/Astro).
8. **Extra npm scripts:** `pytest` (used by `verify`) and `format` (prettier --write). `lint` = ESLint + `prettier --check` on src/tests/e2e/scripts.
9. **Lighthouse CI** uses Playwright's Chromium (`chromePath` from playwright-core) unless `CHROME_PATH` is set. URLs default to `/` and `/404.html`; override with `LHCI_URLS=/,/garden/,…`. Performance is a warn-level assertion at 0.9 because `/rising-water/` has a lower budget (≥ 80); the checker compares per page against §7.
10. **linkinator** skips every non-localhost URL, so it checks internal links only. External links are reviewed separately as warnings.
11. **Vitest** `passWithNoTests` so `npm test` is green before F3 adds tests. Note: `pytest pipeline` exits 5 ("no tests collected") until F3/F4a add tests; checkers should record it as n/a until then.
12. **Python deps installed fine:** numpy 2.5.5, rasterio 1.5.2, gudhi 3.13.0, ruff 0.17.6. No GUDHI fallback needed.
13. **Gitignore additions** beyond §9.1: `.claude/scheduled_tasks.lock`, `.claude/settings.local.json`, Python caches, `.DS_Store`.
14. **Agents.** `.claude/agents/*.md` copied verbatim from spec §8.3. This session spawns `general-purpose` agents with the role body pasted in (new agents folder loads only next session).

## F1
15. Added `yaml@^2.9.1` as an explicit dependency (F1 request: `src/components/site/profile.ts` imports it).
16. Deleted template `public/favicon.ico` (unlinked Astro logo; `public/favicon.svg` is the site icon).
17. Builder self-check screenshots (`docs/builds/**/*.png`) are gitignored like checker screenshots.
18. **F1 check found Phase 0 harness bugs (fixed by Control):** `astro preview` in Astro 7.4 backgrounds itself under agent detection, so `playwright.config.ts` webServer now runs `npm run preview -- --port 4321 --ignore-lock`. linkinator 8.1.0 scans 0 links in local-directory mode, so `npm run links` is now `node scripts/check-links.mjs` (Control-owned): starts preview on 4321, crawls it with `linkinator.config.json` (skips non-localhost URLs), stops the server.
19. F1 attempt 1 FAIL was test-only (5/28 e2e failures from bugs in e2e/shell.spec.ts); returned to site-builder as attempt 2.
## F1 (cont.)
20. Raw Lighthouse JSON/HTML reports under docs/checks/ are gitignored; scores are recorded in each check report.

## F2 (builder decisions, accepted by Control)
21. Research slugs: `water-quality`, `tda-rivernets`, `number-theory`, `spectral-fractals`.
22. Research areas are not drafts (their one-liners are [C]); [A] parts are optional empty fields that don't render.
23. Rising water project: not a draft, no date yet (date optional for projects). Control sets `date` when F6 passes (via the F2 owner).
24. OwlPath is `draft: true` (status, link and date are [A]).
25. Fractal poster lists Andrew as sole author (§3 names no coauthors) — flagged for Andrew.
26. Garden/CV sort: undated (ongoing) items first, then newest first. Drafts with an empty title show "Title needed", dev only.
27. Number-theory one-liner: "One preprint, with a second paper in progress." ("expected early 2027" omitted until Andrew decides whether to list it).
28. Request to let F2 own `tests/unit/content/**`: deferred — e2e covers thumbnail determinism; revisit if a checker asks for unit tests.
29. `/about/` has no link from header/footer/home: assigned to F7 (Control will list Footer.astro for F7).

## F3
30. Added npm script `bench:tda` = `node scripts/bench-tda.mjs` (F3 optional request).
31. F3 API additions beyond §6.2 accepted: `Bar.mergedInto` (absorbing lake's birth cell, for the F6 info card) and `MergeEvent.type` ('birth' | 'merge').
32. Checker order: F4a → F3 → F2 (F3 unblocks F4b and F5; nothing waits on F2 until F7).

## F4a
33. F4a PASS_WITH_NOTES. Notes 1–3 (half-pixel offset range wording, unsourced "2021 release", unsourced vertical accuracy) go to the data-engineer as part of F4b, before F6 renders "About the data" from meta.json.

## Phase 3 scheduling
34. F4b starts now (pipeline-only, can't disturb the F2 site build). F5 starts after the F2 check finishes, because F5 edits src/components/hero/** which the F2 checker's build includes.

## F4b
35. barcode.json stores exact float32 heights (not rounded to 0.1 m): 33.5 KB, and F6 can check `b[k] === heights[bi[k]]` strictly. Accepted.
36. barcode.json adds column `mi` (mergedInto birth cell; essential bar di = mi = -1). Accepted (consistent with #31).
37. Geography finding for F6 copy: 6 of the top-10 lakes are valleys closed only by the rectangle's east/north edges; #5–7 are open-pit mines (surface-model depressions). Bonneville/Great Salt Lake is rank 3; Great Divide Basin is present but rank 47. F6 must not claim more than docs/data.md supports.

## F2 attempt 1 FAIL
38. F2 FAIL (all 7 criteria pass; hard gate failed on F1's `e2e/shell.spec.ts:150` anchor-scroll race exposed by real home content, plus "or theCV" on /about/). For attempt 2 Control assigns `e2e/shell.spec.ts` to the F2 site-builder (F1 is done; same role owns both).
39. F2 attempt 2 also takes cheap non-blocking notes: neutral draft descriptions (collaborators only in authors), Garden lede wording vs sort order, chip-group alignment at 768 px.
40. Parallel now: F2 builder (attempt 2), F4b checker (data-only, no site build), F5 builder (hero files only). F5's checker will wait until F2 is done.

## F2 attempt 2
41. Scroll-settle rule for e2e: `scrollY` unchanged for 150 ms, polled every 50 ms with a synchronous `waitForFunction` predicate (Promise/rAF predicates resolve early in headless Chromium). Garden filter groups: fixed 8.5rem label column from 40.0625rem up, stacked below.
42. tsconfig `exclude` adds playwright-report, test-results, .lighthouseci, docs/checks/tools, pipeline (keeps `astro check` to project code).
43. Because F5 is editing hero files in parallel, the F2 attempt-2 check runs in an isolated snapshot (git worktree of HEAD + F2's changed files), so a half-built hero can't affect F2's verdict.

## F4b
44. F4b PASS_WITH_NOTES. Notes 1 (primary-source LANDMARKS coords) and 3 ("≈ 40 m" vs "about 34–46 m") are deferred to the data-engineer in the F9 fix round unless F6 needs them sooner; neither changes any conclusion.

## F2 done
45. F2 PASS_WITH_NOTES (attempt 2). For F7: tighten the anchor test (target top near viewport top), fix /garden/ meta description to match visible types, add /about/ footer link (#29).
46. F5 attempt 1 FAIL (readout throttle/staleness, clipped highlight readout). Returned to the same viz-builder (context retained) as attempt 2 with notes: edge marker clipping, strip aria-label per view, aria-keyshortcuts completeness, e2e 500 ms timing from navigation.
47. F5 PASS_WITH_NOTES (attempt 2). Notes 1–3 (pit/pass overlap, NBSP before units, destroy() timers) deferred to the viz-builder in the F9 fix round. Raw Lighthouse folders docs/checks/**/lh/ gitignored.
48. F6 also owns tests/unit/viz/explorer/** (Control-assigned, for unit tests of explorer logic). F6 may import, not edit, src/lib/viz/common/**.
49. F6 attempt 1 FAIL (explorer renders unverified data on mismatch). Returned to the same viz-builder as attempt 2, with notes: Lighthouse perf headroom (one 54 run from a long compute task + hillshade LCP), rounded corners clipping corner cells, lede overstatement.
50. F6 PASS_WITH_NOTES (attempt 2). Lighthouse protocol for F7/F9: one discarded warm-up run, then judge on the median of ≥ 3 runs. F6 notes 2–3 (e2e for size/barcode rejection; hide map hint in error state) and the optional Worker go to the viz-builder in the F9 fix round.
51. Rising water project date set to 2026-11 (the month F6 passed, per §3) — done as part of F7 by the site-builder (content file owner).
52. F7 extra owned files (Control-listed fixes): src/layouts/BaseLayout.astro (include Seo.astro in <head>), src/components/site/Footer.astro (/about/ link), src/pages/garden/index.astro (meta description), e2e/shell.spec.ts (anchor test: target top near viewport top), src/content/work/project-rising-water.yaml (date 2026-11), new e2e/seo.spec.ts.
53. 404 page: no `noindex` (Control's earlier instruction reversed). §7 requires SEO ≥ 95 on every page; noindex scores ~69. The HTTP 404 status Cloudflare Pages returns already keeps it out of indexes. lighthouserc unchanged.
54. F7 PASS_WITH_NOTES. Footer wrap at 375 and home description deferred to F9 fix round (site-builder) if the auditor flags them.

## F8
55. CSP hashes are computed from the built HTML, not typed by hand: F8 adds scripts/write-headers.mjs (F8-owned) that reads public/_headers and fills in sha256 hashes for every inline <script>/<style> found in dist/, writing dist/_headers. Control will change `build` to `astro build && node scripts/write-headers.mjs` when F8 reports.
56. For F8 self-checks only, the site-builder may run the header script against the existing dist/ and `npx wrangler pages dev dist --port 4408` (local, no login). The checker still does the authoritative build and verification on 4321.

## GitHub Pages test deploy (Andrew's explicit request)
57. Andrew turned on GitHub Pages (source: GitHub Actions) as a test host before Cloudflare, and asked for the site to deploy there. This is his explicit OK to deploy to GitHub Pages only (not Cloudflare). Control added `.github/workflows/deploy-gh-pages.yml` (push to main → build with SITE_URL=https://andrewc156.github.io, BASE_PATH=/Personal-Portfolio/ → actions/deploy-pages). Site URL: https://andrewc156.github.io/Personal-Portfolio/.
58. `astro.config.mjs` reads `base` from BASE_PATH (default '/'), so Cloudflare and local builds are unchanged. Task D1 (site-builder) makes every internal link, asset path and fetch base-aware. The workflow is pushed only after a checker passes D1, so the first deploy isn't a broken site.
59. GitHub Pages limits (documented, accepted for a test host): `_headers` is ignored (no CSP/caching headers there); robots.txt under a sub-path is not read by crawlers; canonical URLs point at the github.io sub-path while it's the host.

## F8
60. `build` = `astro build && node scripts/write-headers.mjs` (F8 request 1): dist/_headers gets CSP hashes for every inline script/style from the built HTML.
61. `.nvmrc` pinned to the full version 26.13.0 (F8 request 2) so Cloudflare's build image and actions/setup-node both resolve it unambiguously.
62. CSP uses `'unsafe-hashes'` with exact hashes only because Explorer.astro has `style=""` attributes and one `onsubmit="return false"`; injected code is still blocked. F9 fix round (viz-builder): replace the inline handler with addEventListener and move style attributes to CSS/CSSOM (keep the map aspect-ratio in CSS to protect CLS), which drops 'unsafe-hashes' automatically.
63. Check order: D1 (GitHub Pages base path) check first, then F8 check, because both build the site and D1 is still editing src/.
64. tests/unit/url.test.ts added (D1 builder's helper test, placed by Control). D1 check runs before F8's.
65. D1 PASS_WITH_NOTES. Control bumped the Pages workflow to checkout@v7, setup-node@v7, upload-pages-artifact@v5, deploy-pages@v5 (current majors; inputs verified in each action.yml) and set cancel-in-progress: false. The D1 commit excludes package.json's build-script change and all F8 files (unchecked); they ship with F8.
66. GitHub Pages test deploy is live: https://andrewc156.github.io/Personal-Portfolio/ (run 45474947932, build+deploy green). Live browser check: hero draws, explorer '600 of 600 bars identical', 0 console errors, 0 failed or third-party requests.
67. F8 PASS_WITH_NOTES. Control fixed the stale .nvmrc sentence in docs/deploy.md (now 26.13.0, per #61) before committing — wording only.

## C1 — content update from Andrew's CV (2026-11-24)
68. Andrew supplied his CV (PDF, uploaded in the session; kept out of the repo) and asked to update the site with it. Facts in it are now [C]. His answers: NO phone number on the site; NO CV PDF download for now; MERGE "Water quality" and "TDA: RiverNets" into one research area; advisors named only on their research entries/CV entries, NO References section.
69. C1 (site-builder) runs in an isolated git worktree because the F9 audit is building the main tree. After C1's check passes, Control merges it into main; F9's content findings are then re-checked in the fix round.
70. CI run 45476952307 (ubuntu): all of `npm run verify` passed except Lighthouse CLS on `/` = 0.21 (> 0.05). Locally ≈ 0.0001. Sent to the F9 auditor to diagnose; fix goes to the owning role in the fix round.
71. C1 built (worktree .claude/worktrees/agent-a302a2e8cd44f54ea, branch worktree-agent-a302a2e8cd44f54ea). Research slugs are now `water-quality`, `number-theory`, `spectral-fractals` (supersedes #21 per #68). Control applied C1's requests in the worktree: e2e/shell.spec.ts footer test now expects the Source link (repo URL); e2e/headers.spec.ts drops /research/tda-rivernets/.
72. Main tree: tsconfig/eslint/prettier ignore `.claude/` (worktrees live there); .gitignore adds symlink forms `node_modules` and `pipeline/.venv`.

## F9 fix round 1
73. F9 attempt 1 FAIL: one blocking fix (font-swap layout shift, CLS up to 0.21 with a wide fallback font; site-builder). Fix round 1 runs three builders in parallel on disjoint files: site-builder R1 (font CLS + footer wrap + home description), viz-builder R1 (drop 'unsafe-hashes', marker overlap, NBSP, destroy() timers, explorer e2e rejection cases, error-state hint), data-engineer R1 (LANDMARKS from USGS GNIS/MRDS, data.md wording). Garden lede note dropped: with C1, OwlPath is an ongoing project, so "Ongoing projects come first" is now accurate.
74. Meanwhile the C1 checker verifies the CV content in its worktree. Integration order: merge C1 → commit fix-round changes → F9 attempt 2 (fresh checker) on the merged main → push.
75. F9-R1 viz-builder done (docs/builds/F9-R1/viz-builder.md): no inline style/on* attributes left, so write-headers drops 'unsafe-hashes'. After merging C1, Control updates e2e/headers.spec.ts:154–176 (rename, fix comments, assert no 'unsafe-hashes' in the CSP) — deferred to avoid a conflict with C1's edit of the same file.
76. C1 attempt 1 FAIL (two CV bullets regrouped facts; contact rows misaligned at 375). Returned to the same builder in the worktree as attempt 2, plus superscript 'th', NBSP in R² values, Position line width. F9-R1 data-engineer done (USGS GNIS/MRDS landmarks; Ray, Mission, Chino, Bagdad confirmed open pits; data bytes unchanged).
77. C1 attempt 3 PASS_WITH_NOTES. Its checked OwlPath URL delta was accidentally omitted when integrating the snapshot. F9 attempt 2 exposed the omission. The site-builder re-applied the verified URL from the CV in F9-R2. The privacy matcher and historical report redactions are present in C1 commit be62c1e.

77. C1 attempt 3 passed with notes. The supplied CV page-two annotation provides OwlPath URL https://andrewc156.github.io/OwlPath/. The C1 test uses a generic phone-format matcher. Historical attempt 1 reports are redacted; attempt 2 report documents the failure without private digits.

78. F12a (S3 basin mask): the WBD 2025-01-08 release covers Mexico in region 15 (INEGI-harmonized units), so the spec's "coverage gap in Mexico" premise doesn't hold for this release. Only 4 south-west cells fall in no WBD unit, and those are documented in docs/data.md. Control keeps the spec definition HU-2 14 ∪ 15 as built, including HU-4 1508 "Sonora" (drains to the ocean or a closed basin, not to the Colorado) and the Great Divide Closed Basin. Andrew can choose to exclude 1508 (see QUESTIONS.md). F12b copy must not say "US portion only". Suggested label: "USGS Watershed Boundary Dataset regions 14–15", with the credit line from basin-mask.json. Andrew confirmed on 2026-11-24 to keep 14 + 15 as built.

79. CI: the "Headers and CSP under wrangler pages dev" step had never been reached, because `npm run verify` always failed earlier. Once CI1 fixed that, the step failed with "http://localhost:4321/ is already used": Playwright starts its preview webServer even when the headers spec targets wrangler on 8788, and an earlier verify step (probably scripts/check-links.mjs, which kills `npx` but may orphan `astro preview`) left 4321 bound. Control changed playwright.config.ts so that HEADERS_BASE_URL or PW_BASE_URL skips the webServer, and PW_BASE_URL sets baseURL (this also delivers the builders' request for running specs against a 44NN dev server). Verified locally: headers.spec 8/8 against wrangler while 4321 was occupied. The possible orphan in check-links.mjs is noted as a follow-up.

80. F12b (S3 explorer mask): the basin mask is display-only. Lakes and the barcode stay computed on the whole grid per §6.1, and the lakes table gets a "Pit in basin" marker column (shown when the mask is on) rather than a filter. The new URL hash state is `#mask=basin`. Section anchors such as `#lakes` are left untouched, so old links still behave. The public coverage wording in basin-mask.json is being made reader-facing as part of F13a attempt 1 (data-engineer), with no change to basin-mask.bin.

81. Andrew approved the F11b explainer copy: “An island appears when rising water cuts a hill off from land connected to the edge of the grid. It disappears when its last dry cell goes underwater. Each bar spans those two water levels.” Use this approval for the islands strip.

82. Andrew chose option 1 for homepage discoverability. F14 adds a compact toolbar above the hero canvas with the Animation selector and a labeled Settings trigger for the existing panel.

83. Andrew requested the footer credit removal (F15), the Personal portfolio project entry (F16), and a Garden header link with the section anchors in homepage order (F17). The header order is Mission, Work, Research, Open science, Garden, Rising water, CV.

84. Andrew requested GitHub Pages uploads stop in favor of Cloudflare only (F18). Remove the additional GitHub Pages deploy workflow while keeping CI and base-path compatibility.

85. Andrew asked for a better site vibe (2026-11-25). His choices: (a) copy in the first person, warm but academic ("I study… I'm interested in…"), edited with the humanizer rules (no AI-isms) and no new facts; (b) visual polish within the current design system (type scale, spacing, hero framing, distinct research thumbnails, contact and section rhythm), with no redesign of tokens, fonts or accent; (c) no new personal content, since he skipped that question. The work runs after the F9 attempt-4 baseline audit and is followed by a fresh F9 re-audit. Planned features: F19a copy voice (site-builder), F19b hero first frame and framing (viz-builder), F19c visual polish (site-builder, after F19a).

86. New confirmed fact from Andrew (2026-11-25), in his words: "I am interested in PhD's and Mathematics and Data Science REUs." F19a may say that he's interested in PhD programs and in mathematics and data science REUs. It must not say he is applying, name a field or schools for the PhD, or give dates. Suggested placement: the Mission or About copy, and/or near Contact (for example, "I'm interested in math and data science REUs and PhD programs. If you run one, I'd like to hear from you."). The wording is the builder's; the substance must stay exactly this.

87. F19b hero changes, under Andrew's polish brief (#85). They supersede the matching parts of spec §6.3:
- playback starts part-way up the rise, at a deterministic level picked from the engine bars, so the first frame shows several lakes; loops and replays still start from the bottom; reduced motion keeps a static frame at 45%;
- the default bar cap drops from 30 to 12;
- the map is 16:9 (was 2:1) and the barcode strip is shorter;
- hovering or tapping a lake on the map highlights its bar;
- relief shading is stronger.
The hero caption becomes "Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on. The barcode gives each lake a bar from the level where it forms to the level where it merges." This supersedes the caption quoted in §6.3; the spec file itself is left unedited. The copy is unconfirmed until Andrew approves it.

88. F23 production QA fixes (2026-11-25, `docs/qa/f23-production/report.md`, 18 findings). Andrew's choices:
- **QA-18 analytics: keep Cloudflare Web Analytics.** This supersedes the spec's "no trackers or third-party runtime requests" rule for this one beacon only. The CSP allows `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`, nothing broader. No other third-party requests are allowed.
- **QA-12 host/scheme normalization: use a Worker script** in the repo. It permanently redirects `http://` and `www.` to `https://andrewchincea.com`, preserving path and query, and otherwise serves the static assets. Because `_headers` does not apply to Worker-generated responses, the Worker must attach the same security and cache headers itself.
- **Worker name is `personal-portfolio`** (for `wrangler.jsonc`). The Workers Builds deploy command stays `npx wrangler deploy --assets ./dist --compatibility-date 2026-11-23` unless the builder proves it must change; wrangler reads `assets.not_found_handling` from the config file even when `--assets` is passed (checked in wrangler's `resolveAssetOptions`).
- **QA-01 localhost metadata:** Workers Builds separates build variables from runtime "Variables & Secrets"; a runtime `SITE_URL` never reaches `astro build`. The build falls back to `https://andrewchincea.com` when `WORKERS_CI` or `CF_PAGES` is set, and fails rather than emit localhost URLs in a Cloudflare build.
- Control's calls on low-stakes options: QA-15 syncs the URL with `history.replaceState` (no new history entries); QA-17 shows unsupported Type deep links as an active chip with a clear action.
- Split: F24 delivery (site-builder), F25 shell/settings/Garden (site-builder), F26 hero (viz-builder), F27 explorer (viz-builder). Disjoint file sets, built in parallel; one checker run then verifies all four.
