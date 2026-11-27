# Check report — F28b Shell and content feel — attempt 1
Verdict: FAIL

Checked the uncommitted working tree on `1fc5125`, using the F28b paths only. The base for before/after is a throwaway `git worktree` of `1fc5125` (since removed). Tools: `docs/checks/tools/f28-check-*`. Probes ran against `astro preview` on 4321 (production build) in Chromium and WebKit.

Gates: check ✅ · lint ✅ · unit (913) ✅ · pytest n/a (pipeline/ unchanged) · build ✅ · e2e ❌ (235 passed, 9 failed, 10 skipped. Four failures are new F28b tests; five are the host-limited p95 tests, which also fail on base) · headers e2e ✅ (10/10 under `wrangler dev` on 4321) · axe ✅ (shell axe tests pass; 0 violations with the panel frozen mid-exit in both engines) · lighthouse ✅ (see below) · links ✅ (30 links, 0 broken) · visual ✅ · content n/a (no copy changes) · tda n/a · data n/a

Lighthouse (mobile, staticDistDir, one run each; dark theme via `--blink-settings=preferredColorScheme=0`). Scores are Perf/A11y/BP/SEO; every page has CLS 0:

| page | light | dark |
|---|---|---|
| / | 100/100/100/100 | 100/100/100/100 |
| /garden/ | 100/100/100/100 | 100/100/100/100 |
| /rising-water/ | 81/100/96/100 | 96/100/96/100 |
| /about/ | 100/100/100/100 | 100/100/100/100 |
| /404.html | 100/100/100/100 | 100/100/100/100 |

/rising-water/ meets its ≥ 80 performance budget. Its BP of 96 comes from the existing `image-aspect-ratio` audit on `hillshade.webp`, which isn't an F28 file.

## Acceptance criteria
1. **Plans implemented as written: ✅ in the CSS.** I diffed 01, 02, 03, 04, 05, 06, 07, 08, 10 and 11 against their targets. Deviations: 02's test, 04's merged `.link-btn` rule, and 11's chip selector (it adds `getClientRects`). All are justified. In `dist/`, the CSS keeps `@starting-style{.settings[data-astro-cid-psic4rm5]{…}}` for the drawer, the sheet and reduced motion, plus `.settings[data-astro-cid-psic4rm5][hidden]{…}`. `body:after` and `:root[data-settings-modal] body:after` are unscoped. No `@keyframes` or `settings-in-*` remain, and every `:hover` in `src/` sits inside `(hover: hover) and (pointer: fine)`.
2. **Interruptible enter and exit: ✅ motion, ❌ a11y.** The motion checks pass in both engines (`f28-check-probe.mjs drawer`):
   - Only a `transform` CSSTransition runs: 260 ms `cubic-bezier(0.32, 0.72, 0, 1)` to open and 200 ms to close, plus the discrete `display` transition. Opacity stays 1 on every sampled frame, and the surface is opaque (`rgb(253,251,247)` / `rgb(26,29,32)`).
   - Seeked interrupts at 20, 60, 100, 150 and 220 ms: the offset right after the interrupting click equals the offset before it, to 6 decimals, at 1280 and 375. For example, close at 100 ms gives 34.3472 → 34.3472.
   - Real-time spam (10–11 clicks in 0.9 s): no frame moves away from the current target, so nothing restarts. WebKit's samples run 79.8 → 150.5 → 292.8 after a close.
   - The strips show the drawer entering from the right and the sheet rising from the bottom, opaque, with no double exposure.

   **What fails:** the closing panel can take keyboard focus in WebKit. See Blocking fix 1.

   The F25 checks pass: role=dialog and aria-modal=true on the sheet, `main` and the header inert, Tab and Shift+Tab stay inside in Chromium, Esc closes and focus returns to the gear, a backdrop tap closes it, and no `[inert]` is left behind. The existing shell e2e also passes.
3. **Reduced motion: ✅.** Panel transform is `none` on every frame at 1280 and 375. Opening, closing and flipping the theme start 0 CSSTransitions, and press gives `transform: none` (Chromium and WebKit).
4. **Touch: ✅ in emulation.**
   - Taps on New terrain, Play, the gear, a nav link, the wordmark, a Garden chip, a work row and a research-card title leave the computed fill or colour unchanged. `:hover` still matches after the tap; the gate is what stops the fill. Base shows sticky fills on 7 of the 8 targets in both engines, so the probe does discriminate.
   - With a mouse at 1280, all 8 targets change colour on hover.
   - Settings selects compute to 16 px with touch and 14 px with a mouse.
   - No horizontal overflow on /, /garden/ or /rising-water/ at 320, 375 or 390, with or without the sheet open.
   - `body` min-height resolves to `100svh`.
