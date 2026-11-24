# Handoff

**Last updated:** 2026-11-24 18:50 EST, Claude Code (Control)

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
| F10 Extra hero modes (S1) | blocked: needs Andrew's approval | n/a | — |
| F11 Islands barcode (S2) | blocked: needs Andrew's approval | n/a | — |
| F12 Basin mask (S3) | blocked: needs Andrew's approval | n/a | — |
| F13 Place labels (S4) | blocked: needs Andrew's approval | n/a | — |

## Current task

- **Role:** Control. **Files:** `docs/HANDOFF.md` only.
- **Done:** Resumed from Codex and checked the handoff against the repo. Added the handoff protocol to CLAUDE.md. No WIP branch exists. No reports are marked PARTIAL. There is no unchecked work on main.
- **Left:** Andrew needs to decide on the stretch features. Spec §10 says stretch work starts "only after F9 PASS and only if Andrew says yes".

## Handoff vs repo (resume check, 2026-11-24)

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

None.

## Open issues and "Needs Andrew"

- Approve or decline stretch features F10–F13 (S1–S4). The scope is in `docs/STATUS.md`.
- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Get Andrew's yes or no on F10–F13.
2. If yes, delegate F10 to viz-builder, then run the checker and commit and push on PASS. Then F11 (tda-engineer + viz-builder), F12 (data-engineer + viz-builder), F13 (data-engineer + viz-builder), and a fresh F9 audit at the end.
3. Collect the `docs/QUESTIONS.md` answers and deployment approval.

## WIP branch

none
