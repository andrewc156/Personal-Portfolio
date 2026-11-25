# F23 production QA — 05 Settings drawer and state management

**Target:** https://andrewchincea.com/ · **Date:** November 25, 2026 · **Browser:** Chromium 156, isolated session `f23qa05` · **Viewports:** 1440×900 desktop, 390×844 and 320×640 touch emulation.

**Result:** 3 Medium issues; no Critical, High, or Low issues. Both entry points, explicit dismissal, focus return and mode-specific settings worked. The main gaps were hidden keyboard focus on mobile and unwanted motion after a mode or system-preference change.

| ID | Severity | Category | Finding |
|---|---|---|---|
| 05-01 | Medium | Accessibility | Mobile keyboard focus moves behind the open drawer |
| 05-02 | Medium | Accessibility | Enabling system reduced motion does not stop existing autoplay |
| 05-03 | Medium | Functional | A mode change can resume a manually paused animation |

## 05-01 — Mobile keyboard focus moves behind the open drawer

**URL:** `/` · **Severity:** Medium · **Category:** Accessibility

**Reproduce:** At 390×844, with the Rising water mode selected, open Settings. Scroll its controls to **Reset** and focus or activate it. Press `Tab`, then `Tab` again, without dismissing the sheet.

**Expected:** The next focus stops are visible. A non-modal drawer can let focus leave, but must not send it to completely covered controls.

**Actual:** Focus first lands on the Animation select, then on the hero **Settings** button. Both are fully behind the bottom sheet. Hit tests at their centers returned drawer fieldsets; the Animation select occupies y=375–419 while the sheet spans y=295–844. `Esc` or explicit close remains available.

**Console:** No captured warnings or errors. **Evidence:** `M Tab after Reset` and `M next Tab after Reset` in [evidence.jsonl](evidence.jsonl).

MEDIA:screenshots/mobile-focus-under-sheet.png

## 05-02 — Enabling system reduced motion does not stop existing autoplay

**URL:** `/` · **Severity:** Medium · **Category:** Accessibility

**Reproduce:** Load Home with system reduced motion off and leave the animation playing. Without reloading, enable reduced motion (tested by changing Chromium’s `prefers-reduced-motion` emulation to `reduce`). Do not press Play.

**Expected:** The already-running autoplay stops when the system preference changes, and the controls offer Play for an explicit opt-in.

**Actual:** The media query immediately reports `reduce`; the drawer’s computed transition duration also drops to `0.00001s`. The canvas nevertheless keeps changing, and both controls still say **Pause**. Canvas hashes across 1.1 seconds under live `reduce` differed (`762882824` → `-908676281`). A reload with `reduce` already enabled correctly produces a static canvas and **Play**. Manual Play then starts the animation as expected.

**Console:** No captured warnings or errors. **Evidence:** `RM live changed to reduce during autoplay` and `RM fresh load with reduce` in [evidence.jsonl](evidence.jsonl). The paired screenshots show the control labels; the hash samples establish movement.

MEDIA:screenshots/desktop-live-reduced-motion.png
MEDIA:screenshots/desktop-reduced-load.png

## 05-03 — A mode change can resume a manually paused animation

**URL:** `/` · **Severity:** Medium · **Category:** Functional

**Reproduce:** With system reduced motion off, pause **Rising water** and optionally set **Water level**. Select **Dye spill**, then return to **Rising water** without using Play. On mobile, close the drawer to reach the selector.

**Expected:** Keep the explicit paused state through mode changes, or at least restore it on return to the paused mode. A manually held water level should not start moving again without Play.

**Actual:** Using the native select at 390×844, the hero showed **Play** before the switch and **Pause** in Dye spill and on return to Rising water. Reopening the drawer showed the level had moved from 27% to 29.5%. Desktop selection via input/change events also restarted Rising water on return: the level was 68% before the switch and 7.5% after return. The restart point therefore varies with the path; the repeatable problem is that pause is lost.

