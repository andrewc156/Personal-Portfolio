# Build report — F1 Site shell and design system — attempt 2

Summary: Fixed all three blocking e2e defects in `e2e/shell.spec.ts`: exact gear locators, and waiting for the drawer's animations to finish before measuring it and before running axe. I also fixed the two non-blocking notes. While the drawer is open, the header is pinned above it (≥ 641px) and the drawer starts below the header, so the gear and the theme toggle stay visible and clickable, even after scrolling. The panel is now rendered right after the header, so keyboard order runs gear → panel → page. Focus-to-heading on open, Esc, the close button and focus return are unchanged. The footer Source link stays hidden.

Files changed:
- e2e/shell.spec.ts:
  - `exact: true` on all 8 'Art settings' locators.
  - New `animationsSettled()` helper. It waits two rAFs, then loops until every animation in the panel subtree, including transitions, has finished. It tolerates cancelled animations.
  - The helper is used before the 1280 and 375 drawer measurements and before the settings-open axe scan. The axe scan also asserts the panel is visible first.
  - New tests: "header tools stay usable while the drawer is open" at 768 and 1280, and "keyboard order runs gear → panel". The suite is now 31 tests, up from 28.
- src/layouts/BaseLayout.astro: `SettingsPanel` moved from after `<Footer>` to directly after `<Header>`.
- src/components/site/SettingsPanel.astro: drawer `inset` top is now `var(--shell-header-h, var(--header-h))` instead of 0.
- src/components/site/Header.astro: while `:root[data-settings-open]` is set and the viewport is ≥ 40.0625rem, the header is `position: sticky; top: 0; z-index: 60`, which puts it above the panel's z-index of 50.
- src/components/site/settings.ts:
  - `setSettingsOpen` toggles `data-settings-open` on `<html>`.
  - New `trackHeaderHeight()` uses a ResizeObserver to keep `--shell-header-h` on `:root` equal to the header's height. Setting it through the CSSOM is not blocked by a style-src CSP.
- docs/builds/F1/screens/home-settings-{375,768,1280}-{light,dark}.png (dev-server self-check; these replace the attempt-1 screenshots)

How to verify:
- `npm run check` (0 errors, 0 warnings, 1 hint; the hint is in the checker's own docs/checks/tools/f1-probe.mjs, not F1 code), `npm run lint` ✅, `npm test` ✅ (exit 0, no unit tests in my area)
- Checker: `npm run build && npx playwright test e2e/shell.spec.ts`, twice. I did not run the e2e suite, per the rules.
- Self-check: on `npx astro dev --port 4402`, I ran an ad-hoc Playwright script (not the suite) at 375/768/1280 in light and dark, with the panel open and its animations settled. Results:
  - axe: 0 violations of any impact in all 6 states.
  - Horizontal overflow: 0 everywhere.
  - Drawer box at 1280: x=928, y=61 (the header's bottom), w=352, h=739. At 768: x=416, y=96, w=352, h=704. At 375: a bottom sheet with y=449, h=351, bottom 800, full width.
  - After scrolling 700px with the drawer open, the theme toggle and the gear were both clickable. Playwright's hit-test passed, and the gear closed the panel.
  - Enter on the gear → focus on `#settings-title`. Gear focused + Tab → focus inside `#settings-panel`. Esc → focus back on the gear.

Acceptance criteria (self-check):
1. ✅ Unchanged from attempt 1: tokens, themes, no flash and AA contrast. No new color literals.
2. ✅ Unchanged: header, nav, skip link and focus. The header's look is unchanged; it is pinned only while the drawer is open.
3. ✅ Settings panel:
   - The gear and the theme toggle stay usable while the drawer is open.
   - Tab order runs gear → panel.
   - Esc and the close button both close the panel and return focus to the gear.
   - Open/closed state is remembered.
   - Layout: right drawer below the header; bottom sheet at ≤ 40rem.
4. ✅ Unchanged: self-hosted fonts, no third-party requests.
5. ✅ Unchanged: home composition and 404.
6. ✅ (dev) / pending the checker: the three e2e defects are fixed, and axe now runs only after the drawer has settled.

Needs Andrew (unchanged):
- Display name, tagline and hero question are draft (`confirmed: false`).
- Footer "Source" link is still hidden. Which repo URL should it link to?
- Keep the footer Claude Code credit?
- Email, GitHub, LinkedIn, ORCID, photo, CV PDF, graduation term and domain are still empty in profile.yaml.

Requests to Control: none. Attempt-1 requests are done (DECISIONS #15, #16).

Known limitations:
- Below 52rem the header has two rows (about 96px at 768), so the drawer there is shorter (704px at 800 tall).
- Below 40rem the header is not pinned, because the bottom sheet never covers it.
- Non-blocking note 4 (a few type and size literals outside tokens.css) was not addressed in this attempt.
- `/rising-water/` and `/cv/` nav targets don't exist yet (F6/F2).
- F8's CSP still needs hashes for both inline scripts.
