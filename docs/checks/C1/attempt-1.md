# Check report — C1 Content update from Andrew's CV — attempt 1

**Verdict: FAIL**

Every gate passes. Two blocking issues remain:
1. A number taken from the CV is regrouped on the CV page so that it means something the CV doesn't say.
2. The contact rows are misaligned at 375 px. This counts as a visual FAIL under §11 step 5.

Both fixes are small.

Worktree: `/Users/andrewchincea/personalPortfolio/.claude/worktrees/agent-a302a2e8cd44f54ea` (branch `worktree-agent-a302a2e8cd44f54ea`, uncommitted on top of dc8e61c). I edited no source files: `git status` shows the same 28 modified or deleted files as the builder's diff, plus my `docs/checks/**` files.

## Gates

| Gate | Result | Detail |
|---|---|---|
| check | ✅ | 0 errors, 0 warnings, 0 hints |
| lint | ✅ | Clean (ESLint and Prettier) |
| unit | ✅ | 18 files, 458 passed |
| pytest | ✅ | 291 passed, 1 skipped |
| ruff | ✅ | Clean |
| build | ✅ | 10 pages |
| e2e | ✅ | Whole suite run twice: 114 passed and 8 skipped both times. The 8 skipped are `headers.spec`, which needs `HEADERS_BASE_URL`. |
| headers.spec | ✅ | 8/8 against `wrangler pages dev dist` on port 8788. `/research/tda-rivernets/` returns 404 there. |
| axe | ✅ | Covered by e2e: 0 serious or critical issues, light and dark |
| Lighthouse | ✅ | See below |
| links | ✅ | 25 links, 0 broken. External GitHub links return 200. |
| visual | ❌ | Contact rows misaligned at 375 px (Fix 2) |
| content | ❌ | One regrouped CV number (Fix 1). Greps are clean. |
| JS size | ✅ | Home page JS is about 14.4 KB gzip (Hero 11.1, BaseLayout 0.4, plus settings and colour chunks of 0.9 and 2.0). Other pages load 0.4 KB. No third-party origins. |
| tda | n/a | |
| data | n/a | |

