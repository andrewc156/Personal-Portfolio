# Handoff

**Last updated:** 2026-11-26 EST, Hermes Agent / Claude Code (Control)

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
| F16 Personal portfolio project entry | done | PASS_WITH_NOTES (attempt 1) | `49befc5` |
| F17 Garden header link and section order | done | PASS_WITH_NOTES (attempt 1) | `51133cd` |
| F18 Stop GitHub Pages uploads | done | PASS (attempt 1) | `c9047a5` |
| CI3 Place labels robust to font metrics | done; hosted CI green (run 45557116146) | PASS_WITH_NOTES (attempt 1) | `5c54ee2` |
| F9 Final audit (post-stretch) | done (baseline before F19) | PASS_WITH_NOTES (attempt 4) | `e426d03` |
| F19a Copy voice (first person, humanized) | done | PASS (check attempt 2) | `111f774` |
| F19b Hero first frame and framing, plus /rising-water/ spacing and hero reduced-motion race | done (WIP integrated) | PASS (check attempt 2) | `637d2a6` (candidate `464da59`) |
| F19c Visual polish within the system | done | PASS (check attempt 1) | `680aeac` |
| F20 Hero Settings cog | done | PASS (attempt 1) | `9f9fb7c` |
| F21 Collatz steps setting | done | PASS (attempt 1) | `a74ce65` (candidate `83d402f`) |
| F22 Collatz starts at step one | done | PASS (attempt 1) | `614feef` (candidate `755a594`) |
| F23 Collatz default 30 | done and live | PASS (attempt 1) | `20d59f9` |
| F24 Production delivery (QA-01/02/12/18) | done | PASS_WITH_NOTES (attempt 1; Control fixed deploy.md notes 1–3) | — | — |
| F25 Shell, Settings sheet, Garden (QA-03/11/16/17) | done | PASS_WITH_NOTES (attempt 2) | — | — |
| F26 Hero playback and a11y (QA-04/05/09/13/14/15/16) | done | PASS_WITH_NOTES (attempt 1) | — | — |
| F27 Explorer focus/touch/keyboard/no-JS (QA-06/07/08/10) | done | PASS_WITH_NOTES (attempt 1) | — | — |
| F28 Natural UI pass (setup) | set up; F28a audit dispatched (checker role, read-only) | n/a | `c86d3f0` |
| F9 re-audit after F19 | blocked on browser coverage | FAIL (attempt 5) | audited `680aeac`; report in this docs checkpoint |

## Current task

| Task | Role | Files | Done | Left |
|---|---|---|---|---|
| F28 Natural UI pass | Control | `docs/builds/F28/plan.md`, `docs/design-skills/emil-kowalski/**`, DECISIONS #89, STATUS | Library review done; Emil's skills vendored; plan written (`c86d3f0`); F28a audit dispatched 2026-11-26 (Hermes subagent sa-0-663574b3; writes docs/checks/F28a/; port 4321 in use by it) | Wait for F28a (checker role, read-only audit) → triage into DECISIONS #90 → F28b and F28c in parallel → optional F28d → one fresh checker. |
| F9 post-F19 audit | Control / checker | `docs/checks/F9/attempt-5.md` | FAIL only on the unverified browser matrix | Still needs a multi-version browser runner. |

## Handoff vs repo (resume check)

- Hermes resume: pull/fetch found `main = origin/main` at `f65c6d0`; CI run 45564236156 passed. Origin has only `main`; the old Claude worktree stays untouched. The F19 builds are complete on paper, but both checker reports were PARTIAL. F9 attempt 4 is already committed in `e426d03`; `docs/STATUS.md` had stale F19a/b todo rows. Disk check: 11 GiB free.

- Claude Code resume (2026-11-25): main = origin/main at `c9047a5`. The handoff protocol section in CLAUDE.md already exists (`e659d0a`), so it wasn't re-added. No `wip/codex-handoff` or other WIP branch exists locally or on origin. The committed HANDOFF still listed F18 as "commit pending". The working-tree copy was already corrected. The F16 and F17 check reports were PARTIAL stubs, so both get fresh checks. Codex's /private/tmp snapshot is ignored.

- At Codex resume, main matched origin/main at `529dbdc`. Neither remote handoff branch exists. F10 attempt 2 and F13a attempt 1 were marked partial.

