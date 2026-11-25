# Handoff

**Last updated:** 2026-11-24 21:08 EST, Codex (Control)

## Status

| Feature | State | Last verdict | Commit |
|---|---|---|---|
| Phase 0 and Codex pointer | done | n/a | `543888a` |
| F1 Site shell | done | PASS_WITH_NOTES | `a33d31c` |
| F2 Content and pages | done | PASS_WITH_NOTES | `cd2097f` |
| F3 Persistence engine | done | PASS_WITH_NOTES | `53e54dc` |
| F4a Colorado DEM | done | PASS_WITH_NOTES | `601cd81` |
| F4b Reference barcode | done | PASS_WITH_NOTES | `f5dddaf` |
| F5 Synthetic hero | done | PASS_WITH_NOTES | `2e666d5` |
| F6 Colorado explorer | done | PASS_WITH_NOTES | `3b3f7ab` |
| F7 Polish and SEO | done | PASS_WITH_NOTES | `e5bdaf9` |
| F8 Cloudflare Pages setup | done | PASS_WITH_NOTES | `dc8e61c` |
| D1 GitHub Pages base path | done | PASS_WITH_NOTES | `71d5077` |
| C1 CV content | done | PASS_WITH_NOTES (attempt 3) | `be62c1e`, `f8061b3`, `c7bdc7c` |
| F9 Final audit | done | PASS_WITH_NOTES (attempt 3) | `c7bdc7c`, reports in `ef15630` |
| Handoff protocol in CLAUDE.md | done | n/a | `e659d0a` |
| CI1 Fix failing GitHub CI (mobile nav focus) | done; GitHub CI green (run 45521148302) | PASS_WITH_NOTES (attempt 1) | `7e9b745` |
| F10 Extra hero modes (S1) | done | PASS_WITH_NOTES (attempt 2) | `0454256` |
| F11 Islands barcode (S2) | F11a engine done (PASS_WITH_NOTES); F11b accepted, commit pending | PASS_WITH_NOTES (F11b attempt 2 and F11a) | `248ebae` |
| F12 Basin mask (S3) | done | PASS_WITH_NOTES (F12a and F12b attempt 1) | `4c32017`, `f0060bb` |
| F13 Place labels (S4) | F13a done, F13b attempt 2 built, checker queued | FAIL (F13b attempt 1); PASS_WITH_NOTES (F13a) | `7aa2244` |

## Current task (one checker and one builder in parallel, with no overlapping paths)

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F11b islands barcode attempt 2 | checker | docs/checks/F11b/ and isolated F11b-r2 candidate | Viz-builder fixed visible caption, preserves link and restores copy on switch/reset. | PASS_WITH_NOTES. 166 browser passes, exact visible caption in all six configurations, CLS within budget. Commit pending. |
| F13b place labels attempt 2 | viz-builder | Label layout, overlay and regression tests | Attempt 1 FAIL: some leaders and markers crossed unrelated text. All other gates passed. | Same builder completed the overlap fix and report. Astro check, lint and 84 explorer tests passed. Independent check queued after F11b. |

A fresh full-site audit follows the stretch work.

## Handoff vs repo (resume check)

- At Codex resume, main matched origin/main at `529dbdc`. Neither remote handoff branch exists. F10 attempt 2 and F13a attempt 1 were marked partial.

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

- F8 documentation clarification was reviewed by Control against Cloudflare’s official build and deployment instructions. No application or hosting configuration changed.

Unchecked feature candidates:
- F11b accepted, commit pending: `e2e/hero.spec.ts`, `src/components/hero/{HeroSettings.astro,hero-client.ts}`, `src/lib/viz/hero/{barcode,controller,islands,model,text}.ts`, `tests/unit/viz/model.test.ts` and `docs/builds/F11b/attempt-{1,2}.md`. Archived attempt-1 FAIL evidence is under `docs/checks/F11b/` and `docs/checks/tools/f11b-*`.
- F13b candidate: `e2e/explorer.spec.ts`, `src/components/explorer/{AboutData.astro,Explorer.astro,PlaceLabels.astro,build-data.ts,explorer-client.ts,place-labels-client.ts}`, `src/lib/viz/explorer/labels.ts`, `src/pages/rising-water/index.astro`, `tests/unit/viz/explorer/labels.test.ts`, and `docs/builds/F13b/attempt-1.md`.

## Open issues and "Needs Andrew"

- Cloudflare log dated 2026-11-25 01:39 UTC: the normal static build succeeded. Workers Builds then ran `npx wrangler deploy`, auto-added the Cloudflare Astro adapter, and failed prerendering `/rising-water/` when the Workers runtime could not read `/public/data/colorado/meta.json`. The project is specified for Cloudflare Pages Git integration. The site-builder completed the docs-only `docs/deploy.md` clarification and `docs/builds/F8/attempt-2.md`. Control verified the documentation against the supplied log and official Cloudflare references. A second Workers log confirmed explicit `--assets ./dist` bypasses the adapter, then failed because the CLI lacked `--compatibility-date`. Add `--compatibility-date 2026-11-23` to both Workers commands. Andrew supplied a third log confirming Workers deployed version `52c665f3-3ea4-4b4e-9313-0953cff7ca8b` using the explicit assets path and date. Read-only checks returned HTTP 200 on the homepage, explorer, and metadata and 404 on an unknown route. The live canonical URL uses localhost. Needs Andrew: set the Workers build variable `SITE_URL=https://personal-portfolio.chinceaandrew509.workers.dev` and rebuild, or use the final custom domain if already chosen.

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- CI1 fixed (`7e9b745`). Confirm that the next GitHub CI run on main is green. CI1 note: the header script is inlined and hashed into the CSP by write-headers.mjs (one more inline hash on every page). Optional: PW_BASE_URL override in playwright.config.ts (Control file).
- Andrew approved F11b copy: “An island appears when rising water cuts a hill off from land connected to the edge of the grid. It disappears when its last dry cell goes underwater. Each bar spans those two water levels.”
- F11a note: 2,993 Colorado island bars, so F11b needs a display threshold.
- Resolved: Andrew confirmed the F12 basin mask stays WBD 14 + 15 as built (DECISIONS #78).
- GitHub CI is GREEN again (run 45521148302 on `e473de0`, which includes CI1 `7e9b745`, the config fix `2d79120` and F12a). It had been red since `ef15630`. Follow-up: scripts/check-links.mjs may orphan `astro preview` (DECISIONS #79).
- F13a updated the Sonora wording in `docs/data.md` and made the basin coverage text ready for the F12b About panel.
- F13b notes from F13a: show labels.json attribution.credit in About; 9 labels use anchor "mouth"; use `display` if present; Las Vegas at x=2 (place text east).
- F12b production transfer is within 3 MB. The checker noted a one-time overlay rasterization cost and the existing image aspect ratio finding.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Finish the F11b caption fix check and commit/push on acceptance.
2. Check the finished F13b overlap fix and commit/push on acceptance.
3. Run and record the fresh F9 full-site audit.

## WIP branch

none

Latest Control push: Cloudflare troubleshooting docs `d11e026` to origin/main. Unchecked candidates remain local.
