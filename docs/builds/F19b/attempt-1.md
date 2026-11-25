# Build report — F19b Hero first frame and framing — attempt 1

## Summary
- **First frame.** Autoplay now starts part of the way up instead of at the bottom. On the first painted frame you see land, three or four coloured lakes and a few barcode bars.
  - The start comes from a pure function, `pickStartProgress` in `model.ts`, of the engine's bars and the sorted heights. It is deterministic for a given seed and grid; seed 42 at 1280×800 starts at p = 0.14.
  - Loops, replays and reduced motion are unchanged: loops and replays start at 0, and reduced motion still shows a static frame at 45 % with no autoplay.
- **Relief.** The land tint now mixes height with height rank, and the hillshade is measured relative to flat ground with an asymmetric gain. Both run once per terrain or palette, so per-frame cost is the same.
- **Barcode link.** Pointing at a lake on the map (hover, or tap on touch) now outlines its bar and marks its pit and pass. The bar-to-map direction already existed.
- **Barcode default.** `maxBars` drops from 30 to 12, so the rows stay legible and their colours visibly match the lakes.
- **Framing.**
  - The map is now 16:9 (was 2:1) and the strip is 6.5rem (was 7.5rem).
  - When the art box is at least 35rem wide, the readout sits beside Play / New terrain on one row. The row is 53 px tall, down from 97 px.
  - The mobile hero has tighter top padding and a smaller gap, and the toolbar has slightly more space below it.
- **Copy and fixes.**
  - Hero caption and keyboard help rewritten with the humanizer rules.
  - Three missing-space bugs on /rising-water/ fixed (F9 a4 note 2).
  - The reduced-motion e2e startup race hardened (F9 a4 note 1).

## Files changed
- `src/lib/viz/hero/model.ts`: adds `pickStartProgress` and the constants `START_SEARCH`, `START_MIN_DEPTH_M`, `START_TARGET_WET` and `START_MAX_WET`.
- `src/lib/viz/hero/controller.ts`:
  - start progress on load, plus a public `startAt`;
  - `HERO_DEFAULTS.maxBars` 30 → 12;
  - map → bar link: `lakeRowAt(cell)`, `mapPicked`, and the pointer handlers;
  - `highlightedRow` getter for e2e.
- `src/lib/viz/hero/render-map.ts`: land tint (half linear height, half height rank), hillshade relative to `SHADE_FLAT` (new export).
- `src/lib/viz/hero/modes/meta.ts`: new `RISING_CAPTION` export; Rising water key help; the "With the animation focused:" lead-in in the other four modes' key help.
- `src/components/hero/Hero.astro` (CSS only):
  - mobile padding and gap;
  - toolbar margin;
  - `container: hero-art`;
  - map aspect 16:9;
  - strip 6.5rem;
  - `@container (min-width: 35rem)` status row.
- `src/components/explorer/LakesTable.astro:36`, `src/pages/rising-water/index.astro:126,131`: add `{' '}`.
- `e2e/hero.spec.ts`:
  - `RISING_CAPTION` constant, now used by the exact-caption test too;
  - `framesSettled()` helper used by both reduced-motion tests;
  - new test: the first frame shows ≥ 2 lakes and the start is the same on reload;
  - new test: hovering a lake highlights its bar and leaving clears it.
