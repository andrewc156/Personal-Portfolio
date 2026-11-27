# Build report — Issue #11 Settings drawer exit — attempt 1

## Summary

The wide header stays pinned until the drawer's discrete display transition finishes or is canceled. The panel becomes inert and returns focus as soon as closing starts. The interrupt test measures the actual opening transform transition and the dedicated drawer spec exercises Tab during a rendered exit.

## Files changed

- `src/components/site/settings.ts` ties the header pin to the current display transition.
- `src/components/site/Header.astro` uses the exit state at widths above the sheet breakpoint.
- `src/components/site/SettingsPanel.astro` updates the comment describing the header pin.
- `e2e/shell.spec.ts` reads the opening duration from the running transition.
- `e2e/settings-drawer.spec.ts` covers keyboard focus during exit, the scrolled header, interrupted exits, theme cancellation, and reduced motion.

## How to verify

- `npm run check` passed with zero errors, warnings, or hints.
- `npm run lint` passed.
- `npm test` passed all 913 tests across 37 files.
- `git diff --check` passed.
- From the production build, run `npx playwright test e2e/settings-drawer.spec.ts e2e/shell.spec.ts`.

## Acceptance criteria

- The scrolled desktop header remains sticky while the panel is visible during exit and returns to normal positioning when it is gone. The browser spec exercises both points.
- Reopening cancels the previous exit. Reduced motion removes the header pin immediately. A theme switch cancels a running exit as intended.
- Tab moves to the hero mode control and the leaving panel refuses programmatic focus. The drawer spec exercises the animated drawer and modal sheet.
- The interrupt test measures the production opening and closing transform transition durations.

## Needs Andrew

None.

## Requests to Control

Include `e2e/settings-drawer.spec.ts` in the WebKit Playwright project and run the browser tests before committing.

## Known limitations

Browser checks are pending checker verification.
