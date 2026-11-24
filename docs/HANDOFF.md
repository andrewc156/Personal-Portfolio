# Handoff

**Last updated:** 2026-11-24 18:58 EST, Claude Code (Control)

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
| F10 Extra hero modes (S1) | building (viz-builder, attempt 1) | n/a | — |
| F11 Islands barcode (S2) | todo (approved) | n/a | — |
| F12 Basin mask (S3) | todo (approved) | n/a | — |
| F13 Place labels (S4) | todo (approved) | n/a | — |

## Current task

- **Role:** viz-builder, F10 attempt 1 (Andrew approved F10–F13 on 2026-11-24).
- **Files:** src/lib/viz/common/**, src/lib/viz/hero/**, src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts, docs/builds/F10/.
- **Done:** delegated.
- **Left:** build the four modes, then report to docs/builds/F10/attempt-1.md. After that, Control runs a fresh checker.

## Handoff vs repo (resume check, 2026-11-24)

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

None.

## Open issues and "Needs Andrew"

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. When viz-builder returns F10, run a fresh checker on F10. On PASS, commit `feat(F10): … [checked]` and push. On FAIL, run a fix round.
2. F11 Islands barcode (tda-engineer for H1 engine, then viz-builder for the strip) → checker.
3. F12 Basin mask, then F13 Place labels (data-engineer then viz-builder) → checker. Then a fresh F9 audit.

## WIP branch

none