- `tests/unit/viz/start.test.ts` (new, 6 tests); `tests/unit/viz/modes/meta.test.ts` (caption, key help, AI-ism guard).
- `docs/builds/F19b/`:
  - `shots.mjs`, `hover-shot.mjs`, `spacing-4418.mjs` (the checker's spacing repro, pointed at port 4418);
  - `before.json`, `after.json`;
  - PNGs (gitignored).

## How to verify
```
npm run check            # 0 errors / 0 warnings / 0 hints (150 files)
npm run lint             # clean
npm test                 # 28 files, 818 passed
npx vitest run tests/unit/viz/start.test.ts tests/unit/viz/modes/meta.test.ts
# checker, with preview on 4321:
npx playwright test e2e/hero.spec.ts
node docs/checks/tools/f9a4-spacing.mjs     # /rising-water/ should list only the ".prj" filename false positive
node docs/builds/F19b/shots.mjs check 4321  # same before/after shots against preview
```
I ran the spacing repro against my dev server on 4418. /rising-water/ now reports only `"…from WBDHU2.prj"`, a filename false positive. The other routes' hits ("B.S.", a quoted title) are on F19a-owned pages, and they are false positives too.

## Acceptance self-check
- ✅ **Bars equal engine output.** `selectBars` still returns references to `result.bars`, and the existing model and barcode tests pass. The map link only reads `Flood.componentOf`, which is the birth cell.
- ✅ **Deterministic per seed.**
  - The start depends only on the bars, heights and pacing. A unit test checks it on 6 seeds, and the new e2e test checks it across reloads.
  - The land colours depend only on heights and rank.
- ✅ **Non-blank within 500 ms.** The first frame is still painted in the constructor. The extra work is one Float32Array of length n plus about 32 × 12 comparisons, under 1 ms at 11k cells. Not timed under e2e (checker only).
- ✅ **Frame time.** The per-frame path (`paint`, `drawBarcode`) is unchanged. Land pixels are still built in `setColors`, once per terrain or palette. Hover adds one `advanceTo` and a loop over at most 12 rows per pointer move.
- ✅ **CLS 0.** All changes are static CSS. The readout keeps its 2-line reserved height.
  - Probe at 375, 768, 900, 1280 and 1440: `.hero__bar` height is identical before and after highlighting the longest bar readout and in Collatz mode, and the readout never overflows (scrollHeight ≤ clientHeight, scrollWidth ≤ clientWidth).
- ✅ **Keyboard, hidden summary.** Unchanged. `cycleHighlight` and the strip handlers reset `mapPicked`, so a map pick never fights a keyboard or strip pick.
- ✅ **Reduced motion: static frame at 45 %, no autoplay.**
  - Probe: frames 1 → 2 by 300 ms, then flat at 2 to 2.8 s; `running=false`, `state=paused`, progress 0.45.
  - The e2e tests now wait for that settle before measuring the 800 ms window. The same `≤ 2` bound now proves there is no autoplay without the race. The extra-mode test also asserts `running=false` before the window.
- ✅ **Hero JS budget.** About 1.5 KB of source added to the hero chunk and no new dependencies. Not measured with a build (checker only).
- ✅ **§6.6 copy.** Each caption claim maps to items 2 and 3 (see the table).
- ✅ **Spacing bugs fixed** (dev-server repro above).
- ⚠️ **e2e not run by me** (builder rule). New and changed hero tests are type-checked and linted only.

## Text changes (before → after)
| Where | Before | After |
|---|---|---|
| Hero caption (meta.ts `RISING_CAPTION`) | Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime. | Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on. The barcode gives each lake a bar from the level where it forms to the level where it merges. |
| Caption link | See it on the Colorado River Basin → | unchanged (already plain) |
| Rising water key help (hidden, aria-describedby) | With the animation focused: Space plays or pauses, Left and Right arrows move the water level, Home and End jump to the bottom and top, Up and Down pick a bar, Escape clears the picked bar, and N makes a new terrain. | When the animation has focus, Space plays or pauses. The Left and Right arrows lower and raise the water, and Home and End jump to the bottom and the top. Up and Down pick a bar, Escape clears it, and N makes new terrain. |
| Dye spill key help | With the animation focused: Space plays or pauses, Enter spills dye at the centre, and N makes a new current. | When the animation has focus, Space plays or pauses, Enter spills dye at the centre, and N makes a new current. |
| Fractal pond key help | With the animation focused: Space plays or pauses, Enter drops a pebble at the centre, and N makes a new pond. | When the animation has focus, Space plays or pauses, Enter drops a pebble at the centre, and N makes a new pond. |
| Random rivers key help | With the animation focused: Space plays or pauses, and N grows a new network. | When the animation has focus, Space plays or pauses and N grows a new network. |
| Collatz delta key help | With the animation focused: Space plays or pauses, and N draws a new delta. | When the animation has focus, Space plays or pauses and N draws a new delta. |
| /rising-water/ lakes note | …as clicking its bar does.With the basin mask on… | …as clicking its bar does. With the basin mask on… |
| /rising-water/ code list | …in pipeline/tda_ref.py.Repository | …in pipeline/tda_ref.py. Repository |
| /rising-water/ code list | …runs in your browser.Source | …runs in your browser. Source |

How the copy was edited, and why it has no first person:
- **Facts:** each caption claim maps to §6.6.
  - "Form in the valleys" is item 2 (born at a valley floor).
  - "When two meet, the older one carries on" is item 2 (the elder rule).
  - "One bar … from the level where it forms to the level where it merges" is item 3.
- **Removed:** the "born, then merge" list rhythm and the abstract "records each lake's lifetime".
- **First person:** none in the caption. It describes the animation, and an "I" there would add a claim about Andrew that isn't in the sources. The key help is instructions, so it uses second-person-neutral phrasing.

## Screenshots (dev server 4418, seed 42, DPR 1; in docs/builds/F19b/)
Both sets were taken right after hydration, with playback paused at that frame.
- `before-1280-light.png`:
  - flat, blurry beige terrain with almost no relief, one small blue lake, Level 33 m · 1 lake;
  - the strip is empty except the essential bar;
  - the status row is tall (buttons, with the readout on a second line).
- `before-1280-dark.png`: same, a muddy dark brown field with one lake.
- `before-375-light.png` / `-dark.png`: same single lake, and the strip is mostly empty. Play and the readout sit at the fold.
- `before-*-rm.png` (45 %): one large merged lake and about 20 hair-thin bars (27 rows at 3 px pitch), so the colours are hard to match to anything.
- `after-1280-light.png`:
  - clear relief with lit and shaded ridges;
  - three or four lakes in distinct identity colours (blue, orange, plum), Level 170 m · 3 lakes;
  - five legible coloured bars in the strip match the lakes;
  - the readout sits beside the buttons, vertically centred;
  - the name block is centred on the art.
- `after-1280-dark.png`:
  - the same frame on dark, with visible relief instead of a flat brown field;
  - light-blue, orange and pink lakes, and the bars match.
- `after-375-light.png` / `-dark.png`:
  - three lakes on first paint;
  - the hero starts 24 px higher, so the map, the strip and the Play / New terrain row all fit in the first 812 px.
- `after-*-rm.png` (45 %): large lake with shaded shores; 12 thick bars, with dead bars ending at their merge levels.
- `after-1280-hover.png`: the pointer over the orange lake outlines its bar in the strip and marks "Lake 2 · pit" and "pass (spills here)" on the map. The readout says "Height 184 m · Lake 2".
- `before-1280-light-3s.png` / `after-1280-light-3s.png`: about 3 s into play, for comparison.

## Needs Andrew
- Is the caption wording OK? It is about twice as long as before (38 words vs 20). The shorter fallback is: "Water rises over a random landscape. Lakes form in the valleys, and when two meet, the older one carries on." If you choose it, the barcode sentence moves to the strip's aria-label, which already says the same thing.
- Taste: the light-theme relief is now noticeably stronger. The gains are in `render-map.ts:104`, so it is easy to soften.

## Requests to Control
1. **Spec §6.3 caption** (portfolio-megaprompt.md:187): replace the quoted caption with the new `RISING_CAPTION` text, citing DECISIONS #85.
2. **DECISIONS entry** for:
   - autoplay starting at `pickStartProgress`, while loops, replays and reduced motion are unchanged;
   - `maxBars` default 12, still adjustable from 5 to 60;
   - map aspect 16:9 and strip 6.5rem;
   - the map → bar hover/tap link.
3. **Copy consistency (F19a or Control):** /rising-water/ still uses the old phrasing in its meta description and intro, "Lakes are born, then merge, and the barcode records each lake's lifetime." (`src/pages/rising-water/index.astro:43,58`). I didn't touch it because my ownership there covers the spacing fix only.
4. **Checker:**
   - run `e2e/hero.spec.ts`: two new tests, the hardened reduced-motion tests, and the caption tests now using the new text;
   - re-run `f9a4-spacing.mjs`.
5. **Dev-server note for future builders:** a second `astro dev` in this repo needs `--ignore-lock`. Otherwise it refuses to start, or with `--force` it kills the other session's 4411 server.

## Known limitations
- At p ≈ 0.14 some lakes that the first frame shows were born before it. Their births are seen from the second loop on, and on replay (both start at 0).
- Lakes below the barcode's row cap (now 12) have no bar, so hovering them highlights nothing. The readout still names the lake.
- The caption's "to the level where it merges" doesn't apply to the lowest lake, which never merges. The strip's aria-label covers that ("The lowest lake's bar never ends").
- I didn't measure frame time, Lighthouse or JS size myself (checker-only gates).
