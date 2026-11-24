# Build report — C1 Content update from Andrew's CV — attempt 1

Summary: The site content now follows Andrew's CV and DECISIONS #68.
- **Research areas:** 3 instead of 4. `tda-rivernets` is merged into `water-quality` ("Water-quality prediction on river networks").
- **Work items:** 8, none of them drafts: 1 submitted paper, 2 posters, 1 talk and 4 projects.
- **Schema:** work items can now carry a `status: submitted` (shown in place of a date and venue), an `end` date, or `ongoing: true` (shown as "Mon YYYY – Present"). `$k$` inline math in content text renders as an italic *k*.
- **CV page:** rebuilt with every section in the CV's order. There is no phone number, no References section and no PDF link.
- **Contact:** shows on the home page, the About page and the CV.

Worktree: `/Users/andrewchincea/personalPortfolio/.claude/worktrees/agent-a302a2e8cd44f54ea`, branch `worktree-agent-a302a2e8cd44f54ea`, based on dc8e61c. Nothing is committed.

## Files changed
Modified:
- `src/content.config.ts`
  - Work items: optional `end`, `ongoing` and `status`. Ranges are validated: `end` and `ongoing` can't both be set, a range needs a start date, and `end` can't be before the start. A `paper` with `status: submitted` may have no date.
  - Research areas: the schema is exported as `researchSchema`. It adds `results[]` and an optional `position{role, organization, start, end?, ongoing?, highlights[]}`.
- `src/components/content/constants.ts`: `RESEARCH_SLUGS` is now `['water-quality', 'number-theory', 'spectral-fractals']`. Adds `WORK_STATUSES` and `STATUS_LABELS`.
- `src/components/content/format.ts`: adds `formatRange`, `mathSegments` and `plainText`. The sort comment is updated.
- `src/components/content/Citation.astro`
  - Shows "Submitted." in place of the date and venue.
  - Shows date ranges.
  - Renders inline math in titles.
- `src/components/content/WorkRow.astro`: the date slot shows a range or "Submitted". Titles and descriptions render inline math.
- `src/components/content/ResearchCard.astro`: renders inline math in the summary.
- `src/components/content/ContactLinks.astro`: rows wrap, so the long email and LinkedIn addresses no longer overflow at 375 px.
- `src/components/home/OpenScience.astro`: the site-source link is listed first.
- `src/pages/research/[slug].astro`
  - Adds a Position line with dates and an Advisor line (only when known).
  - Adds a Results section.
  - Uses `plainText` for the meta description.
  - The Rising water link is now on `water-quality`.
- `src/pages/cv/index.astro`: rewritten. Sections, in order:
  1. Contact (visually hidden heading)
  2. Education (location, degrees, "Expected May 2028", coursework)
  3. Research interests
  4. Publications and preprints
  5. Research experience (built from `research.position`)
  6. Presentations
  7. Projects (with descriptions)
  8. Technical skills
  9. Work experience
- `src/pages/garden/index.astro`: the lede now matches the real sort order ("Submitted work, which has no date yet, comes first; everything else is newest first.").
- `src/content/research/water-quality.yaml`, `number-theory.yaml`, `spectral-fractals.yaml`
- `src/content/work/talk-maa-southeastern-2026.yaml`, `poster-rivernets-analytics-day-2026.yaml`, `poster-fractal-laplacian-2025.yaml`, `project-owlpath.yaml`, `project-rising-water.yaml` (tag only)
- `src/data/profile.yaml`: `display_name.confirmed: true`, `expected_graduation: May 2028`, email, GitHub, LinkedIn and `site.source_url`. ORCID and `cv_pdf` stay empty.
- `src/data/copy.yaml`: the mission and About bio are refreshed from CV facts. Both stay `confirmed: false`.
- `src/data/open-science.yaml`: the repository, `tree/main/pipeline` and `tree/main/src/lib/tda`.
- `e2e/site.spec.ts`, `e2e/seo.spec.ts`

New:
- `src/components/content/DateRange.astro`
- `src/components/content/MathText.astro`
- `src/components/content/cv.ts` (a zod-validated loader for `cv.yaml`)
- `src/data/cv.yaml` (coursework, research interests, skills, work experience)
- `src/content/work/paper-kth-power-divisor.yaml`, `project-nyc-subway.yaml`, `project-askscrappy.yaml`
- `tests/unit/content/format.test.ts`, `tests/unit/content/cv.test.ts`
- `docs/builds/C1/attempt-1.md`

Deleted:
- `src/content/research/tda-rivernets.yaml`
- `src/content/work/preprint-number-theory.yaml` (replaced by `paper-kth-power-divisor.yaml`)

## How to verify
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 18 files, 458 passed (17 of them new).
- Checker: `npm run build && npx playwright test e2e/site.spec.ts e2e/seo.spec.ts e2e/shell.spec.ts`. `e2e/shell.spec.ts` will fail its footer test until Control applies Request 1.
- Lighthouse: `LHCI_URLS=/,/garden/,/research/,/research/water-quality/,/research/number-theory/,/research/spectral-fractals/,/cv/,/about/,/rising-water/,/404.html npm run lhci`, then `npm run links`.

## Acceptance criteria (self-check)
Checked with ad-hoc Playwright scripts against `npx astro dev --port 4410` (now stopped). The scripts are not in the repo.

