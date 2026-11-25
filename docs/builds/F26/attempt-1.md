# Build report — F26 Hero playback and accessibility fixes — attempt 1

Summary: Fixed QA-04, QA-05, QA-09, QA-13, QA-14, QA-15 and the hero part of QA-16 from `docs/qa/f23-production/report.md`. A page-level `PlaybackIntent` keeps a manual pause across mode switches. Ends of runs and system pauses don't count as manual pauses. Turning on reduced motion mid-play pauses the current animation, and Play still works. The Rising water live summary now updates at coarse milestones and announces explicit bar selections. Barcode hit-testing is limited to the drawn bar ±6 CSS px. The address bar follows the mode and seed through `history.replaceState`. At narrow widths the toolbar wraps its label. The hero's JS-only controls stay disabled and out of the tab order until the client module runs.

Files changed:
- src/lib/viz/hero/playback.ts (new): `PlaybackIntent` (user-play / user-pause / ended / system-pause) and `progressMilestone()`
- src/lib/viz/hero/url.ts (new): `heroHref(href, mode, seed)`. Sets `seed` and sets `mode` (or drops it for the default mode). Keeps other params and the hash.
- src/lib/viz/hero/barcode.ts: `barcodeHit(x, y, rows, level, minH, maxH, L)` hits only the drawn extent ±`BAR_HIT_TOLERANCE` (6 CSS px × dpr)
- src/lib/viz/hero/controller.ts: adds opts `autoplay` and `progress` (held level), an `onUserPlayback` hook (togglePlay and scrub only), milestone summaries (quarters; at most one every 3 s plus the top), selection announcements (keyboard ↑/↓, strip click/tap, map click/tap, Esc), a view-aware summary, and a `barRect(k)` test getter
- src/lib/viz/hero/text.ts: `summaryText` takes `view` (barcode | diagram | hidden) and `selected`; `islandsSummaryText` takes `chart` and `selected`; new `selectedLakeText` and `selectedIslandText`
- src/lib/viz/hero/modes/shell.ts, modes/index.ts: adds the `autoplay` option and the `onUserPlayback` hook
- src/components/hero/hero-client.ts: wires the intent and restores the held Rising level on return; listens for live `prefers-reduced-motion`; syncs the URL (replaceState, only when mode or seed changes); enables Play and New terrain and sets the hero `tabindex=0` after init; clears the no-JS readout note
- src/components/hero/Hero.astro: Play and New terrain are `disabled` in markup; the hero box has no `tabindex` in markup; the readout has a static note ("A still picture. The animation needs JavaScript."); below 22rem the toolbar puts the label on its own row
- e2e/hero.spec.ts: new `F26 playback and accessibility` describe with 16 tests
- tests/unit/viz/{playback,url,barcode-hit}.test.ts (new); tests/unit/viz/text.test.ts (summary and selection text); tests/unit/viz/model.test.ts (new `barcodeHit` signature)

How to verify:
- `npx vitest run tests/unit/viz/playback.test.ts tests/unit/viz/url.test.ts tests/unit/viz/barcode-hit.test.ts tests/unit/viz/text.test.ts tests/unit/viz/model.test.ts`
- `npx playwright test e2e/hero.spec.ts -g 'F26'` (checker, port 4321)
- Full gates: `npm run check`, `npm run lint`, `npm run test`, `npm run e2e`

