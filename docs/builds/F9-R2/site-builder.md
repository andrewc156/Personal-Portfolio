# Build report — F9 final audit fixes — attempt 2

## Summary

I corrected the mobile navigation test to follow the six links by keyboard and confirm each focused link scrolls into view. The OwlPath production failure came from the C1 content delta not being integrated into the main worktree. I added the URL from the supplied CV annotation to the project entry and changed the regression assertion to select the rendered link by its destination within the project item.

## Files changed

- `e2e/shell.spec.ts` — exercise keyboard reachability and automatic scroll for all six mobile navigation links.
- `e2e/site.spec.ts` — assert the exact destination link within the OwlPath item on Garden and CV.
- `src/content/work/project-owlpath.yaml` — integrate the previously checked CV-provided site URL.
- `e2e/headers.spec.ts` — Prettier formatting only.

## How to verify

- `npm run check`
- `npm run lint`
- `npm test`
- Checker: rebuild production and rerun the two previously failing browser tests, then the full F9 protocol.

## Acceptance criteria (self-check)

- ✅ Mobile nav test advances through the skip link and wordmark, then tabs through all six nav links, asserting focus and in-viewport scroll for each. It verifies the list has scrolled by the final link.
- ✅ The OwlPath assertion matches rendered anchor markup by exact URL within the data-id project item on Garden and CV.
- ✅ OwlPath URL is transcribed from the hyperlink in Andrew's supplied CV, not guessed.
- ✅ `npm run check`: 0 errors, warnings, or hints across 120 files.
- ✅ `npm run lint`: clean.
- ✅ `npm test`: 462 tests passed.

## Needs Andrew

None for these fixes.

## Requests to Control

This fix round includes the OwlPath content link already verified by C1 attempt 3. C1's earlier builder changes are present in main, but this one file had retained its pre-C1 contents during integration.

## Known limitations

The production build, browser tests, Lighthouse, and preview were not run here because the builder role assigns those gates to the checker.
