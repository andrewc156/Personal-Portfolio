# Build report — F5 Synthetic hero — attempt 1

Summary: I replaced F1's Hero and HeroSettings stubs with the synthetic Rising water hero, which uses the F3 engine unchanged. It draws a seeded fractal-noise terrain with an elevation tint and hillshade. Lakes take their identity colours from the engine's union-find root (the birth cell), so the elder rule decides which colour survives a merge. Below the map is a live barcode strip that can switch to a persistence diagram. Hovering or tapping a bar outlines and labels its lake and marks its pit and pass. The settings live in F1's panel in four groups. The hero has keyboard and touch controls, reduced-motion handling, and pausing when off-screen or in a hidden tab. Everything the renderer draws comes from pure, unit-tested functions in `src/lib/viz/**`.

Files changed:
- src/lib/viz/common/color.ts: hex/packing, WCAG contrast, CIELAB and CIEDE2000, and Machado 2009 CVD simulation.
- src/lib/viz/common/rng.ts: mulberry32, lattice hash, and seed helpers.
- src/lib/viz/common/noise.ts: value noise and fBm.
- src/lib/viz/common/palettes.ts: Delta, Canyon, Glacier, Estuary and Mono, each in light and dark.
- src/lib/viz/hero/terrain.ts: gridSize (about 4 CSS px per cell, ≤ 40k cells), generateTerrain, hillshade.
- src/lib/viz/hero/model.ts: rankLakes, buildLakeTable (identity slots and labels), selectBars (min persistence and cap), barExtent, levelAt (linear and percentile), basinMask.
- src/lib/viz/hero/render-map.ts: MapPainter, which writes packed RGBA into a preallocated ImageData buffer with no per-frame allocation.
- src/lib/viz/hero/barcode.ts: strip layout, drawBarcode, drawDiagram, and hit testing.
- src/lib/viz/hero/text.ts: readout and screen-reader summary text.
- src/lib/viz/hero/controller.ts: the DOM runtime (loop, observers, events).
- src/components/hero/Hero.astro: replaces the stub.
- src/components/hero/HeroSettings.astro: replaces the stub.
- src/components/hero/hero-client.ts: new.
- tests/unit/viz/{color,palettes,terrain,model,text}.test.ts: 88 tests.
- e2e/hero.spec.ts: 14 tests, written but not run.
- docs/builds/F5/screens/*.png: 20 self-check screenshots (gitignored).

How to verify:
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 9 files, 369 passed, of which 88 are new in tests/unit/viz.
- Checker: `npm run build && npx playwright test e2e/hero.spec.ts`. Every test loads `/?seed=42` (the `?seed=` parameter makes the terrain deterministic) and reads state from `[data-hero]` (`data-state`, `data-running`, `data-seed`) and from its `__hero` controller (`frames`, `progress`, `drawnRows`).
- What I ran myself: throwaway Playwright scripts against `npx astro dev --port 4405` (now stopped), in Chromium.

Acceptance criteria (self-check):
1. ✅ Everything in §6.3 works.
   - **Terrain:** the same seed gives an identical grid (unit test). The grid is 141×71 at 1280, 176×88 at 768 and 85×43 at 375.
   - **Map:** land tint plus hillshade. Water takes its lake's identity colour with depth shading. "Color by depth" and shoreline outlines are options.
   - **Barcode:** bars grow live up to a current-level line, and finished bars stay. Min-persistence threshold, max-bars cap, and a barcode ↔ persistence diagram toggle (birth vs death scatter, diagonal and ∞ line). At the top level the essential bar reaches the right edge (unit test).
   - **Settings groups:** Terrain (seed, New terrain, scale, roughness), Water (Play/Pause, speed, level scrubber, pacing linear | percentile, loop), Barcode (show, min persistence, max bars, view), Color (palette, color by, shoreline), plus Reset, which keeps the current seed.
   - **Interaction:** hovering or tapping a bar outlines its lake with a two-tone ring (text colour inside, background colour outside). If the lake has already merged, the ring shows its basin just before it spilled. The pit and pass get markers, and the labels read "Lake N · pit" and "pass". Hovering the map shows "Height X m · Lake N" or "· dry land".
   - **Loop:** at the top it holds for 2.5 s, then starts again with a new seed if loop is on. Otherwise it stops, and Play replays from the bottom.
2. ✅ Drawn bars equal the engine's bars (tests/unit/viz/model.test.ts), checked against a recording 2-D context for 5 seeds at 4 levels each.
   - Every `fillRect` maps back to one engine `Bar` object, and there is exactly one rect per bar born so far.
   - The x positions invert to `birth` and `min(death, level)` to within 1e-9 of the relief.
   - With no threshold and no cap, the rows are exactly `result.bars`.
   - Threshold and cap keep the most persistent engine bars.
   - Diagram points sit at (birth, death).
3. ✅ The canvas is non-blank right after hydration, because the first frame is painted synchronously in the controller's constructor. The map's pixel variance was 7,250 at 57 ms after navigation (Pixel 7 emulation). Console errors: none in any of the 6 theme/width runs.
4. ✅ Controls, as measured by the probe:
   - **Mouse:** buttons, bar hover and map hover work.
   - **Keyboard** (only while the hero wrapper itself has focus): Space plays and pauses, ←/→ scrub ±2 % (±10 % with Shift), Home/End jump, ↑/↓ cycle bars, Esc clears the highlight, N makes a new terrain. scrollY stayed 0. Typing "n" in the seed input did not change the terrain.
   - **Touch:** tapping Play and tapping a bar both work.
   - **Settings:** they are in F1's panel through `HeroSettings`. I tested the seed input, the panel Play button, view, palette and level.
5. ✅ Reduced motion: state paused, progress 0.45, `running=false`, 2 frames in total, and the Play button is shown.
6. ✅ Off-screen: `running=false`, and frames stayed at 1010 → 1010 over 0.5 s. Back on screen it runs again. In a hidden tab (emulated `visibilityState` plus the event) it stops running and resumes when visible.
7. ✅ Frame times at 1280×800 in Chromium, measured over 4 runs of 300 frames:
   - rAF interval: median 16.7 ms, p95 16.7–16.8 ms, max 16.8 ms.
   - The hero's own render work: median 0.3–0.5 ms, p95 0.5–0.8 ms, max ≤ 1.1 ms.
8. ⚠️ Lighthouse was not run (checker only). Measurements I took that bear on it:
   - CLS: 0.0005 at 1280 and 0 on Pixel 7 (dev server). The map box uses aspect-ratio 2/1 and the strip and control row have fixed heights.
   - Hero JS: 12.3 KB gzip (esbuild bundle of hero-client plus the libraries, minified).
   - Main-thread work at load is one terrain plus one `computeH0` on about 10k cells, a few ms.
   - axe: 0 violations of any impact (light, with the settings panel opened and used).

Palette method (§4.2):
- Each palette has 6 identity colours (Mono has 4) per theme, chosen with a maximin search and then tuned by hand.
- The test simulates protanopia, deuteranopia and tritanopia with the Machado, Oliveira & Fernandes (2009) matrices at severity 1.0, applied in linear RGB.
- It asserts a minimum pairwise CIEDE2000 ≥ 10 for normal vision and for each simulation, in both themes. The CIEDE2000 implementation is checked against Sharma et al.'s published test pairs.
- It also asserts that every identity colour has ≥ 3:1 contrast against the strip background, and that this background matches `--color-surface` in tokens.css.
- Lowest pairwise ΔE (normal / protanopia / deuteranopia / tritanopia):

  | palette | light | dark |
  |---|---|---|
  | Delta | 18.1 / 12.1 / 14.9 / 10.6 | 22.5 / 17.1 / 17.6 / 18.2 |
  | Mono | 11.2 / 10.9 / 11.4 / 11.3 | 11.8 / 11.2 / 12.0 / 12.7 |
  | Others | ≥ 11.3 | ≥ 13.5 |

- The K most persistent lakes always get distinct colours (colour = importance rank mod K).

Needs Andrew: none new. The hero text (name, question, keywords) is still F1/F2 draft content.

Requests to Control:
- None required.
- Optional, for F3 / docs/tda.md: `Flood.advanceTo` still allocates its events array and a closure per call (F3 note 1). The hero calls it once per frame and ignores the events, so a cheaper "advance without events" method would remove the only per-frame allocation left in the hero. It isn't needed for the budget (render p95 < 1 ms).

Known limitations:
- The caption links to `/rising-water/`, which doesn't exist until F6, so `npm run links` will report it as broken until then.
- Lake labels ("Lake N") are importance ranks within the current terrain, not stable ids across terrains.
- The readout line is truncated with an ellipsis on narrow screens. The full text is in the visually hidden summary only for pause and scrub states, not for hover.
- The hidden-tab test emulates `document.visibilityState`, because Playwright can't truly background a tab.
- Very short bars (narrower than 1 device px) are drawn at their true width, so they are faint. This is deliberate, to keep drawn bars equal to engine bars.
- Linear pacing does most of its merging in the lower half of the rise on most seeds. Percentile pacing spreads it out.
