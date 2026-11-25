# Check report — F17 Garden header link and section order — attempt 1
Verdict: PASS_WITH_NOTES

I (checker, Claude Code) ran this check on 2026-11-25 against the uncommitted main working tree at `6210515`. F17 changes `src/components/site/nav.ts`, `e2e/shell.spec.ts` and `e2e/cls.spec.ts`.

Gates: check ✅ · lint ✅ · unit (799) ✅ · pytest (606) ✅ + ruff ✅ · build ✅ · e2e (183: 166 passed, 9 failed, 8 skipped) ⚠️ · axe ✅ (inside e2e) · lighthouse ✅ · links ✅ · visual ✅ · content ✅ · tda n/a · data n/a

- **e2e:** every shell, CLS and nav test passes. The 9 hero failures also happen on a clean HEAD, so they aren't caused by F17 (see Note 1).
- **Lighthouse:** run on mobile. `/`, `/garden/` and `/cv/` scored 100/100/100/100 with CLS 0. `/404` passed with the default config. `/rising-water/` scored 96 for performance on both reruns.
- **Links:** all 27 internal links pass.

## Acceptance criteria
1. **The nav order matches the homepage section DOM order.**
   - Probe on `/` (`docs/checks/F17/attempt-1/probe.json` → `order`): the nav reads Mission `/#mission`, Work `/#work`, Research `/#research`, Open science `/#open-science`, Garden `/garden/`, Rising water `/rising-water/`, CV `/cv/`.
   - The section ids in `main` appear in DOM order as `mission, work, research, open-science`, which matches the first four links.
   - `src/pages/index.astro` composes Mission → RecentWork(`work`) → ResearchGrid(`research`) → OpenScience, in the same order.
   - DECISIONS #83 records Andrew's request.
2. **The Garden href and aria-current are correct.**
   - The built `dist/index.html` has `href="/garden/"`.
   - On `/garden/`, Garden is the only nav link with `aria-current="page"`. I checked this at all 5 widths and in both themes.
   - On `/`, no nav link has `aria-current`, which is correct because anchors are excluded (`Header.astro:14`).
   - The active style is visible: an accent colour with an underline in both themes (screenshots).
   - `shell.spec.ts:149-153` clicks Garden and asserts the URL and `aria-current`, and it passes.
3. **withBase works with a non-root base.** I ran `BASE_PATH=/Personal-Portfolio/ npx astro build --outDir <scratch>`.
   - All seven nav links are prefixed: `/Personal-Portfolio/#mission` … `/Personal-Portfolio/garden/` … `/Personal-Portfolio/cv/`.
   - On `garden/index.html`, `<a href="/Personal-Portfolio/garden/" aria-current="page">Garden` is marked, so the `path === href` comparison still holds under the base.
   - The external portfolio link stays absolute.
   - `dist/` wasn't touched, and the scratch output was deleted.
4. **Mobile nav stays on one row and every link is reachable by keyboard.**
   - **Independent probe** at 320, 375, 412, 768 and 832 px: Tab from the wordmark visits Mission → Work → Research → Open science → Garden → Rising water → CV. Every focused link sits fully inside the scrolling `ul` and the viewport. Shift+Tab walks back in reverse.
   - **Layout:** the nav is one row at every width, including 1280, with document overflow 0. The row scrolls horizontally at 320 and 375.
   - **e2e:** `cls.spec.ts:136` × 5 widths ("all 7 links reachable by keyboard", in Plex plus a wider fallback) and `shell.spec.ts:233` (7 links at 375) pass.
5. **Screenshots of the header (desktop and mobile, light and dark).** `docs/checks/F17/attempt-1/header-{home,garden}-{320,375,768,832,1280}-{light,dark}.png` (20), plus `sheet-header-light.png` and `sheet-header-dark.png`.
   - I opened them all. Each shows one row in the requested order, with no overlap or misalignment and legible contrast in both themes.
   - On mobile, the row is clipped by a fade at the scroll edge, which is the existing design (the links are reachable, per item 4).
   - Desktop at 1280 keeps the wordmark, nav, theme toggle and gear on one line. At 768 and 832 the nav sits on its own row under the wordmark, as before.
6. **No CLS regression.**
   - PerformanceObserver: CLS is 0 on `/`, `/garden/` and `/cv/` at 375 and 1280 px over load plus 2 s, font swap included.
   - Lighthouse: CLS is 0 on all four pages.
   - The `cls.spec.ts` font-swap tests pass.
7. **The tests are sound.**
   - The expected label arrays in `shell.spec.ts` and `cls.spec.ts` match `NAV_ITEMS`.
   - The keyboard loops use 7 links.
   - The cls test title now derives its count from `LABELS.length`.
   - The existing `shell.spec.ts:156` test still independently checks section anchor order and scroll landing for the four anchors.

## Blocking fixes
None.

## Notes (non-blocking)
1. **The 9 local e2e failures are all in `e2e/hero.spec.ts` and unrelated.** They are the p95 frame-time tests (50–83 ms against a 22 ms limit), "pauses in a hidden tab" and 4 "reduced motion" frame counts (3 against a limit of 2).
   - A `git archive HEAD` export without F16/F17 fails the same 9 tests when built and run (`hero-HEAD-baseline.log` vs `hero-worktree.log`).
   - The frame times are exact multiples of 16.7 ms, so rAF was throttled. The laptop was on battery at 41%.
   - Control: confirm `hero.spec.ts` on AC power or in hosted CI before committing.
2. **The spec still lists the old nav order.** `portfolio-megaprompt.md` §4.3 says "Nav: Mission · Research · Work · Open science · Rising water · CV". That is now superseded by DECISIONS #83. Control may want to annotate the spec, which is a Control-owned file.
3. **The tests hard-code the order.** Both `shell.spec.ts` and `cls.spec.ts` list it, so a future reorder of homepage sections wouldn't fail the nav test. An assertion that the nav anchor hrefs follow the `main section[id]` DOM order would make Andrew's "match the homepage" rule self-enforcing. This is optional.
4. **Builder request to Control** ("verify Garden on the GitHub Pages base path"): done in item 3. It works.

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
- docs/checks/F17/attempt-1/: header PNGs (20) + sheet-header-{light,dark}.png, e2e.log, build.log, vt.log, lhci.log, lhci-affected.log, probe.json, hero-worktree.log, hero-HEAD-baseline.log, place-labels-repeat5.log, place-label-font-probe.json
- Probes: docs/checks/tools/f16-f17-probe.mjs, docs/checks/tools/place-label-font-probe.mjs, docs/checks/tools/contact_sheet.py
- No preview process left on port 4321.
