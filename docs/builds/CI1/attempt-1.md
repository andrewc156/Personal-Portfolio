# Build report — CI1 Fix failing GitHub CI test (mobile nav keyboard reachability) — attempt 1

Summary: This was cause (c), a real bug in the component. It was not a timing problem. When Tab focuses an element inside a horizontal scroller, Chromium only scrolls it into view if it is entirely hidden. A link that is partly visible stays clipped, even when only 1 px of it shows. On the ubuntu runner, DejaVu Sans pushed "Rising water" 1.47 px past the right edge of the nav list at 412px, so nothing scrolled and the test failed. The same bug happens in IBM Plex for real users, for example "CV" at 400–412px and "Mission" on Shift+Tab at 388–396px. The fix is a small focusin handler in Header.astro plus `scroll-padding-inline` on the list, so the focused link and its focus ring are always fully revealed. The test is now stricter and catches the bug on macOS in Plex as well, so it no longer depends on which fonts the runner has.

## Root cause (evidence)
- CI trace (run 45514628540, artifact playwright-report): the snapshots record no scroll offset on any element (`__playwright_scroll_left_` is absent), so the list's `scrollLeft` stayed 0 after "Rising water" was focused. The screencast shows the header in DejaVu Sans with "Rising wate" cut off at the right edge. This rules out (a): there was no scroll in progress, smooth or otherwise. The `<ul>` has no `scroll-behavior` (the html `smooth` does not inherit) and no scroll-snap.
- Local Linux-font repro: I loaded the real DejaVu Sans 2.37 TTFs through `@font-face` and forced `--font-sans` the same way the test does, at 412px on the 4411 dev server. "Rising water" then sits at 326.6–413.5 in a list that spans 0–412, with `scrollLeft` 0 both immediately and 600 ms later. That is the exact CI failure, and waiting longer does not change it.
- Minimal Chromium probe (Playwright 1.65.1 Chromium): a 100px link in a 200px `overflow-x:auto` list, Tab-focused. With 1 to 99 px of it hidden, `scrollLeft` stays 0. Only when it is 100 % hidden does Chromium scroll (it centers the link). So any partly clipped link stays clipped.
- Sweep of widths 300–840 (step 4), Tab ×6 then Shift+Tab ×5, before the fix: 45 clipped focus stops in Plex, 54 in DejaVu and 151 in Verdana. Examples: Plex 412 "CV" clipped by 2.4 px; Plex 396 Shift+Tab "Mission" clipped by 18 px. macOS passed only by luck: Verdana's metrics either keep "Rising water" fully visible at 412 or hide it completely.

## Fix
- `src/components/site/Header.astro`: an Astro-bundled module script (same-origin, so CSP-safe, a few hundred bytes) runs on `focusin` inside `.site-nav ul`. If the list overflows, it moves `scrollLeft` by the smallest amount needed to place the focused link inside the list's scroll-padding. The move is instant, so there is no smooth scroll and nothing to wait for, and it also respects reduced motion. On desktop, where the list does not overflow, it does nothing. The fix itself is `scroll-padding-inline: var(--gutter)` on the mobile list: the revealed link sits one gutter from the edge, clear of the edge shadows and with the 2px+2px focus ring fully inside the list. No layout properties changed, so the resting header looks identical and CLS is unchanged.
- After the fix, the sweep over 300–832px, forward and backward, in Plex, real DejaVu Sans and Verdana, has 0 failures out of 8943 focus stops, with the link ±4px ring inside the list. The only remaining "failures" are above 832px, where the desktop row does not clip, so the ring check does not apply there. Screenshot at 412px in DejaVu with "Rising water" focused and the ring fully visible: /private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/acaf7aa2-48fe-4f69-befb-0d96137cc7af/scratchpad/shot-412.png

## Files changed
- src/components/site/Header.astro: focusin reveal script; `scroll-padding-inline` on the mobile list; comment wording.
- e2e/cls.spec.ts: the "mobile nav row" block now runs at 320/375/412/768/832. At each width it checks Plex first, then the forced wide font. For each it checks one row and unchanged height, walks Tab through all 6 links in order, then walks Shift+Tab back through 5. Each focused link must be fully inside the list, including the 4px ring whenever the list scrolls. Failure messages include the link and list coordinates. The measurement is synchronous after each key press because the reveal is instant, so there is no timing dependence. The CLS block is unchanged.
- e2e/shell.spec.ts: "nav stays usable on mobile" now uses `toBeInViewport({ ratio: 1 })`, so each link must be fully visible, not just a sliver.

## How to verify
- npm run check · npm run lint · npm test
- Checker: npm run build, then `npx playwright test e2e/cls.spec.ts e2e/shell.spec.ts` (port 4321), then the full `npm run verify`.
- Negative control: change `'focusin'` in Header.astro to any other event name. 320/375/412 then fail on macOS in Plex ("IBM Plex Sans: Rising water fully visible when focused (link 303.5–380.7, list 0.0–375.0)", "Mission fully visible on Shift+Tab (link -2.5–45.2 …)").

## Acceptance criteria (self-check)
- ✅ Root cause identified with evidence: the Chromium focus-scroll behavior shown by the minimal probe, the CI trace showing scrollLeft stayed 0, and an exact local repro using the DejaVu font files.
- ✅ Fix in the component, not a looser test. The test is stricter: ring included, both directions, Plex and the wide font, 5 widths.
- ✅ cls and shell specs pass locally: 40/40 against the dev server on 4411, and cls.spec 27/27 with `--repeat-each 3`. One earlier run had a single transient fail of the "/" CLS case right after an HMR reload, which came from my negative-control edit or parallel hero edits. It passed on all reruns and is dev-server only.
- ✅ Should pass on the ubuntu runner: the sweep using the actual DejaVu Sans font files that the runner has shows 0 clipped focus stops at 300–832px. The fix does not depend on timing or fonts, since it measures real geometry at focus time.
- ✅ No CLS, a11y or visual regression: no layout properties changed. The font-swap CLS tests pass. shell.spec axe light and dark: 0 serious/critical. No horizontal overflow at 375/768/1280. The resting header is identical at 320/375/412/768/1280 because the script only acts on focus.
- ✅ npm run check: 0 errors/warnings/hints · npm run lint: clean · npm test: 775/775.

## Needs Andrew
None.

## Requests to Control
None required. Optional: playwright.config.ts has no base-URL override, so I ran the two specs through a throwaway config in my scratchpad (baseURL http://localhost:4411, no webServer, same chromium project). If builders should be able to do this directly, this diff would allow it:
```diff
-    baseURL: 'http://localhost:4321',
+    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:4321',
...
-  webServer: {
+  webServer: process.env.PW_BASE_URL ? undefined : {
```

## Known limitations
- No Docker on this machine, so I did not run the official Linux Playwright image. The Linux behavior was reproduced on macOS Chromium by loading the real DejaVu Sans 2.37 font files. Chromium's focus-scroll logic is the same on every platform, so only the fonts differed.
- The 4411 dev server was already running (pid 23366) when I started, and I used it. It is not mine, so I left it running.
- Firefox and Safari already reveal partly visible focused elements. The handler is harmless there because it does nothing when the link is already in view.
