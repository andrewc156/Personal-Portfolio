# Check report — F28b Shell and content feel — attempt 2
Verdict: PASS_WITH_NOTES

Checked the uncommitted working tree on `1fc5125`. F28c's uncommitted changes are also present; they were already checked separately and are only relevant here because they run in the full suite. All probes ran against `astro preview` on 4321 (production build) in Chromium and WebKit.

**Scope.** `git diff --stat` lists 19 files. Every one is an F28b path (`src/styles/**`, `src/components/{site,content}/**`, `src/pages/garden/**`, `e2e/{shell,site}.spec.ts`), an F28c path (`src/components/{hero,explorer}/**`, `e2e/{hero,explorer}.spec.ts`) or `docs/DECISIONS.md` (#92). Untracked files are all under `docs/`. Attempt 2's source change is limited to `src/components/site/settings.ts` (+5 lines, matching DECISIONS #92).

**Gates:**
- check ✅ (170 files, 0 errors, 0 warnings, 0 hints)
- lint ✅ (eslint clean; Prettier clean)
- unit ✅ (37 files, 913/913)
- pytest n/a
- build ✅ (10 pages; CSP script-src +3, style-src +9, same counts as before)
- **e2e ❌ local only:** 241 passed, 5 failed, 10 skipped. All 5 failures are the hero p95 frame-time tests at 66.7 ms (`hero.spec.ts:718` and `:1320` for dye, pond, rivers and collatz). They are host-limited (frames are quantised to 15 fps here), fail identically on the pre-change build (attempt 1), and are left to hosted CI. Every F28b test passes.
- axe ✅ (0 violations of any impact)
- Lighthouse ✅ (see below)
- links ✅ (30 links, 0 broken)
- visual ✅
- content, tda, data: n/a

Lighthouse (mobile, staticDistDir; dark via `--blink-settings=preferredColorScheme=0`, confirmed from the final screenshot). Scores are Perf/A11y/BP/SEO:

| page | light | dark |
|---|---|---|
| / | 100/100/100/100, CLS 0 | 100/100/100/100, CLS 0 |
| /garden/ | 100/100/100/100, CLS 0 | 100/100/100/100, CLS 0 |

These are unchanged from attempt 1. /rising-water/ was skipped because F28b doesn't touch it.

## Attempt-1 fixes, each verified independently

1. **Fix 1, WebKit Tab during the exit: ✅ fixed.**
   - **Probe:** my own, `f28-check-a2-exit.mjs`, in Chromium and WebKit at 1280 and 375. It closes by Esc, a real gear click (1280 only), a real Close click, and Enter on Close. Straight after the close it presses Tab or Shift+Tab, twice each: 56 close-and-Tab rows in total.
   - **Result:** every row has the panel `inert` synchronously after the close, and the panel is still rendered (`display: flex`, mid-exit) when the Tab lands.
     - Tab goes to `#hero-mode` in both engines; Shift+Tab goes to "Dark theme" in Chromium.
     - Focus never lands inside the panel: no `focusin` while it is hidden.
     - After 400 ms focus hasn't moved.
     - `focus()` on the Close button or the seed input mid-exit is refused in both engines.
   - **WebKit Shift+Tab goes to `BODY`.** This is WebKit's default Tab behaviour, not this fix: Shift+Tab from the gear on a page where the panel never opened also goes to `BODY`, and Tab still goes to `#hero-mode`. WebKit Tab only reaches form fields by default.
   - **Mutant control:** I reverted only `settings.ts` to HEAD in a scratch copy, built it, and ran the same probe. WebKit reproduced the original bug: Tab goes to `INPUT#hero-seed` inside the leaving panel, then `BODY`, in 28/28 Tab rows, and `focus()` mid-exit succeeds. So the probe discriminates, and the fix is what removes the bug.
2. **Fix 1, `panel.inert` semantics: ✅**
   - Closed panel on load: `inert` is true and the `inert` attribute is present in both engines at both widths.
   - On open, the first `focusin` inside the panel (`#settings-title`) sees `panel.inert === false`. A Tab inside the open panel reaches a real control.
   - On close, the MutationObserver batch records `inert` added before `hidden`.
   - A remembered open drawer reloads open with `inert === false`.
   - Without JS (both engines, 1280 and 375), the panel has `hidden`, `display: none`, no `inert` attribute and 0 `[inert]` on the page. The gear is disabled and 40 Tabs never enter the panel.
3. **F25 modal behaviour: ✅ (both engines, 390 px, both openers).**
   - role=dialog and aria-modal=true on the sheet.
   - Header, `main`, footer and skip link are inert; focus goes to the title.
   - Esc closes, focus returns to the opener, 0 `[inert]:not(#settings-panel)` remain, and aria-modal is removed.
   - Backdrop tap closes and returns focus.
   - Tab wrap: 0 leaks in 38 Tab/Shift+Tab presses in Chromium.
   - Wide drawer: role complementary, not modal, 0 `[inert]` while open, and it stays open on a background click.
   - **WebKit:** the sheet leaks 5 of 38 Tabs, identical on the pre-fix mutant. This is the existing QA-19, not a regression.
4. **The 3 modified F25 assertions: ✅ the intent is kept.**
   - Each now checks `[inert]:not(#settings-panel)` is 0 and also `#settings-panel.inert === true`. That still proves nothing in the background is left inert, and it adds the new invariant.
   - The open-drawer `[inert]`-count-0 check is unchanged.
   - On the mutant, the two narrow-sheet tests, the remembered-drawer test and both new "closed panel is inert" tests fail at `toHaveJSProperty('inert', true)`, 5 failures in all. So these assertions discriminate.
5. **Fix 2, motion-tokens test: ✅** It parses units and bezier numbers (`toBeCloseTo`, 6 digits) and passes on the minified build.
6. **Fix 3, interrupt test: ✅** It converts `.26s` to 260 and asserts that the measured exit duration (200) is less than 260; it passes at 1280 and 375. See Note 1 for a weakness.
7. **Fix 4, press-feedback test: ✅** It waits for `getAnimations().finished` instead of a fixed 250 ms and reads the scale with ±0.005 tolerance.
   - It still discriminates: with no scale the transform would be `none`, which fails the `^matrix(` check.
   - Reduced motion still expects `none`.
8. **Stability:** the fixed tests and the new inert tests passed 30/30 with `--repeat-each=5` on the production build.

## Acceptance criteria
1. **Plans as written: ✅** No CSS or markup changed since attempt 1; the only source delta is the approved #92 line.
2. **Interruptible, F25 intact: ✅** These are re-run results (`f28-check-a2-probe.mjs`, both engines). Motion is unchanged from attempt 1:
   - Only a `transform` CSSTransition runs: 260 ms `cubic-bezier(0.32, 0.72, 0, 1)` to open, and 200 ms plus the discrete `display` transition to close. Opacity stays 1 and the surface is opaque.
   - Seeked interrupts at 20, 60, 100, 150 and 220 ms leave the offset identical to 6 decimals, at 1280 and 375. For example, 100 ms gives 34.3472 → 34.3472, the same as attempt 1.
   - Real-time spam: no frame between clicks moves away from the target. The flagged samples are click-frame or post-`display: none` artefacts.
   - The frame strips I viewed (6 per engine) show it sliding in and out, opaque, with no double exposure.
3. **Reduced motion: ✅** Press `transform: none`; 0 transitions on panel open/close and on the theme flip; panel transform is `none` on every frame.
4. **Touch: ✅ in emulation.**
   - Taps leave no sticky fill (`same: true` on every target while `:hover` matches), and hover still changes colour with a mouse at 1280.
   - Selects are 16 px under a coarse pointer and 14 px with a mouse.
   - No horizontal overflow at 320, 375 or 390, with or without the sheet.
   - Body min-height resolves to the viewport (svh).
5. **Compositor-only: ✅** Transform and opacity only; the scrim adds CLS 0 on open and close. Hero p95 is advisory locally (66.7 ms, same as base), and hosted CI is authoritative.
6. **No dependencies, CSP hashes only: ✅** `package.json` is untouched and the hash counts are unchanged. With the built CSP injected, there were 0 violations on /, /garden/, /rising-water/ and /404.html in both engines (`f28-check-csp-webkit.mjs`).
7. **`npm run verify`: ✅ except the host-limited p95 tests.** check, lint, unit, build, links and Lighthouse are green. In e2e the only failures are the 5 p95 tests, which are left to hosted CI per DECISIONS #92.
8. **Look unchanged except #91: ✅** Screenshots of / with Settings open and of /garden/ (plain and with a chip active), at 375 and 1280 in light and dark, are all viewed. The sheet is opaque with the scrim at 375, the drawer has no scrim at 1280, theming is correct, and nothing is clipped or overlapping.

Other items re-confirmed:
- **Theme switch:** lands in one frame both ways, with 0 transitions, sync colours equal to final, and no attribute left behind.
- **Press:** `matrix(0.97…)` on `.btn`, `.icon-btn` and `.chip`, with no tap highlight.
- **Garden filter:** instant (9→1 rows; 0 animations on the list).

## Notes (non-blocking)
1. **The interrupt test compares exit against the token, not the real opening transition.** At `e2e/shell.spec.ts:72–75` it compares the exit duration with the `--dur-drawer-in` token rather than the opening transition's own `effect.getTiming().duration`. If the drawer stopped using the token, the test would still pass. My probe shows the real opening transition is 260 ms in both engines, so this isn't blocking; tightening it is optional.
2. **The new inert test's Tab check only proves something through its inert assertion.** The "Tab after close isn't inside the panel" step in `closed panel is inert…` (`shell.spec.ts:649–650`) can't fail in Chromium, which already skipped the leaving panel. The synchronous `inert === true` assertion is what catches a regression, and it does (mutant run). The WebKit behaviour is covered only by the checker probes, because the e2e config is Chromium-only.
3. **Existing items unchanged from attempt 1:**
   - the WebKit sheet Tab-wrap leak (QA-19);
   - the header unpinning during the drawer exit;
   - the real-iPhone checks listed in attempt 1;
   - for WebKit AT, `Accessibility.getFullAXTree` is unavailable, but the leaving panel is now `inert`, which removes it from the AX tree by spec.
4. **Housekeeping for Control:**
   - Delete `docs/builds/F28b/webkit-exit-tab.mjs`, the builder's throwaway, which is outside my write scope. I didn't use it; my own probe replaces it.
   - The untracked `docs/builds/F19a/.Rhistory` is unrelated junk.

## Artifacts
All under `docs/checks/F28b/attempt-2/`:
- `exit-probe-cur.{json,log}` and `exit-probe-mutant.{json,log}`: the Tab-during-exit, inert-semantics, F25 and no-JS probes, on the fix and on the pre-fix `settings.ts`.
- `mutant-e2e.log`: the inert and F25 e2e run against the pre-fix `settings.ts` (5 failed as expected).
- `repeat5.log` (30/30) and `e2e-full-summary.txt` (241 passed, 5 failed, all p95, 10 skipped).
- `regress-{chromium,webkit}.log`, plus `probe/` with the frame strips, scrim and 320 px shots (all viewed) and `cur-chromium-all.json`. WebKit's routed-CSP section stalls on `upgrade-insecure-requests` over http, the same as attempt 1, so its CSP was checked with `csp-webkit.log` instead.
- `axe.{json,log}`, `shots/` (12 PNGs plus `meta.json`, all viewed), `lhci-{light,dark}/` and `lhci-dark-final-screenshot.jpg`.

Tools are in `docs/checks/tools/`:
- `f28-check-a2-exit.mjs`, `f28-check-a2-mutant.sh` (scratch copy, since deleted), `f28-check-a2-probe.mjs` (attempt-1 probe with only the output directory changed), `f28-check-a2-axe.mjs`, `f28-check-a2-shots.mjs` and `f28-check-a2-lhci.cjs`.
- Reused from attempt 1: `f28-check-run.sh` and `f28-check-csp-webkit.mjs`.

Port 4321 is free (`lsof -nP -iTCP:4321` returns nothing). The working-tree diff outside `docs/checks` is byte-identical before and after this check (sha1 `7a798d8278f7ee9a7314efc65a175be333acc15e`). There are no test-results copies under `docs/checks`.
