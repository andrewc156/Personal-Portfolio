# Build report — F5 Synthetic hero — attempt 2

Summary: I fixed both blocking defects from docs/checks/F5/attempt-1.md. The readout is now always correct whenever the hero isn't playing: after a pause, a scrub, keyboard input, a slider drag, and in the reduced-motion frame. During play it is throttled to one update per 150 ms, with a guaranteed trailing update. It now wraps on its own full-width line with room reserved for 2 lines (3 below 26rem), so the highlight text is never clipped and the layout doesn't shift. All four non-blocking notes are also fixed: marker and label clamping with collision avoidance, a view-aware strip aria-label, the full `aria-keyshortcuts`, and an e2e "non-blank" check measured from hydration start.

Files changed:
- src/lib/viz/hero/controller.ts:
  - `updateReadout` is rewritten. It updates immediately when not playing. While playing it throttles to 150 ms with a trailing timer, and `lastReadoutAt` starts at −∞.
  - New `readoutText()`. It first advances the flood to the current `level()`. The map-hover cell is kept, so a hover readout also stays correct after a scrub.
  - `render()` now calls `updateReadout(!playing)`.
  - New public getter `lakeCount`, read by e2e.
  - New `labelStrip()`, called at init and on every view change.
  - `drawMarkers` is rewritten to use the clamped and placed geometry.
- src/lib/viz/hero/markers.ts (new): `clampMarker` keeps markers inside the canvas and clear of its rounded corners. `placeLabel` tries 12 candidate positions, keeping each inside the canvas and clear of both markers and of the other label.
- src/lib/viz/hero/text.ts: new `stripLabel(view)`. It returns "Barcode: … The lowest lake's bar never ends." or "Persistence diagram: … The lowest lake never dies, so its point sits on the infinity line."
- src/components/hero/Hero.astro:
  - The readout is `flex: 1 0 100%`, wraps, and has `min-height: 2.8em` (4.2em at ≤ 26rem). The `nowrap` and ellipsis are gone.
  - `aria-keyshortcuts="Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape N"`.
  - The hidden help text now mentions Home, End and Escape.
  - The static strip label is updated to the new wording.
- tests/unit/viz/markers.test.ts (new):
  - clamping;
  - 2,000 random pit/pass layouts: both labels inside the canvas and never overlapping;
  - right-hand placement is preferred.
- tests/unit/viz/text.test.ts: tests for `stripLabel`.
- e2e/hero.spec.ts:
  - The "non-blank within 500 ms" test now uses an init script that polls the canvas every frame from document start, and it asserts that the first non-blank frame minus `domInteractive` is under 500 ms.
  - New `readout` describe block:
    - after 13 ← presses 33 ms apart, the readout equals `Level ${round(level())} m · ${lakeCount} lake(s)` from `__hero`, and it is still equal 400 ms later;
    - the same check after a real mouse drag of the level slider from 0.9 to 0.3;
    - with reduced motion, at 375 and 1280, the readout is non-empty and equals the truth ("Level 450 m · …"), and is still equal 1 s later;
    - during a finite-bar highlight at 375, 768 and 1280: `scrollWidth ≤ clientWidth`, `scrollHeight ≤ clientHeight`, and the control row's height doesn't change.
  - The suite is now 20 tests.
- docs/builds/F5/screens/a2-*.png: self-check screenshots (gitignored).

How to verify:
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 10 files, 373 passed, of which 92 are in tests/unit/viz.
- Checker: `npm run build && npx playwright test e2e/hero.spec.ts`, then `node docs/checks/tools/f5_readout.mjs` and `node docs/checks/tools/f5_rm_readout.mjs` against preview on port 4321.
- What I ran myself: the checker's two repro scripts unchanged apart from the port (4405) and the Playwright import path, against `npx astro dev --port 4405`.
  - `f5_readout.mjs` reported **stale readouts: 0/9** (attempt 1: 5/9). Examples: ←×13 gives "Level 40 m · 1 lake", the same as the truth. A slider drag from 0.9 to 0.3 gives "Level 290 m · 1 lake", the same as the truth.
  - `f5_rm_readout.mjs` reported "Level 450 m · 1 lake" at both 1280 and 375 (attempt 1: blank).
- The dev server is stopped and port 4405 is free.

Acceptance criteria (self-check):
1. ✅ §6.3: both readout defects are fixed, as above. The highlight readout appears in full at every width:
   - 375: "Lake 17 · born 14 m · spills into Lake 1 at 26 m · persistence 12 m", on 2 lines; scrollWidth and clientWidth are both 317, scrollHeight and clientHeight both 55.
   - 768 and 1280: one line, 530/530 and 36/36.
   - The control row's height is unchanged by a highlight at every width (light and dark).
   - Markers stay inside the map, and the labels never overlap at 375 for seeds 42, 7 and 2026 (`a2-markers-375-seed*.png`).
   - Everything else is unchanged from attempt 1, which the checker verified.
2. ✅ Unchanged: drawn bars equal the engine bars (unit tests, plus the checker's brute force in attempt 1).
3. ✅ Non-blank: variance 7,250 at 57 ms after navigation (Pixel 7). The e2e check now measures from `domInteractive`. Console errors: 0 in all runs.
4. ✅ Mouse, touch and keyboard, as in attempt 1 (probe re-run: Space, ←, N, ↓, seed-input scoping, the panel Play button and bar taps all work). The readout is now correct after keyboard scrubbing.
5. ✅ Reduced motion: paused at 0.45, 2 frames, a Play button, and the readout "Level 450 m · 1 lake".
6. ✅ Off-screen: frames 1007 → 1007 and `running=false`, then it resumes. Hidden tab: `running=false`, then it resumes.
7. ✅ At 1280×800 in Chromium, measured over 3 runs of 300 frames:
   - rAF interval: median 16.7 ms, p95 16.7–16.8 ms, max 16.8 ms.
   - Hero render work: median 0.5–0.6 ms, p95 0.7–0.8 ms, max ≤ 1.0 ms.
8. ⚠️ Lighthouse not run (checker only; attempt 1 scored 100/100). CLS in my own probe, which includes a highlight: 0.00004–0.00046 at 375, 768 and 1280, in light and dark. axe: 0 violations at 1280 light with a highlight shown.

Needs Andrew: none.

Requests to Control: none. The optional F3 request from attempt 1 still stands: an allocation-free advance would remove the last per-frame allocation (`advanceTo`'s events array). It isn't needed for the budget.

Known limitations:
- `/rising-water/` stays a 404 until F6.
- Hidden-tab behaviour is still tested by emulating `visibilityState`.
- On very narrow screens (below about 300 px) a long highlight readout could need more than the 3 reserved lines. That would shift the layout only after user input, which CLS excludes.
- `readoutText()` and the `lakeCount` getter call `Flood.advanceTo(level)`. This is a no-op when the level hasn't changed, apart from F3's small events array.