1. ✅ **Profile.** The display name is confirmed. Expected graduation is May 2028. Email, GitHub and LinkedIn are set; there is no phone and no ORCID. The footer shows a Source link to `https://github.com/andrewc156/Personal-Portfolio`. Open science links go to the repository, `pipeline/` and `src/lib/tda/`. The bio and mission are accurate to the CV and stay `confirmed: false`.
2. ✅ **Work items.** All titles are exactly as in the CV. The paper renders as "Tsz Ho Chan and **Andrew Chincea**. Largest *k*th-Power Divisor of a Random Integer. Submitted." The *k* is `<i>k</i>`, so the text reads "kth" and the label and meta use plain text.
   - Dates and ranges render as "Nov 2026 – Present", "Jan 2026 – May 2026" and "Aug 2024 – Dec 2024".
   - Garden order: the submitted paper, then Dec 2026 poster, OwlPath, Rising water, Mar 2026 talk, NYC Subway, Mar 2025 poster, AskScrappy.
   - There is no second number-theory paper.
   - Rising water is tagged `water-quality` and keeps its Nov 2026 date.
3. ✅ **Research areas.** There are 3, with one-liners, descriptions and Methods taken only from CV bullets. Water quality also has a Results section with the CV's exact R² numbers.
   - Advisors: Dr. Mehmet Aktas (water quality) and Dr. Tsz Ho Chan (number theory). Spectral analysis on fractals has none; the CV names none.
   - `/research/water-quality/` links to `/rising-water/`.
   - Thumbnails are still seeded by slug; `water-quality` and `spectral-fractals` are unchanged.
4. ✅ **CV page.** Headings appear in the CV's order.
   - Research experience dates: Aug 2026 – Present, Aug 2025 – Present, and Aug 2024 – May 2025.
   - Work experience: Aug 2026 – Present.
   - There are 3 presentations and 4 projects.
   - There is no phone, no References section and no PDF link.
5. ✅ **Contact.** The home `#contact` section and About show a mailto email link, GitHub and LinkedIn (3 links). `#teaching` is not rendered.
6. ✅ **Mission.** 3 sentences, CV facts only, `confirmed: false`.
7. ✅ **e2e specs.**
   - **Counts and slugs:** 8 items, typed `{paper 1, poster 2, talk 1, project 4}`; slugs and Rising water tag; the advisor appears only when known.
   - **Rendered text:** "Submitted" replaces the date and venue; Garden and citation date text, including ranges, is checked; the CV section order, positions, publication text with italic *k*, and the job entry are checked.
   - **Contact links:** checked on the home page, About and the CV.
   - **Phone and References:** a test checks every page, including `/rising-water/` and a 404, for any phone format (in visible text, hrefs and meta), `tel:` links, and a References heading.
   - **seo.spec.ts:** 9 pages, sitemap length 9, and `/research/tda-rivernets/` returns 404.
   - Scroll tests: none were added, so the DECISIONS #41 settle rule didn't come up. Name matches use `exact: true`.
8. ✅ **`tda-rivernets` grep** (src/, e2e/, tests/, lighthouserc.cjs, scripts/, docs/deploy.md):
   - `e2e/headers.spec.ts:22` is not my file; see Request 2.
   - `e2e/seo.spec.ts:118` is mine and is intentional: the 404 test for the removed slug.
   - Outside that scope, `docs/DECISIONS.md` #21 and historical `docs/checks/**` and `docs/builds/**` still mention it; they are historical records.
9. ✅ **Accessibility and layout (dev).**
   - axe: 0 violations of any impact on /, /garden/, /research/water-quality/, /cv/ and /about/, at 375 and 1280 px, light and dark.
   - Horizontal overflow at 375 px is 0 on every page. The contact rows overflowed by 24 px before the fix.
   - No console errors apart from font 403s, which come from the worktree setup (see Known limitations).
   - The rendered HTML of all 10 routes contains no private phone digits, tel: links, References heading, TODO/TBD/lorem/placeholder in visible text, or tda-rivernets.

## Needs Andrew
- **OwlPath link:** the CV shows OwlPath as a hyperlink, but the target URL isn't in the text. The item has no link until he supplies the URL.
- **Spectral analysis on fractals advisor:** the CV names none, so the field is empty. Confirm that's intended.
- **Draft copy:** the tagline, hero question, mission, About bio and Open science sentence are still unconfirmed.
- **Hero keywords:** still the §3 draft list "water quality · topological data analysis · statistics · number theory". He may want them updated to the merged areas.
- **Project details:** the CV's tech stacks and longer project bullets aren't on the site; only the ≤160-character descriptions are. He can say if he wants them.

## Requests to Control
1. **`e2e/shell.spec.ts:261-266` will now fail.** It asserts the footer Source link is absent, but `site.source_url` is now set. Suggested change:
   ```ts
   test('footer line shows © year, name, credit and the Source link', async ({ page }) => {
     ...
     await expect(footer.getByRole('link', { name: 'Source', exact: true })).toHaveAttribute(
       'href', 'https://github.com/andrewc156/Personal-Portfolio');
   });
   ```
2. **`e2e/headers.spec.ts:22`:** remove `'/research/tda-rivernets/',` from `PAGES`.
3. **`docs/DECISIONS.md` #21:** record that the research slugs are now `water-quality`, `number-theory` and `spectral-fractals` (per #68).
4. **Optional, `.gitignore`:** the `node_modules` and `pipeline/.venv` symlinks show as untracked. The ignore patterns end in `/`, which doesn't match a symlink. Don't commit them.
5. **Optional, social card:** the card still shows the draft tagline. Nothing in it changed.

## Known limitations
- I didn't run build, preview, e2e or Lighthouse, as the rules require. The new e2e assertions were checked only through equivalent ad-hoc probes against dev, where content is the same as production because there are no drafts.
- In the worktree's dev server, fonts load with a 403 because `node_modules` is a symlink outside Vite's `fs.allow`. This only affects the worktree setup, not the site's code.
- The CV's longest research bullets are shortened, not copied in full. The R² and leakage numbers stay exactly as in the CV.
- The hidden "Contact" h2 on the CV counts in the heading outline, and the e2e test expects it.
