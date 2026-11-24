# Check report — F5 Synthetic hero — attempt 2
Verdict: PASS_WITH_NOTES

Gates: check ✅ · lint ✅ · unit (373) ✅ · pytest (292) ✅ · ruff ✅ · build ✅ · e2e (77/77, run twice) ✅ · axe ✅ (in the e2e suite) · lighthouse (/ ×3: 100/100/100/100; /garden/: 100/100/100/100) ✅ · links ✅ (only /rising-water/ 404s) · visual ✅ · content ✅ · tda ✅ · data n/a

Environment: Apple M3, macOS 27.2, Node v26, Playwright Chromium, headless. Preview ran on port 4321, one server at a time. The port is free now.

## Previous blocking fixes
1. **Stale or blank readout: resolved.**
   - The previous checker's tool `node docs/checks/tools/f5_readout.mjs` now prints **stale readouts: 0/9** (attempt 1: 5/9). Two examples:
     - ←×13 gives "Level 40 m · 1 lake", which matches the truth.
     - Dragging the slider from 0.9 to 0.3 gives "Level 290 m · 1 lake", which matches the truth.
   - `node docs/checks/tools/f5_rm_readout.mjs` gives "Level 450 m · 1 lake" at 1280 and at 375 (attempt 1: blank).
   - My own probe, `docs/checks/tools/f5a2_readout_probe.mjs`, takes its truth from my brute-force BFS (`f5_brute.mjs` `componentsAt`), not from the builder's `__hero`. It reads the readout 60 ms after each action and again 500 ms later. All 26 cases are correct at both times, with 0 console errors. The cases are:
     - pause with Space during play;
     - ←×7, →×5, Shift+←×2, Home, End, Shift+←×3;
     - the Play/Pause button;
     - N while paused, and the New terrain button;
     - a mouse drag on the level slider, and ←×9 on the slider from the keyboard;
     - changing the pacing (the level moves at the same progress: "Level 474 m · 5 lakes");
     - Reset;
     - N during play, then pause;
     - map hover at 3 cells, each before a scrub, after a keyboard scrub down and after a scrub up. These include dry-land ↔ lake transitions;
     - map hover after play → pause, and the pointer leaving the map.
   - **Hover across a merge** (`f5a2_hover_merge.mjs`): I hovered the pit of each of the 4 most persistent finite lakes and scrubbed to just before and just after each death. The readout changes from "Lake N" to the survivor's number, exactly as my brute force's elder-rule survivor says. That is 8 of 8 checks, for example "Height 123 m · Lake 5" → "Lake 3".
   - **During play** (`f5a2_play_lag.mjs`, seeds 42, 7 and 2024, about 300 frames each): I logged the readout and the truth every frame. The maximum lag behind the truth was **134–135 ms**, inside the 150 ms throttle, with 33 readout updates in 5 s. Every frame matched a recent truth. The only exceptions were the first 8 frames, whose text was set before my log started.
2. **Clipped highlight readout: resolved.** In `Hero.astro:198–210` the readout is now `flex: 1 0 100%`, wraps, and has `min-height` of 2.8em (4.2em at ≤ 26rem). The `nowrap` and ellipsis are gone.
   - I picked the drawn row with the longest readout at level 620 and measured it in light and dark at each width. scrollWidth equals clientWidth and scrollHeight equals clientHeight every time:

     | width | clientWidth | clientHeight |
     |---|---|---|
     | 375 | 317 | 55 |
     | 768 | 530 | 36 |
     | 1280 | 530 | 36 |

   - The essential-bar text ("… never dies (the lowest lake, infinite bar)") also fits.
   - The worst-case string "Lake 30 · born 1000 m · spills into Lake 29 at 1000 m · persistence 1000 m" fits at 320, 360 and 375 (`f5a2_narrow.mjs`).
   - The height of the `.hero__bar` row doesn't change when a highlight appears: 115.6 at 375 and 97.4 at 768 and 1280.
   - The screenshots `highlight-{375,768,1280}-{light,dark}.png`, `hover-mouse-1280-light.png` and `tap-375-dark.png` show the full sentence.

## Previous notes the builder says it fixed
- **Edge markers and labels: fixed.**
  - `f5a2_shots.mjs` instruments the live map context's `fillText`, `measureText` and `arc`, independently of `placeLabel`.
  - At 375 I tested 6 seeds (42, 7, 2026, 123456, 99, 31337) × the 3 drawn rows whose pit or pass is nearest a map edge. All 18 cases had edge distance 0. In every one:
    - both label boxes are inside the canvas;
    - the labels don't overlap each other;
    - the pit ring is inside the canvas;
    - no label covers the pit.
  - Zooms in `zoom/` confirm the markers clear the rounded corners.
  - New, smaller issue: see note 1.
