# F23 production QA — 07 Accessibility, keyboard, motion and no-JS

**Target:** `https://andrewchincea.com/` · **Observed:** November 25, 2026 · **Browser:** Headless Chromium 156 on macOS (`f23qa07`; targeted foreground checks in `f23qa07-recovery`). **Release:** F23 source reference `20d59f9` (see [delivery lane](../10-delivery/report.md)); the recovery browser saw the F23 Collatz Steps default of `30` and stylesheet `/_astro/BaseLayout.CPGn5Zzt.css`. The live marker corroborates the release behavior, not the exact deployed commit.

## Executive summary

| Critical | High | Medium | Low | Total |
|---:|---:|---:|---:|---:|
| 0 | 0 | 4 | 1 | 5 |

Fix keyboard focus that becomes hidden behind Settings or left behind by the explorer’s **Show** action first. The explorer’s per-cell inspection has no keyboard equivalent in the tested UI. Without JavaScript, the explorer promises a load that never completes, and some controls still invite activation. Two Medium findings corroborate other lanes and should be counted only once in the consolidated audit.

| ID | Severity | Category | Route | Finding |
|---|---|---|---|---|
| 07-01 | Medium | Accessibility | `/` | Focus moves behind the open Settings sheet (same as [05-01](../05-settings/report.md#05-01--mobile-keyboard-focus-moves-behind-the-open-drawer)). |
| 07-02 | Medium | Accessibility | `/rising-water/` | **Show** jumps to the map but leaves keyboard focus in the lakes table (same as [RW-02](../06-explorer/report.md#rw-02--show-scrolls-to-map-but-leaves-keyboard-focus-in-table)). |
| 07-03 | Medium | Accessibility | `/rising-water/` | Per-cell elevation and coordinate readout is pointer-only. |
| 07-04 | Medium | Functional / fallback | `/rising-water/` | With scripts disabled, the explorer stays in a loading state instead of explaining the fallback. |
| 07-05 | Low | Accessibility / fallback | `/` (theme control also rendered on sampled inner routes) | With scripts disabled, visible controls remain focusable and do nothing. |

## Confirmed findings

### 07-01 — Focus moves behind the open Settings sheet

**Medium · Accessibility · `/`**

1. At a narrow viewport, leave the hero on **Rising water**. Tab to **Art settings** and open it with Enter or Space.
2. Tab through the sheet to **Reset**. Keep it open and press Tab again.

**Expected:** Sequential focus remains visible. A non-modal drawer may let focus leave, but not onto controls entirely covered by it.

**Actual:** At 320×256 CSS px, focus moved to the background **Animation** select at y=106–150. None of nine points over it hit the select: all hit the sheet header or its title. The next Tab went to **Animation settings**, also under the sheet. At 360×225 the trace caught covered background links further along the tab order. Escape closed the panel and returned visible focus to the original gear. The settings lane independently reproduced the same escape behind the sheet at 390×844.

**Evidence:** [`targeted-repros.json`](targeted-repros.json), `panelAfterReset` and `afterEscape`; [`settings-boundaries.json`](settings-boundaries.json), `320`/`360` → `forward`; [covered focus screenshot](screenshots/settings-320-hidden-background-focus.png). No errors in the targeted records.

MEDIA:screenshots/settings-320-hidden-background-focus.png

### 07-02 — Show jumps to the map but leaves keyboard focus in the table

**Medium · Accessibility · `/rising-water/`**

1. At 390×844, Tab to **Show lake 5 on the map** in **Longest-lived lakes**.
2. Press Enter, wait for scrolling to settle, then press Tab.

**Expected:** If activation leaves the table visually, move focus to a visible destination where a keyboard user can inspect the selection, or keep the table in view and provide a separate jump.

**Actual:** Lane 06 measured the visual jump to the map while the active button remained about 2,759 px below the viewport top. The next Tab jumped back to **Show lake 6**. Lane 07 independently recorded focus staying on the **Show lowest lake on the map** button on desktop; that snapshot establishes retained focus, not the settled offscreen distance. The lake selection itself works.

**Evidence:** [Lane 06 measurements](../06-explorer/data-and-focus.json), [after Enter](../06-explorer/screenshots/mobile-show-keyboard-before-tab.png) and [after Tab](../06-explorer/screenshots/mobile-show-keyboard-after-tab.png); [`explorer-actions.json`](explorer-actions.json), `lakeButton` and `lakeButtonFocus`. Do not count separately from RW-02.

### 07-03 — No keyboard equivalent for inspecting an arbitrary map cell

**Medium · Accessibility · `/rising-water/`**

1. In foreground Chromium, open the explorer, activate **Skip to content**, and Tab to **Rising water map**. Start paused (the recovery test used reduced motion).
2. Try the documented map shortcuts (e.g. Right, Down, Escape) and Tab onward. Compare with pointing at an arbitrary cell on the same map.

**Expected:** A keyboard user can choose a cell and obtain the equivalent elevation, coordinates, and wet/dry readout, or reach a textual equivalent for that cell.

**Actual:** Right moved the water slider from 450 to 455; Down selected a plotted lake and Escape cleared the selection. The per-cell readout stayed on its pointer/tap prompt. There were no tabbable cell controls inside the map group; Tab went to **Play**. In the same recovery session, moving a pointer over a cell produced **2,314.0 m (7,592 ft) at 40.1204° N, 111.1396° W · under water, the lowest lake**. The water controls, named-place list, and selected-lake summaries are useful but do not expose per-cell inspection. This is distinct from the touch readout dropping on release in lane 06.

**Evidence:** [`explorer-keyboard.json`](explorer-keyboard.json) and [`explorer-actions.json`](explorer-actions.json) show the named group, keyboard instructions and working playback/selection controls; [map keyboard focus](screenshots/explorer-map-keyboard-focus.png) shows the general map focus state. The recovery keyboard-vs-pointer comparison is transcribed above; no separate screenshot or trace file was added for it. The recovery page hook recorded no uncaught errors or rejections during this check.

### 07-04 — Explorer shows endless loading with JavaScript disabled

**Medium · Functional / fallback · `/rising-water/`**

1. Disable JavaScript for the page, reload, and scroll to the map and data controls.
2. Read the grid status and try to reach the explorer’s interactive controls.

**Expected:** State that the interactive map and computed chart require JavaScript; show the static relief, table and sources as the available alternative, without a loading indicator for work that cannot start.

**Actual:** The page displays **Loading the elevation grid…**, placeholder metrics and disabled explorer controls, with no script-off explanation. The map group still takes focus and advertises shortcuts. The article, static relief, 21 table rows and data-source links are present, so this is misleading fallback UI, not a blank page or a requirement to run the interactive computation without scripts.

**Evidence:** [`no-js.json`](no-js.json), `/rising-water/`; [`targeted-repros.json`](targeted-repros.json), `noJsExplorer`; [loading screenshot](screenshots/no-js-explorer-loading.png).

MEDIA:screenshots/no-js-explorer-loading.png

### 07-05 — Inert buttons remain in the no-JS tab order

**Low · Accessibility / fallback · `/`**

1. Disable JavaScript and reload Home. Tab to **Dark theme** and **Art settings**, and activate them with Enter. Use the skip link and Tab to **Play**; press Enter.

**Expected:** A focusable button either works or makes its unavailability clear. Use a meaningful static art state and omit or disable unavailable theme and art controls rather than adding dead focus stops.

**Actual:** The theme and art gear remained enabled and focusable, but activation did not change the sampled theme state or open the drawer. **Play** was still enabled and unchanged after activation; **New terrain** was also observed enabled and tabbable, but activation was not independently measured. The theme button markup was present on all five no-JS routes; Home was the activation repro. Main navigation, Home copy and the explorer link remained available.

**Evidence:** [`targeted-repros.json`](targeted-repros.json), `noJsHeader`, `noJsTheme`, `noJsArt`, `noJsHomeBeforePlay` and `noJsHomeAfterPlay`; [`no-js.json`](no-js.json); [Play focus screenshot](screenshots/no-js-home-play.png). No captured errors in those targeted records.

MEDIA:screenshots/no-js-home-play.png

## Verified coverage and limits

| Area | Result |
|---|---|
| Routes and skip navigation | Sampled `/`, `/rising-water/`, `/garden/`, `/research/water-quality/`, and `/cv/`. Skip activation focused `main`; subsequent Tab entered page content. The saved reduced-motion matrix captured an offscreen first Tab at y=−78.375, but the [paint probe](skip-paint-probe.json) logged a hidden document and a stalled timeline. A foreground recovery retest on CV at 320 px and Home at 1440 px still sampled y=−78.375 immediately after input, but reached y=8 in the subsequent ~300 ms sample; Enter focused `main` in both. At 320 px with no motion preference, CV was already at y=8 on the first read. A persistent invisible skip link is **not confirmed**. See [matrix](skip-focus-matrix.json), [Home trace](home-keyboard.json), and [CV](focus-edge-cv.json)/[research](focus-edge-research.json) focus traces. |
| Settings semantics | Both entry buttons focused the **Art settings** heading and exposed expanded state; Escape returned focus to the respective opener. The panel is markup for a non-modal aside, so focus escape by itself is not a dialog-trap failure; obscured focus is the failure. [Settings traces](settings-focus.json). |
| Explorer keyboard and accessibility tree | Map reachable by keyboard with a name and shortcut description; level, playback, lake selection and clear worked on sampled keys. Named controls, tables and changing polite status text were inspected in Chromium’s accessibility tree/DOM. This verifies exposed state, not what a screen reader speaks. [Keyboard trace](explorer-keyboard.json) · [Action trace](explorer-actions.json). |
| Reduced motion | On a fresh `reduce` load, Home stayed paused at 450 m in both samples, the explorer showed **Play** with `aria-pressed=false` and a stable level-slider value of 450, and computed scrolling was `auto` on Home, explorer and Garden rather than `smooth`. Those explorer captures did not establish readiness; the recovery test reached a ready, paused explorer. In-page preference switching on Home is separately covered by [lane 05](../05-settings/report.md#05-02--enabling-system-reduced-motion-does-not-stop-existing-autoplay), not a new finding here. [Motion log](motion.json). |
| No-JS baseline | Static content and Skip to content remained available on all five sampled routes. Garden’s Papers link changed the URL to `?type=paper` and kept all 9 items, with an explicit no-JS explanation. Research and CV copy/links remained available. [No-JS log](no-js.json) · [Targeted repros](targeted-repros.json). |
| Reflow | `reflow-*.json` records 320×256, 360×225, and 720×450 CSS viewports. Root/body widths matched viewport widths on all five routes in those samples; this does not rule out local clipping or nested scrolling. These are narrow CSS viewport checks, not native browser zoom or OS text scaling. |
| Automated semantics and contrast | Locally installed axe-core 4.14.1 reported no violations in 10 initial snapshots (five routes × light and dark). Contrast was **incomplete**, not a failure or pass, for eight Home targets and two Water-quality targets in each theme (SVG text and/or decorative glyphs); other sampled pages had no incomplete results. See the `axe-*.json` files, including [dark Home](axe-dark-home.json) and [light Water-quality](axe-light-research-water-quality.json). No exhaustive manual contrast audit of canvas, SVG, or state changes. |

No physical devices, Safari/Firefox, actual screen-reader sessions, OS-level zoom/text scaling, or conformance audit. The interrupted original lane left usable JSON and screenshots; recovery only repeated the ambiguous skip-link paint check and the keyboard-vs-pointer comparison, plus the release marker. Read-only visitor interactions; no security probing, browser install, source edits, or commits.

## Optional improvements (not counted)

- Remove the transition from the focused skip link so it is visible on the first rendered frame under either motion preference.
- Manually review unresolved SVG/canvas contrast in both themes and test the explorer’s polite status with a real screen reader. The saved accessibility-tree and axe checks cannot settle either question.
