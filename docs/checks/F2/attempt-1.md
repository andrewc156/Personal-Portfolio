# Check report — F2 Content and pages — attempt 1

**Verdict: FAIL.** The F2 feature work itself is solid: all 7 acceptance criteria pass on my own evidence. It fails on two things:
- A hard gate fails. `e2e/shell.spec.ts:150` (F1) fails deterministically in both full-suite runs, because F2's real home content now triggers a scroll race in that test.
- There's a visible text defect on `/about/` ("or theCV").

Both fixes are small.

## Gates

| Gate | Result | Detail |
|---|---|---|
| check | ✅ | 0 errors, 0 warnings, 2 hints. Both hints are in old checker tools under `docs/checks/tools/`. |
| lint | ✅ | ESLint and Prettier clean. |
| unit | ✅ | 281/281 |
| pytest | ✅ | 282 passed. This includes the data-engineer's in-progress F4b tests. |
| ruff | ✅ | Clean |
| build | ✅ | 10 pages. Built twice. |
| e2e | ❌ | 56/57 in both runs. `site.spec.ts` passed 26/26 both times. `shell.spec.ts` passed 30/31 both times; `shell.spec.ts:150` "section anchors … nav scrolls to them" failed both times (see Blocking fix 1). |
| axe | ✅ | The shell.spec axe tests (0 serious/critical, light and dark) pass. |
| lighthouse | ✅ | All 100 (see table below). CLS ≤ 0.0001. |
| links | ✅ | 31 links scanned; the only broken ones are `/rising-water/` 404s (expected until F6). No other internal failures. |
| visual | ❌ | `/about/` shows "or theCV" in all 6 variants. Everything else is clean. |
| content | ✅ | See criteria 1–2. |
| tda / data | n/a | |
| JS / third-party | ✅ | 1.14 KB gzip per page, 1.75 KB on `/garden/`. All JS is inline; there are no `.js` files in `dist/`. 0 third-party requests. |

Lighthouse scores (mobile, `staticDistDir`):

