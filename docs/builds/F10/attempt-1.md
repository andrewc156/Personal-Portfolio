# Build report — F10 Extra hero modes (stretch S1) — attempt 1

Summary: The home hero now has a Mode select in HeroSettings ("Animation") with five modes. Rising water stays the default and is unchanged. The four new modes are Dye spill, Fractal pond, Random rivers and Collatz delta. Each is an original fixed-step simulation that runs in a shared `ModeController` shell, and all four are loaded with `import()` only when chosen. Switching modes destroys the old controller first, and e2e checks that its frame, timers, listeners and observers are all gone. The barcode strip and the Rising-water-only controls are hidden in the other modes. The caption, the group and canvas aria-labels, the key help and `aria-keyshortcuts` all change per mode. The Rising water caption still comes out exactly as §6.3 gives it.

Files changed:
- New: src/lib/viz/hero/modes/
  - `meta.ts`: mode ids, labels, captions, key help, `grouped()`. Imported statically and kept small.
  - `types.ts`: the `ModeSim` interface and `ModeColors`.
  - `pixels.ts`: a reusable cell-image blitter and colour mixing helpers.
  - `dye.ts`: curl-noise current, particles with RK2 advection plus Brownian steps N(0, 2DΔt), wall reflection, and a bilinear splat.
  - `pond.ts`: Koch snowflake polygon, scanline rasteriser, leapfrog wave field (Courant number 0.5; CFL limit 1/√2 enforced in the constructor), discrete energy, drops.
  - `rivers.ts`: Scheidegger staggered lattice with a fair coin between the two downstream neighbours, generic `topoOrder` / `strahler` / `drainageArea` / `outletOf`, and a reveal from the largest drainage area down.
  - `collatz.ts`: `collatzStep`, `reverseChildren`, breadth-first `reverseTree` (whole levels only), `layoutTree` (+even / −odd turns), `subtreeSizes` for trunk width, and growth by level.
  - `shell.ts`: `ModeController`. It covers DPR ≤ 2, a fixed-step accumulator (≤ 6 steps per frame), IntersectionObserver and visibility pausing, ResizeObserver with a debounced rebuild, theme observers, keyboard (Space, Enter, N, only when the hero box itself is focused), pointerdown pokes, a throttled readout, and a debounced summary. Growth modes hold for 2.5 s and then loop with a new seed. `destroy()` clears everything; `pendingTimers` and `attached` expose the state.
  - `index.ts`: the lazy entry, `createMode()`.
- src/components/hero/hero-client.ts:
  - `setMode()`: destroys the current controller, applies the per-mode chrome, then either starts `HeroController` or awaits `import('…/modes/index')`. A switch token drops stale imports.
  - Accepts a `?mode=` URL parameter.
  - Test hooks: `__art` (active controller), `__heroMode`, `__setHeroMode`. `__hero` is still the Rising water controller.
  - Form input goes to whichever controller is active, and Reset also restores the mode.
- src/components/hero/HeroSettings.astro:
  - New "Mode" group with the `#hero-mode` select labelled "Animation", plus a note that some controls apply only to Rising water.
  - Rising-water-only controls are wrapped in `[data-rising-only]` (`display: contents`) and get `hidden` in other modes: scale, roughness, water level, pacing, loop, the whole Barcode group, color by, shoreline.
  - Seed, New terrain, Play, Speed and Palette work in every mode.
- src/components/hero/Hero.astro:
  - The caption, group label, shortcuts and key help now come from `meta.ts`. The rendered Rising water text is unchanged.
  - `data-hero-caption`, `data-hero-caption-link` and `data-hero-keys` hooks, and `data-mode` on the root.
  - Default cursor for the non-click modes.
- New: tests/unit/viz/modes/{dye,pond,rivers,collatz,meta}.test.ts (39 tests).
- e2e/hero.spec.ts: new `hero modes` describe block, described under criterion 7. Existing tests are unchanged.

How to verify:
- `npx vitest run tests/unit/viz` → 16 files, 201 tests pass.
- `npm run check` → 0 errors, 0 warnings. `npm run lint` → clean.
- Checker: `npx playwright test e2e/hero.spec.ts` on 4321. I did not run the e2e suite. I ran the same assertions as standalone Playwright scripts against the dev server (see Known limitations).
- Manual: open `/?seed=42`, then the gear → Animation, and try each mode. Or go straight to `/?seed=42&mode=dye|pond|rivers|collatz`.

Acceptance criteria (self-check):
1. ✅ Mode select in HeroSettings, Rising water is the default (`DEFAULT_MODE`, `selected`).
   - Each switch calls `destroy()` on the old controller before starting the next.
   - Standalone check: dye → rising → dye. The old controllers showed frames Δ 0, 0 pending timers, not running, and 0 attached listeners/observers after a `visibilitychange`.
   - The F5 note "destroy() leaves timers" was already fixed in the current `HeroController.destroy()` (it clears the resize, readout and summary timers). The new e2e teardown test now also covers the Rising water controller.
2. ✅ Determinism and sizing.
   - Fixed-step sims are seeded by mulberry32 and value noise. Standalone check: the same seed gives the same canvas hash and a different seed gives a different hash, for all four modes.
   - "New terrain" and N reseed.
   - Grids: `gridSize()` from the hero (about 4 CSS px per cell, ≤ 40k cells) for dye and pond. Rivers use 9 × 5 px node spacing (≤ 40k nodes). Collatz fits its vector drawing to the canvas.
   - DPR is capped at 2. Mode pauses on IntersectionObserver and `visibilitychange` (e2e added).
