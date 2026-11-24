# Check report — F1 Site shell and design system — attempt 1

Verdict: FAIL

The product itself meets every F1 acceptance criterion when I check it independently. The F1-owned e2e suite (`e2e/shell.spec.ts`) is red, though: 5 of 28 tests fail on every run, so the hard e2e gate fails. All three causes are defects in the test file, not in the site. The builder wrote the suite but never ran it. The fixes are small.

Gates: check ✅ (0 errors, 0 warnings, 0 hints) · lint ✅ · unit (0) ✅ (no test files; passWithNoTests) · pytest n/a (no tests, per DECISIONS #11); ruff ✅ (no Python files) · build ✅ (2 pages) · e2e ❌ (23 passed, 5 failed of 28) · axe ✅ in my own probe (0 violations of any impact in 36 combinations), ❌ in the F1 spec (animation race, see fix 3) · lighthouse ✅ (mobile; `/`: perf 100 / a11y 100 / BP 100 / SEO 100, CLS 0; `/404.html`: perf 100 / a11y 100 / BP 100 / SEO 100, CLS 0.0036) · links ✅ (only the expected `/rising-water/` and `/cv/` 404s; see note 1 on how the links gate had to be run) · visual ✅ (18 PNGs, all opened) · content ✅ · tda n/a · data n/a

## Acceptance criteria
1. ✅ **Tokens, themes, no flash.**
   - Every color literal in `src/` is in `src/styles/tokens.css` (grep for hex, rgb and hsl outside it: 0 hits). Type and spacing tokens are in the same file.
   - OS default: with no stored value, `data-theme` is null and the background follows `colorScheme` (e2e "follows the OS preference" passes).
   - The toggle persists across reloads and pages (e2e passes).
   - No flash, checked with my own probe (`docs/checks/tools/f1-probe.mjs`). With OS light and stored dark, `data-theme` was already `dark` when `<body>` was inserted, and the first rAF background was `rgb(17,19,21)`. The reverse case gave `light` and `rgb(247,244,238)`.
   - The inline script is the first script or style element in `<head>`, ahead of the only stylesheet.
   - AA contrast, recomputed independently (`docs/checks/tools/contrast.py`):
     - Text: light 15.7 / 16.7 / 14.4, dark 14.8 / 13.5 / 15.6 on bg / surface / sunken.
     - Muted text: ≥ 6.5.
     - Accent: ≥ 7.7.
     - On-accent: 8.7.
     - Control outlines: light 3.42 / 3.63, dark 4.25 / 3.86.
     - Focus ring: ≥ 7.7.
     - All pass.
2. ✅ **Header, nav, skip link, focus.**
   - Header has the wordmark, the nav (Mission · Research · Work · Open science · Rising water · CV) and the gear (`aria-label="Art settings"`).
   - Mobile: below 52rem the nav wraps onto its own row, and all 6 links are visible at 375px (screenshots).
   - Skip link: it's the first Tab stop, visible at (8,8), and Enter → `#main`, with focus on `main`.
   - Focus: tabbing through every focusable element (skip link, wordmark, 6 nav links, theme toggle, gear, close, slider, select, Reset) shows a 2px solid outline in the accent color on each one.
3. ✅ **Settings panel (product).**
   - Opening from the keyboard sets `aria-expanded="true"` and moves focus to `#settings-title`.
   - Esc sets `aria-expanded="false"`, hides the panel and returns focus to the gear. This also works with focus inside the panel, and the close button does the same.
   - State is remembered across reloads (`settings-open` = `1`/`0`).
   - Layout once the animation settles, at 1280×800: the drawer box is x=928, w=352, h=800, flush right. At 375 it's a full-width bottom sheet (screenshots).
   - localStorage throwing (getter throws `SecurityError`): no page errors, the theme follows the OS, and the toggle, panel, Esc and focus return all still work.
   - Gear absent: 0 gear buttons and 0 panels on `/404.html` and on an unknown route.
4. ✅ **Self-hosted fonts, no third-party requests.**
   - Fonts are @fontsource woff2 files served from `/_astro/`. Loaded faces: Plex Sans 400 and 600, Plex Mono 400.
   - The probe captured every request on `/`, `/` with settings open, `/404.html` and `/x/y/` in both themes. All requests were same-origin (7 unique URLs, 0 foreign).
   - The built HTML contains no absolute `http(s)` URLs.
5. ✅ **Home composition and 404.**
   - `index.astro` composes Hero, Mission#mission, RecentWork#work, ResearchGrid#research, OpenScience#open-science, Teaching and Contact. Teaching and Contact render nothing because there's no content yet, which §4.3 allows.
   - `HeroSettings` goes in `slot="settings"`.
   - Nav clicks scroll to each anchor (e2e passes at 1280).
   - The 404 page exists. Preview returns status 404 for unknown routes, with the h1, a home link and a static `svg[role=img]`.
6. ✅ (product) / ❌ (spec).
   - axe on the settled page: 0 violations of any impact for home, home with settings open, and 404, at 375/768/1280, in light and dark, with reduced-motion both on and off (36 runs).
   - Lighthouse accessibility is 100 on `/` and `/404.html`.
   - Horizontal overflow is 0 in all 18 screenshot states.
   - The F1 axe test fails because it scans mid-animation (fix 3).

## Blocking fixes (FAIL only)
1. **e2e/shell.spec.ts:205 and :255.** Expected: the gear locator resolves to one element. Actual: once the panel is open, `getByRole('button', { name: 'Art settings' })` does a case-insensitive substring match. It then also matches the close button ("Close art settings"), and Playwright throws a strict-mode violation. This fails the tests "opens, closes on Esc, returns focus to the gear" (line 212) and "open/closed state is remembered" (line 255).
   - Fix: add `exact: true` to that locator. For consistency, also add it at :134, :237, :251, :267, :290 and :361.
   - Reproduce: build, then `npx playwright test -c docs/checks/tools/playwright.checker.config.ts e2e/shell.spec.ts`.
2. **e2e/shell.spec.ts:270–273.** Expected: `box.x + box.width == clientWidth` (±1). Actual: off by 24. The bounding box is read during the 220ms `settings-in-right` slide (translateX 1.5rem = 24px). After the animation settles, the box is exactly flush (x 928 + w 352 = 1280).
   - Fix: wait for the panel's animations to finish before measuring, e.g. `await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))`. Alternatively, run this test in a `reducedMotion: 'reduce'` context. Do the same before the 375px measurement at :279.
3. **e2e/shell.spec.ts:361–362.** Expected: 0 serious or critical axe violations with settings open. Actual: `color-contrast (serious)` is reported on `#settings-title`, the legends, the labels, the output, `#hero-palette` and `.btn`, in both themes. axe runs right after the click, while the panel is still fading in from `opacity: 0`. My probe runs the same axe scan after the panel settles (600ms), and it finds 0 violations in every theme, width and motion setting.
   - Fix: after opening, wait for the animations to finish, as in fix 2, before calling `expectNoSeriousAxe`.
   - Reproduce: same command as fix 1.

Run the full suite after fixing. It must reach 28/28 on two consecutive runs.

## Notes (non-blocking)
1. **Control: harness configs (not F1-owned).**
   - (a) `playwright.config.ts` webServer: with an agent detected, Astro 7.4 `astro preview` backgrounds itself and exits, so Playwright reports "Process from config.webServer exited early" and `npm run e2e` / `verify` can't run. Fix: change the command to `npm run preview -- --port 4321 --ignore-lock`. Evidence: `node_modules/astro/dist/cli/preview/index.js:45`. I ran the suite through a checker-only wrapper, `docs/checks/tools/playwright.checker.config.ts`, which differs only in that flag and the output dirs.
   - (b) `npm run links` scanned 0 links. The skip regex `^(?!http://localhost)` also matches the root argument `dist` itself, which then shows as SKIPPED. So the links gate is vacuous as configured. I ran `linkinator http://localhost:4321/ http://localhost:4321/404.html --recurse --skip '^(?!http://localhost:4321)'` against preview instead. All links passed except the expected `/rising-water/` and `/cv/`.
   - (c) LHCI `staticDistDir` serves on a random port (55737 here), not 4321. That's harmless, but it's not literally "port 4321".
2. **The open drawer covers the header tools.** At 768 and 1280 the drawer (z-index 50, `inset: 0 0 0 auto`) covers the theme toggle and the gear. While it's open, the gear (`aria-expanded="true"`) can't be clicked to close it. Esc and the × button still work. Consider starting the drawer below the header (`top: var(--header-h)`), or raising the header tools above it.
3. **Tab order: gear, then the whole page, then the panel.** The panel is non-modal and comes after the footer in the DOM. Today `main` has no focusables, so after the gear the next Tab stop is the panel. Once F2 adds content, Tab from the gear will run through the whole page before it reaches the panel. Opening does move focus into the panel, which mitigates this. Consider rendering the panel right after the header.
4. **A few type and size literals live outside tokens.css:** Hero.astro:47 (`1.25rem` hero question), Header.astro:78 (`1.0625rem` wordmark, which duplicates `--fs-body`) and Hero.astro:67 (`999px` radius). Colors are 100% tokenized.
5. **The footer "Source" link is hidden** because `site.source_url` is empty. DECISIONS #1 records the public repo github.com/andrewc156/Personal-Portfolio. Control or Andrew can decide whether to fill it in. The builder already listed this under Needs Andrew.
6. **Content.** All visible text traces to §3 or §4: the name, the draft hero question, the keywords and the palette names. In dist, TODO|TBD|lorem|placeholder appears 0 times (in visible text and in raw HTML). Michael Liu and Yunus Kaya appear 0 times. The sitemap lists only `/`.
7. **JS.** No `_astro/*.js` files. The shell module is inlined: 2,407 B raw / 1,040 B gzip per page (`/` and `/404.html`), well under the 120 KB budget. F8's CSP will need hashes for both inline scripts (the theme bootstrap and the inlined module), as the builder noted.
8. **Reduced motion is respected.** Under `reduce`, scroll-behavior is `auto` and the panel animation and transitions drop to 1e-5s. Under `no-preference` they're `smooth`, 0.22s and 0.12s.

## Artifacts
- Screenshots (18, all opened): `docs/checks/F1/attempt-1/{home,home-settings,404}-{375x812,768x1024,1280x800}-{light,dark}.png`
- Probe output: `docs/checks/F1/attempt-1/probe-output.json`
- Lighthouse reports: `docs/checks/F1/attempt-1/localhost--2026_11_24_09_16_51.report.json`, `docs/checks/F1/attempt-1/localhost-404_html-2026_11_24_09_17_02.report.json`
- Checker tools: `docs/checks/tools/f1-probe.mjs`, `docs/checks/tools/f1-shots.mjs`, `docs/checks/tools/contrast.py`, `docs/checks/tools/playwright.checker.config.ts`
