# Build report — F2 Content and pages — attempt 1

Summary: I added the content collections (`src/content.config.ts`) with zod schemas per §7. Titles are required unless the item is a draft, and dates are required for paper, preprint, poster and talk unless it's a draft. The content is exactly the six §3 work items and the four research areas. The new pages are `/garden/` (filter chips, `?type=`/`?tag=` deep links, no-JS fallback), `/research/` plus four topic pages, `/cv/` and `/about/`. I filled F1's home stubs: Mission, Recent work, Research cards with deterministic generative SVG thumbnails, Open science, and Teaching and Contact, which render nothing while empty. Drafts appear only in `astro dev`, with a "Draft" badge. I wrote `e2e/site.spec.ts` (26 tests) but did not run it, per the rules.

Files changed:
- **Content config:** `src/content.config.ts`. Collections `work` and `research` use `glob()`; `copy` and `repos` use `file()` on `src/data/`.
- **Work items:** `src/content/work/`:
  - `poster-fractal-laplacian-2025.yaml`
  - `talk-maa-southeastern-2026.yaml`
  - `poster-rivernets-analytics-day-2026.yaml`
  - `preprint-number-theory.yaml`
  - `project-owlpath.yaml`
  - `project-rising-water.yaml`
- **Research areas:** `src/content/research/{water-quality,tda-rivernets,number-theory,spectral-fractals}.yaml`
- **Data:**
  - `src/data/copy.yaml`: mission, about bio and open-science copy, all `confirmed: false`.
  - `src/data/open-science.yaml`: repo entries with empty URLs.
  - `src/data/teaching.yaml`: empty.
  - `profile.yaml` is unchanged.
- **Content components:** `src/components/content/`:
  - `constants.ts` (types, slugs, labels)
  - `format.ts` ("Mon YYYY", sort order, Andrew-name match)
  - `work.ts` (collection access; drafts only when `import.meta.env.DEV`)
  - `thumb.ts` (FNV-1a + mulberry32 seeded SVG)
  - `garden-client.ts` (filters, about 1 KB)
  - `contact.ts`, `content.css`
  - `Citation.astro`, `WorkRow.astro`, `ResearchCard.astro`, `ResearchThumb.astro`, `DraftBadge.astro`, `ContactLinks.astro`
- **Home sections:** `src/components/home/{Mission,RecentWork,ResearchGrid,OpenScience,Teaching,Contact}.astro`. Each keeps the `id` prop on its root `<section>`.
- **Pages:**
  - `src/pages/garden/index.astro`
  - `src/pages/research/index.astro`
  - `src/pages/research/[slug].astro`
  - `src/pages/cv/index.astro`
  - `src/pages/about/index.astro`
- **Tests:** `e2e/site.spec.ts`
- **Self-check screenshots** (dev server, drafts visible): `docs/builds/F2/screens/{home,garden,research_tda-rivernets,cv}-{375,768,1280}-{light,dark}.png`. The home ones are named `_-*.png`.

