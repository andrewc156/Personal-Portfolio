# Check report — F10 Extra hero modes (stretch S1) — attempt 1
Verdict: FAIL

Gates: check ✅ (0/0/0) · lint ✅ · unit ✅ (779/779, 24 files) · pytest ✅ (594) · ruff ✅ · build ✅ · e2e ❌ (full run: 150 passed, 1 failed, 8 skipped; the failure is F10's hero.spec.ts:842, which fails every time, 4/4 runs) · axe ✅ (hero light/dark and every extra mode light/dark pass in the full run, in 3 repeats, and in 3 more under CPU stress) · lighthouse ✅ (/ mobile, 3 runs: perf 100, a11y 100, BP 100, SEO 100, CLS 0, LCP ≈ 0.9 s, TBT ≤ 36 ms) · links n/a · visual ✅ (48 PNGs, all opened) · content ✅ · tda ✅ (my own numeric oracles, all pass) · data n/a

Explorer spec: e2e/explorer.spec.ts passed in my full run. F12b and F13a files changed in the tree while I worked. None of that touches F10, and no F10 file changed during the check (the newest F10 mtime is 19:19; the check started at 19:50).

## Acceptance criteria

1. **Selector, default, teardown: ✅**
   - `#hero-mode` ("Animation") is in the Mode group, and Rising water is the default (`data-mode="rising"`, select value `rising`).
   - I did not rely on the builder's hooks to check for leaks. My tool (docs/checks/tools/f10-leaks.mjs) wraps `requestAnimationFrame`/`cancelAnimationFrame`, `setTimeout`/`setInterval`, `addEventListener`/`removeEventListener`, and IntersectionObserver/ResizeObserver/MutationObserver in the page. It then switches modes through the real `<select>` for 3 rounds of 12 switches, followed by 20 rapid switches (some mid-import).
   - Live counts were identical in every round for each mode. After all the switching, Rising water's counts equal the first-load baseline exactly: 1 rAF, 1 IO, 2 RO, 2 MO, the same listener set.
   - A paused extra mode makes 0 rAF calls in 1 s. No page errors. Log: docs/checks/F10/attempt-1/leaks.log.

2. **Determinism, N, sizing, pause: ❌ (off-screen pause draws once; see fix 1)**
   - Determinism per seed and N regeneration pass (e2e `deterministic per seed` ×4 modes, 4/4 runs). My probe shows N changes the seed in all 4 modes.
   - DPR is capped at 2: I measured ×2.00 at DPR 3 (320 and 375 px viewports).
   - Dye and pond use `gridSize()`: 3.97–4.01 CSS px per cell, ≤ 15,488 cells across 320–2560 px viewports.
   - Rivers uses 9 × 5 CSS px node spacing. That is outside "about 4–6 px" on the column axis (see fix 2). Collatz is vector and has no grid.
   - A hidden tab pauses with no frames.
   - Off-screen does not step the sim (0 sim steps in 40 runs). But there is exactly one extra canvas draw after the IntersectionObserver reports off-screen whenever the scroll happens within about 200 ms of mode start (20/20 runs at settle 0, 0/20 at settle 1 s).
   - Logs: perf-size.log, offscreen-probe.log, offscreen-cause.log.

3. **Chrome per mode and copy: ✅**
   - The strip box and every `[data-rising-only]` control are hidden in the extra modes. Seed, New terrain, Play, Speed, Palette and Reset stay. I confirmed this in the 18 panel screenshots.
   - The caption, group label, canvas aria-label, key help and `aria-keyshortcuts` all change per mode, and the caption link is hidden.
   - I read every string in meta.ts and the four sims' `readout`/`summary`/`label`. None makes a TDA claim; there is no lake, barcode, persistence or homology wording.
   - The Rising water caption in dist/index.html, extracted and whitespace-normalised, equals the §6.3 text plus the link text exactly (scripted comparison: `exact: True`).

4. **Accessibility: ✅**
   - The canvas keeps `role="img"` with a per-mode label.
   - My MutationObserver on the summary and the canvas aria-label saw 0 changes in 4 s of play (240 frames) in every mode. The summary updates on Space-pause ("… Paused. …") and on mode change.
   - Keys:
     - Enter pokes in dye and pond (0→1) and does nothing in rivers and collatz (0→0).
     - Space toggles play.
     - N reseeds.
   - Reduced motion:
     - no autoplay: `state=paused`, `running=false`, and a Play button shows;
     - the static frame is non-blank. Dye and pond show a warmed plume or ripples; rivers and collatz show the full drawing (rm-*.png).
   - axe reports 0 serious/critical in all 4 modes, light and dark, with the panel open and closed.
   - Log: a11y-probe.log.

5. **Correctness: ✅** My own checks are in docs/checks/tools/f10-math.ts (bundle with esbuild, run with node). Every check passes:
   - Curl field:
     - max |div u| = 2.4e-11 by central differences (|∂u/∂x| up to 3.3);
     - normal-velocity jump across cell edges ≤ 6.8e-7;
     - wall-normal velocity 0;
     - per-cell boundary flux from my own Gauss–Legendre line integral ≤ 5.7e-14.
   - Brownian per-axis variance is 1.98 against 2DΔt·n = 2.00.
   - Wave scheme:
     - my von Neumann check gives max|g| = 1 at C = 0.5 and 2.0 at C = 0.75;
     - my own float64 leapfrog matches the builder's field to 8e-7 over 20,000 steps on a level-4 Koch mask;
     - my own discrete energy drifts by 4e-15;
     - wall cells stay exactly 0 and |u| stays bounded (0.81);
     - damped energy is non-increasing;
     - C = 0.72 is rejected.
   - Koch, levels 0–5:
     - 3·4ⁿ vertices, with every edge exactly s/3ⁿ;
     - perimeter 3s(4/3)ⁿ;
     - area matches the closed form;
     - 120° symmetry to 1e-15;
     - no self-intersections (brute force, n ≤ 3);
     - the rasteriser equals my winding-number test on all 15,000 cells.
   - Rivers:
     - Strahler equals my recursive oracle on 6 hand trees (with my hand expectations) and on 300 random forests;
     - on 3 Scheidegger lattices, every node has exactly one receiver in the next column at |Δy| = 0.5;
     - my own walk takes every node to exactly one last-column outlet;
     - lattice Strahler equals my oracle.
   - Collatz:
     - the forward map gives the parent for all 3,518 nodes;
     - levels 0–22 equal the brute-force stopping-time sets;
     - there are no duplicates.

6. **Performance: ✅**
   - Lazy loading:
     - dist/index.html loads only Hero.*.js and BaseLayout.*.js, and the modes chunk (`_astro/modes.D3OP_gsr.js`, 10.2 KB gzip) is reached only through `import()`;
     - the pond-only string "breaks the 2-D CFL" appears only in that chunk;
     - Lighthouse network requests on / don't include it.
   - Initial home JS is 17.0 KB gzip (13.7 + 2.0 + 0.9 + 0.4), within the 120 KB budget.
   - Frame time on preview at 1280×800:
     - p95 is 16.7–16.8 ms in every mode;
     - the sim's step + draw p95 is 2.8 ms for dye and ≤ 0.2 ms for the others.
   - Third-party requests: 0. package.json and the lockfile are unchanged.

7. **e2e coverage and reliability: ❌**
   - Coverage matches the brief.
   - `--repeat-each 3`: 131 passed, 4 failed.
     - :842 failed 3/3 (plus 1/1 in the full run), so it is deterministic.
     - One `dye: click/tap and Enter` failure was a Playwright trace-file ENOENT in `browserContext.close`, not an assertion. That test then passed 10/10 (`-g "click/tap and Enter" --repeat-each 5`), so I count it as external.
   - CI1's other failures (:443, :521 ×2, :632) did not reproduce: they passed in the full run and in 3 repeats, and 24/24 under CPU stress (8 extra busy processes, load average about 18: e2e-stress.log). The likely cause is that CI1 ran against a mid-work tree.

8. **Visual: ✅**
   - I opened all 48 PNGs: 5 modes × 3 widths × 2 themes, plus 18 panel-open shots, plus 4 reduced-motion shots.
   - I found no horizontal overflow (scrollWidth equals the viewport in every case), no clipped readouts (the longest one, collatz at 1280, fits), no blank or frozen canvases, and no contrast problems. The panel fits at 375, 768 and 1280.

9. **Originality: ✅**
   - richpauloo.com's canvases are a particle flow field and an animated Voronoi diagram.
   - The F10 modes differ in approach and look:
     - dye is a grid density with streamline banding, not particle trails;
     - there is no Voronoi;
     - the pond, rivers and Collatz modes are unrelated to anything on that site.
   - The copy is original.

## Blocking fixes

1. **Extra modes draw once while off-screen, and e2e/hero.spec.ts:842 fails every time.**
   - Where:
     - src/lib/viz/hero/modes/shell.ts:268–277: the resize-settle timer sets `this.dirty = true; this.schedule();`;
     - src/lib/viz/hero/modes/shell.ts:288: `schedule()` requests a frame whenever `dirty` is set, even when `onscreen`/`visible` is false.
   - Cause:
     - the ResizeObserver's initial callback, which fires on `observe()`, arms the 200 ms timer;
     - if the hero goes off-screen inside that window, the timer fires and renders one frame while off-screen;
     - my trace shows the timer firing at +164 ms after off-screen and the draw at +165 ms (offscreen-cause.log).
   - Expected: no draws while off-screen or in a hidden tab. Actual: `frames` goes 5→6 (and 6→7) after `running=false`, in 4/4 e2e runs and 20/20 probe runs. The sim doesn't step, but the test, which is sound, fails.
   - Suggested fix: in `schedule()`, request a dirty-only frame only when `this.onscreen && this.visible`. The IO and visibility callbacks already call `schedule()`, so the pending dirty redraw happens on return. Don't loosen the test.
   - Reproduce:
     - `npm run build`, then `npx playwright test e2e/hero.spec.ts -g "extra modes pause off-screen" --repeat-each 3`;
     - or `node docs/checks/tools/f10-offscreen.mjs http://localhost:4321 5` against preview.

2. **Random rivers lattice spacing is outside the criterion-2 sizing rule.**
   - Where: src/lib/viz/hero/modes/rivers.ts:113 (`COL_PX = 9`).
   - Expected: about 4–6 CSS px per cell, following the hero grid. Actual: 8.94–9.04 px per column and 4.93–5.03 px per row (perf-size.log).
   - Fix: either bring the column spacing to ≤ 6 px (at 6 × 5 the largest viewport is still well under 40k nodes), or Control records an accepted deviation in docs/DECISIONS.md. This is a judgement call; if Control accepts it, it drops to a note.
   - Reproduce: `node docs/checks/tools/f10-perf-size.mjs http://localhost:4321`, then read the "rivers … px/cell" lines.

## Notes (non-blocking)

- **CLS on deep links.** Loading `/?mode=<extra>` directly gives CLS ≈ 0.045 at 1280×800 (pond, rivers, collatz; dye measured 0). The strip box is server-rendered and then hidden, so the hero box shrinks. Plain `/` has CLS 0. That 0.045 is close to the 0.05 budget. Consider reserving the same height, or hiding the strip with CSS keyed to the URL parameter before hydration.
- **Spare space under the readout.** In the extra modes the hero card keeps empty space below the readout (about 35–50 px at 375 and 1280). It's cosmetic.
- **Summary announcements on loop.** Rivers and Collatz loop with a new seed every ~9.5 s / ~11.5 s, and the polite live summary then announces the new seed. That is consistent with Rising water's loop, and it isn't per-frame, but it is a periodic announcement during autoplay.
- **Shared labels.** The "New terrain" button and the "Terrain"/"Water" group titles stay the same in every mode (the builder disclosed this). A per-mode label would read better in Collatz and Rivers.
- **Collatz label.** The Collatz canvas label always gives the full 3,518 count, even while the delta is still growing. The readout gives the live count.

## Artifacts

- Report: /Users/andrewchincea/personalPortfolio/docs/checks/F10/attempt-1.md
- Screenshots: /Users/andrewchincea/personalPortfolio/docs/checks/F10/attempt-1/{rising,dye,pond,rivers,collatz}-{375,768,1280}-{light,dark}.png, *-panel.png, rm-*-1280-light.png, shots-report.json
- Logs: /Users/andrewchincea/personalPortfolio/docs/checks/F10/attempt-1/{e2e-full,e2e-hero-repeat3,e2e-stress,leaks,offscreen-probe,offscreen-cause,perf-size,a11y-probe,lhci}.log
- Lighthouse: /Users/andrewchincea/personalPortfolio/docs/checks/F10/attempt-1/lhci/
- Tools: /Users/andrewchincea/personalPortfolio/docs/checks/tools/f10-{math.ts,leaks.mjs,offscreen.mjs,offscreen-cause.mjs,perf-size.mjs,shots.mjs,a11y-probe.mjs,lhci.cjs}
