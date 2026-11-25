# Check report — F19a Copy voice — attempt 1

Verdict: FAIL — the copy gate fails on an unsupported completeness claim and collaborator names moved into descriptive prose. The F19b timing failure is not the basis of this verdict.

Gates: check ✅ (150 files, 0 errors/warnings/hints) · lint ✅ · unit ✅ (818) · pytest ✅ (606) + ruff ✅ · build ✅ (joint and copy-only) · e2e ✅ (site 31/31 joint and 31/31 copy-only; shared run 172 passed, 7 failed, 8 Wrangler-only skipped) · axe ✅ (light/dark F2 checks, zero serious/critical) · Lighthouse ✅ (8 affected routes, each 100 performance/accessibility/best practices/SEO, CLS 0) · links ✅ (27 scanned, zero broken) · visual ✅ (48 captures at the specified three sizes in both themes) · content ❌ · TDA/data n/a.

## Acceptance criteria

- ✅ #85/#86: Mission, About, Open science, Contact and research prose generally use a plain, warm first person. About and Contact say only that Andrew is interested in PhD programs and in mathematics and data science REUs; no application, field, school, or dates added to that fact. All four copy records remain `confirmed: false`. Mission is three sentences. Contact still requires at least one existing link.
- ❌ #85 / §3: Garden and About call the collection exhaustive; existing content contradicts that. Two Garden descriptions put named collaborators in the description as well as the author lists, contrary to the author-only handling recorded in DECISIONS #39. See fixes.
- ✅ F2 data and publishing: Parsed YAML comparison against `7a659bc16658763f0142b92dd177fb66ab247c93` found 12 edited content records, with every non-prose field unchanged and all capped fields ≤160 chars. The nine work items and three topics are unchanged as records; none of the work items are currently drafts. All 10 production pages had zero visible forbidden terms and no draft badges. Dev badge paths are unchanged; no draft fixture was injected into the source.
- ✅ F2 rendering: copy-only Playwright confirmed keyboard and no-JS Garden, deep links, deterministic thumbnails, topic links, citations and CV/PDF behavior; each home Research card retains its filter URL and now has a distinct accessible name beginning “Related work.” No rendered errors, failed requests, third-party requests, or page-level horizontal overflow in the visual matrix. At 375 px the shared nav intentionally scrolls horizontally within its own container.
- ✅ §7 affected routes: `/`, `/about/`, `/garden/`, `/cv/`, `/research/`, and `/research/{number-theory,spectral-fractals,water-quality}/` all met mobile Lighthouse budgets; production JS 1.7–18.8 KB gzip including the joint homepage build (limit 120 KB). Verified on the repository's Chromium runner; no separate Firefox, Safari/iOS or Wrangler run for this feature.

## Blocking fixes

1. `src/pages/garden/index.astro:48`, `src/pages/about/index.astro:24`, `e2e/site.spec.ts:159`: expected curated work without inventing scope. Actual: both say “everything I've worked on”; `/cv/` has CV-only work experience (e.g. Graduation Services Student Assistant, `src/data/cv.yaml`), not listed in the nine-item `/garden/`. Compare those three rendered pages in production. Use wording such as “selected work” or “my work” and revise the exact-text test so it doesn't enforce an overclaim. The older Garden lede used “All”; the new About sentence repeats the unsupported implication on another page.
2. `src/content/work/poster-rivernets-analytics-day-2026.yaml:5`, `src/content/work/talk-maa-southeastern-2026.yaml:5`: expected Michael Liu and Yunus Kaya in the author fields/bylines only (§3 and DECISIONS #39). Actual: both are named in editorial descriptions on `/garden/`, in addition to the structured authors rendered in citations. Open Garden with all items selected; compare the two descriptions with their citations on the topic pages. Keep names in `authors` and describe the work without repeating them in prose.

## Notes (non-blocking)

- Independently buildable: a clean HEAD archive plus only F19a paths passed production build and 31 site tests; no source path overlaps with F19b. Safe to recheck and commit separately after the two copy fixes. Do not include `docs/builds/F19a/.Rhistory` or generated evidence.
- Shared browser failures were independently reproduced on untouched HEAD; none are copy assertions. The checker did not run candidate hosted CI and does not infer a hosted pass. See the F19b report for attribution and prerequisites.
- The Contact invitation and other unconfirmed copy remain Andrew's approval items.

## Artifacts

- Visuals: `docs/checks/F19a/attempt-1/` (48 original PNGs for eight routes × six variants, and contact sheets).
- Logs: `docs/checks/F19b/attempt-1/test-results/e2e-copy-only.log`, `build-copy-only.log`, `runtime.log`, `visual.log`, `lighthouse-scores.txt`, and shared `gate-{check,lint,test,pytest,ruff,build,e2e,lighthouse-corrected,links}.log` in that same directory.
