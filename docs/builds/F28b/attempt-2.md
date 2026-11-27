# Build report — F28b Shell and content feel — attempt 2

Summary: This attempt fixes all 4 blocking items from `docs/checks/F28b/attempt-1.md`:
- **Fix 1:** the closing Settings panel is now `inert`, so a Tab during the 200 ms exit no longer lands in it in WebKit. Control approved this edit to `settings.ts` (DECISIONS #92).
- **Fixes 2–4:** the three F28 e2e tests that were build- or timing-dependent now compare values rather than strings or fixed delays.

On the production build, `shell.spec.ts` and `site.spec.ts` pass 95/95. No CSS, markup or dependency changes.

## Fixes

| # | Fix | Status |
|---|---|---|
| 1 | Closing panel takes keyboard focus (WebKit) | done |
| 2 | Motion-tokens test string compare | done |
| 3 | Interrupt test `parseFloat('.26s')` | done |
| 4 | Press-feedback test timing | done |

**1. Inert closing panel** (`src/components/site/settings.ts`)
- `setSettingsOpen` sets `panel.inert = !open` immediately before `panel.hidden = !open`.
  - On open, inert is cleared before `syncModal` and before focus moves to `[data-settings-title]`.
  - On close, inert is set synchronously, before focus returns to the opener.
- `initSettingsPanel` sets `panel.inert = panel.hidden !== false`, so a closed panel is inert on load. A remembered open drawer then clears it via `setSettingsOpen(true, false)`.
- What doesn't change:
  - **No-JS:** the panel stays plain `hidden`, because only JS sets inert.
  - **F25 logic:** `syncModal`'s sibling inerting, `INERT_MARK` restore, Tab wrap, Esc, backdrop close and focus return are all untouched. The panel is never marked with `INERT_MARK`, so restoring the background never touches it.
- **Test fallout, intended:** three existing assertions checked `document.querySelectorAll('[inert]').length === 0` after closing (sheet Esc, sheet backdrop, remembered-drawer reload). The closed panel itself now matches `[inert]`. Each now checks `[inert]:not(#settings-panel)` is 0, which keeps the original intent (nothing in the background is left inert), and also asserts `#settings-panel.inert === true`. The open-drawer check (`[inert]` count 0 while the drawer is open) is unchanged.
- **New e2e test:** `closed panel is inert, even during its exit transition (1280px / 375px, F28)`.
  - Asserts inert on load.
  - For each close path: `inert === false` with focus inside when open, then `inert === true` synchronously after the close.
  - A Tab pressed straight after the close doesn't land inside the panel, and after the transition settles the panel is still inert with focus outside.
  - Close paths: Esc, gear and Close button at 1280. At 375 only Esc and Close, because the modal sheet makes the header and its gear inert.

**2. Motion-tokens test** (`e2e/shell.spec.ts`)
- Durations are parsed with units and converted to ms: `.16s` → 160 and `160ms` → 160.
- The `cubic-bezier(...)` numbers are parsed and compared with `toBeCloseTo(…, 6)`.
- Expected values: `[0.23, 1, 0.32, 1]`, `[0.32, 0.72, 0, 1]` and `[160, 260, 200]` ms.

**3. Interrupt test** (`sampleInterrupt`)
- `--dur-drawer-in` is now converted by unit: `.26s` → 260 and `260ms` → 260.
- The test now also asserts `enterMs ≈ 260`, then checks `exitMs (200) < enterMs (260)`.

**4. Press-feedback test**
- The fixed `waitForTimeout(250)` is gone. After mousedown, the test waits 2 rAFs, then `Promise.all(btn.getAnimations().map(a => a.finished))`, then reads the transform.
- It parses the matrix and checks `a` and `d` with `toBeCloseTo(0.97, 2)` (±0.005) and `b` and `c` close to 0.
- Reduced motion still expects `none`.

## Files changed (this attempt)
- `src/components/site/settings.ts` (+5 lines, fix 1)
- `e2e/shell.spec.ts`: the new inert test, 3 adjusted `[inert]` assertions, and fixes 2–4
- `docs/builds/F28b/webkit-exit-tab.mjs`: a small throwaway repro, kept so the checker can rerun it. Delete it when done.
- `docs/builds/F28b/attempt-2.md` (this report)

Nothing else touched. No hero/explorer files, configs, package.json or scripts.

## Check results (real output)
- `npm run check`: `Result (169 files): - 0 errors - 0 warnings - 0 hints`
  - The first run had 2 type errors: `panel.hidden` is typed `boolean | "until-found"`, and `inert` doesn't exist on `SVGElement` in a locator `evaluate`. Both fixed.
- `npm run lint`: eslint clean; `All matched files use Prettier code style!` (Prettier was run on both touched files.)
- `npm test`: `Test Files 37 passed (37)`, `Tests 913 passed (913)`
- `npm run build`: `10 page(s) built … Complete!`; write-headers gave `script-src +3 element … style-src +9 element` (unchanged counts).
- `npx playwright test e2e/shell.spec.ts e2e/site.spec.ts` (preview on 4321): **`95 passed (1.4m)`**
  - This includes the 4 previously failing F28 tests (motion tokens, interruptible 1280/375, press feedback), the 2 new inert tests, and all F25 settings tests.
- **WebKit repro for fix 1** (real build, no in-page simulation): `bash docs/checks/tools/f28-check-run.sh . docs/builds/F28b/webkit-exit-tab.mjs`. It ran in WebKit and Chromium at 1280 and 375, 3 runs per close path (Esc, gear at 1280 only, Close button).
  - **Every row:** `inertOnLoad=true`. When open: `inert:false`, focus on `settings-title`. Right after the close plus Tab: `inert:true`, `stillRendered:true` (the panel is mid-exit), `inLeavingPanel:false`, focus on `hero-mode`. After 400 ms: still `hero-mode`.
  - **Before:** attempt 1 in WebKit gave `INPUT#hero-seed`, then `BODY`.
- **Port:** `lsof -iTCP:4321 -sTCP:LISTEN` returns nothing (exit 1) after both runs.

## Risks / notes for the checker
- **What the e2e catches:** it runs in Chromium only, where the leaving panel was already unfocusable. So the "Tab after Esc" part there can't catch the WebKit regression, but the synchronous `inert` assertions do. The WebKit behaviour is shown by the repro script above.
- **The closed panel is now `[inert]`.** Any other code or test that counts `[inert]` elements would see it. I found no others in `src/` or `e2e/` (Explorer uses `data-inert`, which is unrelated).
- **Not addressed (out of scope):** the WebKit sheet Tab-wrap leak (QA-19, pre-existing), Lighthouse, and viewport-fit.
- **Unchanged from attempt 1:** header unpin during the drawer exit, the theme toggle snapping a moving drawer, and the real-iPhone checks.

## Needs Andrew
None.

## Requests to Control
None.
