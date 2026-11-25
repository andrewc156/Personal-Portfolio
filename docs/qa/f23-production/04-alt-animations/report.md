# F23 production QA — 04 Alternate hero animations and Collatz

**Target:** `https://andrewchincea.com/` · **Tested:** November 25, 2026 · **Session:** `f23qa04`

**Result:** Collatz defaults to **30** steps in production. All four alternate modes loaded and played. The Collatz exact/sampled boundary passed. One low-severity UX issue: copying the browser URL does not reproduce the current view. No first-party JavaScript errors were captured.

| Severity | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Issues | 0 | 0 | 0 | 1 | 1 |

## Issues

### 04-01 — The address bar can describe a different animation or seed

**Severity:** Low · **Category:** UX / reproducibility · **URL:** `https://andrewchincea.com/?mode=collatz&seed=123456`

1. Open the URL in a foreground tab. Open **Settings** and note Seed `123456` and Steps `30`.
2. Leave it playing through one complete cycle (about 11 seconds at 1× in this run).
3. Compare the Seed field with `seed=` in the address bar. Open that address again in a fresh tab to compare the initial drawing. For the mode variant, select another animation before copying the address.

**Expected:** A way to copy a link to the current mode and seed, or a clear indication that the URL is only the starting configuration.

**Actual:** Collatz began a new drawing with Seed `650283` after ~10 seconds of observation; the URL still specified `123456`. Reopening the URL started at `123456`. Switching to Rising water also left `mode=collatz` in the address. This does not break direct links or playback; it only affects reproducing the current view. A manually constructed `?mode=collatz&seed=<current-seed>` works for the initial drawing; it cannot encode the custom Steps setting through a documented UI.

**Evidence:** [Before](screenshots/seed-before-loop.png), [after](screenshots/seed-after-loop.png), [URL and state capture](seed-loop-and-keyboard.json) (`initial`, `firstWrap`), [mode mismatch and repeat wrap](loop-off-retest.json) (`risingBefore`, `wrap`). No related runtime error.

## Coverage and expected vs. actual

| Check | Expected | Actual |
|---|---|---|
| Mode switching | Correct drawing, caption, status and controls; no stale Rising barcode | Passed: Rising → Dye → Pond → Rivers → Collatz → Rising. The alternate modes hid the barcode and showed mode-specific instructions and readouts. Changing modes did not rewrite the URL (04-01). |
| Direct links | `?mode=dye`, `pond`, `rivers`, `collatz` each opens the selected mode; `&seed=123456` sets the starting seed | Passed for all four. With browser cache disabled, `/` opened Rising and the Collatz Steps default was `30` in both `/` and the seeded Collatz link. Same-origin live HTML reads also returned `30` in all four URL variants tested. |
| Paint: Dye spill and Fractal pond | Mouse click or touch tap on the active canvas adds one spill or pebble; paused input does not force playback | Passed with desktop mouse in playing and paused states; paused clicks changed the canvas/count without changing Play. In Chromium touch emulation at 390×844, both modes went from 0 to 3 after three trusted taps inside the active area, one increment per tap. |
| Play/Pause | Canvas stays stable while paused and changes after resuming | Passed in all four alternate modes using canvas pixel checks and the Play/Pause label in a visible tab. Rivers and Collatz advanced without painting input. |
| Loop/restart | Clear distinction between Rising's Loop checkbox and alternate playback | Checkbox present for Rising only. Rivers and Collatz automatically drew a new seed after reaching their endpoint. Collatz reached 120 steps and regenerated ~11 seconds after starting even with Rising's Loop unchecked; the checkbox was hidden for Collatz. Dye and Pond continued to simulate; there is no alternate-mode Loop control to test. |
| Error capture | No first-party exceptions, rejected promises, or `console.error` output | None captured in the exercised paths. A pre-navigation listener repeatedly recorded a failed load of the external `static.cloudflareinsights.com/beacon.min.js/...` analytics resource, with no observed hero impact. Cause and behavior outside this session were not verified; not counted as a product issue. |

### Collatz step regression

| Steps | Exact total or sampled label | Drawing |
|---:|---|---|
| 1 | **2** numbers, max **2** | All 2; singular “1 step.” |
| 30 (default) | **3,518** numbers, max **1,073,741,824** | 1,297 drawn; copy distinguishes the exact total from the partial drawing. |
| 50 | **379,600** numbers, max **1,125,899,906,842,624** | 3,217 drawn; full-playback readout showed both counts. |
| 51 | **Sampled branches** | 3,313 sampled numbers, explicitly “not a total” in the accessible description. |
| 120 | **Sampled branches** | 9,937 sampled numbers, explicitly “not a total”; visually reached **120 steps** and the accessible description reached 120 of 120 levels. |

Exact totals/maxima at 1, 30 and 50 were independently checked by traversing positive Collatz predecessors of 1, de-duplicating by first-seen distance and including 1 itself. Native Home and End keys moved the focused Steps slider to 1 and 120, with matching visible output and `aria-valuetext`. The note correctly says totals are exact through 50 and higher settings show sampled branches. At the 120-step endpoint the visual readout briefly trailed the accessible summary by one level, then caught up before the next cycle.

**Evidence:** [Modes](mode-switching.json) · [direct links](direct-links.json) · [live HTML](live-html-defaults.json) · [mouse and playback pixel checks](canvas-interactions.json) · [trusted touch](mobile-touch.json) · [Dye mobile](screenshots/dye-mobile-touch.png) · [Pond mobile](screenshots/pond-mobile-touch.png) · [Rivers playback](playback-loop.json) · [step values](collatz-steps.json) · [keyboard and no-cache default](fresh-default-and-keyboard.json) · [completion telemetry](collatz-completion.json) · [50-step](screenshots/collatz-50-full.png), [51-step](screenshots/collatz-51-full.png), [120-step end state](screenshots/collatz-120-complete-visible.png).

## Optional improvements and limitations

- Add **Copy current animation link** with mode, seed and Steps. Consider **Hold at end** for Rivers and Collatz so users can inspect the finished drawing before a new seed replaces it. Label the existing Loop checkbox as Rising-only.
- Replace the generic **New terrain** button text in alternate modes, e.g. **New current**, **New pond**, **New network** and **New delta**.
- Live production only; no application data writes, repository source changes, or commit. One Chromium browser session with a 1440×1050 desktop viewport and 390×844 touch emulation. No physical devices, other browsers, real screen reader, long-duration soak, analytics delivery verification, or full Rising-water regression. A backgrounded browser suppressed frames and caused a tooling timeout on the first touch attempt; playback and touch were repeated in the foreground. The browser event/error log is scoped to the captured flows, not a full DevTools/network export.
