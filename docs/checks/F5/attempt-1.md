# Check report — F5 Synthetic hero — attempt 1
Verdict: FAIL

Gates: check ✅ · lint ✅ · unit (369, 88 in viz) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ · e2e (71/71 twice) ✅ · axe ✅ · lighthouse (/ ×3: 100/100/100/100; /garden/: 100/100/100/100) ✅ · links ✅ (only /rising-water/ 404s) · visual ❌ (clipped readout text, blank readout in the reduced-motion frame) · content ✅ · tda ✅ · data n/a

Environment: Apple M3, macOS 27.2, Node v26, Playwright Chromium, headless. Preview ran on port 4321, one server at a time. The port is free now.

The F5 changes are uncommitted: src/lib/viz/**, src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts.

## Why FAIL
The maths, rendering, pausing, performance and Lighthouse all pass. The failure comes from one runtime defect and one layout defect, both in the line of text under the hero (the readout):

1. **Wrong or blank readout.** After the user scrubs or pauses, the readout is often stale: it shows a different water level and lake count from the map and strip. In the reduced-motion static frame it is blank.
2. **Clipped text.** The bar-highlight readout is cut off with an ellipsis at every width, including 1280 px.

## Blocking fixes
1. **The readout is stale after scrubbing or pausing, and blank in the reduced-motion frame.**
   - **Where:**
     - `src/lib/viz/hero/controller.ts:609`: `render()` calls `updateReadout(false)`.
     - `controller.ts:671–675`: `updateReadout` drops non-forced calls that come within 150 ms of the last one. Because `lastReadoutAt` starts at 0, it also drops every call while `performance.now() < 150`.
     - Nothing sends a trailing update. Once the animation is paused, no later frame corrects the text.
   - **Expected:** once scrubbing stops, the readout matches `level()` and `flood.alive()`. In the reduced-motion frame it reads "Level 450 m · N lakes".
   - **Actual, scrubbing:** 5 of 9 realistic scrubs leave a wrong readout. Examples:
     - Hero ← pressed 13 times, 33 ms apart: the readout shows "Level 100 m · 4 lakes"; the truth is "Level 40 m · 1 lake".
     - Level slider dragged from 0.9 to 0.3: the readout shows "Level 415 m · 3 lakes"; the truth is "Level 290 m · 1 lake".
     - Screenshot `palette-delta-1280-light.png`: the readout says "Level 51 m · 3 lakes" while the strip says 500 m.
   - **Actual, reduced motion:** the readout is `" "` (empty) 2 s after load, at both 1280 and 375. See `reduced-motion-1280-{light,dark}.png` and `dpr3-1280-light.png`.
   - **Reproduce:** `npm run build`, then `npx astro preview --port 4321 --ignore-lock`, then:
     - `node docs/checks/tools/f5_readout.mjs` (prints "stale readouts: 5/9");
     - `node docs/checks/tools/f5_rm_readout.mjs` (prints the empty readout).
   - **Suggested fix:** force the readout update whenever not playing (in `scrubTo`, `setPlaying(false)`, and the constructor's first frame), or schedule a trailing update after the throttle window.
2. **The bar-highlight readout is clipped at every width.**
   - **Where:**
     - `src/components/hero/Hero.astro:196–208`: `.hero__readout` uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
     - It shows `barReadout()` from `src/lib/viz/hero/text.ts:33–40`.
   - **Expected:** the full sentence is visible, for example "Lake 4 · born 42 m · spills into Lake 1 at 167 m · persistence 125 m". It is the only place that shows the spill level and persistence. §11 step 5 counts clipped text as a FAIL.
   - **Actual:**
     - At 1280 the readout reads "Lake 4 · born 42 m · spills into Lake 1 at 1…" (`hover-1280-light.png`, `hover-1280-dark.png`, `diagram-1280-*.png`).
     - At 375 it reads "Lake 14 · born 94 m · spills into Lake …" (`tap-375-light.png`).
   - **Reproduce:** hover the second barcode row on `/?seed=42` at 1280×800 with the level at about 62 %, or run `node docs/checks/tools/f5_shots.mjs`.
   - **Suggested fix:** let the readout wrap. Give it its own full-width line under the buttons with a reserved height for 2 lines, so there is no CLS.

## Acceptance criteria
1. **§6.3 works:** ❌, only because of fixes 1 and 2. Everything else was verified as follows.
   - **Terrain:**
     - Deterministic per seed. The browser's heights equal `generateTerrain(W, H, …)` bit for bit for 4 seeds.
     - About 4.0 CSS px per cell. Grids are 141×71 at 1280, 176×88 at 768 and 85×43 at 375, all ≤ 40k cells.
   - **Map:**
     - Land has an elevation tint and hillshade.
     - Water has lake colour and depth shading.
     - "Color by depth" and shoreline outlines work (`colorby-depth-*.png`).
   - **Barcode:**
     - Bars grow live up to the level line.
     - The min-persistence threshold and the cap work.
     - At the top, the essential bar reaches the right edge (checked in node and in the browser).
     - The barcode ↔ diagram toggle works, including the diagonal and the ∞ line.
   - **Settings:** all four groups are in F1's panel, and every control fits at all three widths. My bounding-box check found no control outside the panel.
   - **Interaction:**
     - Hovering a bar shows a two-tone outline, the pit and pass markers, and "Lake N · pit" and "pass" labels.
     - Hovering the map gives "Height 490 m · Lake 1".
   - **Loop:** the hold measured 2,527 ms, then a new seed (42 → 17178) started at progress 0. With loop off, playback stops at the top.
   - **Accessibility:**
     - `role="img"` and an aria-label on both canvases.
     - Summary cadence: 0 changes over 2 s of play (120 frames), then 1 on pause and 1 after the 300 ms scrub debounce.
     - Keyboard: see criterion 4.
     - Reduced motion: see criterion 5.
   - **Performance:**
     - Pausing: see criterion 6.
     - DPR cap: with DPR 3 emulated, the canvas backing store is 2.001× its CSS size (1131 px for 565.3 px).
   - **Caption:** exact. The link goes to /rising-water/.
2. **Drawn bars equal the engine bars:** ✅. Section "TDA" below has the detail.
3. **Non-blank within 500 ms, no console errors:** ✅
   - My own probe, which polls from navigation: the controller existed at 39 ms and the map was non-blank 0.2 ms later (variance 6,918). The first frame is painted synchronously.
   - Console errors were 0 in every probe: TDA, behaviour, screenshots, perf, 4 viewports, both themes.
4. **Mouse, touch, keyboard; settings in F1's panel:** ✅ functionally. Fix 1 still applies, because the readout during keyboard scrubbing is stale.
   - **Mouse:** Play/Pause, New terrain, bar hover and map hover work.
   - **Touch** (375, hasTouch): tapping a bar highlights it ("Lake 14 · born 94 m …"), and tapping Play plays.
   - **Keyboard, with the hero focused:**
     - Space toggles play without scrolling.
     - End followed by ←, ←, Shift+← gives progress 0.86, as expected.
     - ↓ highlights the first bar, and N gives a new seed.
   - **Scoping:**
     - With the body focused, Space scrolls the page (0 → 760) and does not toggle play.
     - With the body focused, ↓ scrolls 40 px.
     - With the body focused, "n" does nothing.
     - Typing "n 5" plus ← in the seed input edits only the input.
     - Space on the focused Close button closes the panel.
     - Space on the theme toggle switches the theme.
     - Space on the hero's own Play button toggles once.
5. **Reduced motion:** ✅ for no autoplay.
   - The state is paused at progress 0.45 (level 450 of 0–1000 m), running=false, and the frame count goes 1 → 2 over 1.5 s.
   - A Play button is shown. Clicking it plays.
   - The readout is blank, which is fix 1.
6. **Pauses off-screen and in a hidden tab:** ✅
   - Off-screen: running=false and 0 frames in 0.8 s. Running resumes when scrolled back.
   - Hidden tab: running=false and 0 frames with `visibilitychange` emulated, and running resumes.
   - Headless `bringToFront` of another tab does not change `visibilityState`, so a real hidden tab can't be produced headlessly (see note 4).
7. **p95 ≤ 22 ms at 1280×800:** ✅. Section "Performance" below has the numbers.
8. **Lighthouse mobile on `/`:** ✅. Performance 100 and accessibility 100 on 3 runs.

## Lighthouse (mobile, staticDistDir)
| run | perf | a11y | BP | SEO | CLS | TBT | LCP |
|---|---|---|---|---|---|---|---|
| / #1 (`LHCI_URLS=/ npm run lhci`) | 100 | 100 | 100 | 100 | 0.0001 | 7 ms | 904 ms |
| / #2 | 100 | 100 | 100 | 100 | 0.0001 | 4 ms | 905 ms |
| / #3 | 100 | 100 | 100 | 100 | 0.0001 | 6 ms | 906 ms |
| /garden/ (F2 regression check) | 100 | 100 | 100 | 100 | 0.0001 | 0 ms | 752 ms |

CLS in my own PerformanceObserver probe:
- At 375 it was 0.00000 through load, hydration and two theme toggles.
- At 1280 it was 0.00046, from one shift at 42 ms during load. Theme toggles added nothing.

## TDA (§11 step 7), checked against my own brute force
- **Tool:** `docs/checks/tools/f5_brute.mjs`, written for this check.
  - Cells are added in (h, i) order.
  - After every step, every wet cell is relabelled by BFS, using 4-connectivity, seeded in ≺ order so each label is the component's ≺-minimum cell.
  - The old labels inside the new component are read by a full scan. The elder rule picks the ≺-minimum old label as the survivor.
  - A second function labels the components of {h ≤ t} at arbitrary levels.
  - It imports nothing from src/lib/tda or the builder's tests.
- **Node** (`node docs/checks/tools/f5_hero_tda.mjs`): 6 seeds at grids 141×71, 176×88, 85×43 and 120×60. Result: **ALL OK**.
  - `selectBars` equals my rows under 5 threshold/cap settings: 30/30 checks.
  - `drawBarcode` rects from a recording context, at 5 levels, invert to [birth, min(death, level)] within 1e-9 of the relief: 547 rects, with exactly one rect per born row.
  - The diagram draws one point per born row.
  - Engine `mergedInto` equals my survivor for every bar.
  - `MapPainter.comp` equals my BFS ≺-minimum label at 6 levels, given forward then backward: 338,256 cell checks.
  - At 44 merge events, the dying lake's pit pixel is its own colour just below the death level and the older survivor's colour at the death level.
  - The terrains have 56–209 births, 0 zero-length bars, and 1 essential bar each.
- **Browser** (`node docs/checks/tools/f5_browser_tda.mjs`): seeds 42, 7, 123456 and 2024 at 1280, 768 and 375. Result: **ALL OK**.
  - `__hero.drawnRows` equals my brute-force rows.
  - I installed a recorder on the live strip context's `fillRect` and scrubbed to 0.2, 0.6, 1, 0.45 and 0.1 (forward, then backward). The recorded rects invert to my bars (302 rects). The essential bar reaches the right edge at the top.
  - `painter.comp` and `alive()` equal my BFS at every one of those levels.
  - **Elder rule on real canvas pixels.** For seed 42, lake@75 (slot 1) merges into the older lake@5436 (slot 0):
    - its pit pixel changes from 138,66,30 to 25,75,122;
    - those are exactly the expected LUT colours, both on the canvas and in the buffer.
    - The other 3 seeds behave the same way.
- **Backward scrub with the level slider** (`f5_backscrub.mjs`): 90 % → 85 → 70 → 50 → 20 → 0.5 %. `alive()` and `comp` equal my BFS each time.
  - This confirms the F3 note that a backward `advanceTo` replays from the bottom: the state is correct, and the hero ignores the returned events.

## Explainer audit (§11 step 8)
- The caption is exact: "Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime." followed by "See it on the Colorado River Basin →", which links to /rising-water/.
- I read the rest of the TDA copy against §6.6 and found it consistent:
  - the map aria-label (items 1 and 2);
  - the strip aria-label (items 2 and 3);
  - the readouts ("spills into Lake N at X m · persistence Y m", and "never dies (the lowest lake, infinite bar)") (items 2, 4 and 5);
  - the summary text;
  - the diagram legend ("Height above the diagonal is persistence") (item 4);
  - the map labels "pit", "pass" and "pass (spills here)" (item 2);
  - the pacing labels "Linear (metres)" and "Percentile (area)" (item 8).
- Small wording issues are in notes 2 and 3.

## Performance (§11 step 9)
I sampled rAF frame times at 1280×800 during play, 700 frames per run. "Hero work" is the time spent inside the hero's own frame callback.

| run | rAF Δ median / p95 / max | hero work median / p95 / max |
|---|---|---|
| seed 42 | 16.70 / 16.70 / 16.80 ms | 0.60 / 1.00 / 1.80 ms |
| seed 7 | 16.70 / 16.80 / 16.80 ms | 0.50 / 0.80 / 1.20 ms |
| seed 0 | 16.70 / 16.80 / 16.80 ms | 0.50 / 0.80 / 1.20 ms |
| 4× CPU (CDP), seed 42 | 16.70 / 16.80 / 16.80 ms | 0.10 / 0.70 / 1.10 ms |
| 4× CPU (CDP), seed 7 | 16.70 / 16.70 / 16.80 ms | 0.10 / 0.60 / 1.20 ms |

- The 4× rows are informational. I confirmed that throttling engaged: a busy loop took 16.6 → 68.7 ms, and 50 `render()` calls took 2.8 → 9.1 ms. Hero-work timing under throttle looks coarsened by timer resolution.
- This confirms the F3 note on browser frame timing: about 1 ms p95 per frame, against 6 ms.
- **JS on `/`, gzip -9:**

  | file | size |
  |---|---|
  | Hero | 12.0 KB |
  | settings | 0.9 KB |
  | BaseLayout | 0.4 KB |
  | **total** | **≈ 13.4 KB** (budget ≤ 120 KB) |

- **Third-party requests:** none. I logged every request in 4 page loads, and the built HTML has no external origins.

## Palettes (colour-blind claims)
- **My implementation:** `pipeline/.venv/bin/python -I docs/checks/tools/f5_palette_cvd.py`.
  - Machado 2009 matrices at severity 1.0, applied in linear RGB.
  - My own CIEDE2000, validated against Sharma et al. (2005) pairs 1, 7, 17, 25 and 34 to 1e-4.
  - It parses palettes.ts as text and runs no builder code.
- **Minimum pairwise ΔE00** (normal / protan / deutan / tritan) and minimum contrast against `--color-surface`:

  | palette | light | dark |
  |---|---|---|
  | Delta | 18.1 / 12.1 / 14.9 / 10.6, contrast 4.65 | 22.5 / 17.1 / 17.6 / 18.2, contrast 3.45 |
  | Canyon | 21.6 / 15.0 / 14.3 / 11.3, contrast 4.52 | 19.3 / 17.8 / 17.3 / 16.9, contrast 3.46 |
  | Glacier | 20.7 / 13.6 / 12.5 / 14.1, contrast 4.52 | 19.6 / 13.9 / 13.5 / 15.6, contrast 3.43 |
  | Estuary | 21.2 / 16.8 / 13.2 / 18.3, contrast 4.87 | 18.4 / 17.2 / 18.1 / 17.7, contrast 3.47 |
  | Mono | 11.2 / 10.9 / 11.4 / 11.3, contrast 3.44 | 11.8 / 11.2 / 12.0 / 12.7, contrast 3.27 |

- The worst case is 10.6. Every value is ≥ 10 ΔE00 and every contrast is ≥ 3:1. This matches the builder's table exactly.
- Colour is never the only cue: a highlighted lake gets a two-tone outline plus the pit and pass markers and their text labels.

## Notes (non-blocking)
1. **Highlight markers at the map edge can be clipped.** In `tap-375-light.png` (zoom: `zoom-375-tap-labels.png`), the pit ring at the right edge is cut by the rounded corner, and the "pass" label sits right against "Lake 14 · pit". `drawMarkers` (controller.ts:612–669) flips labels left at the right edge but doesn't avoid the top or bottom edges, or the other label.
2. **The strip's aria-label is static.** It says "Barcode: …" even when the persistence diagram is showing. It also says each bar runs "to the level where it merges into an older lake", but the essential bar never merges (§6.6 item 5). Suggested fix: update the label on a view change and add "the lowest lake's bar never ends".
3. **`aria-keyshortcuts` is incomplete.** At Hero.astro:35 it lists Space, ArrowLeft, ArrowRight and N, but ArrowUp, ArrowDown, Home, End and Escape are also bound. The hidden help text mentions ↑ and ↓ but not Home, End or Escape.
4. **Hidden-tab testing is emulated.** Both the e2e test and my probe use an overridden `visibilityState` plus the event. Headless Chromium keeps `visibilityState` "visible" when another tab is brought to the front.
5. **The e2e "within 500 ms" test measures from when `__hero` exists, not from navigation.** My own probe measured from navigation (see criterion 3), so the claim holds.
6. **One allocation remains per frame.** The hero calls `Flood.advanceTo` every frame, and `updateSummary` calls it too (F3 note 1). This has no measurable effect: hero work p95 is about 1 ms.

## Artifacts
- **Report:** docs/checks/F5/attempt-1.md.
- **Screenshots** in docs/checks/F5/attempt-1/ (gitignored). I opened every one.
  - `home-{375x812,768x1024,1280x800}-{light,dark}-{closed,open,open-scrolled}.png`
  - `panel-*.png`
  - `hover-1280-{light,dark}.png`, `diagram-1280-{light,dark}.png`, `diagram-375-light.png`, `tap-375-light.png`
  - `reduced-motion-1280-{light,dark}.png`
  - `palette-{delta,canyon,glacier,estuary,mono}-1280-{light,dark}.png`
  - `colorby-depth-1280-{light,dark}.png`, `dpr3-1280-light.png`
  - `zoom-768-tick.png`, `zoom-375-tap-labels.png`
- **Lighthouse JSON** in docs/checks/F5/attempt-1/lh/{run1,run2,run3,garden}/ (gitignored per #20).
- **Tools** in docs/checks/tools/:
  - `f5_brute.mjs`, `f5_hero_tda.mjs`, `f5_browser_tda.mjs`, `f5_backscrub.mjs`
  - `f5_behaviour.mjs`, `f5_readout.mjs`, `f5_rm_readout.mjs`
  - `f5_perf.mjs`, `f5_shots.mjs`, `f5_palette_cvd.py`, `f5_lhsum.py`
