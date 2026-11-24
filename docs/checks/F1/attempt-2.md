# Check report — F1 Site shell and design system — attempt 2

Verdict: PASS_WITH_NOTES

All three blocking fixes from attempt 1 are resolved. The F1 suite is green, 31/31 on two consecutive runs with the real `playwright.config.ts`. Both non-blocking notes the builder says it fixed hold up under my own probes:
- (a) While the drawer is open, the gear and the theme toggle stay visible and clickable at 768 and 1280, including after scrolling.
- (b) Tab from the gear goes straight into the panel.

The sticky-header change causes no layout shift and no overlap. Every hard gate passes. The notes below are non-blocking.

Gates: check ✅ (0 errors, 0 warnings, 1 hint, and that hint is in my own `docs/checks/tools/f1-probe.mjs`) · lint ✅ (ESLint and Prettier clean) · unit (0) ✅ (exit 0, passWithNoTests) · pytest n/a (no tests, DECISIONS #11); ruff ✅ (no Python files) · build ✅ (2 pages) · e2e (31) ✅ (31/31 on run 1, 31/31 on run 2, `npx playwright test e2e/shell.spec.ts`) · axe ✅ (suite clean, and my probe found 0 violations of any impact in 36 combinations) · lighthouse ✅ (mobile; `/` perf 100 / a11y 100 / BP 100 / SEO 100, CLS 0.00015; `/404.html` 100 / 100 / 100 / 100, CLS 0.0036) · links ✅ (`npm run links` scanned 9 links; the only 404s are the expected `/rising-water/` and `/cv/`) · visual ✅ (24 PNGs, all opened) · content ✅ · tda n/a · data n/a

## Previous blocking fixes (attempt 1)
1. ✅ **Strict-mode gear locator.** `exact: true` is now on every 'Art settings' locator, at e2e/shell.spec.ts:147, 218, 250, 264, 268, 280, 307, 333, 347 and 418. The tests "opens, closes on Esc, returns focus to the gear" and "open/closed state is remembered" pass on both runs.
2. ✅ **Drawer measured mid-animation.** The new `animationsSettled()` helper (e2e/shell.spec.ts:15–25) waits two rAFs and then awaits `getAnimations({subtree:true})`. It runs before both measurements, and "right drawer on desktop, bottom sheet on mobile" passes. I checked the geometry independently. At 1280 the drawer is x=928, y=61, w=352, h=739, so its right edge is 1280 and flush. At 375 it's a full-width sheet with y=461, h=351 and its bottom at 812.
3. ✅ **axe scanned mid-fade.** The settings-open axe scan now asserts the panel is visible and waits for the animations to settle (e2e/shell.spec.ts:418–421). Both "axe: 0 serious/critical" tests pass.

## Previous non-blocking notes the builder fixed
- (a) ✅ **The drawer no longer covers the header tools.** Probe `docs/checks/tools/f1-probe-a2.mjs` hit-tests `elementFromPoint` at the center of the gear and the toggle, in light and dark.
  - At 768 the header bottom is at 96 and so is the panel top. At 1280 both are at 61. `--shell-header-h` matches the header height (95.58px and 61px).
  - Gear and toggle hit-tests: `hitSelf: true` with the panel open at the top of the page, after scrolling to the bottom (scrollY 355 and 281), and after closing and then reopening while scrolled.
  - The header's computed `position` is `sticky` while open at ≥ 641px and `static` at 375.
  - Resizing with the panel open (1280 → 375 → 800 → 1280) re-lays it out correctly every time: drawer → sheet → drawer below a 96px header → drawer below a 61px header.
  - The suite's new tests "header tools stay usable while the drawer is open at 768px / 1280px" also pass.
- (b) ✅ **Tab order is gear → panel.** I opened the panel with Enter on the gear, which sends focus to `#settings-title`. Then I focused the gear and pressed Tab. The sequence was Close → `#hero-scale` → `#hero-palette` → Reset → end of document. With the panel closed, Tab from the gear skips the hidden panel. The skip link still lands on `main`.

## Acceptance criteria
1. ✅ **Tokens, themes, no flash.**
   - Grep for hex, rgb and hsl outside `src/styles/tokens.css`: 0 hits.
   - No flash: with OS light and stored dark, `data-theme` was `dark` when `<body>` was inserted and the first rAF background was rgb(17,19,21). The reverse case gave `light` and rgb(247,244,238).
   - The theme follows the OS by default and the toggle persists; both e2e tests pass.
   - With localStorage throwing, there are 0 page errors, the theme follows the OS (dark), the toggle works, the panel opens with `aria-expanded=true`, and Esc returns focus to the gear.
2. ✅ **Header, nav, skip link, focus.**
   - The wordmark, 6 nav items and the gear are present. The nav wraps onto its own row at 375 and 768 (screenshots).
   - The skip link is the first Tab stop, shown at (8,8), and Enter moves focus to `main`.
   - Every focusable element shows a 2px solid outline. That's the accent color everywhere except the skip link, which uses the text color. Elements checked: skip link, wordmark, 6 nav links, theme toggle, gear, close, slider, select and Reset.
3. ✅ **Settings panel.**
   - `aria-expanded` follows the open state.
   - Esc closes the panel and returns focus to the gear, whether focus was on the gear or inside the panel. The close button does the same.
   - The state is remembered: stored-open on load gives an open drawer below the sticky header.
   - Drawer on desktop and tablet, bottom sheet at ≤ 40rem.
   - No gear and no panel on `/404.html` or on unknown routes.
4. ✅ **Self-hosted fonts, zero third-party requests.** All requests on `/` (closed and open), `/404.html` and `/x/y/`, in both themes, were same-origin: 7 unique URLs and 0 foreign. Loaded faces are Plex Sans 400 and 600 and Plex Mono 400, all from `/_astro/`. The built HTML has no absolute http(s) URLs.
5. ✅ **Home and 404.** The composition is unchanged from attempt 1. The e2e test "section anchors exist in §4.3 order and nav scrolls to them" passes. Preview returns 404 for unknown routes and serves the custom page.
6. ✅ **axe, Lighthouse, layout.**
   - axe: 0 violations of any impact for home, home with settings open (settled), and 404. That covers 375/768/1280, light and dark, and reduced motion on and off: 36/36 clean.
   - Lighthouse accessibility is 100 on `/` and `/404.html`.
   - Horizontal overflow is 0 in all states.
   - The screenshots are clean.
   - CLS from the sticky change, measured with a PerformanceObserver: opening and closing at the top, scrolling with the drawer open, and reopening while scrolled all produced 0 layout-shift entries (`shiftsNoInputTotal: 0` in all 6 width/theme runs). `main`'s top moved 0px on open. The only shifts were at load, ≤ 0.0004 (font swap), the same as attempt 1.

## Notes (non-blocking)
1. **At 375 the header isn't pinned while the sheet is open.** This is by design: the sheet sits at the bottom and never covers the header. After scrolling, the gear is off-screen (top −466 in my probe), so the sheet is closed with × or Esc. That's acceptable. The builder lists it under known limitations.
2. **The tool-usability test only proves scrolling for this content length.** The new test at e2e/shell.spec.ts:320 wheels 600px, but the page can scroll only 281 px at 1280×800 and 355 px at 768×800. It does reach the bottom, so it's valid today. It also only asserts that `data-theme` matches `/light|dark/` after the toggle click; a stronger check would assert the value changed. It's fine for F1, but worth tightening once F2 adds content.
3. **Literals still outside the tokens file.** The type and size literals from attempt-1 note 4 are still there: Header.astro `1.0625rem`, Hero.astro `1.25rem` and `999px`. Colors are 100% tokenized.
4. **CSP.** Inline script on each page is 2,701 B raw / 1,164 B gzip, up from 2,407 B. That's far under the 120 KB budget. F8's CSP still needs hashes for both inline scripts. `--shell-header-h` is set through the CSSOM (`style.setProperty`), which a `style-src` CSP doesn't block.
5. **Carried over.** The footer "Source" link is still hidden, and the profile fields are still drafts. Both stay with Needs Andrew. `npm run lhci` serves `staticDistDir` on a random port (56113 here), as noted in attempt 1.
6. **Ownership.** Every changed F1 file (`e2e/shell.spec.ts`, `BaseLayout.astro`, `SettingsPanel.astro`, `Header.astro`, `settings.ts`) is within F1's §8.2 paths. Content is unchanged. Visible text traces to §3/§4, there are 0 TODO/TBD/lorem/placeholder hits in dist, 0 collaborator names, and the sitemap lists only `/`.

## Artifacts
- Screenshots (24, all opened):
  - `docs/checks/F1/attempt-2/{home,home-settings,404}-{375x812,768x1024,1280x800}-{light,dark}.png`
  - `docs/checks/F1/attempt-2/extra-open-scrolled-{375x812,768x1024,1280x800}-{light,dark}.png`
- Probe output: `docs/checks/F1/attempt-2/probe-output.json` (attempt-1 probe, rerun) and `docs/checks/F1/attempt-2/probe-a2-output.json` (sticky header, overlap, CLS, resize, tab order)
- Lighthouse: `docs/checks/F1/attempt-2/localhost--2026_11_24_09_25_11.report.json`, `docs/checks/F1/attempt-2/localhost-404_html-2026_11_24_09_25_21.report.json`
- Checker tools: `docs/checks/tools/f1-probe.mjs`, `docs/checks/tools/f1-probe-a2.mjs` (new), `docs/checks/tools/f1-shots.mjs`
- Port 4321 is free; the preview server was stopped.
