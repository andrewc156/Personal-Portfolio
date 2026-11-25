# Build report — F25 Shell, Settings sheet and Garden fixes — attempt 1

Summary: Fixed QA-03, QA-11, QA-16 (shell part) and QA-17 from `docs/qa/f23-production/report.md`. On narrow screens (≤40rem) the Settings bottom sheet is now modal: `role="dialog"` plus `aria-modal`, the rest of the page is `inert`, Tab and Shift+Tab wrap inside the sheet, and Esc, Close or a tap on the covered page closes it and returns focus to whichever opener was used. The wide drawer stays non-modal as before. After Back/Forward, if focus is offscreen it moves to a visible target without scrolling. Without JS, the theme toggle and gear are disabled and visibly dimmed; with JS they are never dimmed. An unlisted-type deep link on Garden now shows that type as the active chip, with a Clear link and a plain empty state. Ignored filter values are removed from the URL.

Files changed:
- src/components/site/settings.ts — modal sheet (`syncModal`: inert siblings marked `data-settings-inert`, dialog semantics), Tab wrap, backdrop click dismissal, crossing the breakpoint updates the modal state, an open state is not restored on narrow screens
- src/components/site/focus-restore.ts (new) — `popstate` / `pageshow`(persisted) focus reconciliation
- src/components/site/shell-client.ts — calls `initFocusRestore()`
- src/components/site/theme.ts — enables the toggle when it is wired
- src/components/site/ThemeToggle.astro, src/components/site/Header.astro — buttons rendered `disabled`
- src/layouts/BaseLayout.astro — the existing inline head script adds `js` to `<html>` (one line, so the CSP hash changes; write-headers.mjs recomputes it at build)
- src/styles/global.css — `:root:not(.js) .icon-btn:disabled` dimming; `.icon-btn:hover:not(:disabled)`; `[data-focus-restore]:focus { outline: none }`
- src/components/content/garden-state.ts (new) — pure URL-state helpers
- src/components/content/garden-client.ts — unlisted-type chip, Clear action, type-specific empty text, URL normalization (`replaceState`)
- src/pages/garden/index.astro — hidden chip and Clear link for each known type with nothing listed; `data-garden-empty-text`
- tests/unit/content/garden-state.test.ts (new, 7 tests)
- e2e/shell.spec.ts — 2× narrow-sheet tests (header gear and hero Settings), wide drawer non-modal and resize, no narrow restore, 3× D01 history widths (1024/1280/1440), in-page link sanity, 2× no-JS/no-flash
- e2e/site.spec.ts — unlisted-type deep link; ignored values dropped from the URL

How to verify:
- `npx astro check` (no errors in F25 files), `npx vitest run` (37 files / 913 tests pass)
- `npx eslint --parser-options tsconfigRootDir:$PWD <F25 files>` and `npx prettier --check <F25 files>`
- `npx playwright test e2e/shell.spec.ts -g "narrow sheet|wide drawer stays|remembered open drawer does not|focus after history|no-JS shell"`
- `npx playwright test e2e/site.spec.ts -g "unlisted type|ignored filter values are dropped"`
- Also run the full shell.spec and site.spec, because the gear and theme buttons now start disabled.

Acceptance criteria (self-check):
- ✅ QA-03 Tab/Shift+Tab stay within the narrow sheet: 60 Tabs and 8 Shift+Tabs stayed inside in the e2e test, for both openers (dev server :4422).
- ✅ QA-03 Obscured background is inert: header, main, footer and skip link have `inert === true` while the sheet is open, and no `[inert]` elements remain after it closes.
- ✅ QA-03 Esc, Close and backdrop tap each return focus to the opener (header gear and hero "Animation settings"). The hero trigger is handled through the existing `aria-controls` opener, with no hero change.
- ✅ QA-03 Desktop unchanged: no inert and no `aria-modal` at 1280px, and a background click keeps the drawer open. Resizing to 390px makes it modal; resizing back restores it. The existing Esc, header-tools (768/1280) and keyboard-order tests still pass.
- ✅ QA-11 Repro check: the new history test fails without `initFocusRestore()` (3/3 widths) and passes with it. After Back to `/` at scrollY 0, focus is not offscreen and the next Tab stays near the top (scrollY < 200).
- ✅ QA-11 In-page Research link still continues into `#research` on the next Tab, and the fix does not interfere.
- ✅ QA-16 (shell) With JS off, the theme toggle (on `/` and `/garden/`) and the gear are disabled, have opacity < 1 and are skipped by Tab. With JS on they are enabled at opacity 1 and are never dimmed during load (checked with a MutationObserver). Opacity and the `disabled` attribute don't change layout, so CLS is unaffected.
- ✅ QA-17 `?type=preprint|software|dataset` shows that chip with `aria-current`, "Nothing is listed under X yet." and "Showing 0 of 9 items". Clear keeps `?tag=`, hides the chip and focuses "All types", and Back restores the filter. Unknown values are dropped from the URL (`?type=bogus&x=1` → `?x=1`). Screenshot: /Users/andrewchincea/.hermes/cache/scratch/f25-garden-unlisted.png
- ✅ Unit tests: garden-state.test.ts 7/7 pass.

Needs Andrew: none. The empty-state text only says that nothing of that type is listed, which the build data already establishes.

Requests to Control:
- The full `npm run lint` and `npx astro check` fail for environmental reasons. Untracked `docs/checks/F19a/attempt-2/test-results/**` and `docs/checks/F19b/attempt-*/test-results/**` contain `tsconfig.json` files and trace bundles: ESLint reports 926 "No tsconfigRootDir" parse errors, and astro check reports errors inside those folders. Either delete those test-results folders or add `docs/checks/**/test-results/**` to the ESLint and astro/tsconfig ignores. Remaining astro check errors are in other builders' in-progress files (e2e/hero.spec.ts, src/components/hero/hero-client.ts, src/components/explorer/explorer-client.ts), not F25.
- QA-16 hero part (viz-builder, F26): Hero.astro now renders Play and New terrain `disabled`. Global `.btn:disabled` dims at opacity 0.6, so JS loads may briefly flash a dimmed state. `:root.js` is now set before first paint, so the hero can scope its dimming to `:root:not(.js) .hero__btn:disabled` if wanted.

Known limitations:
- Playwright's Chromium disables the back/forward cache, so the bfcache `pageshow` path is untested. The test covers the same-document Back (`/#research` → `/`) that leaves focus offscreen, and the full Research → article → Back×2 path. The `pageshow` handler runs the same reconciliation.
- On narrow screens a remembered open state no longer reopens the sheet on load (a modal over an unseen page). The value is kept, so wide screens still restore it.
- Backdrop dismissal applies only to the narrow modal sheet. The wide drawer still ignores background clicks, as the QA report describes.
- Not run (checker only): build, preview, full e2e suites, Lighthouse.
