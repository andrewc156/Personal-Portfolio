# Check report — Issue #9 Settings keyboard focus — attempt 1

## Verdict

PASS. Checked the Issue #9 candidate on `fix/issue-9-settings-focus` before commit, with Settings script blob `e0e424c`, regression spec blob `4a40731` and Playwright config blob `a8e390c`.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | Pass. 173 files, 0 errors, warnings or hints. |
| `npm run lint` | Pass. |
| `npm test` | Pass. 913 tests across 37 files. |
| `npm run build` | Pass. 10 static pages, CSP header written. |
| `npx playwright test e2e/settings-focus.spec.ts e2e/select-controls.spec.ts` | Pass. 12 tests across Chromium and WebKit. |
| `npx playwright test e2e/shell.spec.ts --project=chromium --grep 'settings panel\|axe: 0 serious/critical'` | Pass. 22 tests, including both modal openers, both theme axe tests, drawer, close and breakpoint behavior. |
| `git diff --check` | Pass. |

The local run covered checks relevant to the focus change. Python, Lighthouse, links and the full browser suite remain part of the repository CI workflow. Content, persistence math, data and layout audits were outside the scope of this fix.

## Acceptance criteria

- At 390 × 844 with touch enabled, the independent production-preview probe sent 30 Tab presses and 8 Shift+Tab presses after opening from each Settings button. WebKit 27.2 went from 5 escapes to `BODY` out of 38 presses per opener on the pre-fix build to 0 out of 38 on the candidate. Chromium 159.0.8154.6 had 0 out of 38 per opener on both builds.
- In both engines the new regression spec observed every stop in forward and reverse order, including buttons and the mode-specific paths for Rising water and Collatz. The two WebKit cases failed on the pre-fix build at the first forward Tab because focus skipped the Close button.
- In both engines, opening set the modal role, set `aria-modal`, made the background inert and focused the title. Escape returned focus to the exact opener, removed background inertness and left the closed panel inert. At 1280 × 800, Tab naturally left the non-modal drawer without dismissing it.

## Notes

Browser versions are from Playwright 1.65.1 on macOS. The touch viewport was emulated.

## Artifacts

The independent probe is local checker scratch. Rerun the committed browser regression with `npm run build` followed by `npx playwright test e2e/settings-focus.spec.ts`.
