# Handoff

**Last updated:** 2026-11-24 20:26 EST, Codex (Control)

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
| F11 Islands barcode (S2) | F11a engine done (PASS_WITH_NOTES); F11b hero strip delegated to viz-builder | PASS_WITH_NOTES (F11a attempt 1) | `248ebae` |
| F12 Basin mask (S3) | F12a data done; F12b built, checker queued (after F10, before F13a) | PASS_WITH_NOTES (F12a attempt 1) | `4c32017` |
| F13 Place labels (S4) | F13a accepted, F13b queued after F12b | PASS_WITH_NOTES (F13a attempt 1) | — |

## Current task (one checker and one builder in parallel, with no overlapping paths)

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F11b islands barcode attempt 1 | viz-builder | Hero components, hero viz, unit/browser tests, docs/builds/F11b/attempt-1.md | Delegated with approved explainer wording. | Builder report and fresh checker. |
| F13a check | checker | docs/checks/F13a/ only | Data-engineer finished recovery and verified cached output. Replaced Python 3.11-only UTC alias in three pipeline files for §7 Python 3.10 compatibility. | PASS_WITH_NOTES. All 39 labels checked against primary archives. Commit pending. |
| F12b | viz-builder | Explorer files listed below | Review complete. Viz-builder guarded stale mask requests and added a regression. Astro check, lint and 80 explorer unit tests passed. | Independent checker after accepted F13a data. |

Then: F11b islands strip in the hero (after F10 PASS), F13b explorer labels (after F12b + F13a), then a fresh F9 audit.

## Handoff vs repo (resume check)

- At Codex resume, main matched origin/main at `529dbdc`. Neither remote handoff branch exists. F10 attempt 2 and F13a attempt 1 were marked partial.

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

All unverified:
- F11b build may touch the hero components, hero viz files, unit/browser tests and attempt-1 report. F10 is committed.
- F13a (PASS_WITH_NOTES, commit pending): pipeline/labels.py, pipeline/tests/test_labels.py, pipeline/build_colorado.py, pipeline/basin_mask.py, public/data/colorado/{labels.json,basin-mask.json,meta.json}, docs/data.md
- F12b (built, unchecked): src/lib/viz/explorer/{basin.ts,controller.ts,text.ts,types.ts,about.ts}, src/components/explorer/{explorer-client.ts,Explorer.astro,LakesTable.astro,AboutData.astro,build-data.ts}, src/pages/rising-water/index.astro, tests/unit/viz/explorer/basin.test.ts, e2e/explorer.spec.ts

## Open issues and "Needs Andrew"

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- CI1 fixed (`7e9b745`). Confirm that the next GitHub CI run on main is green. CI1 note: the header script is inlined and hashed into the CSP by write-headers.mjs (one more inline hash on every page). Optional: PW_BASE_URL override in playwright.config.ts (Control file).
- Andrew approved F11b copy: “An island appears when rising water cuts a hill off from land connected to the edge of the grid. It disappears when its last dry cell goes underwater. Each bar spans those two water levels.”
- F11a note: 2,993 Colorado island bars, so F11b needs a display threshold.
- Resolved: Andrew confirmed the F12 basin mask stays WBD 14 + 15 as built (DECISIONS #78).
- GitHub CI is GREEN again (run 45521148302 on `e473de0`, which includes CI1 `7e9b745`, the config fix `2d79120` and F12a). It had been red since `ef15630`. Follow-up: scripts/check-links.mjs may orphan `astro preview` (DECISIONS #79).
- F12a notes: optional INEGI credit for the Mexican units (F12b); stale 1508 sentence in docs/data.md (F13a is fixing it).
- F13b notes from F13a: show labels.json attribution.credit in About; 9 labels use anchor "mouth"; use `display` if present; Las Vegas at x=2 (place text east).
- F12b check note: its e2e 3 MB transfer test fails only on the dev server (unminified). Must be confirmed on preview. F12b depends on F13a's basin-mask.json SHA, so check F13a before F12b if F13a's addendum changes the json. Order: F10 → F13a → F12b.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Finish the fresh F13a check and commit/push on acceptance.
2. Check the F11b builder result and F12b explorer mask in sequence on port 4321, then commit/push each accepted feature.
3. Build and check F13b, then run the fresh F9 full-site audit.

## WIP branch

none

Latest Control push: F10 `0454256` to origin/main. Unchecked candidates remain local.