3. ✅ Barcode strip hidden in the other modes, and the Rising-water-only controls get `hidden`.
   - Caption, group aria-label, canvas aria-label and key help change per mode.
   - A unit test shows the extra-mode copy has no persistence, barcode, lake, homology, filtration or elder-rule wording.
   - A unit test pins the Rising water caption to the exact §6.3 text, and the caption link is restored on return.
4. ✅ Accessibility.
   - Canvas keeps `role="img"` with a per-mode label, which includes live counts (for example "3,518 numbers").
   - The hidden summary updates on construction (mode change), on pause/play, on a new seed, and after a poke (600 ms debounce). It never updates per frame.
   - Keys: Space plays/pauses, N makes a new seed, and Enter pokes the centre in Dye spill and Fractal pond.
   - With reduced motion there is no autoplay. Dye and pond show a warmed static frame, rivers and Collatz show the full drawing, and the Play button shows.
   - Standalone axe run: 0 violations of any impact in all four modes, in light and dark, with the panel open and closed.
5. ✅ Unit tests:
   - Curl field: the central-difference divergence is ≈ 0 at 2,000 points (< 1e-6 of the derivative scale); every cell's net flux is ≈ 0; there is no flow through the walls.
   - Brownian variance grows by about 2DΔt.
   - Wave scheme:
     - energy is conserved to < 1e-3 over 4,000 steps with fixed walls;
     - wall cells stay at exactly 0;
     - damped energy decays;
     - the constructor rejects C > 1/√2, and the scheme blows up at C = 0.9.
   - Koch snowflake: vertex count is 3·4ⁿ, and area matches the closed form A₀(1 + 3/5(1 − (4/9)ⁿ)), which proves the bumps point outward.
   - Strahler order checked on 8 hand-built trees and forests; cycles are rejected.
   - Scheidegger:
     - every cell has exactly one receiver, the adjacent node in the next column;
     - every cell reaches exactly one outlet in the last column, and those outlets' areas sum to W·H;
     - first-column sources merge into fewer than H/3 outlets.
   - Collatz:
     - `collatzStep(child) === parent` on all nodes of a 20k-node tree;
     - level d equals the brute-force set of n with stopping time d, for d ≤ 16;
     - no duplicates, and all values are safe integers.
6. ✅ Lazy loading, frame time and requests.
   - The extra modes load only via `import()`. Standalone check: no script on the initial load contains a pond-only marker string, and one does after switching.
   - Size (esbuild, minified, gzip, as an estimate):
     - initial hero JS goes from 13.3 KB to about 15.2 KB;
     - the lazy modes chunk is about 10.4 KB;
     - both are far inside the 120 KB budget.
   - Frame time at 1280×800 (dev server, Chromium): p95 is 16.7–16.8 ms in every mode. The sim's step + draw costs ≤ 1.2 ms at p95 (dye is the heaviest).
   - No new dependencies and no network requests from the modes.
7. ✅ e2e/hero.spec.ts covers:
   - selecting each mode through the real select (chrome swap, hidden strip and controls, caption, labels, summary, non-blank canvas) and switching back to Rising water (strip, exact caption and link, labels);
   - teardown of dye, pond and rising controllers;
   - lazy loading;
   - per mode: determinism, N and Space, plus reduced motion (no autoplay, static frame, Play button);
   - click and Enter for dye and pond (pokes, readout, summary, the picture changes), and tapping the pond on touch;
   - pausing off-screen and in a hidden tab;
   - p95 ≤ 22 ms per mode;
   - no overflow at 375, 768 and 1280;
   - axe in light and dark for every mode, with the panel open and closed.
8. ✅ Colours.
   - All colours come from tokens read at runtime (`--color-surface`, `-sunken`, `-water`, `-water-deep`, `-land-1..3`, `-accent`, `-text-muted`) plus the selected palette's identity colours. Modes redraw when the theme changes.
   - Screenshots at 375 and 1280, light and dark, were reviewed for every mode.
   - Standalone overflow check at 320, 375, 768 and 1280: no horizontal overflow, and the readout is never clipped.

Needs Andrew: none. All copy is descriptive and makes no claims about Andrew.

Requests to Control: none. No shared files or dependencies were touched.
- Note: while I worked, other uncommitted changes appeared in the tree that are not mine: docs/data.md, e2e/cls.spec.ts, e2e/shell.spec.ts, pipeline/*, public/data/colorado/*, src/components/site/Header.astro, docs/builds/F12a, docs/checks/CI1. Please keep them out of the F10 commit.
- Note: `npx astro dev --port 4410` reported a dev server for this project already running on 4411 (pid 23366, not started by me). I used it for my screenshots and checks and left it running.

Known limitations:
- I did not run the e2e suite (builder rules). The new tests were checked as equivalent standalone Playwright scripts against the dev server. The checker should run e2e/hero.spec.ts.
- Frame timing and bundle sizes were measured on the dev server and with esbuild, not on a production build. The checker should confirm with build, preview and Lighthouse.
- "Enter on the focused canvas" works on the focused hero box (`[data-hero]`, tabindex 0), which contains the canvas. The canvas itself is not a separate tab stop, so there is no nested focus.
- Dye spill and Fractal pond have no end state, so they don't loop. Random rivers and Collatz delta hold 2.5 s when fully grown, then regenerate with a new seed (same as Rising water's default loop). The Loop checkbox applies to Rising water only.
- Fractal pond uses a Koch snowflake only; the Sierpinski option was not built. Level 4 is used when the grid is at least 56 cells tall, otherwise level 3.
- Random rivers draws Strahler orders 1–2 as thin muted threads for legibility. Orders ≥ 3 use the palette's identity colours. Width grows with order, so colour is never the only cue.
- The settings group headings stay "Terrain" and "Water" in every mode, and the button is still "New terrain" in all modes.
