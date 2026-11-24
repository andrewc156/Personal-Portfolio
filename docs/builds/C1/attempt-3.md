# Build report — C1 Content update from Andrew's CV — attempt 3

## Summary

I verified the OwlPath URL from the page-two annotation in Andrew's supplied CV and added it to the project entry. The site-wide contact check now detects common North American phone formats using a generic pattern. A browser regression test checks the OwlPath link on both the Garden and CV pages.

## Files changed

- `src/content/work/project-owlpath.yaml` — set the confirmed site URL.
- `e2e/site.spec.ts` — replace personal phone fragments with a generic matcher and assert both rendered project links.
- `docs/builds/C1/attempt-3.md` — this report. Control redacted the two historical reports separately.

## How to verify

Run `npm run check`, `npm run lint`, and `npm test`. For the project annotation, use `pdfinfo -url "$CV_PDF" | rg OwlPath` with the supplied private PDF. The checker can verify the rendered links and privacy assertion in `e2e/site.spec.ts` after the production build.

## Acceptance criteria (self-check)

- ✅ The site-wide test's phone pattern contains only generic numbering rules. The independent tel-link and References-heading checks remain in place.
- ✅ Page two of the supplied PDF links to https://andrewc156.github.io/OwlPath/. The work entry matches the annotation. Both the CV citation and Garden row consume that entry's site link.
- ✅ Astro checked 119 files with zero diagnostics. Lint passed. Vitest passed 458 tests across 18 files.

## Needs Andrew

None for these fixes. The supplied PDF resolves the previous OwlPath link question.

## Requests to Control

Update the shared questions board to mark the OwlPath date, status and link as resolved. Confirm the staged candidate and historical reports are clear of private phone data before pushing.

## Known limitations

Production browser assertions and final content verification are pending the independent checker.
