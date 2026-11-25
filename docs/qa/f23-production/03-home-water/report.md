# Production QA 03 — Home Rising water

**Target:** `https://andrewchincea.com/` · **Tested:** November 25, 2026 EST · **Session:** `f23qa03`  
**Scope:** Home → Rising water only, using the public UI. Headless Chromium 156 on macOS: 1200×1000 desktop and 390×950 Chromium touch emulation; light and dark themes. No Explorer navigation, application edits, or writes to production.

## Summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 1 |
| **Total** | **2** |

The map, slider, chart linkage, and same-seed replay worked. The live accessibility summary lagged the animation and did not announce keyboard picks; barcode hit targets also extended into visually blank chart space.

| ID | Severity | Category | Finding |
|---|---|---|---|
| 03-01 | Medium | Accessibility | Live summary does not follow playback or announce the selected bar |
| 03-02 | Low | UX | Blank chart space can select a distant bar |

## 03-01 — Live summary does not follow playback or announce the selected bar

**Repro:** On the home animation, open **Settings**, disable **Loop with a new terrain**, raise **Speed** to its maximum, close Settings, and play from the bottom (or click **Play** again at 100%). Compare the visible readout with the `aria-live="polite"` text while water rises. After it finishes, Tab to the animation group and press **Down** twice to select a finite bar. Repeat in **Islands barcode** to check the island selection.

**Expected:** The live text provides occasional accurate playback milestones without announcing every frame. When a keyboard user selects a bar, the live region or another accessible selection mechanism conveys which feature is selected and its key values.

**Actual:** With seed `305613`, the visible readout progressed through **268 m / 5 lakes**, **632 m / 1 lake**, and **953 m / 1 lake**. At each sample, the live region still read **Playing … 0 m … 1 lake … 1 of 27 bars**. It caught up after stopping at 100%. Selecting **Lake 24** then showed its birth, spill, and persistence in the visual readout and drew markers on the map, but after four seconds the live region still gave only the unselected summary and mentioned a different lake (Lake 2, the longest). The selected readout is a plain paragraph, not a live region or the focused element. In Islands barcode, selection likewise showed an island's appearance/submergence only in the visual readout. The diagram canvas had an accurate accessible name, but the live region still called it a barcode; it also retained chart copy immediately after hiding the chart.

**Evidence:** [Replay in progress](screenshots/26-dark-replay-same-seed.png), [keyboard-selected finite lake](screenshots/34-dark-keyboard-selected-finite-lake.png), and [DOM observations](observations.jsonl) (`non-loop playback frame`, `keyboard finite lake selected after 4s`, `island bar from keyboard at top`, and `diagram point hover and accessible name`). No matching application exception was captured. Screen-reader audio was not tested; the finding is based on the rendered DOM and live-region content, not a claim about a particular reader's output.

## 03-02 — Blank chart space can select a distant bar

**Repro (desktop):** Set **Seed** to `123456`, **Max bars** to `32`, leave **Min persistence** at `10 m`, and select **Barcode**. Pause and use the Water level slider to reach 100%. In the 1200×1000 viewport with the chart in its initial position, hover at approximately `(1030,524)`, far to the right of the Lake 2 segment on the same row. Move outside the chart to clear it.  
**Repro (touch emulation):** In **Islands barcode**, seed `305613`, Water level 100%, at 390×950, tap the long bottom-right bar near `(327,714)`, then tap the blank left side near `(50,680)`. The recorded chart had 12 visible bars; if the layout differs, use the same relative positions shown in the evidence.

**Expected:** A generous hit target makes small bars selectable, but visibly empty chart space well beyond a segment should not select an unrelated feature. If whole-row targeting is intentional, the UI should make the row target discoverable.

**Actual:** The desktop hover selected **Lake 2** (171–414 m, reported persistence 242 m), although the pointer was around the 825 m position on that row. Leaving the chart cleared it. On touch, the blank-space tap changed the selection to an island at **573–596 m**, visibly far from the tap, rather than leaving the current island alone or clearing the selection.

**Evidence:** [Desktop blank-row hover](screenshots/40-light-chart-blank-row-hover.png), [touch on the intended bar](screenshots/20-mobile-island-bar-tap.png), [touch result retained on the map](screenshots/21-mobile-map-tap-top.png), and [DOM observations](observations.jsonl) (`desktop hover far from a visible bar in same chart row`, `mobile touch empty chart space`). No matching application exception was captured.

## Coverage and results

| Area | What was verified |
|---|---|
| Settings slider and keyboard edges | In linear pacing, the slider reached 0%/0 m, one right-arrow step reached 0.5%/5 m, and End reached 100%/1000 m. The focused animation's Home/End and right-arrow shortcuts independently moved the map and chart. The numeric live status caught up after settling. [Slider minimum](screenshots/27-dark-slider-zero.png) · [maximum](screenshots/29-dark-slider-end.png) |
| Replay and seed | With looping disabled, playback stopped at 100%; **Play** then restarted on seed `305613` and advanced again. **New terrain** changed `123456` to `305613`; re-entering `123456` restored the earlier terrain appearance and longest finite lake persistence of 242 m. [Finish](screenshots/25-dark-natural-finish.png) · [replay](screenshots/26-dark-replay-same-seed.png) · [restored seed](screenshots/38-light-seed-123456-restored.png) |
| Lakes, bars, and diagram | At the bottom, Lake 1 was the lone born bar; at the top, the infinite bar and finite historical bars were visible. Mouse hover on a finite bar and on a diagram point showed the lake details and linked map markers; hovering a wet map location linked it to Lake 1. Keyboard Down selected a bar, and Escape returned to the normal level readout. [Finite bar](screenshots/08-light-chart-finite-hover.png) · [map hover](screenshots/22-dark-desktop-lake-map-hover.png) · [diagram hover](screenshots/36-dark-persistence-point-hover.png) |
| Islands, empty state, and touch | At 0% with seed `123456`, the islands chart had 0 of 17 born bars and selection did not fabricate a bar. At 100% there were 0 live islands, but historical spans remained selectable, with peak and cut-off map annotations. Tapping an island bar highlighted the corresponding map markers; tapping a wet map cell in Lake Barcode selected Lake 1 and its bar. **Show barcode** hid and restored the chart. [Empty islands](screenshots/12-light-islands-bottom.png) · [dark linked island](screenshots/15-dark-islands-top.png) · [mobile wet cell](screenshots/23-mobile-lake-map-tap.png) |
| Themes and errors | Map, chart, controls, and selected annotations rendered in light and dark; no blocking visual break was observed in the tested viewports. The page error observer captured one failed Cloudflare Insights beacon resource and no application `console.error`, uncaught exception, or unhandled rejection. Failure cause was not independently established. [Browser error log](browser-errors.txt) |

## Improvements (not counted as defects)

- Label the stopped-at-top action **Replay** to distinguish it from resuming a pause; it currently says **Play** and resets the water on activation.
- Give the blank islands chart a short message such as **No islands have formed at this level**. The current axes-only state is valid but easy to mistake for a chart that failed to load.

## Limitations

- One Chromium build, one desktop viewport, and one emulated touch viewport. No physical phone, Safari/Firefox, or actual screen reader was used.
- Some CDP mouse-move calls timed out after delivering the event. Only pointer outcomes confirmed by DOM/readout and screenshot were used; timing samples are illustrative, not a performance benchmark. The JSONL includes exploratory attempts, including select-menu attempts that left `view: barcode`; use the recorded `view` field rather than the step label for those rows.
- Terrain/topology mathematics, prolonged looping, all settings combinations, and the standalone Explorer were not audited. No application changes or commit were made.
