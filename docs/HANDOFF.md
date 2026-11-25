# Handoff

**Last updated:** 2026-11-24 19:20 EST, Claude Code (Control)

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
| CI1 Fix failing GitHub CI (e2e/cls.spec.ts:171, 412px nav focus) | building (site-builder, attempt 1); CI red since `ef15630` | n/a | — |
| F10 Extra hero modes (S1) | building (viz-builder, attempt 1) | n/a | — |
| F11 Islands barcode (S2) | checking: F11a built (docs/builds/F11a/attempt-1.md), checker attempt 1 running | n/a | — |
| F12 Basin mask (S3) | building: F12a mask data (data-engineer, attempt 1) | n/a | — |
| F13 Place labels (S4) | todo (approved) | n/a | — |

## Current task (four builders running in parallel, with no overlapping paths)

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F10 Extra hero modes | viz-builder | src/lib/viz/common/**, src/lib/viz/hero/**, src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts, docs/builds/F10/ | delegated | four modes, tests, report → checker |
| F11a H1 islands engine | tda-engineer | src/lib/tda/**, tests/unit/tda/**, tests/fixtures/tda/**, pipeline/tda_ref.py, pipeline/tests/test_tda_ref.py, scripts/bench-tda.mjs, docs/tda.md, docs/builds/F11a/ | built, report done | checker attempt 1 running → docs/checks/F11a/attempt-1.md |
| CI1 CI test fix | site-builder | src/components/site/Header.astro, src/styles/**, e2e/cls.spec.ts, e2e/shell.spec.ts, docs/builds/CI1/ | delegated | root cause + fix, report → checker (priority: check first) |
| F12a Basin mask data | data-engineer | pipeline/** (not tda_ref), public/data/colorado/**, docs/data.md, docs/builds/F12a/ | delegated | WBD 14+15 rasterized to grid, tests, report → checker |

After these: F11b islands strip in the hero (viz-builder, after F10 + F11a), F12b mask toggle in the explorer (viz-builder), F13a GNIS labels data (data-engineer, after F12a), F13b explorer labels (viz-builder), then a fresh F9 audit. Checkers run one at a time.

## Handoff vs repo (resume check, 2026-11-24)

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

All are unverified builder work in progress, not yet checked:
- F11a (built): src/lib/tda/h1.ts, types.ts, index.ts, pipeline/tda_ref.py, pipeline/tests/test_tda_ref.py, tests/unit/tda/islands.test.ts, tests/fixtures/tda/islands*.json, generate_islands_fixtures.py, scripts/bench-tda.mjs, docs/tda.md, docs/builds/F11a/
- F10 (building): src/lib/viz/hero/** (modes/), src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts
- F12a (building): pipeline/basin_mask.py and others, public/data/colorado/meta.json
- CI1 (building): header/styles/e2e cls+shell

## Open issues and "Needs Andrew"

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- GitHub CI `npm run verify` has failed on every push since `ef15630`: `e2e/cls.spec.ts:171` says "Rising water is scrolled into view when focused" at 412px. It is Linux-only; the F9 checker passed on macOS. Being fixed as CI1. Andrew is preparing a Cloudflare Pages deploy.
- §6.6 has no H1 statements. Any islands UI copy (F11b) needs explainer wording Andrew approves.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Check CI1 first when it returns, commit and push, and confirm GitHub CI is green (`gh run list --workflow CI`). As each other builder returns, run a fresh checker on it (one at a time). On PASS, commit only its owned paths as `feat(F#): … [checked]` and push. On FAIL, run a fix round.
2. Then F11b, F12b, F13a, F13b as above.
3. Run a fresh F9 full-site audit and update the final report.

## WIP branch

none