**Lighthouse.** Mobile, `staticDistDir`, 4 runs per URL. The first run is discarded and the score is the median of the other 3 (DECISIONS #50).

| Page | Perf | A11y | BP | SEO | CLS |
|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/garden/` | 100 | 100 | 100 | 100 | 0.0004 |
| `/research/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/research/water-quality/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/research/number-theory/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/research/spectral-fractals/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/cv/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/about/` | 100 | 100 | 100 | 100 | 0.0005 |

Raw results are in `docs/checks/C1/attempt-1/lighthouse-medians.txt` and `lhci/.lighthouseci/`.

## Acceptance criteria

### 1. Facts trace to the CV or §3: ❌ (Fix 1)

I read the CV PDF in full, both as text and as page images, and compared it with the rendered text of all 9 pages (`attempt-1/page-text.txt`).

| CV statement | Where it appears | Match |
|---|---|---|
| Andrew Chincea; achincea@students.kennesaw.edu; linkedin.com/in/andrewchincea; github.com/andrewc156 | Contact on home, About and CV; footer | ✅ |
| Private phone number (redacted) | Nowhere (DECISIONS #68) | ✅ (omitted) |
| Kennesaw State University, Marietta, GA; B.S. Mathematics (Statistics Concentration); B.S. Data Science and Analytics; Expected May 2028 | CV › Education | ✅. Case is "Statistics concentration" as in §3 (note 3). |
| Coursework, three groups, every course listed | CV › Education | ✅ character for character |
| Research interests sentence | CV › Research interests | ✅ exact |
| [1] T. H. Chan and A. Chincea. *Largest kᵗʰ-Power Divisor of a Random Integer.* Submitted. | CV › Publications; home Recent work; Garden; number-theory page | ✅ Author order Chan then Chincea; Andrew in bold; "Submitted." Title characters match; *k* is `<i class="math">k</i>`. The "th" is not superscript (note 1). |
| Undergraduate Researcher – Analytic Number Theory, Aug. 2025 – Present, KSU, Advisor Dr. Tsz Ho Chan | CV › Research experience; number-theory page Position and Advisor | ✅ |
| *O*(log *x*) error term for every integer *k* ≥ 2; experiments on integers up to 10⁸ | number-theory page; CV | ✅ |
| Co-presented k = 2 case with Michael Liu at the 105th MAA SE | CV highlight (name omitted; Liu appears as coauthor on the talk) | ✅ |
| Undergraduate Research Assistant – RiverNets (TDA Lab), Aug. 2026 – Present, Advisor Dr. Mehmet Aktas | water-quality page; CV | ✅ |
| Five variables; smoothness penalty; 28 Colorado River Basin stations; USGS hourly | water-quality page | ✅ |
| MERIT Hydro 90 m; 67,401 nodes compressed to 67; "along with graphs for the Chattahoochee basin" | water-quality page Methods ✅. CV highlight says graphs were built "from MERIT Hydro … for the Colorado and Chattahoochee basins". | ⚠️ (Fix 1b) |
| Kron reduction within 10⁻⁸, about 150× faster | water-quality page | ✅ |
| Benchmarks: OLS, Ridge, Elastic Net, spline GAM, RF, GB; nested LOSO; three-station and whole-subbasin holdouts | water-quality page | ✅ |
| R² = 0.38 (specific conductance) and 0.12 (pH) at unseen stations, versus 0.02 for the best alternative | water-quality page Results ✅. **CV page drops "0.12 for pH" and pairs 0.02 with specific conductance only.** | ❌ (Fix 1a) |
| Leakage overstated R² by up to 0.13 | CV | ✅ |
| ERA5-Land: water-temperature R² 0.863 → 0.892; DO blend R² = 0.748 | water-quality page Results | ✅ |
| Map site with 28 automated tests; technical reports | CV | ✅ |
| First-Year Scholar Undergraduate Researcher, Aug. 2024 – May 2025, KSU, no advisor | spectral page; CV | ✅ |
| Dirichlet problem; numerics; 2-D by separation of variables; poster at 104th MAA SE | spectral page; CV | ✅ |
| Talk "Largest Square Divisor of a Random Integer", with M. Liu, Statistics & Data Applications session, 105th MAA SE, Univ. of North Alabama, Florence, AL, Mar. 2026 | Garden, home, number-theory page, CV | ✅ |
| Poster "RiverNets: Graph-Laplacian Regression … in the Colorado River Basin", with Y. Kaya, KSU Fall Analytics Day, Kennesaw State University, Kennesaw, GA, Dec. 4, 2026 | Garden, home, water-quality page, CV ("Dec 2026") | ✅ title exact |
| Poster "Properties of Eigenvalues of Fractal Laplacian", 104th MAA SE, High Point University, High Point, NC, Mar. 2025 | Garden, spectral page, CV | ✅ |
| OwlPath, Nov. 2026 – Present, three KSU majors, mark courses and see next-term classes | Garden, home, CV | ✅. No link; the URL isn't in the CV. |
| NYC Subway Incident Modeling, Jan. 2026 – May 2026, R/Quarto, MTA 2015–2024, weather and ridership | Garden, CV | ✅ |
| AskScrappy, Aug. 2024 – Dec. 2024, LangChain, Ollama, LLaMA 3.1, local | Garden, CV | ✅ |
| Technical skills: 4 groups, every item | CV › Technical skills | ✅. Items are exact; group labels are sentence-cased (note 3). |
| Graduation Services Student Assistant (Federal Work-Study), Aug. 2026 – Present, KSU Office of the Registrar, 3 bullets | CV › Work experience | ✅ |
| References (Chan, Aktas) | Nowhere (DECISIONS #68) | ✅ (omitted) |

Facts from §3 rather than the CV:
- "Rising water" project (Nov 2026)
- "Junior in the 2026–27 academic year"
- Hero keywords
- Tagline and hero question

All of these are ✅.

The mission, bio and Open-science sentence contain only CV or §3 facts and remain `confirmed: false` ✅.

I checked the venues against the MAA Southeastern Section's own pages:
- The 105th meeting was at the University of North Alabama, Florence, Mar 26–28, 2026.
- The 104th was at High Point University, Feb 27 – Mar 1, 2025. That fits "Mar 2025".

### 2. Privacy: ✅
- The search for private phone digits and tel: links in dist, src and public returned no matches. The literal search terms have been redacted.
- `find public dist -iname '*.pdf'` returns nothing.
- No "References" anywhere in `dist`.
- The only "pdf" in `dist` HTML is the skill "pdfplumber". There is no CV PDF link.

### 3. Structure: ✅
- 8 work items: paper 1, poster 2, talk 1, project 4. None is a draft: `grep "draft: true" src/content` returns nothing.
- Research slugs are exactly `water-quality`, `number-theory` and `spectral-fractals` (`dist/research/`).
- `/research/tda-rivernets/` returns 404 on both preview and wrangler.
- Rising water is tagged `water-quality`. `/research/water-quality/` links to `/rising-water/` twice.
- No second number-theory paper.
- Garden filters (my `tools/c1/structure.mjs` and `garden2.mjs`):

  | Filter | Visible rows |
  |---|---|
  | `?type=project` | 4, including untagged OwlPath, NYC and AskScrappy |
  | `?tag=water-quality` | 2 |
  | `?tag=number-theory&type=paper` | 1 |
  | Clicking the chips | Updates the URL and the count |
  | No JS (`?type=talk`) | All 8 |
- Home `#teaching` is absent. `#contact` has exactly mailto, GitHub and LinkedIn.
- CV h2 order: Contact (visually hidden), Education, Research interests, Publications and preprints, Research experience, Presentations, Projects, Technical skills, Work experience. That is the CV's order, minus References ✅.

### 4. Gates
- Steps 1, 2, 3, 4, 6 and 9 ✅ (see the Gates table).
- Step 5 ❌: Fix 2.

I took 36 full-page PNGs: /, /garden/, /research/water-quality/, /research/number-theory/, /cv/ and /about/, at 375, 768 and 1280, in light and dark. I opened every one, plus tiles of the 5614 px-tall CV at 375.
- An overflow probe reports `scrollWidth == clientWidth` and no element past the right edge on any of them.
- Long titles wrap cleanly: the RiverNets poster, "Undergraduate Research Assistant – RiverNets (TDA Lab)" and the kth title.

### 5. Base-path build: ✅
`BASE_PATH=/Personal-Portfolio/ SITE_URL=https://andrewc156.github.io npm run build` succeeds.
- No `href`, `src`, `action`, `content` or `data-*` attribute starts with `/` without the base.
- The `links.site` of Rising water renders as `/Personal-Portfolio/rising-water/`.
- `og:url` is `https://andrewc156.github.io/Personal-Portfolio/cv/`.
- I then rebuilt with the default settings: `dist/index.html` has `href="/garden/"` and 0 occurrences of `Personal-Portfolio/_astro`.

## Blocking fixes (owner: site-builder)

### 1. CV-page RiverNets highlights regroup CV facts

**a. R² comparator.** `src/content/research/water-quality.yaml:30`
- **Expected** (as in the CV): "…the graph model reached R² = 0.38 for specific conductance and 0.12 for pH at unseen stations, versus 0.02 for the best alternative."
- **Actual:** "…at unseen stations the graph model reached R² = 0.38 for specific conductance, versus 0.02 for the best alternative."
- **Problem:** Dropping the pH figure ties 0.02 to specific conductance alone, which the CV doesn't say.
- **Fix:** Restore "and 0.12 for pH", or end the sentence before "versus".

**b. MERIT Hydro attribution.** `src/content/research/water-quality.yaml:28`
- **Expected** (matches the CV and this page's own Methods bullet): "Built river-network graphs in NetworkX from MERIT Hydro 90 m flow directions for the Colorado basin, along with graphs for the Chattahoochee basin."
- **Actual:** "…from MERIT Hydro 90 m flow directions for the Colorado and Chattahoochee basins."
- **Problem:** The CV doesn't say the Chattahoochee graphs came from MERIT Hydro.

**Reproduce:** `npm run build && npx astro preview --port 4321`, then open `/cv/` → Research experience → the first entry's 3rd and 5th bullets. Compare with CV page 1, RiverNets bullets 3 and 5.

### 2. Contact rows misaligned at 375 px on `/`, `/about/` and `/cv/`

**Where:** `src/components/content/ContactLinks.astro:31-43`

**Actual:**
- Each row is `display:flex; flex-wrap:wrap` with `dt { min-width: 6rem }`, so whether a value wraps depends on its length.
- At 375 px, Email and LinkedIn wrap below their labels: the value starts at x≈16 px. GitHub stays inline: the value starts at x≈124 px.
- The three values therefore sit in two different columns. See `attempt-1/about-375-light.png` and `about-375-dark.png` (Contact block), `home-375-*.png` (bottom) and `tiles/cv-375-light-part0.png`.

**Expected:** Every row uses the same layout at a given width. Either:
- below a breakpoint (for example, `@media (max-width: 30rem)`), every `dt` sits on its own line, using `flex-basis: 100%` or `flex-direction: column`; or
- the `dl` is a two-column grid with `minmax(0,1fr)` values and `overflow-wrap:anywhere`.

768 and 1280 px are already aligned and must stay that way.

**Reproduce:**
1. `npm run build && npx astro preview --port 4321`
2. `node docs/checks/tools/c1/shots.mjs docs/checks/C1/attempt-1`
3. Open `about-375-light.png`. Or in DevTools at 375 px, compare `getBoundingClientRect().left` of the three `.contact-links dd a`: they are about 16, 124 and 16.

## Notes (non-blocking)

1. **kth-power title typography.** The CV sets the title as *Largest k*<sup>th</sup>*-Power Divisor…*, with a superscript "th". The site renders an italic *k* followed by a normal "th". The characters match and the plain-text label and meta read "kth". If Control wants the CV's exact typography, `MathText` or the content could render "th" as `<sup>`. Worth folding into the Fix 1 round.
2. **Item order inside sections differs from the CV.** Sections are in CV order, as required.
   - Research experience: the CV lists number theory (Aug 2025) before RiverNets (Aug 2026); the site follows the research-area `order` (RiverNets first).
   - Presentations: the CV lists the talk first; the site sorts newest first.
   - Projects add Rising water, from §3.
3. **Capitalisation.**
   - "Statistics concentration" follows §3; the CV has "Statistics Concentration".
   - Skill group labels are sentence case ("Data analysis & machine learning", "Tools & platforms"); the CV uses title case.
4. **Cosmetic.**
   - At 1280 px the research-page Position row runs past the ≈68ch measure the prose uses. The `dl` isn't width-limited.
   - "(R² =" and "0.748)" break across lines at 375 and 1280 px; a non-breaking space would keep them together.
5. **Builder's report.** Its claims match what I reproduced: counts, order, date ranges, contact, absence of teaching, the e2e assertions, and no `tda-rivernets` in `dist` (it remains only in the intentional 404 test in `e2e/seo.spec.ts`). Its Needs-Andrew list is accurate: OwlPath URL, spectral advisor, draft copy, hero keywords.
6. **Default build `og:url`.** It uses `http://localhost:4321` because `SITE_URL` is unset. This predates C1 and is by design (§7).

## Artifacts
All under `/Users/andrewchincea/personalPortfolio/.claude/worktrees/agent-a302a2e8cd44f54ea/docs/checks/`.

In `C1/attempt-1/`:
- Logs: `check.log`, `lint.log`, `unit.log`, `pytest.log`, `ruff.log`, `build.log`, `e2e-run1.log`, `e2e-run2.log`, `headers.log`, `links.log`, `build-basepath.log`, `build-final.log`
- Lighthouse: `lighthouse-medians.txt`, `lhci/.lighthouseci/`
- Content: `page-text.txt` (rendered text, headings and links of all 9 pages)
- Overflow probe: `overflow.log`
- Screenshots: 36 PNGs named `{home,garden,water-quality,number-theory,cv,about}-{375,768,1280}-{light,dark}.png`, plus `tiles/cv-375-*-part*.png`

In `tools/c1/` (my checker tools):
- `dump-text.mjs`, `structure.mjs`, `garden2.mjs`, `shots.mjs`, `crop.py`
- `lhci-collect.cjs`, `lh-median.py`, `pw-nowebserver.config.ts`

Final state: no preview, wrangler or workerd process is running; port 4321 is free; `dist/` is the default (root-base) build.

Sources:
- [MAA Southeastern Section — 2026 Section Meeting](https://southeastern.maa.org/events/2026-section-meeting)
- [MAA Southeastern — 2025 Section Meeting](https://maasoutheastern.org/2025-section-meeting)
- [MAA-SE 2025 spring newsletter](https://maasoutheastern.org/2025-spring-newsletter.pdf)