**Console:** No captured warnings or errors. **Evidence:** `M paused rising before switching`, `M native select Dye while paused`, `M reopen after native switch` and the desktop `D paused rising at 68` / `D return from dye to rising` records in [evidence.jsonl](evidence.jsonl).

MEDIA:screenshots/mobile-paused-before-mode-switch.png
MEDIA:screenshots/mobile-after-native-mode-switch.png

## Coverage and observed state rules

| Area | Result |
|---|---|
| Open / dismiss / focus | Desktop gear and hero pointer activation, gear Space, hero Enter, and mobile taps opened the same named drawer and focused its heading. `Esc` and the explicit close button returned focus to the opener. Mobile gear could also close a hero-opened sheet. Both triggers synchronized `aria-expanded`. Clicking the background did not dismiss the desktop non-modal drawer. After a persisted reload there was no prior opener; Close focused the gear. |
| Responsive layout | Right-hand panel on desktop; full-width bottom sheet on mobile. At 320×640, the panel stayed within the viewport, its body scrolled, and both Reset and Close were reachable. A mobile hardware-keyboard equivalent exposed 05-01. |
| Scope | The drawer is Home-only; absent from Garden and the Rising water article. The Home `#work` anchor preserved both the open drawer and edited controls. The theme toggle is separate. No site-level reduced-motion switch appeared in the tested UI; the system preference and manual Play/Pause were tested. |
| Five modes and controls | Checked Rising water, Dye spill, Fractal pond, Random rivers, and Collatz delta. Seed, New terrain, speed, Play/Pause and palette were present in every mode; Collatz alone exposed Steps. Rising water exposed terrain scale/roughness, water level/pacing/loop, barcode and lake colors/shoreline. The plot was hidden in other modes. Exercised seed entry and out-of-range clamping, New terrain, all editable control types, all three plot views and plot visibility. Plot changes and hiding were verified from canvas labels/dimensions as well as form values; not a numerical or rendering audit of each control. |
| Mode / drawer state | Shared seed, speed and palette carried across modes. Rising-only edits and Collatz Steps survived mode round-trips; manually paused playback did not reliably survive (05-03). Closing/reopening the drawer alone did not reset the animation selection. |
| Reset | Returned a customized Collatz session to Rising water and restored the option defaults tested (including Collatz Steps 30), while preserving the seed. Reset from a paused Rising water state also preserved pause and the manually set 73% level. **New terrain** separately changed the seed. |
| Navigation / reload | `settings-open` persisted for open and closed states. A round trip through Garden and a normal reload restored default art settings (Rising water, Delta, speed 1, new seed) even when the drawer reopened. Only drawer visibility—not art edits—was durable in these flows. |
| Reduced motion | A fresh `reduce` load stayed static; manual Play opted in. Switching through all five modes after a reduced-motion load kept the paused button state until explicit Play. Live opt-in during autoplay failed (05-02). |

## UX improvements (not counted as defects)

- Clarify the sticky state: the drawer remembers whether it was open, but art edits are local to the current page session. Consider remembering the settings or offering a shareable preset. On mobile, consider not reopening a bottom sheet over fresh Home content on return.
- Label Reset’s scope (for example, **Reset options**) or add a note that it preserves the seed and can preserve the current paused water level. Keep **New terrain** as the separate seed-changing action.
- Give the mobile sheet a clear way to switch modes without closing it first, and use mode-neutral wording for shared controls such as **New terrain** in Dye spill or Fractal pond.

**Evidence and limits:** [Machine-readable evidence](evidence.jsonl) and `screenshots/` accompany this report. The console hook captured `console.warn`, `console.error`, uncaught errors and unhandled rejections on the tested pages; none were recorded in the reported scenarios. Some form-control and mode coverage used DOM input/change dispatch; the mobile focus and pause findings reproduced with actual browser touch/keyboard events. Chromium emulation only; no physical device, Safari/Firefox, screen-reader, or performance testing. No source edits, commits, or server-side writes.
