# Handoff

**Last updated:** 2026-11-24 20:45 EST, Claude Code (Control)

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
| CI1 Fix failing GitHub CI (mobile nav focus) | done; GitHub CI confirmation pending | PASS_WITH_NOTES (attempt 1) | `7e9b745` |
| F10 Extra hero modes (S1) | built, waiting for checker (queue: CI1 → F12a → F10) | n/a | — |
| F11 Islands barcode (S2) | F11a engine done (PASS_WITH_NOTES); F11b hero strip todo (after F10) | PASS_WITH_NOTES (F11a attempt 1) | `248ebae` |
| F12 Basin mask (S3) | checking: F12a checker attempt 1 running | n/a | — |
| F13 Place labels (S4) | todo (approved) | n/a | — |

## Current task: no builders running; F12a checker running; F10 check queued

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F10 Extra hero modes | viz-builder | src/lib/viz/common/**, src/lib/viz/hero/**, src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts, docs/builds/F10/ | built, report done | checker queued |
| F12a Basin mask data | data-engineer | pipeline/** (not tda_ref), public/data/colorado/**, docs/data.md, docs/builds/F12a/ | built | checker attempt 1 running → docs/checks/F12a/attempt-1.md |

After these: F11b islands strip in the hero (viz-builder, after F10 + F11a), F12b mask toggle in the explorer (viz-builder), F13a GNIS labels data (data-engineer, after F12a), F13b explorer labels (viz-builder), then a fresh F9 audit. Checkers run one at a time.

## Handoff vs repo (resume check, 2026-11-24)

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

All are unverified builder work in progress, not yet checked:
- F10 (built, unchecked): src/lib/viz/hero/modes/** (new), src/components/hero/{hero-client.ts,HeroSettings.astro,Hero.astro}, tests/unit/viz/modes/**, e2e/hero.spec.ts
- F12a (built, unchecked): pipeline/basin_mask.py, pipeline/build_colorado.py, pipeline/tests/test_basin_mask.py, public/data/colorado/{basin-mask.bin,basin-mask.json,meta.json}, docs/data.md

## Open issues and "Needs Andrew"

- Before deployment: domain, hosting method, and explicit deployment approval (`docs/deploy.md`).
- Content decisions in `docs/QUESTIONS.md`: ORCID and photo, site copy and hero keywords, footer/header, fractals advisor and poster details, Rising water tagging, teaching/outreach. Regenerate the social card once the tagline is confirmed.
- CI1 fixed (`7e9b745`). Confirm that the next GitHub CI run on main is green. CI1 note: the header script is inlined and hashed into the CSP by write-headers.mjs (one more inline hash on every page). Optional: PW_BASE_URL override in playwright.config.ts (Control file).
- §6.6 has no H1 statements. Any islands UI copy (F11b) needs explainer wording Andrew approves.
- F11a note: 2,993 Colorado island bars, so F11b needs a display threshold.
- Resolved: Andrew confirmed the F12 basin mask stays WBD 14 + 15 as built (DECISIONS #78).
- Non-blocking: Lighthouse image-aspect-ratio note on `/rising-water/` (score is within budget).

## Next 3 actions

1. Confirm GitHub CI is green for `7e9b745`. F12a checker (running), then the F10 checker (CI1 checker saw 5 hero.spec failures from F10, incl. :842 off-screen pause), one at a time, committing only each feature's owned paths.
2. After F10 PASS: F11b islands strip in the hero (viz-builder). After F12a PASS: F12b explorer mask toggle (viz-builder) and F13a GNIS labels data (data-engineer).
3. F13b explorer labels, then a fresh F9 full-site audit.

## WIP branch

none
