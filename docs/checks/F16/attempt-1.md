# Check report — F16 Personal portfolio entry — attempt 1
Verdict: PASS_WITH_NOTES

The checker (Claude Code) wrote this on 2026-11-25, against the uncommitted main working tree at `6210515`. F16 adds `src/content/work/project-personal-portfolio.yaml` and modifies `e2e/site.spec.ts`.

Gates: check ✅ · lint ✅ · unit (799) ✅ · pytest (606) ✅ + ruff ✅ · build ✅ · e2e (183: 166 passed, 9 failed, 8 skipped; all F16 tests pass; the 9 hero failures also occur on clean HEAD, see Notes 1) ⚠️ · axe ✅ (in e2e) · lighthouse ✅ (mobile; `/`, `/garden/` and `/cv/` score 100/100/100/100 with CLS 0) · links ✅ (27 internal links; the external https://andrewchincea.com/ returns 200) · visual ✅ · content ✅ · tda n/a · data n/a

## Acceptance criteria
1. **The schema is valid.** `npm run check` reported 0 errors, 0 warnings and 0 hints across 143 files, and `npm run build` succeeded under Astro's strict zod `workSchema` (`src/content.config.ts`).
   - `type` is `project`, `title` is set, and `date` is `'2026-11'`, which matches `DATE_RE`.
   - The description is 127 characters, under the 160 limit.
   - There's one author. `links` has `site` only and `tags` is `[]`.
   - `draft` is `false` and `confirmed` is `true`. There are no unknown keys.
2. **It renders correctly in /garden/.** In `dist/garden/index.html` the row is `li.work-row[data-id="project-personal-portfolio"][data-type="project"]` with an empty `data-tags`.
   - The row's anchor goes to `https://andrewchincea.com/`.
   - It shows the "Project" tag, the title "Personal portfolio", the description and `<time datetime="2026-11">Nov 2026</time>`.
   - I took screenshots at 375, 768 and 1280 px in light and dark. Nothing is clipped or overlapping, and page overflow is 0 at every size (`docs/checks/F16/attempt-1/garden-item-*.png`, `sheet-items.png`).
3. **It renders correctly in /cv/, under Projects.** The citation reads "**Andrew Chincea** (Nov 2026). [Personal portfolio](https://andrewchincea.com/)." with the description below it. Andrew is bold, and the only link is the existing one. Screenshots of all 6 viewport and theme combinations are clean (`cv-item-*.png`, `cv-viewport-*.png`, `sheet-viewports.png`).
4. **Nothing is invented.** Every rendered string traces back to the YAML.
   - Andrew supplied the title, link and authorship (DECISIONS #83, HANDOFF, and QUESTIONS, which confirm `andrewchincea.com` is live).
   - The month comes from the Cloudflare deploy log dated 2026-11-25.
   - The description's claims ("academic website", "research, projects, and CV", "interactive terrain animations", "Colorado River Basin explorer") all describe things this site visibly has.
   - No venue, coauthor, tag or code link was added.
   - The homepage Recent work list also picks the item up from the collection, which is expected.
5. **The tests are sound.**
   - `ALL_WORK` has length 9, and the type counts `{paper:1, poster:2, talk:1, project:5}` match the 9 YAML files on disk.
   - The new parametrised test covers OwlPath and Personal portfolio on both `/garden/` and `/cv/`. Swapping `toHaveCount(1)` for `toBeVisible()` doesn't weaken it: the locator is strict, so it still fails on zero matches or duplicates, and it now also requires the link to be visible.
   - The data-driven Garden tests (`e2e/site.spec.ts:160-164`, `:190-201`) iterate `PUBLIC_WORK`, so the new row's title, date and type counts are covered without hard-coding.
   - All of these passed in the full run, including `site.spec.ts:588` for both projects.
6. **Hygiene.** The TODO/TBD/lorem/placeholder test, the draft-exclusion test and the no-phone/tel: test all passed in the full e2e run. CLS on `/garden/` and `/cv/` is 0 at 375 and 1280 px (PerformanceObserver probe, `docs/checks/F17/attempt-1/probe.json`).

## Blocking fixes
None.

## Notes (non-blocking)
1. **The 9 local e2e failures are in `e2e/hero.spec.ts` and unrelated to F16.** They are the p95 frame-time tests (50–83 ms against a 22 ms limit), "pauses in a hidden tab" and four reduced-motion frame-count checks (3 frames against a limit of 2).
   - A `git archive HEAD` export, without F16 or F17, built in a scratch directory fails the same 9 tests.
   - The frame times are exact multiples of 16.7 ms, which points to rAF throttling. The laptop was on battery at 41 %.
   - Logs: `docs/checks/F17/attempt-1/hero-HEAD-baseline.log` and `hero-worktree.log`. Control should confirm `hero.spec.ts` on AC power or in hosted CI.
2. This is the only work description in the first person ("for **my** research"). The others are neutral ("This site's interactive explorer…"), so it reads oddly on the CV. Wording like "An academic website for Andrew's research…" or "This site: research, projects and CV…" would match. That's Andrew's call.
3. This entry overlaps with the existing "Rising water" project: same month, and both mention the explorer. OwlPath also uses `ongoing: true` for a live project, and this entry doesn't. Both points are optional; Andrew decides.
4. The first Lighthouse run on `/rising-water/` scored 76 for performance, a cold-start outlier. The two reruns scored 96, and F16 doesn't touch that page.

## Pre-existing CI issue (not counted toward this verdict)

Hosted CI (ubuntu-latest, Chromium) fails `e2e/explorer.spec.ts:873` "explorer: place labels › map labels, markers, and leaders stay separated at 375px (light)" and "(dark)". At line 931, `placed.filter(p => p.topPriority)` has fewer than the 14 priority-1 labels.

**Locally (macOS, Chromium):** both tests pass. They passed in the full e2e run, and all 10 passed with `npx playwright test e2e/explorer.spec.ts -g "stay separated at 375px" --repeat-each=5`. Log: `docs/checks/F17/attempt-1/place-labels-repeat5.log`.

**Hypothesis (reproduced): the label font is a platform font, so label widths depend on the OS.**
- `src/components/explorer/PlaceLabels.astro:76-78`: the label `<text>` uses `font: 600 11px system-ui, sans-serif`. This is not the self-hosted IBM Plex, and it has no size-matched fallback. On macOS it resolves to SF (CDP `getPlatformFontsForNode` reports `.SF NS`). On an Ubuntu runner, Chromium's `system-ui`/`sans-serif` resolves through fontconfig, normally to DejaVu Sans. Its bold face is much wider.
- `src/components/explorer/place-labels-client.ts:30`: `getComputedTextLength()` feeds those widths into `placeLabelBoxes`.
- `src/lib/viz/explorer/labels.ts:188` sets `boxWidth = ceil(textWidth) + 8`. In the loop at `:192-234`, priority 1 has only 4 distances × 8 positions. Each candidate box is clamped into bounds at `:211-212` and must clear every placard, marker and leader at `:216-224`. A priority-1 label that finds no slot is silently skipped, because nothing guarantees placement. Line 931 of the test then counts one fewer.
- Las Vegas is the most fragile case. In `public/data/colorado/labels.json` it is at grid x = 2, the far west edge of the 326-column grid. Every "left" option gets clamped to `PAD` back onto its own marker, so only right-side slots remain, and a wider box has fewer of those.

**Evidence:** `docs/checks/tools/place-label-font-probe.mjs` (output in `docs/checks/F17/attempt-1/place-label-font-probe.json`) overrides only the label font and re-runs layout at 375×900 with the basin mask on:

| Label font | Σ text width (39 labels) | placed | priority-1 placed |
|---|---|---|---|
| system-ui → SF (macOS default) | 3012 px | 26/39 | **14/14** |
| Arial | 2922 px | 25/39 | **14/14** |
| DejaVu Sans Bold (Ubuntu default, v2.37 loaded as a webfont) | 3424 px (+13.7 %) | 24/39 | **13/14**, missing Las Vegas |
| Verdana | 3403 px | 24/39 | **13/14**, missing Las Vegas |

The light and dark results are identical, which matches CI failing both themes. With the DejaVu face the test's line-931 assertion fails exactly as it does on CI. I didn't run the suite on Linux, so the CI font is inferred from Ubuntu's fontconfig default and not observed. The CI Playwright trace or `fc-match system-ui:bold` on the runner would confirm it.

**Fix directions for CI3 (viz-builder's choice):**
1. Make label metrics platform-independent. Set the label text in the self-hosted Plex Sans 600, and re-run `layout()` after `document.fonts.ready`/`loadingdone`, because the ResizeObserver won't fire on a font swap.
2. And/or make priority-1 placement robust. Give edge markers more candidate slots or distances, or let priority 1 displace lower-priority placards.
3. Only as a last resort, relax the test. That would hide a real UX regression on Linux and Android, where Las Vegas disappears.

## Artifacts
- docs/checks/F16/attempt-1/: Garden/CV item + viewport PNGs (3 widths × 2 themes; PNGs gitignored), sheet-items.png, sheet-viewports.png, links.log
- docs/checks/F17/attempt-1/: shared gate logs (e2e.log, build.log, vt.log, lhci*.log), probe.json, hero logs, place-labels-repeat5.log, place-label-font-probe.json
- Probes: docs/checks/tools/f16-f17-probe.mjs, docs/checks/tools/place-label-font-probe.mjs, docs/checks/tools/contact_sheet.py
- No preview process left on port 4321.