How to verify:
- `npm run check`: 0 errors, 0 warnings, 2 hints (both in the checker's `docs/checks/tools/*.mjs`).
- `npm run lint`: clean.
- `npm test`: 281/281. These are F3's tests; F2 adds no unit tests, see Requests.
- Checker: `npm run build && npx playwright test e2e/site.spec.ts`, plus `LHCI_URLS=/garden/,/cv/,/research/tda-rivernets/ npm run lhci`.
- Self-check on `npx astro dev --port 4402` with an ad-hoc Playwright and axe script (not the suite):
  - axe found **0 violations of any impact** on `/`, `/garden/`, `/garden/?tag=water-quality`, `/research/`, the 4 topic pages, `/cv/` and `/about/`, at 375/768/1280 in both themes.
  - Horizontal overflow was 0 everywhere.
  - Filters:
    - `?type=poster` → 2 rows.
    - Then clicking "Number theory" → URL `?type=poster&tag=number-theory`, 0 rows, the empty state shows, and status reads "Showing 0 of 6 items".
    - "Show all work" → `/garden/` with 6 rows.
  - Keyboard: 12 Tabs reach the "Posters" chip. Enter filters, focus stays on the chip, and the outline is solid. Back restores `/garden/` with all rows.
  - No-JS: `?type=talk&tag=water-quality` shows all 6 rows and the empty state stays hidden.
  - Grepping the visible text of every page for TODO/TBD/lorem/placeholder found 0 hits.

Acceptance criteria (self-check):
1. ✅ Schemas follow §7 (`workSchema` in `src/content.config.ts`, with `superRefine` for required-unless-draft). There are exactly 6 work items, one per §3 bullet; the e2e test asserts the type counts poster 2, talk 1, preprint 1, project 2.
   - These items have their [A] fields empty and `draft: true`:
     - Talk: title empty.
     - Analytics Day poster: title empty.
     - Preprint: title, date and links empty.
     - OwlPath: date and links empty, no status field.
   - Nothing appears beyond §3. Collaborators appear only as coauthors on their draft items.
2. ✅ (dev) / pending the checker (build).
   - `getWork()` filters `draft` unless `import.meta.env.DEV`, and the badge `[data-draft-badge]` shows in dev (screenshots).
   - The e2e tests "no draft items or Draft badges in the build" and "visible text in dist/ …" cover the production side.
   - I didn't run a build, per the rules. The production Garden will list 2 items: the fractal poster and Rising water.
3. ✅ Garden:
   - Chips are links (`/garden/?type=…`), so they work and are keyboard-operable without JS. JS filters in place with `pushState` and `popstate`.
   - Active chips get `aria-current="true"`. Counts are announced in a `role="status"` line.
   - Unknown values are ignored; valid values with no items show the empty state.
   - Rows follow §4.1: mono uppercase type tag → title → description · venue → `<time>` "Mon YYYY". The whole row is one link, to the item's own link or else its first topic page.
4. ✅ Research cards and topic pages:
   - Cards have a linked heading, a one-liner, "Related work →" to `/garden/?tag=<slug>`, and an inline SVG thumbnail. The thumbnail is generated at build time from `hashString(slug)` and uses theme tokens; there are no images and no runtime JS.
   - Topic pages have About, Methods (only if any are known, so none right now) and Related work as citations, plus a Garden link.
   - `/research/tda-rivernets/` links to `/rising-water/`.
5. ✅ Citations show authors with Andrew in `<strong>`, "(Mon YYYY)", the title (linked when `links.site` exists) and the venue in `<em>`. Buttons PDF/DOI/Preprint/Code/Data/Slides/Poster appear only for links that are set; none are set now.
6. ✅ The CV is built from profile and content: Education, Research, Publications and preprints, Presentations, Projects. Sections with no items are omitted. The PDF link appears only when `profile.cv_pdf` is a URL or a file that exists under `public/`; it's empty now, so there's no link.
7. ⏳ For the checker (Lighthouse). axe is clean, every page has a title and meta description, link text is descriptive, and there are no console errors in dev.

Decisions (please log in DECISIONS.md):
- **Research slugs:** `water-quality`, `tda-rivernets`, `number-theory`, `spectral-fractals`.
- **Research areas are non-draft.** Their one-liners are [C]. The [A] parts (topic, advisor, methods, longer description) are optional empty fields that don't render.
- **Rising water is non-draft and undated.** The date is optional for projects. Set `date` when F6 passes.
- **OwlPath is `draft: true`** because its status, link and date are [A]. Its title and description are kept.
- **The fractal poster lists only Andrew as author.** §3 names no coauthors; Andrew should confirm.
- **Sort order:** undated (ongoing) items first, then newest first.
- **Dev-only text:** drafts with an empty title show "Title needed" in dev only.
- **Number theory one-liner:** "One preprint, with a second paper in progress." I left out "expected early 2027" because whether to list that paper is [A].

Needs Andrew:
- Titles: the Michael Liu talk, the Yunus Kaya poster, and the preprint (plus its date, link and coauthors).
- OwlPath status, link and date.
- Fractal poster: confirm Andrew is the sole author (or name the coauthors or advisor) and whether to add a poster PDF.
- Research areas:
  - water quality: topic, advisor, data, methods;
  - RiverNets: description paragraph, advisor;
  - number theory: whether to mention or list the in-progress paper;
  - methods for any area.
- Copy approvals (all `confirmed: false`): mission paragraph, About bio, and the Open science sentence "The source code for this site is public, including the data pipeline and the persistence engine behind the Rising water explorer."
- Repository URL to show. Open science and the footer show no links until `src/data/open-science.yaml` URLs (or `profile.site.source_url`) are set.
- Contact links (email, GitHub, LinkedIn, ORCID) and the CV PDF. The Contact and About contact sections stay hidden until these exist.
- Teaching and outreach entries, if any.

Requests to Control:
1. Add the new open items to `docs/QUESTIONS.md`: fractal poster authorship, Open science copy, and the repo URL for Open science.
2. Optionally allow `tests/unit/content/**` for F2, so `format.ts` and `thumb.ts` (pure functions) can get Vitest tests. Determinism is covered in e2e for now.
3. `/about/` isn't linked from the header, the footer or the home page; only the sitemap lists it. Consider a footer link (F1 or F7 file).
4. Ops note: an older `astro dev` on port 4402 (pid 62617, started 09:22, before `content.config.ts` existed) was serving stale empty collections. I stopped it with `npx astro dev stop`, used my own, and stopped that too. Port 4402 is free.

Known limitations:
- `/rising-water/` (Rising water's link, and the TDA page's link) returns 404 until F6. `npm run links` will report it, as it already does for the nav.
- With JS off in Playwright's Chromium, `<noscript>` isn't rendered (it's parsed as raw text), so the e2e checks the note's markup rather than its visibility. All rows still show.
- With JS off, clicking a chip loads `?type=…`, and the page shows all items plus the noscript note. That's by design (§5).
- The production home "Recent work" shows only 2 items, because the others are drafts.
- e2e/site.spec.ts has not been run, per the rules. It type-checks and lints clean.
