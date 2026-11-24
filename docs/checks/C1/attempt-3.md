# Check report — C1 Content update from Andrew's CV — attempt 3

**Verdict: PASS_WITH_NOTES**

## Gates

| Gate | Result |
|---|---|
| Astro check, lint, unit | ✅ Zero diagnostics, lint clean, 458 tests across 18 files |
| Python, Ruff | ✅ 291 passed, one skipped, Ruff clean |
| Build, browser | ✅ Ten pages built. Playwright 115 passed, eight preview-only hosting tests skipped. |
| axe | ✅ Zero serious/critical violations on affected routes in light and dark. |
| Lighthouse | ✅ Eight audited routes, four runs each. All category medians met the ≥95 budgets. |
| Links | ✅ 25 links scanned, no internal failures. |
| Visual | ✅ Reviewed 64 screenshots for Home, Garden, Research, all three research pages, CV and About at 320, 375, 768 and 1280 in light and dark. No clipping, broken fonts or horizontal overflow. |
| Content | ✅ CV, source annotation and rendered pages reconciled. Phone matcher is generic. No phone, References, tel links, draft badges or placeholder text in production. |
| TDA, data | n/a for C1 |

## Acceptance criteria

- ✅ The supplied CV's education, work, research, papers, presentations, projects and skills appear with their source grouping. The eight RiverNets bullets match the source. Confirmed OwlPath URL annotation is linked from the Home, Garden and CV entries.
- ✅ Contact rows align at 320, 375, 768 and 1280. All ten built pages passed privacy and placeholder scans. No downloadable CV or References section appears.
- ✅ Superscript and nonbreaking math formatting render correctly. Production pages have no console errors or third-party runtime requests in the browser checks.
- ✅ Screenshots at all four widths in both themes show no overlap, clipping, broken fonts or overflow. The position metadata reads cleanly at each width.
- ✅ Lighthouse scores meet the F2 budgets on Garden, CV and all three research pages. The run also measured Home and About.

**Notes:** The facts block on topic pages occupies a wider column than the prose at tablet and desktop widths, while staying within the page and remaining legible. This did not cause clipping or overflow.

**Artifacts:** `docs/checks/C1/attempt-3/fresh/` contains the 64 reviewed captures. Browser, Lighthouse and links logs are in `docs/checks/C1/attempt-3/` in the isolated checker copy.