Acceptance criteria (self-check):
- ✅ QA-04: `emulateMedia({reducedMotion:'reduce'})` mid-play pauses Rising and Collatz. Frames and progress then stay still, the label reads Play, Play restarts playback, and later switches don't autoplay. Reduced motion at load is unchanged: Rising stays static at 45% (#87), and Collatz build/warm paths are untouched (F22 step 1). (e2e QA-04 ×2 pass)
- ✅ QA-05: After Pause, dye/pond/collatz stay paused, and the return to Rising keeps the held level. Space and scrubbing count as manual pauses. Play clears the flag. A loop-off natural end is not a manual pause: the next mode autoplays. (e2e QA-05 ×3; unit PlaybackIntent)
- ✅ QA-09: At 3× speed the summary shows "Playing … ≥25%" mid-run and "Paused … 100%" at the end, with 2–8 updates per run. ↓ announces "Selected Lake N: born at …, spills into Lake M at …, persistence …". A click on a bar and the islands ↓ key are also announced. The summary says "persistence diagram … points" in diagram view and drops chart copy when the chart is hidden. (e2e QA-09 ×2; unit text)
- ✅ QA-13: Measured select widths were 320→177 px (label wraps above), 360→146, 375→161 (unchanged), 768/1280→190. The longest label is 91 px of text. The selector and Settings stay on one row, with no horizontal overflow. (e2e QA-13 at 320/375/768/1280)
- ✅ QA-14: On seed 123456 with maxBars 32 at 100%, hovering on the bar selects it, 60 px right of the bar clears, and 4 px right still hits. Touch behaves the same: a tap in blank space clears instead of picking a distant bar. Diagram hit (10 px radius) is unchanged. (e2e QA-14; unit barcode-hit at dpr 1 and 2)
- ✅ QA-15: From `/?x=1&mode=collatz&seed=123456#hero-title`, mode changes and New terrain rewrite `mode` and `seed`, keep `x` and the hash, and leave `history.length` unchanged. Reopening the written URL gives the same mode and seed. A bare `/` stays bare until the state changes. (e2e QA-15 ×2; unit url)
- ✅ QA-16 (hero): With JS off, the mode select, Settings, Play and New terrain are disabled, the hero box has no tabindex, and 30 Tabs never land in the toolbar or animation box. With JS on, the controls are enabled and the box has tabindex 0. Hero element boxes at 390 px are identical with and without JS (no CLS). (e2e QA-16 ×2)
- ✅ Perf: no per-frame allocations were added. The milestone check is integer math, plus `performance.now()` only when a milestone changes. URL work runs only when mode or seed changes. Pause rules and DPR cap are unchanged. Frame-time tests were not modified.

Gates (run by builder):
- `npm run test`: ✅ 37 files, 913 tests pass.
- `npm run lint`: ❌ fails repo-wide (923 errors). Every error is a typescript-eslint "multiple candidate TSConfigRootDirs" parsing error caused by untracked copies of the repo under `docs/checks/F19a/attempt-2/test-results/candidate` and `docs/checks/F19b/attempt-{1,2}/test-results/*`. Not caused by F26.
  - Changed files pass `npx eslint --parser-options tsconfigRootDir:$PWD src/lib/viz/hero src/components/hero e2e/hero.spec.ts tests/unit/viz` (explorer excluded).
  - `prettier --check` is clean on every owned path.
- `npx astro check`: ❌ 102 errors, all of the same environment kind. The stale copies declare the same `HTMLElement` globals (`__hero`, `__art`, `__explorer` …), so types resolve to old `HeroController` copies. That also explains the e2e "`barRect`/`highlightedRow`/`lakeRowAt` does not exist" errors.
  - With a scratch tsconfig that extends the repo's and excludes `docs/**`: 0 errors in src/ and in all F26 files.
  - 5 errors remain in files F26 didn't touch (tests/unit/viz/terrain.test.ts Buffer typing, explorer basin test, e2e/explorer.spec.ts), probably artifacts of the scratch config.
- Self-check e2e against `npx astro dev --port 4423`: `-g 'F26'` → 16/16 pass. Dev server stopped afterwards.

Needs Andrew: Nothing blocking. One copy item: the no-JS readout note reads "A still picture. The animation needs JavaScript." The live-region copy stays within §6.6 (items 3–5: birth, spill, persistence, the infinite lowest-lake bar).

Requests to Control:
- Remove or exclude the stray repo copies under `docs/checks/**/test-results/**` (e.g. add `"docs/checks/**/test-results"` to the tsconfig `exclude` and to the ESLint ignores). They break `npm run lint` and `astro check` for every builder.
- e2e/cls.spec.ts (not owned): consider a 320 px home CLS sample. The QA-13 toolbar wrap is pure CSS from first paint and the F26 no-JS/JS box comparison shows no shift, but cls.spec is the canonical guard.
- The site-builder (F25) owns the header theme toggle and the Settings sheet's own no-JS state. The hero Settings button stays disabled in markup until `initSettingsPanel()` enables it, so it needs no change.

Known limitations:
- I ran only the new F26 e2e tests, as instructed. Existing hero tests that touch the changed code were checked by reading only: bar hover at (40,10) or tap at (30,10) lands on row 0's essential bar, which spans the full width at 100%. The 320 px toolbar test still sees the select and Settings on one row (measured). The checker should run the full hero spec.
- The 320 px toolbar is about 26 px taller than before (the label row). It is static layout, not a shift.
- Rising water's held level is restored on return only while a manual pause is in force. After Play, a new Rising run starts at the usual auto-picked level.
- The live summary leads with the selection only on the announcement itself. Later pause/scrub summaries append the selection, and playback milestones leave it out to stay short.
- JS users can see the static readout note until the module script runs (deferred module, same box; no layout shift).
