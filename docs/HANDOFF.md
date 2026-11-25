# Handoff

**Last updated:** 2026-11-24 21:55 EST, Claude Code (Control)

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
| F10 Extra hero modes (S1) | checking: F10 checker attempt 1 running | n/a | — |
| F11 Islands barcode (S2) | F11a engine done (PASS_WITH_NOTES); F11b hero strip todo (after F10) | PASS_WITH_NOTES (F11a attempt 1) | `248ebae` |
| F12 Basin mask (S3) | F12a data done; F12b built, checker queued (after F10, before F13a) | PASS_WITH_NOTES (F12a attempt 1) | `4c32017` |
| F13 Place labels (S4) | F13a built (39 GNIS labels, labels.json 9,962 B), checker queued after F10 | n/a | — |

## Current task (one checker and two builders in parallel, with no overlapping paths)

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F10 check | checker | docs/checks/F10/ only | started | full gates; investigate hero.spec :443/:521/:632/:842 → verdict |
| F12b mask toggle | viz-builder | src/lib/viz/explorer/**, src/components/explorer/**, src/pages/rising-water/**, e2e/explorer.spec.ts, tests/unit/viz/explorer/**, docs/builds/F12b/ | built, report done | checker queued |
| F13a labels data | data-engineer | pipeline/**, public/data/colorado/** (labels.json; no mask changes), docs/data.md, docs/builds/F13a/ | built + addendum done (basin-mask.json reworded, SHA f9f3e4d6…; .bin unchanged) | checker queued after F10 |

Then: F11b islands strip in the hero (viz-builder, after F10 PASS), F13b explorer labels (viz-builder, after F12b + F13a), then a fresh F9 audit.

## Handoff vs repo (resume check, 2026-11-24)

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

All unverified:
- F10 (built, being checked): e2e/hero.spec.ts, src/components/hero/{Hero.astro,HeroSettings.astro,hero-client.ts}, src/lib/viz/hero/modes/**, tests/unit/viz/modes/**
- F13a (built, unchecked): pipeline/labels.py, pipeline/tests/test_labels.py, pipeline/build_colorado.py, pipeline/basin_mask.py, public/data/colorado/{labels.json,basin-mask.json,meta.json}, docs/data.md
- F12b (built, unchecked): src/lib/viz/explorer/{basin.ts,controller.ts,text.ts,types.ts,about.ts}, src/components/explorer/{explorer-client.ts,Explorer.astro,LakesTable.astro,AboutData.astro,build-data.ts}, src/pages/rising-water/index.astro, tests/unit/viz/explorer/basin.test.ts, e2e/explorer.spec.ts

## Open issues and "Needs Andrew"

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- CI1 fixed (`7e9b745`). Confirm that the next GitHub CI run on main is green. CI1 note: the header script is inlined and hashed into the CSP by write-headers.mjs (one more inline hash on every page). Optional: PW_BASE_URL override in playwright.config.ts (Control file).
- §6.6 has no H1 statements. Any islands UI copy (F11b) needs explainer wording Andrew approves.
- F11a note: 2,993 Colorado island bars, so F11b needs a display threshold.
- Resolved: Andrew confirmed the F12 basin mask stays WBD 14 + 15 as built (DECISIONS #78).
- GitHub CI is GREEN again (run 45521148302 on `e473de0`, which includes CI1 `7e9b745`, the config fix `2d79120` and F12a). It had been red since `ef15630`. Follow-up: scripts/check-links.mjs may orphan `astro preview` (DECISIONS #79).
- F12a notes: optional INEGI credit for the Mexican units (F12b); stale 1508 sentence in docs/data.md (F13a is fixing it).
- F13b notes from F13a: show labels.json attribution.credit in About; 9 labels use anchor "mouth"; use `display` if present; Las Vegas at x=2 (place text east).
- F12b check note: its e2e 3 MB transfer test fails only on the dev server (unminified). Must be confirmed on preview. F12b depends on F13a's basin-mask.json SHA, so check F13a before F12b if F13a's addendum changes the json. Order: F10 → F13a → F12b.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Record the F10 verdict, then commit and push on PASS (or run a fix round with viz-builder).
2. Check F12b and F13a as they return, one checker at a time.
3. F11b, then F13b, then a fresh F9 full-site audit.

## WIP branch

none
