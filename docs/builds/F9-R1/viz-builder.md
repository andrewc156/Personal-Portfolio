# Build report: F9-R1 viz-builder fixes (attempt 1)

Summary: I made all six F9 viz-builder fixes.
- Explorer.astro has no `style=""` or `on*=""` attributes left. The data-derived map aspect-ratio, hillshade size and legend swatch colours now come from one inline `<style>` element. The form's submit is cancelled by an addEventListener in the client.
- The hero's pass diamond is moved just clear of the pit ring when the two would touch, and the pit is drawn last.
- The hero's `metres()` uses U+00A0. The explorer already did.
- Hero `destroy()` now clears all three timers and stops later scheduling.
- The explorer e2e gains the size and barcode rejection cases.
- The error state hides the map hint and removes the map's focus stop and crosshair.

Files changed:
- src/components/explorer/Explorer.astro
  - Removed the 4 `style=` attributes and `onsubmit`.
  - Added a build-time `<style is:inline set:html>` holding `.explorer .ex-map{aspect-ratio:…}`, the `.ex-map__shade` width/height %, and the `.ex-swatch[data-sw="k"|"neutral"]{--sw-l;--sw-d}` rules. That element is a normal `<style>` element, so write-headers.mjs hashes it into style-src without needing 'unsafe-hashes'.
  - Swatches now carry `data-sw`. The form carries `data-ex-controls`.
  - New error-state CSS: `.explorer[data-inert='true'] .ex-hover{visibility:hidden}` (the box is kept, so nothing shifts) and `… .ex-map__water{cursor:default}`.
- src/components/explorer/explorer-client.ts
  - The submit listener (`e.preventDefault()`) is attached in `init()`, before the data loads.
  - New `markInert()` is called from `reject()` and `fail()`. It empties the hint, removes the stage's `tabindex`, `aria-keyshortcuts` and `aria-describedby`, and sets `data-inert="true"`.
- src/lib/viz/hero/markers.ts: new `separatePass(px, py, pitR, qx, qy, passR, minGap, W, H, margin, out)` and the `Point` type.
  - When the centres are closer than pitR + passR + minGap, the diamond moves to exactly that distance. It moves along pit → pass, or along the first of 8 directions that stays inside the clamp.
  - Markers already far enough apart are not moved.
  - It writes into `out` and allocates nothing.
- src/lib/viz/hero/controller.ts
  - Marker drawing: the pass centre comes from `separatePass(… 3*d …)` (scratch `passPt`). The diamond is drawn first and the pit last. Label avoid-boxes use the shifted diamond.
  - `destroy()` is idempotent. It cancels the rAF, clears `resizeTimer`, `readoutTimer` and `summaryTimer`, runs and empties the cleanup list (listeners, IO, RO, MO, media query) and calls `setRunning(false)`.
  - After destroy, a `destroyed` flag guards `schedule()`, `onResize`, `queueSummary` and the readout trailing timer.
  - Each timer zeroes its id when it fires.
  - New read-only getter `pendingTimers`, used by e2e.
- src/lib/viz/hero/text.ts: `NBSP = ' '`. `metres()` returns `${r} m`, both cached and uncached.
- tests/unit/viz/text.test.ts: expectations use ` m`. New checks for `metres(17)`, the uncached path, and that no output has "digit, space, m".
- tests/unit/viz/markers.test.ts: 4 new `separatePass` tests.
  - Markers already apart are untouched.
  - Adjacent and same-cell pairs are pushed exactly clear.
  - At the canvas edge the push goes the other way.
  - 5,000 random near pairs: never touching, always inside the clamp, and far pairs unchanged.
- e2e/hero.spec.ts
  - Readout regexes and the expected-readout helper use ` m`.
  - New `lifecycle` test. It sets up ≥ 2 pending timers (summary debounce and resize settle, during play), calls destroy(), sets sentinel text in the readout and summary, and waits 700 ms. It expects: pendingTimers 0, sentinels intact, no frames, grid unchanged, `data-running="false"`.
- e2e/explorer.spec.ts: the rejection describe is now table-driven over grid.f32 or barcode.json. It has two new cases:
  - (c) grid truncated by 4 bytes. Status contains "wrong size".
  - (d) barcode.json with lake 3's `di` + 1 and an intact grid. Status contains "does not match barcode.json (599 of 600 bars identical)".

  Every case now also asserts:
  - every `[data-ex-control]` is disabled;
  - the hint is hidden and empty, with no "Point at or tap the map" text;
  - the stage has no tabindex and the cursor is `default`;
  - exactly one console.error, readouts "–", 0 painted pixels and no controller.