- **Strip aria-label follows the view: fixed.** The label changes when the view changes in F1's panel, and it reverts to the barcode text when switched back.
  - Barcode: "Barcode: one bar per lake, from the water level where it is born to the level where it spills into an older lake. The lowest lake's bar never ends."
  - Diagram: "Persistence diagram: one point per lake, birth level across and death level up. Height above the diagonal is persistence. The lowest lake never dies, so its point sits on the infinity line."
  - Both are consistent with §6.6 items 2–5.
- **aria-keyshortcuts: fixed.** It is "Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape N", which matches the bound keys in controller.ts:830–866. The hidden help text now names Home, End and Escape.
- **e2e non-blank timing: fixed.** `e2e/hero.spec.ts:88–143` polls every frame from an init script and asserts that the first non-blank frame minus `domInteractive` is under 500 ms. That is a conservative start, since hydration can't begin before `domInteractive`. My own probe (`f5_behaviour.mjs` step 1) measured from navigation: hydration at 40 ms and non-blank 0.1 ms later, with variance 6,918.

## Acceptance criteria
1. **§6.3 works:** ✅. Both readout defects are fixed (above). I re-ran `f5_behaviour.mjs` and everything from attempt 1 still holds:
   - **Keyboard scoping:**
     - With the body focused, Space scrolls the page, ↓ scrolls it, and "n" does nothing.
     - On the hero, Space, End, ←, Shift+←, →, ↓ and N work.
     - Typing in the seed input, Space on Close, Space on the theme toggle and Space on the Play button each do only their own job.
   - **Loop:** the hold is 2,530 ms, then a new seed starts at progress 0. With loop off it stops at the top.
   - **DPR cap:** 2.001×.
   - **Summary cadence:** 0 changes during 2 s of play, 1 on pause, 1 after the 300 ms scrub debounce.
   - **Roles:** both canvases have `role="img"`.
   - **Caption:** exact, and the link goes to /rising-water/.
2. **Drawn bars equal the engine's bars:** ✅. I re-ran the independent tools, all **ALL OK**:
   - `f5_hero_tda.mjs`: 30 row-set checks, 547 rects, 338,256 comp checks and 44 merge-colour checks, over 6 seeds and 4 grids.
   - `f5_browser_tda.mjs`: 4 seeds at 1280, 768 and 375. Drawn rows and recorded `fillRect` match my brute force, and the elder-rule pit pixels match. No off-site requests.
   - `f5_backscrub.mjs`: `alive` and `comp` match BFS at every slider step.
3. **Non-blank within 500 ms, no console errors:** ✅. The e2e test passes, and my probe measured 40 ms from navigation. Console errors were 0 in every probe and screenshot run.
4. **Mouse, touch, keyboard; settings in F1's panel:** ✅.
   - **Mouse:** bar hover, map hover and the buttons work.
   - **Touch:** tap on a bar, and tap Play.
   - **Keyboard:** as in criterion 1.
   - **Panel:** all four groups are in the panel at 3 widths × 2 themes (`home-*-open*.png`).
5. **Reduced motion:** ✅. The state is paused at 0.45, frames go 2 → 2 over 1.5 s, and a Play button is shown. The readout is "Level 450 m · N lakes" (`reduced-motion-{375,1280}-{light,dark}.png`).
6. **Pauses off-screen and in a hidden tab:** ✅. Off-screen gives running=false and 0 frames, then it resumes. Emulated hidden also gives running=false and 0 frames, then it resumes (see note 4).
7. **p95 ≤ 22 ms at 1280×800:** ✅. `f5_perf.mjs`, 700 frames per run:
   - rAF interval p95 was 16.7–16.8 ms in each of 3 unthrottled runs, and 16.7 ms in each of 2 runs at 4× CPU.
   - Hero work p95 was 0.6–0.9 ms.
8. **Lighthouse mobile on `/`:** ✅. Performance 100 and accessibility 100 on 3 runs.

