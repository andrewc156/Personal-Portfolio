# Build report — F15 Remove footer credit — attempt 1

Summary: At Andrew's request, the existing profile flag now disables the Claude Code credit in the shared footer. The browser regression verifies its absence while retaining the copyright and Source link assertions.

Files changed:

- `src/data/profile.yaml` sets `show_claude_code_credit` to `false`.
- `e2e/shell.spec.ts` checks the removed text and the remaining footer content.

How to verify:

- `npm run check && npm run lint && npm test`
- Checker: `npm run build && npx playwright test e2e/shell.spec.ts -g 'footer shows'`

Acceptance criteria (self-check):

- ✅ The profile flag is false and the shared footer already guards the credit and its separator with that flag.
- ✅ The existing browser test keeps the copyright and Source link assertions and now expects the credit to be absent.
- ✅ Astro check passed with zero diagnostics across 143 files. Lint passed. Vitest passed all 799 tests across 26 files.

Needs Andrew: Nothing.

Requests to Control: Verify the built footer in the independent browser check.

Known limitations: The browser regression awaits the checker.