- Codex's "Uncommitted changes" list was stale. Those paths were committed in `ef15630`, and the tree was clean on resume.
- There is an old Claude worktree at `.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, at `dc8e61c`) with uncommitted C1-era edits. It is the historical snapshot the C1 notes describe, and the C1 content on main supersedes it. Per Andrew's instruction it stays untouched under `.claude/`. It is not a WIP branch to merge.

## Uncommitted changes

- None for features. F24–F27 were committed and pushed (`827390c`, `44835b7`, `8b871b8`, `8e2f839`, docs `5e189c9`, `217bd79`).
- Untracked stale F19 checker artifacts (`docs/checks/F19a/attempt-2/`, `docs/checks/F19b/attempt-2/`, `docs/checks/tools/f19-*`, `f21-independent.mjs`, `docs/builds/F19a/.Rhistory`): historical, not staged.

## Open issues and "Needs Andrew"

- F9 blocker: last two Chrome, Firefox and Safari releases including actual iOS are not all verified. Firefox failed even on a blank page; iPhone WebKit emulation is not actual Safari/iOS. Control preflight found one desktop Safari (27.2) and no `simctl` available. No source fix is indicated by these results. Need access to a suitable real-browser/device runner.

- F19b exact WIP candidate passed all five unchanged ≤22 ms tests in hosted CI 45573412148. Local Chromium timing and two pre-existing explorer/hidden-tab races are documented in checker reports; don’t weaken those gates.
- 11 GiB free at resume; recheck before full Lighthouse audit.
- F9 attempt-4 notes: missing spaces on /rising-water/ at LakesTable.astro:36-37 and rising-water/index.astro:126-127 and :131-132 (folded into F19b); the hero reduced-motion e2e has a startup race at hero.spec.ts:918-928 (folded into F19b).

- F16 notes (Andrew's call): the description is in the first person ("for my research"); it overlaps with the "Rising water" project; and it lacks `ongoing: true`. F17 note: spec §4.3 still lists the old nav order (superseded by DECISIONS #83).
- Local hero.spec.ts frame-time tests fail on this Mac even on AC power. Headless Chromium runs requestAnimationFrame at about 33 ms on a blank page, likely because the display is asleep or covered. They pass on hosted CI, which is the authority for these tests.
- CI3 notes (non-blocking): in 1 of 4,000 synthetic layouts, a rescue slot costs one priority-1 placement (labels.ts:283-290). Leaders run 70-125 px only at 320-335 px with widths ×1.1 or more. The `loadingdone` listener is never removed (place-labels-client.ts:77).
- RESOLVED by CI3 (`5c54ee2`, CI run 45557116146 green). Earlier: hosted CI was RED on main. Runs 45532297932 (F13b `aa6b3da`) and 45534748972 (F18 `c9047a5`) both fail. e2e/explorer.spec.ts:873, the place labels test at 375px light and dark, gets fewer than 14 priority labels at line 931. It passed in local checks. Tracked as CI3 (owner viz-builder). Run 45551772489 on `6210515` confirms: only these 2 fail; hero tests pass on hosted CI.

- Cloudflare log dated 2026-11-25 01:39 UTC: the normal static build succeeded. Workers Builds then ran `npx wrangler deploy`, auto-added the Cloudflare Astro adapter, and failed prerendering `/rising-water/` when the Workers runtime could not read `/public/data/colorado/meta.json`. The project is specified for Cloudflare Pages Git integration. The site-builder completed the docs-only `docs/deploy.md` clarification and `docs/builds/F8/attempt-2.md`. Control verified the documentation against the supplied log and official Cloudflare references. A second Workers log confirmed explicit `--assets ./dist` bypasses the adapter, then failed because the CLI lacked `--compatibility-date`. Add `--compatibility-date 2026-11-23` to both Workers commands. Andrew supplied a third log confirming Workers deployed version `52c665f3-3ea4-4b4e-9313-0953cff7ca8b` using the explicit assets path and date. Read-only checks returned HTTP 200 on the homepage, explorer, and metadata and 404 on an unknown route. The live canonical URL uses localhost. Andrew confirmed the custom domain `andrewchincea.com` is live. Read-only checks with a browser user agent returned HTTP 200 on the custom-domain homepage, explorer and metadata. The homepage canonical and sitemap still use localhost. Andrew reports `SITE_URL` was already set. Investigate which build environment and deployed `dist` produced the live localhost metadata before recommending a configuration change.

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

1. IN PROGRESS: F28a audit. If the session drops, treat docs/checks/F28a/ as unverified when it still starts with PARTIAL and re-dispatch. The checker role does the read-only audit with improve-animations, mobile-native, remove-animations and emil-design-eng (brief in docs/builds/F28/plan.md) and writes to docs/checks/F28a/.
2. Triage the F28a plans into DECISIONS #90 (look-changing plans → Needs Andrew), then dispatch F28b (site-builder) and F28c (viz-builder) in parallel.
3. Decide on F28d (NumberFlow) from the audit. If it goes ahead, add `number-flow@0.6.2` and the shadow-style CSP hash, then dispatch the viz-builder.

Previous round (done): F24–F27 merged through candidate CI 45720189475; production `npm run check:prod` 178/0.

## WIP branch

None. F22 draft PR #3 merged on PASS; `wip/codex-handoff` was deleted locally and on origin.

Latest verified main push: F23 `20d59f9` (CI 45704540528 and Workers Build succeeded; live Collatz slider default 30 verified). F22 `614feef` (candidate CI 45701214633 passed; merged main CI 45702534254 success (completed)). F21 `a74ce65` (exact candidate CI 45696088155 and merged main CI 45698726531 passed). F20 `9f9fb7c` passed hosted CI 45692029569. F19c `680aeac` also passed CI 45645398484; hosted candidate CI 45573412148 passed. Main CI 45643294552 passed on F19b; prior F19a main CI 45575890659 passed.

Discarded the two PARTIAL checker reports; moved the interrupted F19b logs to Hermes scratch (not repository evidence for the fresh verdict).