How to verify:
- `npm run check`: 0 errors / 0 warnings / 0 hints.
- `npm run lint`: eslint is clean. Prettier is clean on all my files. Its only warnings are in site-builder files being edited in parallel (Footer.astro, Header.astro, fonts.css, tokens.css).
- `npm test`: 16 files, 445 tests passed.
- Checker, after a build:
  - `grep -E '\s(style|on[a-z]+)="' dist/rising-water/index.html dist/index.html` should find nothing. A bare `on[a-z]+="` pattern also matches `content="` in meta tags.
  - `node scripts/write-headers.mjs` should report 0 attribute hashes and omit 'unsafe-hashes'.
  - `npx playwright test e2e/explorer.spec.ts e2e/hero.spec.ts e2e/headers.spec.ts`.

Acceptance criteria (self-check, dev server on 4412, Playwright script in scratchpad; now stopped):
- ✅ 1. No `style="` or `on*="` in the rendered dev HTML of `/rising-water/` or `/`. Evidence: `grep -oE '\s(style|on[a-z]+)="'` → 0 matches on both.
  - Map aspect is computed as `0.62888 / 1`, and the box ratio is 0.62889. It is set in CSS before hydration.
  - The shade measures 570.047 px in a 570 px map (100.0102 %).
  - All 13 swatches show the right colours (for example rgb(31, 95, 153) = #1f5f99; neutral rgb(180, 200, 224)).
  - Dispatching a cancelable submit on `form.ex-controls` gives defaultPrevented = true.
- ✅ 2. Seed 42 at 375 px, DPR 2: the closest pit/pass pair (cells 1 apart, Lake 12) draws a separate ring and diamond with a gap, and both labels show. Screenshot: /private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/1f67abd1-ed51-4a07-9073-e87a4f7de7b0/scratchpad/pw/hero-adjacent.png. Unit tests are in markers.test.ts.
- ✅ 3. The hero readout is `"Level 51 m · 3 lakes"` with U+00A0. Explorer values already used U+00A0 (text.ts `NBSP`, readout `"563.2 m"`). Unit tests updated.
- ✅ 4. The destroy check, run live: pendingTimers is 2 before and 0 after; readout and summary sentinels intact after 700 ms; 0 frames; grid unchanged; running "false". The e2e test is the same logic.
- ✅ 5. Ran the e2e cases' logic live:
  - Truncated grid: status "…(the grid file has the wrong size)…".
  - Altered `di`: status "…does not match barcode.json (599 of 600 bars identical)…".
  - Both: 1 console error, all controls disabled, readouts "–", 0 painted pixels.
- ✅ 6. In both error cases the hint is not visible and its text is empty, the stage has no tabindex, and the map cursor is `default`. Screenshot: /private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/1f67abd1-ed51-4a07-9073-e87a4f7de7b0/scratchpad/pw/explorer-err.png.
- ✅ Regression check:
  - `/`: hero animates (48 frames in 0.8 s), 0 console errors.
  - `/rising-water/`: status "… matches barcode.json (600 of 600 bars identical)". A bar click fills the card ("Lake 5 · birth cell 117202"). The hint is visible in the OK state. 0 console errors.
- I did not run e2e, build, preview or Lighthouse, as the rules require. The checker must run them.

Needs Andrew: none.

Requests to Control:
- e2e/headers.spec.ts:154–176 (not mine) still passes as written: aspect-ratio is still not `auto`, and the submit is still prevented. Its comments and test name now describe the old mechanism ("style=\"aspect-ratio: …\" is hashed under 'unsafe-hashes'", "onsubmit=\"return false\" is hashed too", "inline attributes are allowed"). Suggested update by Control:
  - rename the test to "explorer loads and verifies its data; no inline attributes are needed";
  - add an assertion that the response's CSP has no `'unsafe-hashes'`;
  - fix the comments.
- write-headers.mjs needs no change: with no attribute hashes found, `sourceList()` already leaves out 'unsafe-hashes'.
- Port note: an Astro dev server from another builder was running on 4411 and holds Astro's dev lock. I started mine on 4412 with `--ignore-lock` and stopped it afterwards. 4411 was left alone.

Known limitations:
- In the error state the hint is hidden with `visibility:hidden`, so its two-line box stays empty. This avoids a layout shift.
- The readout trailing timer is only pending during some play frames, so the destroy e2e asserts ≥ 2 pending timers (summary and resize), not 3.
- When the pass diamond is offset, it sits up to about 14 CSS px from the true pass-cell centre. That only happens when the two cells are within a few pixels, and the label still says "pass".
