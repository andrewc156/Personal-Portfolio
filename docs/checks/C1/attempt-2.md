# Check report — C1 Content update from Andrew's CV — attempt 2

**Verdict: FAIL**

Both attempt-1 blockers pass on the fresh build. Two issues remain before this feature can be pushed to the public repository.

## Blocking fixes

1. **Private phone digits in the proposed commit.** The matcher at `e2e/site.spec.ts:59` embeds Andrew's actual number. The prior reports also reproduce it at `docs/builds/C1/attempt-1.md:105` and `docs/checks/C1/attempt-1.md:58,102`. Compare these lines locally with the private CV. Use a generic phone-number check and redact the prior reports before public integration. Recheck the staged content, including reports. All ten production HTML files passed the private-number and reference-contact scan.
2. **Missing confirmed project link.** At `src/content/work/project-owlpath.yaml:10` the links mapping is empty. Run `pdfinfo -url` on the original CV. The page-two OwlPath annotation points to `https://andrewc156.github.io/OwlPath/`. The built Garden row and CV entry have no project link. Set the confirmed site URL and verify the rendered project links.

## Gates

| Gate | Result |
|---|---|
| Astro check, lint, unit | ✅ Zero diagnostics, lint clean, 458 tests across 18 files |
| Python, Ruff | ✅ 291 passed, one skipped, Ruff clean |
| Build, browser | ✅ Ten pages. Playwright 114 passed, eight hosting tests skipped on preview. All eight passed separately against Wrangler at 127.0.0.1:4321. |
| axe | ✅ Zero violations on five affected routes at 375 and 1280 in both themes, zero console errors or third-party requests in those 20 runs |
| Lighthouse | ✅ All four category medians were 100 on eight affected routes. Garden CLS 0.0031, others 0.0001. One warm-up discarded plus three measured runs per route. |
| Links and size | ✅ 25 internal links scanned. All emitted JavaScript combined was 26,952 bytes gzip. |
| Visual | ✅ Reviewed all 64 fresh full-page captures of eight routes at 320, 375, 768 and 1280 in both themes. Zero horizontal overflow. |
| Content | ❌ Confirmed project URL omitted and private phone persisted in repository-bound files |
| TDA, data | n/a for C1 |

## Acceptance criteria

- ✅ Compared built pages with the two-page source CV. Education, research interests, submitted paper, three positions, three presentations, project descriptions, skills and employment trace to the supplied CV or spec §3. The 8 RiverNets CV bullets match the source after normalizing spacing and typesetting. The Colorado graph sizes and the two outcome figures retain their source grouping.
- ✅ Three merged/revised research topics, eight Garden items, four projects, two water-quality-tagged items, one number-theory paper, eight items with JavaScript disabled. The old topic is absent from built pages. Subject advisors and citation author order agree with the source.
- ❌ OwlPath's project date, status and description agree with the source. The PDF annotation is missing from the project entry.
- ✅ Profile, mission, About, three public contact links, hidden teaching section, CV headings and employment dates checked. All ten HTML pages are clear of visible placeholders, draft badges, reference contacts and phone links. No public PDF exists.
- ✅ Contact values align on home, About and CV. The three values start at x=16 at 320 and 375, x=139 at 768 and x=212 at 1280. Position blocks fit their prose measure. Screenshots show clean wrapping in both themes.
- ✅ The five expected routes render superscript “th”. The CV and water-quality topic both use nonbreaking spaces around the equals sign in the two R² expressions.
- ❌ The proposed public test and historical reports contain private contact data. See fix 1.

**Artifacts:** Fresh screenshots, browser geometry, gate logs, HTML checks and Lighthouse medians are under `docs/checks/C1/attempt-2/fresh/`. No prior run's screenshots or scores were used.