| URL | Performance | Accessibility | Best practices | SEO | CLS |
|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/garden/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/cv/` | 100 | 100 | 100 | 100 | 0 |
| `/research/tda-rivernets/` | 100 | 100 | 100 | 100 | 0.0001 |
| `/about/` | 100 | 100 | 100 | 100 | 0 |

The §7 bars are performance ≥ 90 and accessibility, best practices and SEO ≥ 95, so every page passes all four.

## Acceptance criteria

1. ✅ **Schemas and content.**
   - `src/content.config.ts` matches §7. The work schema uses `.strict()`, the type enum, a date regex, `description` max 160 characters, the links object, slug-enum tags, and `draft`/`confirmed`. A `superRefine` requires title and date unless the item is a draft.
   - There are exactly 6 work files, one per §3 bullet, and 4 research files.
   - [A] fields are empty on drafts: the talk, Analytics Day poster and preprint have `title: ''`, and the preprint also has `date: ''`. OwlPath has no date or links. All four have `draft: true`.
   - I traced every content-file fact to §3. Two exceptions trace to other parts of the spec or DECISIONS instead (Notes 1–2).
   - In dev, the Garden shows exactly 6 items, 4 of them with a Draft badge (`dev-garden-drafts-1280-light.png`).
2. ✅ **Drafts and banned words.**
   - The production Garden shows only `project-rising-water` and `poster-fractal-laplacian-2025`.
   - Searching the visible text of `dist/` for "Draft", "Title needed", Michael, Yunus, Kaya, OwlPath and `data-draft` finds nothing. The only "preprint" hits are the research one-liner.
   - `grep -rliE 'TODO|TBD|lorem|placeholder' dist` finds no files. Browser `innerText` of all 10 pages also has 0 hits.
   - In dev (`astro dev --port 4321`, since stopped), every draft shows a "Draft" badge on `/garden/`, `/`, `/research/number-theory/` and `/cv/`.
3. ✅ **Garden** (`docs/checks/tools/f2-func-probe.mjs`):
   - **Without JavaScript**, `/garden/`, `?type=poster` and `?type=talk&tag=water-quality` all show both rows, and the empty state stays hidden.
   - **Deep links:**
     - `?type=poster` → fractal poster only.
     - `?tag=tda-rivernets` → Rising water only.
     - `?type=poster&tag=spectral-fractals` → 1 row.
     - `?type=project&tag=spectral-fractals` → 0 rows, the empty state shows, and status reads "Showing 0 of 2 items".
     - `?type=bogus&tag=nope` → ignored, all rows.
     - `aria-current` is correct in every case.
   - **Keyboard:** Tab reaches the chips. Enter on Posters gives `?type=poster` and 1 row, with focus kept on the chip (solid 2px outline). Enter on an area chip combines the filters. Back and Back restore the earlier states.
   - **Rows follow §4.1:** mono uppercase type, then title, then description · venue, then a mono "Mar 2025" date. See the screenshots.
4. ✅ **Research cards and topic pages.**
   - Home and `/research/` cards each have a linked heading, a one-liner, an SVG thumbnail, and "Related work →" pointing to `/garden/?tag=<slug>`. Clicking each of the 4 links lands on a correctly filtered Garden.
   - Topic pages have About and Related work; Methods is omitted because none are known yet. `/research/tda-rivernets/` links to `/rising-water/`.
   - Thumbnails are deterministic. Thumbnail SVG markup is byte-identical across two builds, and so is every HTML file in `dist/`. Each slug produces the same SVG on every page, and the 4 slugs differ from each other.
   - There are no `<img>` tags and no `<image>`, `href`, `xlink` or `url()` references in the thumbnails.
5. ✅ **Citations.**
   - The author name is in `<strong>`, dates are `<time datetime="2025-03">Mar 2025</time>`, and the venue is in `<em class="citation__venue">`.
   - No link buttons are rendered, which is correct because no item has links.
   - Caveat: I verified the "buttons only for existing links" logic by reading the code (`Citation.astro`, the `LINK_BUTTONS` `flatMap` filter). No current content exercises it.
6. ✅ **CV.**
   - Headings are Education (KSU, both degrees, standing), Research (4 areas), Presentations and Projects, all generated from profile and content.
   - There is no PDF link, which is correct since `cv_pdf` is `''`.
7. ✅ **Lighthouse:** all 100 (see the gates table above).

**Also verified:**
- `/about/` bio is the §3 draft text word for word.
- Home sections render in the order mission > work > research > open-science, each with one h2. `#teaching` and `#contact` are absent.
- There are 0 console errors or warnings across 10 URLs.
- I opened all 42 screenshots plus 1 dev screenshot. Horizontal overflow is 0 everywhere.

## Blocking fixes

### 1. `e2e/shell.spec.ts:162-168` fails deterministically now that home has real content

- **File and owner:** this is an F1 test file. Control needs to authorize the site-builder to edit it, or decide another route.
- **Expected:** the `#open-science` section is in the viewport after clicking the nav link.
- **Actual:** "viewport ratio 0". The page ends at `scrollY = 0` with the URL at `#open-science`.

**Root cause** (this is a test race, not a product bug):
1. The header is `position: static` and `html` has `scroll-behavior: smooth`.
2. `toBeInViewport` for `#research` passes partway through the smooth scroll, so the next `click()` fires during the animation.
3. Playwright's actionability check scrolls the off-screen header link into view, which jumps to the top, and that collides with the in-flight smooth scroll.
4. In my scrollY trace, the page reaches 954 and then snaps back to 0 (`docs/checks/tools/f2-anchor-probe2.mjs`).

