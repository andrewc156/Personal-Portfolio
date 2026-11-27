# Check report — Issue #15 content and light hero relief — attempt 1

**Verdict:** PASS

## Gates

| Gate | Result |
|---|---|
| Astro check, lint, unit | Passed. Astro reported zero diagnostics, and all 913 Vitest tests passed. |
| Static production build | Passed with `npm run build`. |
| Site, shell, SEO, and axe | Passed all 110 Chromium tests in `e2e/site.spec.ts`, `e2e/shell.spec.ts`, and `e2e/seo.spec.ts`. The axe checks found zero serious or critical issues in both themes. |
| Hero smoke | Passed all five Chromium tests matching `non-blank|caption and link are exact|first frame has several lakes|reduced motion: no autoplay` in `e2e/hero.spec.ts`. |
| Project classification and copy | Passed source and built-HTML assertions. |
| Light relief | Passed independent pixel probe. |
| Full Lighthouse, browser matrix, and frame timing audit | Outside this issue's targeted follow-up. |

## Acceptance criteria

- The tagline stays “Mathematics, statistics, and water.” and is marked confirmed. The current site uses page-specific descriptions, so the tagline approval is recorded in profile data. The existing social-card asset and generator are unchanged.
- The built hero renders “How do we measure the structure hidden in water data?” The full caption remains, and the keywords match the previous profile.
- Mission, About, open-science, and contact text match their previous YAML values and have `confirmed: true`. The contact invitation renders, and the site and About tests pass.
- Rising water appears in the Garden as a project with no research tag or ongoing designation. The RiverNets related-work list excludes the project. Its contextual link to the explorer remains, and the RiverNets research position retains `ongoing: true`. The separate Personal portfolio entry is unchanged.
- Profile ORCID and photo fields are still empty. Teaching remains hidden, and no advisor or poster credits or PDF additions appear in the source diff.
- An independently configured single-cell `MapPainter` rendered flat terrain at channel value 160. In light mode the shadow moved from its prior expected 100 to 115, and the highlight moved from 176 to 172. In dark mode the probe returned the previous exact values of 96 and 206. The changed coefficients apply in `setColors`, outside the frame paint loop.
