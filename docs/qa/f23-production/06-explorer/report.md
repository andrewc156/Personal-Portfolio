# F23 production QA — 06 Rising Water explorer

**Target:** https://andrewchincea.com/rising-water/  
**Date:** November 25, 2026 (EST) · **Session:** `f23qa06`  
**Browser:** Headless Chromium 156 on macOS; 1440×1000 desktop, 390×844 emulated touch/keyboard, and 320×720 responsive check. Read-only visitor interactions.

## Summary

**2 confirmed issues: 0 Critical, 0 High, 2 Medium, 0 Low.** Desktop exploration, overlays, chart selection and data computation worked. Mobile taps do not leave a readable cell result; keyboard activation from the lakes table scrolls to the map without moving focus there.

| ID | Finding | Severity | Category | Viewport |
|---|---|---|---|---|
| RW-01 | Cell readout disappears on tap release | Medium | Functional / Accessibility | 390×844 touch |
| RW-02 | Show scrolls to map but leaves keyboard focus in table | Medium | Accessibility / UX | 390×844 keyboard |

## RW-01 — Cell readout disappears on tap release

**URL:** `/rising-water/` · **Severity:** Medium · **Category:** Functional / Accessibility

1. Scroll to the map in a touch viewport with the instruction under it visible.
2. Tap and release a cell around the middle of the map.
3. Look at the readout below the map.

**Expected:** The tapped elevation and coordinates remain visible after release, long enough to read or until another tap/dismissal. The instructions explicitly say to point **or tap**.  
**Actual:** Touch at `(173, 365)` showed `2,681.0 m (8,796 ft) at 38.0204° N, 111.6396° W · dry` while pressed. The touch `pointerleave` restored the instructions during release, before the click completed. At 900 ms the instructions still showed. A second cell also lost its result on release. Desktop mouse hover worked.

Evidence: [while pressed](screenshots/mobile-map-touch-down.png) · [after release](screenshots/mobile-tapped-map.png) · [event trace](touch-trace.json).

## RW-02 — Show scrolls to map but leaves keyboard focus in table

**URL:** `/rising-water/` · **Severity:** Medium · **Category:** Accessibility / UX

1. At a narrow viewport, move keyboard focus to **Show lake 5 on the map** in Longest-lived lakes.
2. Press Enter and wait for scrolling to stop.
3. Press Tab.

**Expected:** If Show scrolls to the map, move focus with the visual jump (e.g. to its focusable group, where its shortcuts work) or offer a clear keyboard path to the selected lake.  
**Actual:** Enter selected Lake 5 and scrolled the map to the top, but focus stayed on the button roughly 2,759 px below the viewport top. The selected-lake detail card was also below the visible mobile map. The next Tab jumped back to the table and focused the Lake 6 Show button.

Evidence: [after Enter](screenshots/mobile-show-keyboard-before-tab.png) · [after Tab](screenshots/mobile-show-keyboard-after-tab.png) · [focus and scroll measurements](data-and-focus.json).

## Verified coverage

| Area | Expected / observed |
|---|---|
| Map / layout | Shaded relief, water and SVG shared bounds within about 1 px. Desktop hover gave elevation, coordinates and wet/dry; mask membership was sampled both inside (region 14) and outside. No page-level horizontal overflow at 390 or 320 px. [Desktop overlays](screenshots/desktop-overlays-map.png) · [320 px controls](screenshots/narrow-controls.png). |
| Keyboard and level | Foreground Home/End synchronized slider and readouts at −2.9 m / 0.0% flooded and 3,697.8 m / 100.0% flooded. Left/Right moved 5 ticks and Shift+Right moved 50; Up/Down selected bars, Escape cleared, Space toggled playback, and Tab left the map for Play. Slider Home/End worked. Emulated reduced-motion reload started paused. [Keyboard log](desktop-interactions.json). |
| Pacing, speed, scale, thresholds | Switching Percentile → Linear preserved 1,673.3 m while moving the slider from tick 500 to 453; setting the linear slider to 500 gave 1,847.5 m. In three-second samples from the same start, 4× progressed farther than 0.25× (297 vs 19 ticks). m/ft reordered primary and alternate values and converted persistence. Top 5 and 400 m yielded 2 results; Top 600 and 1 m yielded 600. [Playback/units log](playback-interactions.json) · [two-bar view](screenshots/desktop-barcode-two-bars.png). |
| Barcode, diagram, table | Clicked finite and infinite bars, a finite diagram dot and the infinity marker. The finite selection exposed pit, spill/pass, parent and persistence; the lowest lake never merged. The table retained 21 rows, and Show selected Lake 2 even when filtered out of the plot at 400 m. The narrow table scrolled within its own region. [Barcode log](chart-interactions.json) · [diagram](screenshots/desktop-diagram-two-bars.png) · [filtered selection](table-filter-repro.json) · [table left](screenshots/mobile-table-left.png) / [right](screenshots/mobile-table-right.png). |
| Basin mask / places | Mask drew hatch and boundary, added **Pit in basin** with yes/no and region values, and did not drop rows. It reported 97,311 of 134,964 cells (72.1%). Place labels adapted: 32/39 desktop, 26/39 at 390 px, 22/39 at 320 px. The disclosure expanded to all 39 coordinates. About the data and place-source anchors landed in their sections. [Overlay log](data-and-focus.json) · [anchor positions](desktop-navigation.json). |
| Data / no-data / errors | Visit and reopen both reported 600/600 live bars identical to `barcode.json`. Hillshade, metadata, reference barcode and elevation grid were HTTP 200; so were both mask assets when enabled. No explorer exception or rejection observed. The third-party Cloudflare Insights beacon emitted a resource error on repeated loads with no observed explorer impact; cause unverified. Slider limits and normal routes did not expose an empty plot or an explorer data error; minimum observed was two entries. [Reload log](reload-and-narrow.json). |

## Optional improvements

- Add a horizontal-scroll cue or pin the Lake column on narrow tables so Show and the lake name can be seen together.
- Shorten the mobile path between map, Play/Pause, and the selected-lake detail card.

## Untested / limits

Physical phones, Safari/Firefox, screen readers, multitouch, exhaustive value/row checks and external source download links. No forced missing/corrupt data, offline simulation, or request interception; degraded startup, no-data and mask-failure rendering remain unverified. No source edits or commits.
