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
