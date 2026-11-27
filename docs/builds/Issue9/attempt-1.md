# Build report — Issue #9 Settings sheet focus — attempt 1

WebKit can skip buttons during native sequential focus navigation, including the final button used by the previous wrap handler. The modal sheet now moves focus to the next or previous available control on every Tab keypress. The regression test asserts the complete cycle with each opener and two animation modes.

## Files changed

- `src/components/site/settings.ts`
- `e2e/settings-focus.spec.ts`

## Verification

- `npm run check` passed with 0 errors, warnings, or hints across 173 files.
- `npm run lint` passed.
- `npm run test` passed all 913 tests.
- The checker can verify browser behavior with `npm run build` followed by `npm run e2e -- e2e/settings-focus.spec.ts` after Control adds the spec to the WebKit project.

## Acceptance criteria

- The modal handler selects a focus destination in both directions and wraps to the opposite edge. The test covers both directions from the title and checks every stop in the cycle.
- The handler queries controls on each press and filters out disabled, inert, hidden, and negative-tabindex controls. The test exercises both Rising water and Collatz and checks their distinct sequences.
- Escape restores the opener. The test covers the toolbar and header openers. The Tab handler runs only while the modal sheet is open.

## Requests to Control

Add `e2e/settings-focus.spec.ts` to the existing WebKit project's test matching.

Browser verification is pending the independent checker. No user decision is required.