**Evidence that the product is fine:**
- With real mouse clicks from the top of the page, every anchor lands in view (`f2-anchor-probe3.mjs`).
- The same test steps pass with `reducedMotion: 'reduce'` (`f2-anchor-probe2rm.mjs`, `RM=reduce`).
- They also pass 3 out of 3 times when the test waits for `scrollY` to settle before each click (`f2-anchor-probe4.mjs`).

**Suggested fix:** in the loop, wait for scrolling to stop before each `link.click()`, for example with a `waitForFunction` that compares `scrollY` across two animation frames. Alternatively, run that test with `reducedMotion: 'reduce'`.

**Reproduce:** `npm run build && npx playwright test e2e/shell.spec.ts -g "section anchors"`

### 2. `src/pages/about/index.astro:22-24` renders "or theCV"

- **Expected:** "…or the CV."
- **Actual:** the built HTML is `or the<a href="/cv/">CV</a>`, so the page reads "or theCV". The line break between `the` and `<a>` is dropped.
- **Fix:** put an explicit space, e.g. `the{' '}<a href="/cv/">CV</a>`, or keep `the <a …>` on one line.
- **Reproduce:** `grep -o 'or the.\{0,30\}' dist/about/index.html`, or see `about-*-{light,dark}.png` (all 6).

## Notes (non-blocking)

1. **Open science sentence.** "The source code for this site is public, including the data pipeline and the persistence engine…" is not a §3 fact. It's true per DECISIONS #1 (the public GitHub origin). It is marked `confirmed: false` and listed in Needs Andrew. With no repo link shown, the section asserts openness without linking to anything. Control should get Andrew's OK and the URL.
2. **Rising water details.**
   - The description ("…shown as water rising over terrain with a live barcode") comes from spec §6, not §3.
   - The item's `tda-rivernets` tag implies the explorer is RiverNets work, which §3 doesn't state, though §5 links the TDA page to it. Worth confirming with Andrew.
   - The TDA page sentence about the "Colorado River Basin study area (RiverNets coverage)" traces to §6.4 and §3 research area 2. OK.
3. **Collaborators in draft descriptions.** "A RiverNets poster with Yunus Kaya." and "co-presented with Michael Liu" name the collaborators in the description as well as the author list. This is dev-only (drafts) and §3 itself says "co-presented with Michael Liu", but it's slightly beyond "only as coauthors". Consider neutral descriptions.
4. **Garden lede.** It says "newest first", but undated items (Rising water) sort first (DECISIONS #26). Minor wording.
5. **Chip label alignment at 768 px.** "TYPE" chips sit inline with the label, but "RESEARCH AREA" chips wrap below their label, so the two groups look misaligned (`garden-768x1024-*.png`). Cosmetic.
6. **No unit tests for the pure helpers.** `format.ts` and `thumb.ts` have none (DECISIONS #28). Determinism is covered by e2e and by my two-build comparison.
7. **Report files.** Lighthouse raw JSON stayed in `.lighthouseci/` and was not copied under `docs/checks/` (DECISIONS #20). The build/e2e/links/lhci logs are kept under `docs/checks/F2/attempt-1/`.
8. **Port 4321 is free.** The preview and dev servers I started are stopped.

## Artifacts

- **Screenshots:** `docs/checks/F2/attempt-1/{home,garden,garden-poster,research,research-tda,cv,about}-{375x812,768x1024,1280x800}-{light,dark}.png` (42), plus `dev-garden-drafts-1280-light.png`.
- **Logs:** `docs/checks/F2/attempt-1/{build1,build2,e2e-run1,e2e-run2,links,lhci}.log`
- **Tools:** `docs/checks/tools/`
  - `f2-anchor-probe{,2,2rm,3,4}.mjs`
  - `f2-func-probe.mjs`
  - `f2-visible-text.mjs`
  - `f2-shots.mjs`
  - `f2-dev-drafts.mjs`
  - `f2-svg-extract.py`
  - `f2-js-size.py`
- **Failing-test trace:** `test-results/shell-header-and-navigatio-b8f09-der-and-nav-scrolls-to-them-chromium/trace.zip`
