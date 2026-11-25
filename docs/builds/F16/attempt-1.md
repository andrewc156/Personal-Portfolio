# Build report — F16 Personal portfolio entry — attempt 1

## Summary

Added Personal portfolio as a confirmed November 2026 project by Andrew Chincea, with a link to his live domain. The Garden and CV read the entry from the existing work collection. The separate Rising water project retains its explorer link.

## Files changed

- `src/content/work/project-personal-portfolio.yaml` records the project and its launch month.
- `e2e/site.spec.ts` expects nine work items and five projects. It checks that both OwlPath and Personal portfolio link to their published sites from the Garden and CV.
- `docs/builds/F16/attempt-1.md` records the build.

## How to verify

- `npm run check && npm run lint && npm test`
- Checker, after a production build, runs `npx playwright test e2e/site.spec.ts`. Inspect the Personal portfolio row in the Garden and its citation under Projects on the CV.

## Acceptance criteria (self-check)

- ✅ Astro loaded the schema-valid confirmed project. Andrew supplied the project ownership and public domain, and the launch log establishes the month.
- ✅ The existing collection consumers include the new item in the Garden and CV. The browser assertions cover the public link, and the existing data-driven page tests cover the title, date, and project counts.
- ✅ `npm run check` found zero errors, warnings, or hints across 143 files. `npm run lint` passed. `npm test` passed all 799 tests.

## Needs Andrew

None.

## Requests to Control

None.

## Known limitations

Production rendering and browser verification are pending the independent checker.
