# Handoff

**Last updated:** 2026-11-25 EST, Claude Code (Control)

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
| D1 GitHub Pages base path | done, automatic GitHub Pages deploy retired in F18 | PASS_WITH_NOTES | `71d5077` |
| C1 CV content | done | PASS_WITH_NOTES (attempt 3) | `be62c1e`, `f8061b3`, `c7bdc7c` |
| F9 Final audit | done | PASS_WITH_NOTES (attempt 3) | `c7bdc7c`, reports in `ef15630` |
| Handoff protocol in CLAUDE.md | done | n/a | `e659d0a` |
| CI1 Fix failing GitHub CI (mobile nav focus) | done; GitHub CI green (run 45521148302) | PASS_WITH_NOTES (attempt 1) | `7e9b745` |
| F10 Extra hero modes (S1) | done | PASS_WITH_NOTES (attempt 2) | `0454256` |
| F11 Islands barcode (S2) | done | PASS_WITH_NOTES (F11a attempt 1, F11b attempt 2) | `248ebae`, `0dd1ea1` |
| F12 Basin mask (S3) | done | PASS_WITH_NOTES (F12a and F12b attempt 1) | `4c32017`, `f0060bb` |
| F13 Place labels (S4) | done | PASS_WITH_NOTES (F13a attempt 1, F13b attempt 2) | `7aa2244`, `aa6b3da` |
| F14 Homepage animation toolbar | done | PASS_WITH_NOTES (attempt 1) | `30db9ce` |
| CI2 TDA unit-test timeouts on GitHub | done, hosted CI #37 running | PASS_WITH_NOTES (attempt 1) | `cc75f4d` |
| F15 Footer credit removal | done | PASS (attempt 1) | `9f28641` |
| F16 Personal portfolio project entry | checking | — | — |
| F17 Garden header link and section order | checking | — | — |
| F18 Stop GitHub Pages uploads | done | PASS (attempt 1) | `c9047a5` |

## Current task

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F16 personal portfolio project | checker (Claude Code) | work YAML, e2e/site.spec.ts, docs/checks/F16/ | Builder finished (docs/builds/F16/attempt-1.md). Codex check never finished (report was a PARTIAL stub). | Fresh check, attempt 1 rerun in the main working tree. |
| F17 Garden nav and section order | checker (Claude Code) | nav.ts, e2e/shell.spec.ts, e2e/cls.spec.ts, docs/checks/F17/ | Builder finished (docs/builds/F17/attempt-1.md). Codex check never finished (PARTIAL stub). | Fresh check after F16. |

## Handoff vs repo (resume check)

- Claude Code resume (2026-11-25): main = origin/main at `c9047a5`. The handoff protocol section in CLAUDE.md already exists (`e659d0a`), so it wasn't re-added. No `wip/codex-handoff` or other WIP branch exists locally or on origin. The committed HANDOFF still listed F18 as "commit pending". The working-tree copy was already corrected. The F16 and F17 check reports were PARTIAL stubs, so both get fresh checks. Codex's /private/tmp snapshot is ignored.

- At Codex resume, main matched origin/main at `529dbdc`. Neither remote handoff branch exists. F10 attempt 2 and F13a attempt 1 were marked partial.

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

- F8 documentation clarification was reviewed by Control against Cloudflare’s official build and deployment instructions. No application or hosting configuration changed.

Unchecked feature candidates:

- F16 built, unchecked: portfolio YAML entry in `src/content/work/`, `e2e/site.spec.ts`, and its build report.
- F17 built, unchecked: shared navbar, related shell and CLS nav checks, and its build report.

## Open issues and "Needs Andrew"

- Cloudflare log dated 2026-11-25 01:39 UTC: the normal static build succeeded. Workers Builds then ran `npx wrangler deploy`, auto-added the Cloudflare Astro adapter, and failed prerendering `/rising-water/` when the Workers runtime could not read `/public/data/colorado/meta.json`. The project is specified for Cloudflare Pages Git integration. The site-builder completed the docs-only `docs/deploy.md` clarification and `docs/builds/F8/attempt-2.md`. Control verified the documentation against the supplied log and official Cloudflare references. A second Workers log confirmed explicit `--assets ./dist` bypasses the adapter, then failed because the CLI lacked `--compatibility-date`. Add `--compatibility-date 2026-11-23` to both Workers commands. Andrew supplied a third log confirming Workers deployed version `52c665f3-3ea4-4b4e-9313-0953cff7ca8b` using the explicit assets path and date. Read-only checks returned HTTP 200 on the homepage, explorer, and metadata and 404 on an unknown route. The live canonical URL uses localhost. Andrew confirmed the custom domain `andrewchincea.com` is live. Read-only checks with a browser user agent returned HTTP 200 on the custom-domain homepage, explorer and metadata. The homepage canonical and sitemap still use localhost. Needs Andrew: set the Workers build variable `SITE_URL=https://andrewchincea.com` and trigger a fresh build.

- Andrew deployed the site on Workers and connected `andrewchincea.com`. The remaining deployment setting is the canonical-origin build variable noted above.
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

1. Re-run the F16 and F17 checks (the Codex reports were PARTIAL), then commit and push each on PASS.
2. Run the fresh F9 full-site audit and push its report and handoff.
3. Check hosted CI for the final commit and verify the live canonical URL after the Cloudflare build setting is updated.

## WIP branch

none

Latest Control push: F18 `c9047a5` to origin/main. CI2 hosted #37 was canceled by the next push. Verify the final hosted CI run. Unchecked candidates remain local.
