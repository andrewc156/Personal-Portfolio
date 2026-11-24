# Check report — F2 Content and pages — attempt 2

**Verdict: PASS_WITH_NOTES**

Both blocking fixes from attempt 1 are resolved, and so are notes 3–5. Every hard gate passes, including the full e2e suite twice and the anchor test 5 times in a row. All 7 acceptance criteria pass on my own evidence. The notes below don't block.

Where I ran it: the isolated snapshot `scratchpad/f2-snap` (DECISIONS #43). It is a git worktree of HEAD `53e54dc` with F2's files copied in. I diffed each F2 path (`src/content`, `content.config.ts`, `src/data`, `src/components/{content,home}`, `src/pages/{garden,research,cv,about}`, both e2e specs, `tsconfig.json`) against the main repo, and they are byte-identical. `git diff HEAD` shows no changes to `src/components/hero`, `src/lib` or `src/pages/index.astro`, so the hero is still the F1 stubs.

## Gates

| Gate | Result | Detail |
|---|---|---|
| check | ✅ | 64 files: 0 errors, 0 warnings, 0 hints. The tsconfig `exclude` (#42) removed the attempt-1 hints. |
| lint | ✅ | ESLint and Prettier clean. |
| unit | ✅ | 281/281 |
| pytest | ✅ | 281 passed, 1 skipped |
| ruff | ✅ | Clean |
| build | ✅ | 10 pages. Built twice; all 10 HTML files are byte-identical between the builds (sha1). |
| e2e | ✅ | Full suite, run 1: 57/57. Run 2: 57/57. No retries are configured. |
| anchor test ×5 | ✅ | `--repeat-each=5 -g "section anchors"`: 5/5 |
| axe | ✅ | The shell and site axe tests (light and dark) pass in both runs. |
| lighthouse | ✅ | All 100 on all 5 URLs (table below). |
| links | ✅ | 31 links scanned. The only broken ones are the 15 `/rising-water/` 404s, which are expected until F6. |
| visual | ✅ | 24 PNGs; I opened every one, plus 1 dev PNG. Horizontal overflow is 0 everywhere. |
| content | ✅ | See criteria 1–2. |
| JS / third-party | ✅ | 1.14 KB gzip per page, 1.75 KB on `/garden/`. All JS is inline; `dist/` has no `.js` files. 0 third-party requests and 0 console errors or warnings across 10 URLs. |
| tda / data | n/a | |

Lighthouse scores (mobile, `staticDistDir`):

| URL | Performance | Accessibility | Best practices | SEO | CLS |
|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/garden/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/cv/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/research/tda-rivernets/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/about/` | 100 | 100 | 100 | 100 | 0.0036 |

## Attempt-1 fixes re-verified

**Blocking 1: `e2e/shell.spec.ts` anchor race. ✅ Resolved.**
- **Scope:** `git diff HEAD -- e2e/shell.spec.ts` changes only lines 163–199, inside the "section anchors" loop. It adds the `scrollSettled()` helper and a settle plus second `toBeInViewport()` after each click. Nothing else in the file changed.
- **Results:** 57/57 twice, and the anchor test passed 5/5 on its own.
- **Does it still prove scrolling?** I ran a mutation test (`docs/checks/tools/f2a2/anchor-mutation.spec.ts`). It copies the loop and adds an init script that cancels nav clicks and only pushes the hash, so nothing scrolls.
  - Unmutated: passes 3/3. Final positions: mission top 16 px, work 16 px, research 60 px, open-science 511 px (the page bottom).
  - Mutated: fails at `#research` with "viewport ratio 0".
  - So the test catches a missing scroll. See Note 1 for a limit on this.

**Blocking 2: "or theCV". ✅ Resolved.**
- `dist/about/index.html` contains `or the <a href="/cv/"…>CV</a>`.
- The visible text reads "…the Garden of work, or the CV."
- The text node before the link ends in `"r the "` at every width (`align.log`).
- The screenshots look right at all 6 sizes and themes.

**Note 3: collaborators in draft descriptions. ✅ Resolved.**
- The descriptions are now "A RiverNets poster." and "A co-presented number theory talk."
- In dev, Yunus Kaya and Michael Liu appear only in the citation author lists (`dev-drafts.log`).
- In `dist/`, a grep for Michael|Liu|Yunus|Kaya|OwlPath|Title needed|data-draft|Analytics Day|co-presented finds 0 files.

**Note 4: Garden lede. ✅ Resolved.** It now reads "Ongoing projects come first, then everything else, newest first." That matches the sort order: undated Rising water first, then Mar 2025. In dev: undated items, then Dec 2026, Mar 2026, Mar 2025.

**Note 5: chip alignment at 768 px. ✅ Resolved.** Measured with `f2a2/align.mjs`:

| Width | Layout |
|---|---|
| 375 and 640 | Labels stack above their chips, both at the left edge (x=16 and x=26). |
| 641 | Both chip lists start at x=174. |
| 768 | Both chip lists start at x=179, with labels at x=31. |
| 1280 | Both chip lists start at x=252. |

The breakpoint switches correctly between 640 and 641. The `garden-768x1024-*` screenshots show the two groups aligned on a shared column.

## Acceptance criteria

1. ✅ **Schemas and content.**
   - The schema is the same as attempt 1, which I verified then.
   - There are 6 work files, one per §3 bullet, and 4 research files.
   - The [A] fields are empty: the talk, Analytics Day poster and preprint have `title: ''`, and the preprint also has `date: ''`. OwlPath has no date or links. All four have `draft: true`.
   - The only content changes are the two neutral descriptions, and both trace to §3.
2. ✅ **Drafts and banned words.**
   - The production Garden shows only Rising water and the fractal poster.
   - `grep -rliE 'TODO|TBD|lorem|placeholder' dist` finds 0 files. Browser `innerText` on 10 pages also has 0 hits (`visible-text.log`).
   - In dev, 4 drafts show a "Draft" badge on `/garden/`, `/`, `/research/number-theory/` and `/cv/`.
3. ✅ **Garden** (`func-probe.log`).
   - **Without JavaScript**, all rows show and the empty state stays hidden, on `/garden/`, `?type=poster` and `?type=talk&tag=water-quality`.
   - **Deep links:** `?type=`, `?tag=`, both combined, the empty-state case and bogus values all behave correctly, and `aria-current` is right in each case.
   - **Keyboard:** Tab reaches the chips. Enter applies the filter and keeps focus on the chip (2px solid outline), and Back and Back restore the earlier states.
   - **Rows follow §4.1:** see the screenshots.
4. ✅ **Research cards and topic pages.**
   - Each card has a linked heading, a one-liner, a thumbnail and "Related work →" pointing to `/garden/?tag=<slug>`. All 4 links land on a correctly filtered Garden.
   - Each slug produces the same SVG on every page, and the 4 slugs differ from each other.
   - There are 0 `<img>` tags and no external references in the SVGs.
5. ✅ **Citations.** The author name is in `<strong>`, the date is `<time datetime="2025-03">Mar 2025</time>`, and the venue is in `<em>`. No content has links, so no link buttons render.
6. ✅ **CV.** Headings are Education, Research, Presentations and Projects. There is no PDF link, which is correct because none is provided.
7. ✅ **Lighthouse:** 100 in all four categories on `/garden/`, `/cv/` and `/research/tda-rivernets/`.

## Notes (non-blocking)

1. **The anchor test only proves scrolling for sections below the fold.** At 1280×800, `#mission` and `#work` are already partly in the viewport at `scrollY` 0. In the mutated run, their `toBeInViewport()` checks passed with no scroll at all. The test still fails on a broken anchor scroll, because `#research` is below the fold, and the original HEAD assertion had the same limit. A stricter check would assert that the target's top lands near the viewport top (for example `|top| < 100` unless the page is at its maximum scroll). This could go to F7.
2. **Attempt-1 notes 1–2 are unchanged by instruction.** The Open science sentence has no repo link and needs Andrew's OK. The Rising water item carries the `tda-rivernets` tag.
3. **The `/garden/` meta description is broader than the production build.** It says "posters, talks, preprints and projects", but production shows only posters and projects because talks and preprints are drafts. Consider making it generic (F7).
4. **Attempt-1 notes 6–7 still apply:** there are no unit tests for `format.ts`/`thumb.ts`, and raw Lighthouse output stays in `.lighthouseci/`, which is gitignored (DECISIONS #20).
5. **Servers are stopped and port 4321 is free.** I stopped my preview and dev servers.

## Artifacts

All under `/Users/andrewchincea/personalPortfolio/docs/checks/`:
- **Screenshots:** `F2/attempt-2/{home,garden,garden-poster,about}-{375x812,768x1024,1280x800}-{light,dark}.png` (24), plus `dev-garden-drafts-1280-light.png`.
- **Logs:** `F2/attempt-2/{check,lint,unit,pytest,ruff,build,build2,e2e-run1,e2e-run2,e2e-anchor-x5,anchor-normal,anchor-mutated,lhci,links,func-probe,visible-text,content-grep,align,js-size,dev-drafts,shots}.log` and `dist-sha1.txt`.
- **Tools:**
  - New: `tools/f2a2/{anchor-mutation.spec.ts,anchor.config.ts,align.mjs,shots.mjs}`.
  - Reused from attempt 1: `tools/f2-{func-probe,visible-text,dev-drafts}.mjs` and `tools/f2-{js-size,svg-extract}.py`.
