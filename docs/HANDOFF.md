# Handoff to Claude Code

Written by Codex at 2026-11-24 18:34:06 EST

## Status

| Feature | State | Last checker verdict | Commit hash |
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
| C1 CV content | done | PASS_WITH_NOTES, attempt 3 | `be62c1e`, `f8061b3`, OwlPath correction in `c7bdc7c` |
| F9 Final audit | done | PASS_WITH_NOTES, attempt 3 | `c7bdc7c` |
| F10 Extra hero modes (spec S1) | not started | n/a | — |
| F11 Islands barcode (spec S2) | not started | n/a | — |
| F12 Basin mask (spec S3) | not started | n/a | — |
| F13 Place labels (spec S4) | not started | n/a | — |

## What I did this session

- Control added the exact `AGENTS.md` pointer and pushed `543888a`.
- The C1 checker independently reproduced attempt 2 in a copy of Claude Code's worktree. It failed because an uncommitted test and historical reports exposed private phone digits and the OwlPath URL was missing. The site-builder replaced the matcher with a generic pattern and recovered the URL from the original CV hyperlink. Control redacted the historical reports. Fresh C1 checking passed with notes. Control integrated the CV changes in `be62c1e` and the two checked unit-test files in `f8061b3`.
- The site-builder recovered the interrupted F9 font fix, reviewed the existing implementation and ran its permitted checks. Control retained the completed viz-builder and data-engineer changes and updated the shared CSP test.
- A fresh checker ran F9 attempt 2 on the integrated site. The mobile nav test assumed every link fit the initial viewport, and Control had omitted the checked OwlPath URL during integration. The site-builder fixed those issues in round 2. A fresh checker then passed the full F9 audit with notes. Control committed the remaining checked changes in `c7bdc7c`.
- Control collected completed reports, checker evidence and this handoff in the final docs commit immediately after `c7bdc7c`.
- At Andrew's request, Control added proposed F10–F13 to the handoff and status plan, using the existing stretch scope in the megaprompt.

## Interrupted or in-progress work

No active feature or unfinished report remains. The interrupted **F9 fix round: font CLS fix** belonged to site-builder and touched `src/styles/fonts.css`, `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/site/Header.astro`, `src/components/site/Footer.astro`, `src/pages/index.astro` and `e2e/cls.spec.ts`. Its completed report is `docs/builds/F9-R1/site-builder.md`. F9 fix round 2 is complete in `docs/builds/F9-R2/site-builder.md`. The final checker report and summary are `docs/checks/F9/attempt-3.md` and `docs/checks/F9/summary.md`.

The interrupted **C1 CV content check, attempt 2** belonged to checker and wrote only verification artifacts under `docs/checks/C1/` and checker tools in a temporary copy. There was no partial attempt-2 Markdown report to discard. The fresh attempt-2 FAIL report and attempt-3 PASS_WITH_NOTES report are complete. C1 touched the content and profile data, CV, research and Garden pages and components, plus browser and unit tests. The original Claude worktree retains its historical snapshot. Main is the source for resuming work.

## Uncommitted changes

This is the output of `git status --short --branch` immediately before writing this handoff. The remaining changes all belong to the F9 audit and the Control records for C1/F9. The final docs commit includes these paths and this handoff.

```text
## main...origin/main [ahead 1]
 M docs/DECISIONS.md
 M docs/STATUS.md
 M docs/checks/F9/summary.md
?? docs/builds/F9-R1/
?? docs/builds/F9-R2/
?? docs/checks/F9/attempt-2.md
?? docs/checks/F9/attempt-2/
?? docs/checks/F9/attempt-3.md
?? docs/checks/F9/attempt-3/
?? docs/checks/tools/f9-headers.config.ts
?? docs/checks/tools/f9-r1/
?? docs/checks/tools/f9-r3-contact.mjs
```

- `docs/STATUS.md` and `docs/DECISIONS.md` record Control's F9 and C1 integration decisions and verdicts.
- `docs/builds/F9-R1/` contains the site-builder, viz-builder and data-engineer reports and the data-engineer's pit evidence. `docs/builds/F9-R2/` contains the site-builder report for the navigation and OwlPath fixes.
- `docs/checks/F9/summary.md`, `attempt-2.md`, `attempt-2/`, `attempt-3.md`, and `attempt-3/` are the final-audit reports and evidence. `docs/checks/tools/f9-headers.config.ts`, `f9-r1/`, and `f9-r3-contact.mjs` are F9 checker helpers.
- The feature files present at wrap-up were committed in `c7bdc7c`. The following name-status list records their scope.

```text
M	docs/data.md
A	e2e/cls.spec.ts
M	e2e/explorer.spec.ts
M	e2e/headers.spec.ts
M	e2e/hero.spec.ts
M	e2e/shell.spec.ts
M	e2e/site.spec.ts
M	pipeline/barcode.py
M	pipeline/tests/test_barcode.py
M	src/content/work/project-owlpath.yaml
A	src/styles/fonts.css
M	tests/unit/viz/markers.test.ts
M	tests/unit/viz/text.test.ts
```

Within that list, `docs/data.md` and `pipeline/` are the data-engineer fixes. `e2e/explorer.spec.ts`, `e2e/hero.spec.ts`, and `tests/unit/viz/` are the viz-builder fixes. `src/styles/fonts.css`, `e2e/cls.spec.ts`, and `e2e/shell.spec.ts` are site-builder fixes. `src/content/work/project-owlpath.yaml` and `e2e/site.spec.ts` complete the C1 integration. `e2e/headers.spec.ts` is the shared CSP check update.

## Open issues

- All blocking C1 and F9 findings were resolved. Lighthouse reports an image aspect ratio note on `/rising-water/`. The route scored 96 in Best Practices and met the budget.
- Needs Andrew before deployment. Confirm the domain, hosting method and explicit deployment approval. Remaining content decisions include ORCID and photo, site copy and hero keywords, footer/header preferences, the fractals advisor and poster details, Rising water tagging, and teaching or outreach entries. See `docs/QUESTIONS.md`. The social card can be regenerated after the tagline is confirmed.

## Next steps for Control

1. Resume Claude Code on main and read `docs/STATUS.md` and `docs/checks/F9/summary.md` for the accepted state.
2. Collect Andrew's content decisions and deployment choices from `docs/QUESTIONS.md`.
3. After explicit deployment approval, follow `docs/deploy.md` for the chosen hosting method. If Andrew approves stretch work, use the F10–F13 plan in `docs/STATUS.md` and follow the usual builder and independent checker workflow.

## Deviations

- C1 was checked in temporary copies to respect Andrew's instruction to leave `.claude/` alone. The checker usage limit interrupted attempt 3. Replacement checkers completed its evidence and report.
- Control accidentally included some F9-R1 site and visualization paths in the C1 commit before the full F9 verdict because the commit pathspec included all of `src/`. Control also left out the checked C1 unit-test files and the OwlPath URL delta. The tests were committed separately in `f8061b3`, and the URL was restored in `c7bdc7c`. The final F9 audit covered the combined result.
- F9 builders used the existing role-specific report names under `docs/builds/F9-R1/` and `docs/builds/F9-R2/`. The audit reports use the standard numbered paths. The checker reviewed the visual matrix through contact sheets. The final attempt relied on prior F9 evidence for unchanged explainer wording and geographic and licence sources.
- Full PNG screenshots remain in the local checkout under the repo's ignore rules. Completed reports, contact sheets and text evidence are tracked.

## WIP branch

none
