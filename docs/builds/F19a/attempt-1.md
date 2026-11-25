# Build report — F19a First-person copy voice — attempt 1

Summary: I rewrote the site's prose in Andrew's first person ("I study…", "I work on…"), warm but academic, using the humanizer rules (DECISIONS #85). That covers the Mission, About and Open science copy, the research-area summaries and descriptions, the work-item descriptions, and the visible prose on the Garden, About and research topic pages. The one new fact (DECISIONS #86) appears as the last sentence of the About bio and as a new Contact lead-in on the home page. No headings, sections or citation fields (titles, venues, dates, authors, links) changed. All copy stays `confirmed: false`. The "Related work →" link keeps its visible text, but its accessible name changes from "Related work on Water-quality prediction on river networks" to "Related work: Water-quality prediction on river networks".

Files changed:
- src/data/copy.yaml: rewrote mission, about_bio and open_science, and added a `contact` entry (`confirmed: false`)
- src/content/research/{water-quality,number-theory,spectral-fractals}.yaml: `summary` and `description` only (methods, results and CV highlights unchanged)
- src/content/work/*.yaml (all 9): `description` only
- src/components/content/work.ts: `getCopy` id union now includes `'contact'`
- src/components/content/ResearchCard.astro: the "Related work" accessible name now comes from `aria-label` (it was CSS-hidden text)
- src/components/home/Contact.astro: renders the new lead-in paragraph above the links
- src/pages/garden/index.astro: lede and empty-state text
- src/pages/about/index.astro: the paragraph of links under the bio
- src/pages/research/[slug].astro: Rising water link sentence and the "no related work" empty state
- e2e/site.spec.ts: stronger assertions (see below). No existing assertion was weakened.
- docs/builds/F19a/attempt-1.md (this report)

How to verify:
```
npm run check        # 0 errors, 0 warnings, 0 hints
npm run lint         # eslint clean; prettier clean
npm test             # 810/811 pass; the 1 failure is F19b's in-progress file (see Known limitations)
npx vitest run --exclude 'tests/unit/viz/modes/**'   # all F19a-relevant suites pass
git diff -- src/data src/content src/components/content src/components/home src/pages/{garden,about,research} e2e/site.spec.ts
# Checker: npm run e2e -- e2e/site.spec.ts (new assertions on the Garden lede, About bio, Contact lead-in and Related work accessible names)
```
Dev self-check on `npx astro dev --port 4417 --ignore-lock`: 4411 held the Astro dev lock and I didn't touch it. `--ignore-lock` runs a second server without stopping it. I checked `/`, `/about/`, `/garden/`, `/research/water-quality/`, `/research/number-theory/` and `/cv/` at 1280 and 375. There was no horizontal overflow (scrollWidth was 375 at 375). The text wraps cleanly in the cards, the Contact section and the About page. The 4417 server is stopped; 4411 is still up.

Acceptance criteria (self-check):
- ✅ Prose is in the first person, warm but academic: Mission, About, Open science, Contact lead-in, research summaries and descriptions, Garden lede, topic-page sentences.
- ✅ Humanizer pass: none of the listed AI-isms appear (pivotal, testament, landscape, vibrant, showcase, delve, crucial, key, underscore, foster, "serves as", -ing tack-ons, "not just…", rhetorical questions, signposting, "in order to"). The new copy has no em dashes. Headings were already sentence case and are unchanged. I removed "spans" and the noun-phrase fragments and varied sentence openers. Final "what still sounds AI?" pass: "on…on…on" in the About bio became "in analytic number theory and in predicting water quality…". "Everything I've worked on." was a fragment and became "This is everything I've worked on." The personal-portfolio fragment became a full sentence.
- ✅ No new facts beyond §3, content files and DECISIONS. The only addition is #86, worded "I'm interested in mathematics and data science REUs and, later, PhD programs." It doesn't say he's applying and names no field, schools or dates. "In my first year" (Mission) comes from the First-Year Scholar position (Aug 2024–May 2025) plus junior standing in 2026–27. "I expect to graduate in May 2028" is `expected_graduation` in profile.yaml.
- ✅ Citation fields are byte-identical: titles, venues, dates, authors, links and tags (`git diff` touches only `description`/`summary` lines in the content files).
- ✅ The Personal portfolio description no longer overlaps Rising water: it no longer mentions terrain or the explorer.
- ✅ The CV stays formal. Bullets, interests, skills and job text are unchanged. Project descriptions show on the CV, so I kept the three projects that had no "I" free of it.
- ✅ Hero question and tagline (profile.yaml) are unchanged.
- ✅ Every draft string stays `confirmed: false`, including the new `contact` entry.
- ✅ Accessibility: heading order is unchanged and no headings were added. Link text is meaningful. The Related work accessible names are "Related work: <area>" (checked in Chrome's AX tree), and the visible text "Related work" is still at the start of the name (label-in-name). The new contact paragraph is real DOM text, not CSS-only text.
- ✅ The About meta description (Seo.astro clamp at 160 characters) cuts at the first sentence: "I'm an undergraduate at Kennesaw State University, working toward a B.S. in Mathematics (Statistics concentration) and a B.S. in Data Science and Analytics." (156 characters). Every work description is ≤ 160 characters, and so is every research summary (the schema max).
- ✅ Tests: e2e/site.spec.ts now asserts the exact Garden lede, the exact Contact lead-in, the About bio's first-person opener and REU sentence (and no "apply"), and each card's exact accessible name `Related work: <title>`. The existing `/^Related work/` and `'See this area in the Garden'` assertions still hold. No test outside my paths asserts old copy text (grep across e2e/ and tests/).
- ✅ check, lint: clean. ⚠️ unit: 810/811, and the one failure isn't from F19a (see Known limitations).

## Before → after (for Andrew's approval)

| Where | Before | After |
|---|---|---|
| copy.yaml `mission` (home #mission) | Andrew Chincea studies mathematics (statistics concentration) and data science and analytics at Kennesaw State University. His primary research, on the RiverNets project in the KSU TDA Lab, uses graph-Laplacian regression to predict water quality at river stations with no data. He also works in analytic number theory and has studied eigenvalues of the fractal Laplacian. | I'm a junior at Kennesaw State University, studying mathematics (statistics concentration) and data science and analytics. My main research is on RiverNets, a project in the KSU TDA Lab, where I use graph-Laplacian regression to predict water quality at river stations that have no data. I also work in analytic number theory, and in my first year I studied eigenvalues of the fractal Laplacian. |
| copy.yaml `about_bio` (/about/) | Andrew Chincea is an undergraduate at Kennesaw State University studying mathematics (statistics concentration) and data science and analytics. His research spans water-quality modeling on river networks, analytic number theory, and spectral analysis on fractals. | I'm an undergraduate at Kennesaw State University, working toward a B.S. in Mathematics (Statistics concentration) and a B.S. in Data Science and Analytics. I expect to graduate in May 2028. My research is in analytic number theory and in predicting water quality on river networks. Before that, as a First-Year Scholar, I studied spectral analysis on fractals. I'm interested in mathematics and data science REUs and, later, PhD programs. |
| copy.yaml `open_science` | The source code for this site is public, including the data pipeline and the persistence engine behind the Rising water explorer. | I've made the code for this site public, including the data pipeline and the persistence engine behind the Rising water explorer. |
| copy.yaml `contact` (new; home #contact lead-in) | (none) | I'm interested in mathematics and data science REUs and, later, PhD programs. If you'd like to talk about either, here's how to reach me. |
| research/water-quality `summary` | Predicting hourly water quality at river stations with no data, using graph-Laplacian regression on the river network. | I use graph-Laplacian regression on river networks to predict hourly water quality at stations that have no data. |
| research/water-quality `description` | RiverNets, a project in the TDA Lab at Kennesaw State University, predicts hourly water quality (water temperature, dissolved oxygen, specific conductance, pH and turbidity) at river stations with no data, using a smoothness penalty along the river network. | I work on RiverNets, a project in the TDA Lab at Kennesaw State University. The model predicts five measurements (water temperature, dissolved oxygen, specific conductance, pH and turbidity) with a smoothness penalty along the river network. |
| research/number-theory `summary` | The largest *k*^th^-power divisor of a random integer, the subject of a submitted manuscript. | I study the largest *k*^th^-power divisor of a random integer. |
| research/number-theory `description` | The submitted manuscript Largest *k*^th^-Power Divisor of a Random Integer establishes an asymptotic formula with an *O*(log *x*) error term for every integer *k* ≥ 2. | In our submitted manuscript, "Largest *k*^th^-Power Divisor of a Random Integer," Dr. Tsz Ho Chan and I establish an asymptotic formula with an *O*(log *x*) error term for every integer *k* ≥ 2. |
| research/spectral-fractals `summary` | First-Year Scholar research on eigenvalues of the fractal Laplacian. | As a First-Year Scholar, I studied eigenvalues of the fractal Laplacian. |
| research/spectral-fractals `description` | How fractal geometry shapes the spectrum of the fractal Laplacian, from the one-dimensional Dirichlet eigenvalue problem to two dimensions. | I looked at how fractal geometry shapes the spectrum of the fractal Laplacian. I started from the Dirichlet eigenvalue problem in one dimension and then extended the analysis to two. |
| work/paper-kth-power-divisor | An asymptotic formula with an *O*(log *x*) error term for every integer *k* ≥ 2. | We establish an asymptotic formula with an *O*(log *x*) error term for every integer *k* ≥ 2. |
| work/poster-fractal-laplacian-2025 | First-Year Scholar research on eigenvalues of the fractal Laplacian. | Results from my First-Year Scholar research on eigenvalues of the fractal Laplacian. |
| work/poster-rivernets-analytics-day-2026 | Graph-Laplacian regression that predicts water quality at unmonitored river stations in the Colorado River Basin. | Yunus Kaya and I present graph-Laplacian regression for predicting water quality at unmonitored stations in the Colorado River Basin. |
| work/talk-maa-southeastern-2026 | The square-divisor case (*k* = 2) of the largest *k*^th^-power divisor of a random integer. | Michael Liu and I presented the square-divisor case (*k* = 2) of the largest *k*^th^-power divisor of a random integer. |
| work/project-askscrappy | A local RAG academic-advising assistant built with LangChain, Ollama and LLaMA 3.1 that runs entirely on local hardware. | An academic-advising assistant built with LangChain, Ollama and LLaMA 3.1. It uses retrieval-augmented generation and runs entirely on local hardware. |
| work/project-nyc-subway | Regression models in R and Quarto relating weather and ridership to NYC subway disruptions, using MTA major-incident records for 2015–2024. | Regression models in R and Quarto that relate weather and ridership to NYC subway disruptions, using MTA major-incident records for 2015–2024. |
| work/project-owlpath | An interactive prerequisite map for three KSU majors; students mark completed courses and see which classes they can take next term. | An interactive prerequisite map for three KSU majors. Students mark the courses they've finished and see which classes they can take next term. |
| work/project-personal-portfolio | An academic website for my research, projects, and CV, with interactive terrain animations and a Colorado River Basin explorer. | This is the site you're reading. It collects my research, projects and CV. |
| work/project-rising-water | This site's interactive explorer of persistent homology, shown as water rising over terrain with a live barcode. | An interactive explorer of persistent homology: water rises over Colorado River Basin terrain while a barcode updates live. |
| Garden lede (/garden/) | All of Andrew Chincea's work. Submitted work, which has no date yet, comes first; everything else is newest first. | This is everything I've worked on. Submitted work has no date yet, so it comes first. The rest is newest first. |
| Garden lede, other branches (not rendered today) | "Undated work comes first; everything else is newest first." | "Undated work comes first. The rest is newest first." ("Newest first." unchanged) |
| Garden empty state | Nothing matches these filters yet. Show all work | Nothing matches these filters. Show all work |
| About, link paragraph | See the research areas, the Garden of work, or the CV. | You can also browse my research areas, the Garden of everything I've worked on, or my CV. |
| Topic page /research/water-quality/ | The Rising water explorer on this site is built from elevation data for the Colorado River Basin study area (RiverNets coverage). | I built the Rising water explorer on this site from elevation data for the same Colorado River Basin study area that RiverNets covers. |
| Topic page empty state (not rendered today) | No work in this area is listed yet. | I haven't listed any work in this area yet. |
| Research card link, accessible name (visible text unchanged: "Related work →") | Related work on Water-quality prediction on river networks | Related work: Water-quality prediction on river networks |

Unchanged on purpose: tagline, hero question, keywords, every heading, "All work →", "See this area in the Garden →", the noscript note, every CV bullet, research interests, skills, work experience, research `methods`/`results`, page meta descriptions in Control-owned files.

Needs Andrew:
- Approve or edit each "After" string above. All of them stay `confirmed: false`, including the new Contact lead-in.
- The Contact lead-in ends with "If you'd like to talk about either, here's how to reach me." That's an invitation, not a fact. Keep it, or cut it to just the REU/PhD sentence?
- "My main research is on RiverNets" restates §3's "primary research focus". Confirm that's still true.
- QUESTIONS.md (Control-owned) should list the new `contact` copy entry under "Copy choices".

Requests to Control:
1. docs/QUESTIONS.md, under "## Copy choices", add:
   `- [ ] Contact lead-in in \`src/data/copy.yaml\` (\`contact\`), from DECISIONS #86. Draft: "I'm interested in mathematics and data science REUs and, later, PhD programs. If you'd like to talk about either, here's how to reach me."`
   and change `- [ ] Mission paragraph (draft written from §3 facts only)` / `- [ ] About bio (draft from §3)` to `… (first-person rewrite, F19a)`.
2. Optional, src/pages/index.astro line 19 (home meta description, Control/F1). It's still third person, which is fine for search snippets. If you want it to match the voice, a ≤160-character option: ``const description = `I'm ${displayName}, a math and data science student at Kennesaw State University. I research water quality, topological data analysis and number theory.`;`` (152 chars). I'd lean toward keeping third person for search results. Your call.
3. Optional, the research index meta (`${displayName}'s research areas.`) and Garden meta description stay third person. Same reasoning, no change requested.
4. No test outside my paths asserts the old copy (grep of e2e/ and tests/), so no test changes are needed elsewhere.

Known limitations:
- `npm test` has 1 failure, `tests/unit/viz/modes/meta.test.ts` ("keeps the §6.3 caption exactly"). It comes from F19b's uncommitted edit to `src/lib/viz/hero/modes/meta.ts` (a new hero caption), not from F19a. F19a touches no viz files. The other 810 tests pass.
- I didn't run e2e (checker only). The new site.spec.ts assertions are checked against the dev DOM and Chrome's accessibility tree, not under Playwright.
- `astro dev --port 4417` needed `--ignore-lock` because the 4411 session holds Astro's dev lock file. I didn't stop or replace that server.
- Project descriptions are shared between the Garden and the CV. I kept the three neutral ones without "I" so the CV reads formally. "Personal portfolio" ("This is the site you're reading… my research…") is the one first-person line in the CV Projects list. It already said "my research" before F19a.