5. **Compositor-only: ✅.** The panel uses transform, the scrim opacity and press transform. Colour hovers are unchanged, only gated now. The scrim adds 0 CLS while opening and closing.

   Hero p95 is advisory locally. Run alone, it measures 66.7 ms on both base and F28 (host-limited: rAF is quantised to 15 fps here). In the full suite it measured 116.7–133.3 ms. That's unchanged from base; hosted CI is authoritative.
6. **No dependencies, CSP hashes only: ✅.**
   - `package.json` is untouched.
   - `dist/` has 0 `style="` attributes. The script-src hashes are identical to base, and style-src still has 9 element hashes (contents changed, count didn't).
   - With the built CSP injected into preview responses, I saw 0 `securitypolicyviolation` events and 0 console CSP messages on /, /garden/, /rising-water/ and /404.html, while opening Settings and flipping the theme, in both engines. `upgrade-insecure-requests` was dropped for this http-localhost probe only.
7. **`npm run verify`: ❌.** e2e is red because of the 4 F28b test defects (fixes 2–4). Links, Lighthouse and CLS are within budget.
8. **Look unchanged except #91: ✅.**
   - Garden at 375, 768 and 1280 in light and dark is pixel-identical to base (0 px).
   - Home differs only in the random hero terrain and the 16 px touch select.
   - The sheet adds the scrim: light `rgba(28,27,25,0.28)`, dark `rgba(0,0,0,0.5)`, opacity 1 when open. The wide drawer stays at opacity 0 at both 768 and 1280, and the scrim is back to 0 after closing.

Other items checked:
- **Theme switch:** lands in one frame both ways. It starts 0 CSSTransitions, against 15 on base, and the colours on the synchronous read equal the final ones. `data-theme-switching` is cleared, and the hover transitions still run afterwards.
- **Press:** `matrix(0.97…)` on `.btn`, `.icon-btn` and `.chip`. Tap highlight is `rgba(0,0,0,0)`; `user-select: none` and `touch-action: manipulation` are set.
- **Garden filter:** synchronous, for example 9 → 1 rows on the same task, with 0 animations on the list.

## Blocking fixes (FAIL only)

1. **Keyboard focus lands in the closing panel, then is lost (WebKit/Safari a11y regression).**
   - **Where:** `src/components/site/settings.ts:109` (`panel.hidden = !open;`), together with `src/components/site/SettingsPanel.astro:75–83` (`[hidden]` stays rendered for 200 ms through `display … allow-discrete`).
   - **Expected:** after Esc, the gear or the close button, the next Tab goes to the next control after the panel (base: `#hero-mode`), and the leaving panel can't be focused or reached by AT.
   - **Actual (WebKit, 1280 and 375, 3/3 runs):**
     - Esc then Tab (~15–20 ms later) focuses `INPUT#hero-seed` inside the leaving panel (`hidden=true`, `display: flex`).
     - 400 ms later focus is on `BODY`, so a keyboard user's focus is dropped.
     - `focus()` on the close button succeeds mid-exit.
     - Base WebKit sends that Tab to `#hero-mode`.
     - Chromium already treats the leaving panel as unfocusable and leaves it out of the AX tree, which is why the Chromium-only e2e can't see this.
   - **Fix:** in `setSettingsOpen`, set `panel.inert = !open` immediately before `panel.hidden = !open`, so inert clears before focus moves in on open and is set synchronously on close. Without JS the panel is still just `hidden`. I simulated exactly this in-page (`f28-check-inert-fix.mjs`): WebKit then sends Tab to `#hero-mode` and focus stays there, Chromium is unchanged, and opening still focuses the title. This touches `settings.ts`, which plan 02 put out of bounds, so Control has to authorise it. It is inside site-builder ownership.
   - **Test:** in `shell.spec.ts`, assert `#settings-panel` has `inert === true` synchronously after Esc/close and `false` when open. That works in the Chromium-only project. Optionally, also assert that Tab right after Esc doesn't land inside the panel.
   - **Repro:** `bash docs/checks/tools/f28-check-run.sh . docs/checks/tools/f28-check-inert-fix.mjs`, or `… f28-check-probe.mjs webkit cur exit`.
2. **`e2e/shell.spec.ts:1015–1021` "motion tokens exist (F28)" fails on the production build.**
   - **Expected:** the tokens are checked by value.
   - **Actual:** the minifier serialises them as `cubic-bezier(.23, 1, .32, 1)`, `cubic-bezier(.32, .72, 0, 1)`, `.16s`, `.26s` and `.2s`, so the string compare fails deterministically. The builders only ran it on dev.
   - **Fix:** compare semantically. Either apply each token to a probe element (`transition-duration: var(--dur-press)` read back as `0.16s`; `transition-timing-function: var(--ease-out)` read back as normalised `cubic-bezier(0.23, 1, 0.32, 1)`), or parse the numbers and units.
   - **Repro:** `npm run build && npx playwright test e2e/shell.spec.ts -g "motion tokens"`.
3. **`e2e/shell.spec.ts:71–73, 644`: the enter/exit interruptibility tests (1280 and 375) fail.**
   - **Actual:** `enterMs = parseFloat('.26s')` gives `0.26`, so `expect(200).toBeLessThan(0.26)` fails deterministically on the build. Every jump assertion before it passed (Δ < 1 px).
   - **Fix:** use the opening transition's own `effect.getTiming().duration` (260), or convert the s/ms units, and assert 200 < 260.
   - **Repro:** `npx playwright test e2e/shell.spec.ts -g "interruptible"`.
4. **`e2e/shell.spec.ts:1104`: the press feedback test is timing-dependent.**
   - **Actual:** `matrix(0.970021, …)` and `matrix(0.970105, …)` in 3/3 local runs. On this host, frames are 66 ms apart, so the 160 ms transition hasn't settled 250 ms after mousedown, and the regex `^matrix\(0\.97, 0, 0, 0\.97,` fails. My own probe at 250 ms got the exact `0.97` once and `matrix(1,…)` once.
   - **Fix:** await `Promise.all(btn.getAnimations().map(a => a.finished))` before reading, or parse the matrix and use `toBeCloseTo(0.97, 2)`.
   - **Repro:** `npx playwright test e2e/shell.spec.ts -g "press feedback"`.

## Notes (non-blocking)
- **Builder risk "AT sees the closing panel":** Chromium's `Accessibility.getFullAXTree` doesn't expose the leaving panel. Playwright's `ariaSnapshot` does, but it uses its own visibility rules. WebKit AT couldn't be inspected; fix 1 covers it either way.
- **WebKit tab wrap is pre-existing:** WebKit's tab wrap inside the modal sheet leaks, because WebKit tabs to text fields only by default. This happens on base too, so it isn't an F28 regression. Worth a separate look.
- **Header unpin:** it unpins while the drawer is still sliding out (flagged by the builder). Feel check only; not judged as blocking.
- **Hover-gate test scope:** "every :hover rule is gated" scans `/`, `/garden/`, `/research/` and `/rising-water/` and does discriminate. "a tapped button keeps no hover fill" also discriminates: base shows the sticky fill in my probe.
- **Garden instant-filter test:** checks only the list subtree. Chip colour transitions (10, the same on base) are expected.
- **Needs a real iPhone (not blocking):**
  - the sheet rising with no see-through;
  - gear spam;
  - no sticky hover after taps;
  - no zoom on the Settings selects;
  - no extra scroll on /about/ and 404 with the toolbar (emulation can't show svh vs vh);
  - scrim legibility in dark mode;
  - the last row against the home indicator (viewport-fit is deferred).

## Artifacts
- `docs/checks/F28b/attempt-1/probe/` holds the frame strips (`cur-{chromium,webkit}-drawer-{1280,375}-*-{open,close}.png`), the scrim and 320 px sheet shots, and the JSON probe output (`cur-*.json`, `base-*.json`).
- `docs/checks/F28b/attempt-1/compare-{home,garden,settings}-{375,768,1280}.png` are base vs F28 side by side in light and dark (all viewed); diff numbers are in `compare-diffstats.json`. The raw shots are in `shots/`.
- `docs/checks/F28b/attempt-1/lhci-{light,dark}/*.report.json`
- Tools: `docs/checks/tools/f28-check-{run.sh,probe.mjs,inert-fix.mjs,csp-webkit.mjs,shots.mjs,compare.py,lhci.cjs}`
- Housekeeping: no test-results copies under `docs/checks`. Port 4321 is free. The working-tree diff outside `docs/` is byte-identical before and after this check (sha1 `edee29be…`).
