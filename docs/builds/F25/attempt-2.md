# Build report — F25 Shell, Settings sheet and Garden fixes — attempt 2

Summary: Fixed the checker's blocking QA-11 issue. Focus was reconciled two frames after `popstate`. With default motion (`scroll-behavior: smooth`), Chromium spends about 300 ms animating the same-document Back from `/#research` to `/`, so the check ran while the article link was still on screen. `afterRestore()` now waits for the scroll restoration to finish before it reconciles. It reconciles on `scrollend`, and also whenever `scrollY` has been unchanged for 3 frames (the fallback for browsers without `scrollend`, and the path for reduced motion or instant restores). A scroll that starts late restarts the wait. A final reconcile runs at a 1 s cap, and then the listeners are removed. `reconcileFocus()` only acts when focus is offscreen, so running it more than once is safe. The history e2e test now runs with both `no-preference` and `reduce` motion. It waits for the forward smooth scroll to settle before Tab and before Back, as the QA steps do. Non-blocking note fixed too: the Settings panel root is now a `div` with `role="complementary"` (switched to `dialog` + `aria-modal` on narrow screens), which clears axe `aria-allowed-role`.

Files changed:
- src/components/site/focus-restore.ts — `afterRestore()` waits for the scroll to settle (scrollend, a 3-stable-frame poll, re-arms on late scroll, 1 s cap and cleanup). Each new traversal cancels the earlier wait.
- src/components/site/SettingsPanel.astro — the root changes from `<aside>` to `<div role="complementary">`, and the doc comment is updated.
- src/components/site/settings.ts — `syncModal` sets `role="complementary"` when not modal, instead of removing the role.
- e2e/shell.spec.ts — the QA-11 history tests run under `no-preference` and `reduce` motion × 1024/1280/1440. A `scrollSettled` helper is used after the fragment jump, after Tab, after Back and after the next Tab. Each test asserts the expected computed `scroll-behavior` and that the forward scroll reached Research (scrollY > 800). The narrow-sheet test asserts axe `aria-allowed-role` has 0 violations on the panel (any impact). The wide-drawer test asserts the `complementary` landmark and the role switch dialog ↔ complementary on resize.
- (`src/styles/global.css` unchanged: the smooth scrolling stays.)

How to verify:
- `npx astro check` (0 errors), `npm run lint` (clean), `npm run test` (37 files / 913 tests pass)
- `npx astro dev --port 4422 --ignore-lock`, then `PW_BASE_URL=http://localhost:4422 npx playwright test e2e/shell.spec.ts -g "focus after history|narrow sheet|wide drawer stays"`
- `node docs/checks/tools/f24-27-qa11-samedoc.mjs http://localhost:4422`, plus the same command with `RM=1`

Acceptance criteria (self-check, dev server :4422):
- ✅ QA-11 default motion: the checker's repro tool gives PASS at 1024, 1280 and 1440. After Back: scrollY 0, focus on BODY, next Tab → "Skip to content" at scrollY 0. With `RM=1` it is also PASS ×3.
- ✅ The new e2e test fails without the fix. With attempt 1's two-rAF timing, the 3 `no-preference` tests fail and the 3 `reduce` tests pass. That matches the checker's finding, so the test now reproduces the real flow. With focus restore disabled, all 6 fail. With the fix, all 6 pass.
- ✅ No-`scrollend` fallback: an ad-hoc probe swallowed every `scrollend` event at capture, so only the frame poll and cap ran. It gave the correct result at 1024, 1280 and 1440 (scrollY 0, focus BODY, next Tab → Skip link).
- ✅ In-page Research link still continues into `#research` on the next Tab.
- ✅ Full `e2e/shell.spec.ts` against the dev server: 44/44 pass, including narrow sheet ×2, the wide drawer and the axe checks.
- ✅ axe `aria-allowed-role` on the open 375/390 sheet: 0 violations (asserted in e2e).

Needs Andrew: none.

Requests to Control: none.

Known limitations:
- In the worst case, focus is reconciled up to about 1 s after Back: a smooth restore that never fires `scrollend` and never holds still for 3 frames. Typically it runs at the end of the ~300 ms animation.
- Playwright's Chromium disables bfcache, so the `pageshow(persisted)` path is still untested. It uses the same `afterRestore()`.
- The narrow sheet still has no scrim (checker note 2, a design choice; unchanged).
- Not run (checker only): build, preview, full e2e suites, Lighthouse. The dev server is stopped.
