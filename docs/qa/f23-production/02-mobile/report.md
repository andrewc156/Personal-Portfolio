# F23 production QA 02 — Mobile and touch

**Target:** https://andrewchincea.com/ · **Date:** 2026-11-25 · **Session:** `f23qa02`  
**Scope:** Read-only visitor actions on production in Chromium 156. F23/default 30 was the supplied release context, not a separately verified build identifier.

## Executive summary

**One confirmed issue:** the home animation selector clips the default label at 320 CSS px. No blocking mobile issue or page-wide horizontal overflow was observed in the sampled routes. Touch taps and swipes worked on the tested navigation, settings sheet, and Rising water explorer.

| Critical | High | Medium | Low | Total |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 1 | 1 |

## MOB-01 — Home animation selector clips “Rising water” at 320 px

**Severity:** Low · **Category:** Visual / responsive · **URL:** https://andrewchincea.com/

1. Open the home page in a 320 × 640 CSS-pixel Chromium touch viewport.
2. Leave **Rising water** selected and both settings panels closed.
3. Look at the **Animation** selector beside **Settings**. Resize to 375 CSS px to compare.

**Expected:** The closed selector shows the full name of the current animation.

**Actual:** At 320 px the 106 px-wide select visibly reads “Rising wate,” dropping the final `r`. The underlying selected option still contains `Rising water`; the layout itself does not overflow the viewport. At 375 px the select is 161 px wide and shows the full label. No console error was captured.

**Evidence:** [320 px repro](screenshots/320-home-top.png) · [375 px comparison](screenshots/375-home-top.png) · [DOM measurements](layout-measurements.jsonl)

MEDIA:screenshots/320-home-top.png

| ID | Finding | Severity | Category | Route |
| --- | --- | --- | --- | --- |
| MOB-01 | Closed animation selector clips default label | Low | Visual | `/` |

## Verified coverage

- **Layout:** 45 measurements across nine route states at **320 × 640**, **375 × 667**, **430 × 932**, **667 × 375 landscape**, and **900 × 600 wide touch**. Routes: `/`, `/garden/`, `/garden/?type=paper`, `/rising-water/`, `/cv/`, `/about/`, and the number-theory, water-quality, and spectral-fractals research pages. Checked heading/content wrap and viewport, root and body widths. No page-wide horizontal overflow or out-of-viewport sampled reading-content boxes; navigation and the lakes table deliberately scroll within their own regions. No page-script errors were captured in the clean matrix.
- **Navigation and page scrolling:** At 320 px a touch swipe moved the header rail from `scrollLeft=0` to `172`; tapping the newly visible **CV** opened `/cv/`, the brand link returned home, and **Research** landed at `/#research` with its section top ~16 px below the viewport top. Touch scrolling took the phone header offscreen; at 900 px the home header stayed at `top=0` after scrolling 1,200 px. The secondary-page headers in the matrix were static. [Nav at end](screenshots/320-nav-end.png) · [CV](screenshots/320-cv-top.png) · [Wide sticky header](screenshots/900-home-sticky.png)
- **Settings and touch:** Trusted Chromium `pointerdown`, `touchstart`, `touchend`, and `click` were observed on a real CDP touch gesture. At 320 px, the Art settings sheet opened and closed by tap; a swipe moved its contents 260 px while the page stayed put. At 667 × 375, the 210 px-high settings body also scrolled independently (241 px). A mouse click opened Art settings in the 900 px touch-emulated desktop layout. [Portrait sheet](screenshots/320-art-open.png) · [Landscape before](screenshots/667-art-top.png) / [after](screenshots/667-art-scrolled.png)
- **Garden and Rising water:** At 375 px a tap on **Papers** opened the filtered Garden and reported `Showing 1 of 9 items`. At 430 px a tap on **Pause** changed its label to **Play**. At 320 px, swipes reached the rightmost column of the 937 px-wide lakes table within its 286 px scrollport; tapping **Show** returned the viewport to the map area (page scroll 2,945 → 548 px). [Garden result](screenshots/375-garden-papers.png) · [Explorer controls](screenshots/430-visualizer-controls.png) · [Table left](screenshots/320-lakes-left.png) / [right](screenshots/320-lakes-right.png) · [Interaction observations](interaction-observations.json)

## Optional improvements (not counted as defects)

- Consider a more persistent cue for mobile navigation's horizontal scrolling. At 320 px only the start of **Garden** is visible initially; **Rising water** and **CV** are offscreen. The rail was swipeable and the links worked.
- Consider a larger hit area for frequently used actions: the mobile nav links are 30 px tall, Garden filter chips 36 px, and table **Show** buttons 32 px. No missed activation was reproduced with centered taps.
- Consider keeping the lake name or row context visible when horizontally scrolling to **Show**. The action works, but the identifying column is then offscreen at 320 px.

## Limits

Headless Chromium with CDP viewport, touch and orientation overrides; no physical handset, iOS Safari, mobile browser chrome, or OS-native picker behavior verified. The 900 px run accepted both touch emulation and mouse input, but media queries still reported `pointer: coarse` and no `any-pointer: fine`, so it is not a true hybrid-device test. Direct touch dispatch initially timed out in the harness; trusted input and scrolling were verified after bringing a fresh tab to the foreground and using CDP synthesized gestures. No security testing, writes to production, source edits, or commits.