## Lighthouse (mobile, staticDistDir)
| run | perf | a11y | BP | SEO | CLS | TBT | LCP |
|---|---|---|---|---|---|---|---|
| / #1 (`LHCI_URLS=/,/garden/`) | 100 | 100 | 100 | 100 | 0.0001 | 0 | 905 ms |
| /garden/ | 100 | 100 | 100 | 100 | 0.0001 | 0 | 752 ms |
| / #2 (`LHCI_URLS=/`) | 100 | 100 | 100 | 100 | 0.0001 | 0 | 904 ms |
| / #3 | 100 | 100 | 100 | 100 | 0.0001 | 0 | 905 ms |

- All LHCI assertions passed.
- In run #1, `bf-cache` reported "CacheLimitPrunedOnCriticalMemoryPressure". Lighthouse labels it "Not actionable"; it comes from the environment, and runs #2 and #3 pass it.
- **CLS from my PerformanceObserver:**
  - 0.00000 at 375;
  - 0.00019 at 768;
  - 0.00028–0.00046 at 1280, all from load;
  - a highlight adds 0 at every width and theme.

## Other gates
- **Links:** `npm run links` found 15 broken links, all `/rising-water/` (expected until F6).
- **Content:** `dist/` has no TODO, TBD, lorem or placeholder.
- **Copy (§11 step 8):** I checked the caption, both strip labels, the help text, the readouts and the map labels ("Lake N · pit", "pass", "pass (spills here)"). All are consistent with §6.6. "pass (spills here)" appears only while the level is below the death level, which I confirmed in `diagram-1280-dark.png`: level 700, death 706.
- **JS on `/`, gzip -9:** Hero is 12.6 KB, settings 0.9 KB and BaseLayout 0.4 KB, so **≈ 13.9 KB** in total, against a budget of 120 KB.
- **Third-party requests:** none. `f5_browser_tda.mjs` logged no off-site requests, and `dist/index.html` names no external origins.

## Notes (non-blocking)
1. **When the pit and pass are next to each other, the pass diamond covers the pit ring.**
   - The pass is drawn after the pit, so the pit can end up almost hidden while its "Lake N · pit" label still points at the spot. Seen in:
     - `markers-375-seed99-row1.png`;
     - `markers-375-seed7-row15.png` (zoom: `zoom/z-markers-375-seed7-row15.png`);
     - `diagram-1280-dark.png` (Lake 24, persistence 10 m);
     - `tap-375-dark.png`.
   - **Where:** `controller.ts:648–671`.
   - **Possible fix:** draw the pit last, or offset the diamond when the two markers are closer than about 2 radii.
2. **A number can wrap away from its unit.** At 1280 the readout wraps as "… persistence 17 / m" (`highlight-1280-light.png`), and the same happens at 768. The text isn't clipped, only split.
   - **Possible fix:** use a no-break space in `metres()` (`text.ts:9–13`), or drop `overflow-wrap: anywhere` at `Hero.astro:209`.
3. **`destroy()` doesn't clear its timers.** At `controller.ts:302–305` it doesn't clear `readoutTimer` or `summaryTimer`. It's harmless today, because nothing calls `destroy` mid-play.
4. **Hidden-tab behaviour is still tested only by emulation.** It uses an overridden `visibilityState`, because headless Chromium can't produce a real hidden tab (same as attempt 1).

## Artifacts
- **Report:** docs/checks/F5/attempt-2.md.
- **Screenshots** in docs/checks/F5/attempt-2/ (46 PNGs plus 11 zooms in `zoom/`). I opened every one.
  - `home-{375,768,1280}-{light,dark}-{closed,open,open-scrolled}.png`
  - `highlight-{375,768,1280}-{light,dark}.png`, `hover-mouse-1280-light.png`, `tap-375-dark.png`
  - `reduced-motion-{375,1280}-{light,dark}.png`
  - `markers-375-seed*-row*.png` (12)
  - `diagram-{375,1280}-{light,dark}.png`
- **Lighthouse JSON** in docs/checks/F5/attempt-2/lh/run{1,2,3}/ (gitignored).
- **New tools** in docs/checks/tools/:
  - `f5a2_readout_probe.mjs`, `f5a2_play_lag.mjs`, `f5a2_hover_merge.mjs`
  - `f5a2_shots.mjs`, `f5a2_narrow.mjs`
- **Re-run tools:** `f5_readout.mjs`, `f5_rm_readout.mjs`, `f5_hero_tda.mjs`, `f5_browser_tda.mjs`, `f5_backscrub.mjs`, `f5_behaviour.mjs`, `f5_perf.mjs`, `f5_lhsum.py`.
