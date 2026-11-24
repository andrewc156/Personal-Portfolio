# Andrew Chincea — portfolio site: build spec for Claude Code

Spec version 1.1 · 2026-11-24 · Hosting: Cloudflare Pages on Andrew's own domain

> **Andrew — how to run this**
> 1. Make an empty folder (for example `andrew-portfolio`) and save this file in it as `portfolio-megaprompt.md`.
> 2. Install Node.js LTS (20 or newer), Python 3.10 or newer, and git. Keep about 1 GB free for the elevation-data cache.
> 3. In that folder, run `claude --permission-mode acceptEdits`. File edits are approved automatically, and you approve shell commands such as `npm` and `python` as they come up. If your Claude Code offers auto mode, `claude --permission-mode auto` asks less often.
> 4. Send: `@portfolio-megaprompt.md You are the Control agent. Execute this spec starting at Phase 0.`
> 5. It will ask once before writing into `.claude/`. That folder is protected, so the prompt is expected.
> 6. If you stop partway, run `claude --continue` and say "Continue from docs/STATUS.md."
>
> Control agent: everything from §1 on is for you. Skip this box.

---

## 1. Your role

You are the **Control agent**, the main Claude Code session. You plan, delegate, integrate and report. You do not write feature code yourself. Every feature is built by a **builder agent** and verified by an independent **checker agent**. Both report back to you, and you decide what happens next.

Operating principles:
1. **Truth over polish.** Never invent facts about Andrew, his collaborators, venues, dates, links or data values. Unknowns stay as clearly marked drafts (§3).
2. **Evidence-based acceptance.** A feature is done only when a checker's PASS report exists on disk under `docs/checks/`. A builder's self-report is never enough.
3. **Small, verifiable increments.** Each builder task covers one feature, and file ownership is disjoint (§8.2). Commit after each PASS.
4. **Keep your own context lean.** Delegate exploration, building and verification. Read reports, not raw logs.
5. **Work autonomously.** Stop only for the items in §9.6. Log every other decision in `docs/DECISIONS.md` and every question in `docs/QUESTIONS.md`.

## 2. What we're building

A static personal academic website for Andrew Chincea, hosted on **Cloudflare Pages** at a custom domain Andrew will buy himself.

- **Look and feel** of Rich Pauloo's site (https://www.richpauloo.com/): minimal and playful. A live generative-art canvas is the centerpiece, with a settings panel of sliders and named palettes, plus a filterable list of work (a "Garden").
- **Information architecture** of Sam Zipper's site (https://www.samzipper.com/): a one-page home with anchored sections (hero with a research question and keywords → mission → recent work → research-area cards → open science → teaching → contact), a complete list of work, per-topic research pages and a CV.
- **Signature feature: Rising water.** An interactive explanation of 0-dimensional persistent homology of the sublevel-set filtration, shown as water rising over terrain with a live barcode. It comes in two versions:
  - a **synthetic** version on the home page, with generative terrain and Rich-style controls;
  - a **real** version on `/rising-water/`, built from a digital elevation model of the Colorado River Basin study area (§6.4).

Non-goals: CMS, blog, comments, analytics or trackers, server-side code, user accounts.

The reference sites are for inspiration only. Do not copy their text, code, images, palette names or exact layouts.

## 3. Facts about Andrew (content seed)

Use only these facts. **[C]** means confirmed by Andrew. **[A]** means Andrew still has to supply it: create the entry with that field empty and `draft: true`, then list it in `docs/QUESTIONS.md`. Never fill an [A] field with a guess.

**Identity**
- [C] Full name: Andrew Dumitru Chincea. Display name: "Andrew Chincea" [A: confirm].
- [C] Undergraduate at Kennesaw State University (KSU), pursuing a B.S. in Mathematics (Statistics concentration) and a B.S. in Data Science and Analytics. Junior in the 2026–27 academic year.
- [A] Expected graduation term, email, GitHub, LinkedIn, ORCID, photo, CV PDF, domain name.

**Research areas.** The one-liners below are true but minimal. Andrew will expand them.
1. **Water quality.** [C] His primary research focus as of fall 2026. [A] Topic, advisor, data, methods.
2. **Topological data analysis: RiverNets.** [C] A TDA lab project at KSU called RiverNets. [C] Its study-area bounding box is in §6.4 (Andrew's label: "River Network Geographic Coverage"). [A] One-paragraph description, advisor.
3. **Number theory.** [C] One preprint, plus a second paper in progress (expected early 2027). [A] Titles, coauthors, links, and whether to list the in-progress paper.
4. **Spectral analysis on fractals.** [C] First-Year Scholar research on eigenvalues of the fractal Laplacian.

**Work items (Garden)**
- [C] Poster: "Properties of Eigenvalues of Fractal Laplacian." 104th MAA Southeastern Section Meeting, High Point University, March 2025. First-Year Scholar research.
- [C] Talk, co-presented with Michael Liu: number theory, 105th MAA Southeastern Section Meeting, March 2026. [A] Title. Keep as a draft until the title is supplied.
- [C] Poster with Yunus Kaya: RiverNets, KSU Fall Analytics Day, December 4, 2026. [A] Title. Keep as a draft until the title is supplied.
- [C] Preprint: number theory. [A] Title, date, link. Keep as a draft until supplied.
- [C] Project: OwlPath, a course-prerequisite chart for Kennesaw State modeled on Georgia Tech's GradGT. [A] Status, link, date.
- [C] Project: Rising water, this site's interactive persistent-homology explorer. Link to `/rising-water/`. Its date is the month F6 passes.

**Copy drafts.** Use the first option by default, mark it `confirmed: false`, and list the alternatives in QUESTIONS.md.
- Tagline: "Mathematics, statistics, and water." / "Measuring the shape of water." / "Where topology meets water."
- Hero question (Sam-style): "What can the shape of a landscape tell us about the water that moves through it?" / "How do we measure the structure hidden in water data?"
- Mission (2–3 sentences): built only from the facts above.
- About bio: "Andrew Chincea is an undergraduate at Kennesaw State University studying mathematics (statistics concentration) and data science and analytics. His research spans water quality, topological data analysis, and number theory."
- Keywords: water quality · topological data analysis · statistics · number theory.

Collaborators (Michael Liu, Yunus Kaya) appear only as coauthors on items. No profile pages and no other details about them.

## 4. Design brief

### 4.1 Rich-style look (build original components that achieve this feel)
- Quiet chrome, lots of whitespace, one accent color. The generative canvas carries the personality.
- Header: wordmark (Andrew's name) on the left; compact nav on the right; a gear button (aria-label "Art settings") that opens the art settings panel on pages that have one.
- Settings panel:
  - Grouped sections with small headings.
  - Each slider shows its live value in monospace.
  - Select menus for palette and "color by"; action buttons (New terrain, Play/Pause, Reset).
  - A right-hand drawer on desktop and a bottom sheet on mobile. Esc closes it and focus returns to the gear button.
  - Open/closed state is remembered in localStorage, wrapped in try/catch.
- Garden: filter chips at the top. Each entry is one clickable row: type tag (mono, small caps) → title → one-line description (plus venue, if any) → date as "Mon YYYY".
- Footer: one small line: © year Andrew Chincea · Source · "Built with help from Claude Code". That last part is a profile flag, on by default, that Andrew can turn off.
- Optional personal touch in the header (for example, a small hover note). [A] Skip by default.

### 4.2 Visual system
- **Type:** IBM Plex Sans for UI and body, IBM Plex Mono for numbers, tags and readouts, self-hosted via @fontsource. Body 17px, line-height 1.6, line length ≤ 68ch.
- **Color:**
  - Tokens as CSS custom properties, with a light theme (warm off-white) and a dark theme (near-black).
  - The site follows the OS theme by default and has a toggle that persists, with no flash of the wrong theme on load.
  - One accent: deep water blue.
  - WCAG AA contrast everywhere: 4.5:1 for body text, 3:1 for large text and UI.
- **Art palettes:** original, water-themed names: Delta, Canyon, Glacier, Estuary, Mono.
  - The categorical "lake identity" palette must stay distinguishable under simulated deuteranopia, protanopia and tritanopia, in both themes.
  - Never rely on color alone. A highlighted lake also gets an outline and a label.
- **Motion:** purposeful. Everything respects `prefers-reduced-motion`.

### 4.3 Sam-style structure
Home is one long page with anchored sections, in this order:
1. **Hero:** synthetic Rising water canvas + name + hero question + keywords.
2. **Mission** (`#mission`): 2–3 sentences.
3. **Recent work** (`#work`): latest 4–5 Garden items in citation style, plus an "All work →" link to `/garden/`.
4. **Research** (`#research`): one card per research area, each with a linked heading, a one-line description, a "Related work →" link to `/garden/?tag=<slug>`, and a generative SVG thumbnail.
5. **Open science** (`#open-science`): how Andrew shares code and data, with links to repositories and to this site's source and data pipeline.
6. **Teaching & outreach** (`#teaching`): rendered only if content exists.
7. **Contact** (`#contact`): only the links that exist. Hidden if there are none.

Nav: Mission · Research · Work · Open science · Rising water · CV. The section items scroll to anchors; Rising water and CV are separate pages.

Citation format (recent work, topic pages, CV):
- Authors (Andrew in bold), year, title, venue in italics.
- Small buttons only for links that exist: PDF, DOI, Preprint, Code, Data, Slides, Poster.

## 5. Site map

| Route | Purpose |
|---|---|
| `/` | Home (§4.3) |
| `/garden/` | All work. Filterable by type (`?type=`) and research area (`?tag=`). Shows every item when JavaScript is off. |
| `/research/<slug>/` | One page per research area: description, methods, related work. The TDA page links to `/rising-water/`. |
| `/rising-water/` | Colorado River Basin explorer (§6.4) |
| `/cv/` | Web CV generated from content, with a PDF download only if Andrew provides one |
| `/about/` | Longer bio (draft) and contact links |
| `/404` | Friendly not-found page with a small static terrain image (Cloudflare Pages serves `404.html` for unknown routes) |

Also include: `sitemap.xml`, `robots.txt`, Open Graph and Twitter meta tags, canonical URLs and a favicon. Every absolute URL comes from `SITE_URL` (§7).

## 6. Rising water

### 6.1 Math (authoritative for every implementation)
- **Grid:** heights `h` on a W×H grid. Cell index `i = y·W + x`. Row 0 is north.
- **Total order:** `i ≺ j` if and only if `(h[i], i) < (h[j], j)` lexicographically. Every tie in every implementation (TypeScript, Python, tests) is broken this way.
- **Connectivity:** 4-neighbor (N, S, E, W) by default everywhere. 8-neighbor is an option, never the default.
- **Sweep:** add cells in ≺ order. When cell `i` is added, collect the distinct roots of its already-added neighbors.
  - **No roots:** a new component is born at `h[i]`, with birth cell `i`.
  - **One or more roots:** `i` joins the **oldest** root, the one with the smallest `(birthHeight, birthCell)` under ≺. Every other root dies at `h[i]` with death cell `i` (the elder rule).
  - Record each death as a bar `(birth, death, birthCell, deathCell)`. Bars with `death == birth` can occur on plateaus. Drop them from display but count them in debug stats.
- **Essential bar:** after the sweep, each connected domain has one essential bar with `death = +∞`.
- **Persistence:** death − birth, which is the depth of a basin below its spill point.
- **Lakes:** the flooded region at level `t` is the sublevel set `{x : h(x) ≤ t}`. Its connected components are the "lakes".

### 6.2 Engine (TypeScript, `src/lib/tda/`)
- `computeH0(heights: Float32Array, W: number, H: number, opts?: { connectivity?: 4 | 8 }) → { bars, order }`.
- `class Flood`, an incremental engine for animation:
  - `reset()`
  - `advanceTo(level) → MergeEvent[]`
  - `componentOf(i)`: union-find root, with path compression
  - `isWet(i)`
  - `levelAtPercentile(p)`, computed via `order`
  - `alive()`
- Typed arrays, deterministic, and no per-frame allocations beyond small event arrays.
- Performance targets (mid-range laptop, Chromium):
  - `computeH0` on about 135k cells: ≤ 300 ms.
  - `Flood` per-frame update plus recolor at 135k cells: ≤ 6 ms.
- `pipeline/tda_ref.py` is an independent Python implementation of §6.1 with identical output.

### 6.3 Synthetic hero (home page)
- **Terrain:** seeded RNG plus fractal noise (value or simplex), deterministic per seed. The grid is sized to the canvas: about one cell per 4–6 CSS px, at most 40k cells.
- **Map:**
  - Land is drawn with an elevation tint plus hillshade.
  - Water takes its lake's identity color, with depth shading. When lakes merge, the older lake keeps its color.
  - Options: "color by depth" and shoreline outlines.
- **Barcode strip** below the map:
  - The x-axis is water level. Bars grow live up to a current-level line, and finished bars stay.
  - A minimum-persistence threshold hides short bars, and a row cap limits how many show.
  - The essential bar reaches the right edge at the end.
  - A toggle switches between barcode and persistence diagram (birth vs. death scatter with the diagonal).
- **Settings panel groups:**
  - Terrain: seed, New terrain, scale, roughness.
  - Water: play/pause, speed, level scrubber, pacing (linear | percentile), loop.
  - Barcode: show, min persistence, max bars, view.
  - Color: palette, color by, shoreline.
- **Interaction:** hovering or tapping a bar highlights its lake and marks its birth cell (the pit) and death cell (the pass). Hovering the map shows height and lake id on pointer devices.
- **Loop:** at the maximum level, hold about 2.5 s, then start over with a new seed if loop is on.
- **Accessibility:**
  - The canvas has `role="img"` and an aria-label.
  - A visually hidden summary updates on pause and scrub, not every frame.
  - Keyboard: Space plays/pauses, ←/→ scrubs, N makes a new terrain.
  - With reduced motion there is no autoplay: show a static frame at about 45% level with a Play button.
- **Performance:**
  - Pause when the canvas is off-screen (IntersectionObserver) or the tab is hidden.
  - Cap devicePixelRatio at 2.
  - Target 60 fps, with p95 frame time ≤ 22 ms on a mid-range laptop.
- **Caption** under the hero: "Water rises over a random landscape. Lakes are born, then merge, and the barcode records each lake's lifetime." followed by a link, "See it on the Colorado River Basin →".

### 6.4 Colorado River Basin explorer (`/rising-water/`)

Study area. Use these values exactly:
```
Bounding box (W, S, E, N): [-115.201667, 31.817500, -107.060833, 42.157500]
Center: 36.987500° N, 111.131250° W
Label on the site: "Colorado River Basin study area (RiverNets coverage)"
```
Derived values (recheck these in the pipeline):
- Span: 8.140834° × 10.34°, about 725 km east–west × 1,148 km north–south.
- Display aspect (width/height, equirectangular scaled by cos 36.9875°): about 0.63, so the map is portrait.

Expected geography. Verify all of this from the data before stating any of it on the site:
- **The rectangle is not the hydrologic basin.** It likely leaves out:
  - the Colorado's source in Rocky Mountain National Park, which lies east of 107.06° W;
  - the Green River's headwaters in Wyoming's Wind River Range, which lie north of 42.16° N.
- It likely includes neighboring closed basins, which should show up as long-lived lakes:
  - the Great Salt Lake / Bonneville area of the Great Basin;
  - part of Wyoming's Great Divide Basin, near the north edge.
- The lowest cell should be near the Colorado River delta in the south-west corner, at about sea level.
- The highest raw elevation should be near Uncompahgre Peak in Colorado's San Juan Mountains, about 4,365 m.

UI:
- **Layout:**
  - Desktop: a portrait map (about 55% of the width) beside a column with the barcode or diagram, readouts and controls.
  - Mobile: the same pieces stacked.
- **Map:**
  - The base layer is the precomputed hillshade image.
  - The water overlay is drawn from the same grid the barcode is computed on, so the picture and the barcode always agree.
  - There are thousands of lakes. The K longest-lived (K ≈ 12) get distinct identity colors; all others share one neutral water color. Coloring stays consistent with the elder rule, because a surviving lake's persistence is always at least that of the lake it absorbs.
- **Readouts:** current level (m and ft), percentile, number of lakes, % of area flooded.
- **Controls:** play/pause, speed, level scrubber, pacing (percentile by default, or linear meters), min persistence (m), top-N bars, units (m/ft), view (barcode | diagram).
- **Clicking a bar** (or its row in the table):
  - The level jumps to just below that bar's death level, and the lake is highlighted.
  - An info card appears: born at X m near (lat, lon), merged at Y m at (lat, lon) into lake Z, persistence P m.
  - Every number comes from the data, never typed by hand.
- **Hovering the map** shows elevation and lat/lon.
- **Text alternative:** a "Longest-lived lakes" table (top 20), with buttons that do the same as clicking a bar.
- **Sections below the explorer:**
  - "How to read the barcode", using only §6.6.
  - "About the data", generated from `meta.json` and `ATTRIBUTION.md`: source, licence attribution, processing steps, limitations.
  - "Code", linking to the pipeline and the engine.
- **Performance:** ≤ 3 MB of data transferred, initial compute ≤ 500 ms on desktop, Lighthouse mobile performance ≥ 80.

### 6.5 Data pipeline (`pipeline/`)

Environment: Python ≥ 3.10 in `pipeline/.venv`. Requirements: numpy, rasterio, requests, pillow, gudhi, pytest, ruff. One command builds everything: `npm run data`, which runs `python -m pipeline.build_colorado`. Cloudflare's build does **not** run the pipeline. The processed outputs in `public/data/colorado/` are committed to the repo.

1. **Download** Copernicus DEM GLO-90 tiles: 3″ resolution (about 90 m), Cloud-Optimized GeoTIFF.
   - Source: the public AWS Open Data bucket `copernicus-dem-90m`. No AWS account is needed.
   - Fetch over HTTPS from `https://copernicus-dem-90m.s3.amazonaws.com/<TILE>/<TILE>.tif`, where `<TILE> = Copernicus_DSM_COG_30_N{LAT:02d}_00_W{LON:03d}_00_DEM`, for LAT 31–42 and LON 108–116 (up to 108 tiles).
   - Before the bulk download, fetch one tile and confirm from its geotransform both the naming and which corner the name refers to.
   - A 404 is acceptable only for an all-ocean tile. Log every missing tile.
   - Cache raw tiles in `pipeline/data/raw/` (gitignored; a few hundred MB).
   - Fallback, only if AWS fails: the OpenTopography Global DEM API (`demtype=COP90`). It needs a free API key that Andrew supplies via `.env` (`OPENTOPOGRAPHY_API_KEY`).
2. **Mosaic and clip** to the exact bbox at native resolution: about 9,769 × 12,408 px, roughly 121 M cells. Stream by row bands if memory is tight.
3. **TDA grid:** downsample by taking the **minimum** of each 30 × 30 block of native pixels.
   - Result: 0.025° cells (about 2.2 km × 2.8 km). Partial edge blocks are allowed. Expected size is 326 × 414 = 134,964 cells; verify it.
   - Use the minimum, not the mean. The minimum keeps narrow canyons connected; averaging can wall them off and create fake lakes.
   - Float32 meters. Treat nodata as an error unless it's ocean, in which case use 0 m.
4. **Hillshade** for display:
   - Downsample by block mean to 30″ (about 977 × 1,241 px).
   - Compute hillshade with east–west spacing scaled by cos(latitude).
   - Save as grayscale WebP, ≤ 600 KB.
5. **Reference barcode** (runs after F3 passes): run `pipeline/tda_ref.py` on the exact float32 array written to `grid.f32`. Export every bar with persistence ≥ 1 m, plus the essential bar.
6. **Export to `public/data/colorado/`:**
   - `grid.f32`: little-endian float32, row-major, north row first.
   - `meta.json`: bbox; width; height; cellDeg; rowOrder; min and max with their cells; CRS (EPSG:4326); vertical datum; source and URL; licence; processing steps; connectivity; tie-break rule; generatedAt; git commit.
   - `barcode.json` (or a compact binary, if needed to stay ≤ 600 KB): columnar `b, d, bi, di`, with `d = null` for the essential bar. Values may be rounded to 0.1 m.
   - `hillshade.webp`.
   - `ATTRIBUTION.md`: the exact attribution text the Copernicus DEM licence requires (start from https://registry.opendata.aws/copernicus-dem/), plus a note that Copernicus DEM is a surface model that includes vegetation and buildings.
7. **Tests** (pytest):
   - bbox and shape;
   - no NaN;
   - plausible min and max;
   - the global-minimum cell is in the south-west region;
   - the byte layout matches what the JS loader expects;
   - `barcode.json` is reproducible across runs.
8. **`docs/data.md`:**
   - provenance and every processing step;
   - limitations: surface model, resolution, rectangle ≠ basin;
   - a table of the 10 longest-lived lakes (birth and death elevations, lat/lon of the birth and death cells), for the checker's geography check.

### 6.6 Explainer fact sheet (all TDA copy must stay within these statements)
1. The flooded region at water level t is the sublevel set {x : h(x) ≤ t}. Its connected pieces are lakes.
2. A lake is born when the water reaches a valley floor (a local minimum). It dies when it spills over a pass (a saddle) into an older lake. The older lake continues and keeps its color. This is the elder rule.
3. The barcode has one bar per lake, running from birth level to death level. This is 0-dimensional persistent homology of the sublevel-set filtration.
4. A bar's length (its persistence) is how deep its basin sits below its spill point. Long bars are distinct basins. Short bars are small dips that fill and spill almost immediately.
5. The lowest lake never dies. Its bar is infinite, because it eventually holds all the water.
6. Stability: if every height changes by at most ε, the barcode changes by at most ε in bottleneck distance. Only bars shorter than 2ε can appear or disappear.
7. GIS "fill sinks" raises every depression to its spill point, which removes every finite bar. Dropping only the bars below a persistence threshold is a gentler simplification.
8. The barcode depends only on the order of the heights. Pacing the water by percentile instead of by meters changes the animation speed, not which lakes merge with which.
9. Hydrologists call the filling and overflowing of depressions "fill and spill".

Any number about the Colorado data comes from the data files, never from memory.

## 7. Stack and conventions

**Stack and content**
- Astro (current stable) + TypeScript (strict). No UI framework. Vanilla TypeScript for canvases. Plain CSS with custom properties.
- Static output only, with no adapter. Use the docs for the installed Astro version (for example, to see where the content-collections config lives).
- Content is YAML or Markdown in content collections with zod schemas. Work-item schema:
  - `type`: preprint | paper | poster | talk | project | software | dataset
  - `title`
  - `date` (YYYY-MM[-DD]): required for papers, preprints, posters and talks; optional for projects and software
  - `description` (≤ 160 characters)
  - `venue?`
  - `authors[]` (including Andrew)
  - `links{pdf?, doi?, preprint?, code?, data?, slides?, poster?, site?}`
  - `tags[]`: research-area slugs
  - `featured?`, `draft`, `confirmed`
- Drafts appear in `npm run dev` with a visible "Draft" badge and are excluded from `npm run build`.

**Tooling and scripts**
- Tooling:
  - Vitest;
  - Playwright + @axe-core/playwright;
  - Lighthouse CI (@lhci/cli) using `staticDistDir: ./dist` (point it at Playwright's Chromium if Chrome isn't installed);
  - linkinator;
  - ESLint + Prettier;
  - `astro check`;
  - ruff and pytest for Python;
  - wrangler, for previewing `_headers` locally with `npx wrangler pages dev dist`.
- npm scripts: `dev`, `build`, `preview`, `check`, `lint`, `test`, `e2e`, `lhci`, `links`, `data`, and `verify`. `verify` runs check, lint, test, pytest, build, e2e, links and lhci in that order.

**Budgets**
- Lighthouse mobile, every page: accessibility ≥ 95, best practices ≥ 95, SEO ≥ 95.
- Performance ≥ 90 on every page except `/rising-water/` (≥ 80).
- CLS < 0.05.
- Page JavaScript ≤ 120 KB gzip, not counting data.
- No runtime requests to third-party origins.
- Browsers: the last two versions of Chrome, Firefox and Safari, including iOS.

**Hosting (Cloudflare Pages)**
- Build command `npm run build`; output directory `dist`; Node version pinned in `.nvmrc`.
- The site is served from the domain root, so `base` stays `/`.
- `astro.config` reads `site` from the `SITE_URL` environment variable:
  - until Andrew's domain exists, use the `*.pages.dev` URL;
  - afterwards, set it to his domain in the Cloudflare project settings.
- Canonical URLs and the sitemap always use `SITE_URL`.

**Git, secrets, ports**
- Control commits after each PASS, for example `feat(F3): persistence engine [checked]`.
- Never push, create remotes, run `wrangler login` or deploy without Andrew's explicit OK. Andrew does the Cloudflare login himself.
- Secrets go in `.env` (gitignored), with `.env.example` alongside. Never print keys.
- Only the checker runs `build`, `preview`, e2e and Lighthouse. Checkers run one at a time, on port 4321.
- Builders may run `npx astro dev --port 44NN`, where NN is the feature number.

**Repo layout**
```
portfolio-megaprompt.md        this spec
CLAUDE.md                      shared rules for all agents (§8.5)
.claude/agents/*.md            agent definitions (§8.3)
.nvmrc  .env.example  astro.config.mjs  package.json  …
docs/STATUS.md  DECISIONS.md  QUESTIONS.md  data.md  tda.md  deploy.md
docs/builds/F#/attempt-N.md    builder reports
docs/checks/F#/attempt-N.md    checker reports (+ screenshots, gitignored)
src/styles/ src/layouts/ src/components/{site,home,content,hero,explorer}/
src/pages/ src/content/ src/data/
src/lib/tda/ src/lib/viz/{common,hero,explorer}/
public/data/colorado/  public/_headers
pipeline/  (build_colorado.py, tda_ref.py, tests/, data/raw/ gitignored)
tests/unit/  tests/fixtures/  e2e/  scripts/
```

## 8. Agent team

### 8.1 Roster
| Agent | Does | Notes |
|---|---|---|
| control (you) | plan, delegate, integrate, commit, report | Owns shared files |
| site-builder | F1, F2, F7, F8 | Shell, content, pages, SEO, hosting config |
| tda-engineer | F3 | Persistence engine (TypeScript + Python reference) |
| data-engineer | F4a, F4b | Copernicus DEM → grid, hillshade, reference barcode |
| viz-builder | F5, F6 | Hero canvas, Colorado explorer |
| checker | verifies every feature, plus the F9 final audit | Never edits source |

### 8.2 File ownership
Each task may edit only its own paths, plus its own report folder `docs/builds/<F>/`. Anything else, including a new dependency, goes in the report as a request to Control.

| Task | Owner | May edit |
|---|---|---|
| Phase 0 | control | package.json, lockfile, astro.config.mjs, tsconfig.json, ESLint/Prettier/Vitest/Playwright/LHCI configs, .nvmrc, .gitignore, .env.example, CLAUDE.md, .claude/agents/**, docs/STATUS.md, docs/DECISIONS.md, docs/QUESTIONS.md, pipeline/requirements.txt |
| F1 | site-builder | src/styles/**, src/layouts/**, src/components/site/**, src/pages/index.astro, src/pages/404.astro, src/data/profile.yaml (create), public/favicon.svg, e2e/shell.spec.ts, and **stubs only** for src/components/hero/{Hero,HeroSettings}.astro and src/components/home/{Mission,RecentWork,ResearchGrid,OpenScience,Teaching,Contact}.astro |
| F2 | site-builder | src/content/**, the content-collections config file, src/data/**, src/components/content/**, src/components/home/**, src/pages/{garden,research,cv,about}/**, e2e/site.spec.ts |
| F3 | tda-engineer | src/lib/tda/**, tests/unit/tda/**, tests/fixtures/tda/**, pipeline/tda_ref.py, pipeline/tests/test_tda_ref.py, scripts/bench-tda.mjs, docs/tda.md |
| F4a, F4b | data-engineer | pipeline/** (except tda_ref.py and its test), public/data/colorado/**, docs/data.md |
| F5 | viz-builder | src/lib/viz/common/**, src/lib/viz/hero/**, src/components/hero/**, tests/unit/viz/**, e2e/hero.spec.ts |
| F6 | viz-builder | src/lib/viz/explorer/**, src/components/explorer/**, src/pages/rising-water/**, e2e/explorer.spec.ts |
| F7 | site-builder | src/components/site/Seo.astro, public/robots.txt, public/og/**, scripts/og-image.*, plus specific files Control lists for fixes |
| F8 | site-builder | public/_headers, public/_redirects (only if needed), docs/deploy.md, .github/workflows/ci.yml (optional; runs checks, never deploys) |
| F9 | checker | docs/checks/** only |

Integration rule: `src/pages/index.astro` (F1) composes the stub components. F2 and F5 fill in their own components and never edit `index.astro`. The home page passes `HeroSettings` into the layout's `settings` slot. The gear button appears only on pages that fill that slot.

### 8.3 Agent definitions (write each to `.claude/agents/<name>.md`)

Subagents start with only their own prompt plus CLAUDE.md. They don't see this conversation, so every delegation message must say what to read and what to do. `.claude/agents/` is new in this repo, and Claude Code loads a brand-new agents folder only at the next session start. For **this** session, spawn the built-in general-purpose agent for each role and paste the role file's body at the top of the delegation message. In later sessions, call the agents by name. Spawn subagents with the Agent tool (older Claude Code versions call it Task).

`.claude/agents/site-builder.md`
```markdown
---
name: site-builder
description: Builds the Astro site shell, design system, content collections, pages, SEO, and Cloudflare Pages config for Andrew Chincea's portfolio (features F1, F2, F7, F8 in portfolio-megaprompt.md). Use when Control delegates one of those features.
tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch
model: inherit
---
You are the site-builder for Andrew Chincea's portfolio. You build exactly one feature per task.

Start by reading CLAUDE.md, then the sections of portfolio-megaprompt.md your task names (always §3, §4, §7, §8.2, and your feature in §10). On a retry, read the previous check report first and fix every blocking item.

Rules:
- Edit only the paths your task says you own, plus docs/builds/<F>/. Need anything else (shared config, a dependency, another feature's file)? Stop and request it in your report.
- Use only facts from §3 and the content files. Unknown → draft entry with the field empty, listed under "Needs Andrew". Never guess titles, dates, links, or coauthors.
- Don't copy text, code, images, or exact layouts from the reference sites.
- The accessibility and performance budgets in §7 are requirements.
- Before reporting, run the fast checks for your area: astro check, lint, unit tests. You may run `npx astro dev --port 44NN` for self-checks. Don't run build, preview, e2e, or Lighthouse; the checker does.
- Don't spawn agents, commit, push, or deploy.

Finish by writing your build report (format in §9.5) to docs/builds/<F>/attempt-<N>.md and returning the same text.
```

`.claude/agents/tda-engineer.md`
```markdown
---
name: tda-engineer
description: Implements and tests the 0-dimensional persistent homology (sublevel-set, union-find, elder rule) engine in TypeScript and an independent Python reference for Andrew Chincea's portfolio (feature F3 in portfolio-megaprompt.md). Use when Control delegates F3.
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
---
You are the tda-engineer. Implement §6.1 exactly: total order by (height, index), 4-connectivity by default, the elder rule, and zero-length bars dropped from display but counted. Provide the §6.2 API.

Read CLAUDE.md and portfolio-megaprompt.md §6.1, §6.2, §7, §8.2, and §10/F3 first. On a retry, read the previous check report first.

Rules:
- TypeScript and Python must agree exactly on (birthCell, deathCell) pairs. Use shared JSON fixtures in tests/fixtures/tda/.
- Include the golden and checkerboard tests from F3's acceptance criteria. Before trusting any GUDHI construction, confirm its connectivity with the checkerboard test.
- Measure performance and report numbers plus the machine used. Never estimate them.
- Edit only your owned paths plus docs/builds/F3/. Don't spawn agents, commit, or push.

Finish by writing your build report (§9.5) to docs/builds/F3/attempt-<N>.md and returning the same text.
```

`.claude/agents/data-engineer.md`
```markdown
---
name: data-engineer
description: Builds the reproducible Python pipeline that turns Copernicus DEM GLO-90 tiles for the Colorado River Basin study area into the grid, hillshade, metadata, and reference barcode used by the Rising water explorer (features F4a, F4b in portfolio-megaprompt.md). Use when Control delegates F4a or F4b.
tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, WebSearch
model: inherit
---
You are the data-engineer. Follow portfolio-megaprompt.md §6.4 and §6.5 exactly, and read CLAUDE.md, §7, §8.2, and §10/F4 first. On a retry, read the previous check report first.

Rules:
- Real data only. Never synthesize, interpolate across missing land tiles, or substitute any other dataset under the Colorado label. If downloads fail, stop and report exactly what failed and what you need (for example, Andrew's OpenTopography API key).
- Use the bbox exactly as given. Confirm the tile naming and corner convention from a real tile before bulk download.
- Block-minimum for the TDA grid; block-mean only for the hillshade.
- Copy the licence's required attribution text exactly, with its source URL.
- Never commit raw tiles. Keep the outputs within the size budgets.
- Edit only your owned paths plus docs/builds/F4*/. Don't spawn agents, commit, or push.

Finish by writing your build report (§9.5) to docs/builds/<F>/attempt-<N>.md and returning the same text.
```

`.claude/agents/viz-builder.md`
```markdown
---
name: viz-builder
description: Builds the canvas visualizations for Andrew Chincea's portfolio, the synthetic Rising water hero (F5) and the Colorado River Basin explorer (F6), on top of the existing TDA engine (portfolio-megaprompt.md §6). Use when Control delegates F5 or F6.
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
---
You are the viz-builder. Build exactly one feature per task, following portfolio-megaprompt.md §4 and §6.3 (F5) or §6.4 (F6), plus §7, §8.2, and your feature in §10. Read CLAUDE.md first. On a retry, read the previous check report first.

Rules:
- Use src/lib/tda as-is; never edit it. If you need an engine change, request it in your report.
- Bars you draw must equal the engine's output. Every number shown in the explorer comes from the data files.
- Accessibility is required: keyboard control, text alternative, prefers-reduced-motion, and a hidden summary that updates on pause/scrub.
- Respect the performance budgets: pause when off-screen or in hidden tabs, cap DPR at 2, no per-frame allocations in hot loops.
- Copy about persistence must stay within §6.6.
- You may run `npx astro dev --port 44NN` and take your own Playwright screenshots for self-checks. Don't run build, preview, e2e suites, or Lighthouse.
- Edit only your owned paths plus docs/builds/<F>/. Don't spawn agents, commit, or push.

Finish by writing your build report (§9.5) to docs/builds/<F>/attempt-<N>.md and returning the same text.
```

`.claude/agents/checker.md`
```markdown
---
name: checker
description: Independently verifies one feature (or, for F9, the whole site) of Andrew Chincea's portfolio against portfolio-megaprompt.md and reports PASS, PASS_WITH_NOTES, or FAIL to Control. Use after every builder task and for the final audit.
tools: Read, Glob, Grep, Bash, Write, WebFetch, WebSearch
model: inherit
---
You are the checker. You didn't build this, and you don't trust the builder's report: reproduce every claim yourself.

Read CLAUDE.md, then portfolio-megaprompt.md §11 (your protocol), §7 (budgets), §8.2, and the feature's acceptance criteria in §10.

Rules:
- Never edit source, content, config, or data. Write only under docs/checks/ (reports, screenshots, and your own throwaway test tools in docs/checks/tools/).
- Run gates one at a time on port 4321. Open and look at every screenshot you take.
- For TDA work, compare against your own independent brute-force implementation, not the builder's helpers.
- Verify geography and licence claims against primary sources on the web.
- Verdict: PASS only if every blocking acceptance criterion and every hard gate passes. PASS_WITH_NOTES only for non-blocking issues. Otherwise FAIL, with numbered fixes that each give file:line, expected vs actual, and how to reproduce.
- Don't spawn agents, commit, push, or deploy.

Finish by writing your report (format in §9.5) to docs/checks/<F>/attempt-<N>.md and returning the same text.
```

### 8.4 Delegation templates

Builder delegation:
```
[ROLE — paste the body of .claude/agents/<role>.md here if this session can't call it by name]
FEATURE: F# <name>   ATTEMPT: N
READ FIRST: CLAUDE.md; portfolio-megaprompt.md §3, §4, §7, §8.2, §<feature sections>, §10/F#
YOU OWN (may edit): <paths from §8.2>  + docs/builds/F#/
DO NOT EDIT: anything else — request changes in your report
ACCEPTANCE CRITERIA: <copy from §10>
PREVIOUS CHECK REPORT: docs/checks/F#/attempt-(N-1).md  (retry only — fix every blocking item first)
DELIVER: docs/builds/F#/attempt-N.md (format §9.5); return the same text
```

Checker delegation:
```
[ROLE — paste the body of .claude/agents/checker.md here if needed]
FEATURE: F# <name>   ATTEMPT: N
BUILDER REPORT: docs/builds/F#/attempt-N.md (claims to verify — don't trust them)
CHANGED FILES: <git status --porcelain, filtered to the feature's owned paths>
ACCEPTANCE CRITERIA: <copy from §10>
GATES: §11 steps <list the applicable ones>
DELIVER: docs/checks/F#/attempt-N.md with a verdict; return the same text
```

### 8.5 CLAUDE.md (write this file in Phase 0)
```markdown
# Andrew Chincea — portfolio

Static Astro + TypeScript site with a Python data pipeline, hosted on Cloudflare Pages. Full spec: portfolio-megaprompt.md (authoritative).

## Commands
npm run dev | build | preview | check | lint | test | e2e | lhci | links | data | verify
Python tests: pipeline/.venv/bin/python -m pytest pipeline -q   (Windows: pipeline\.venv\Scripts\python)

## Rules for every agent
- Facts about Andrew come only from spec §3 and src/content. Unknown → draft + "Needs Andrew". Never invent.
- Edit only the files you own for your current task (spec §8.2). Shared files belong to Control.
- Don't copy from the reference sites. No trackers or third-party runtime requests.
- Persistence math follows spec §6.1 exactly: ties broken by (height, index), 4-connectivity, elder rule.
- Never fabricate Colorado data. Never commit raw DEM tiles or secrets.
- Only the checker runs build, preview, e2e, and Lighthouse (port 4321, one at a time). Builders may run `npx astro dev --port 44NN`.
- Never push, deploy, run `wrangler login`, or create remotes. Control commits after a checker PASS.
- Reports: builders → docs/builds/F#/attempt-N.md; checkers → docs/checks/F#/attempt-N.md.
```

## 9. Workflow

### 9.1 Phase 0: setup (you, Control)
1. Check the toolchain: `node -v` (≥ 20), `npm -v`, `python3 --version` (≥ 3.10), `git --version`. If anything is missing, stop and tell Andrew exactly what to install.
2. If `portfolio-megaprompt.md` isn't in the folder, save this spec there verbatim.
3. Run `git init`. Write `.gitignore`: node_modules/, dist/, .astro/, .env, pipeline/.venv/, pipeline/data/raw/, test-results/, playwright-report/, .lighthouseci/, .wrangler/, docs/checks/**/*.png.
4. Write `CLAUDE.md` (§8.5) and the five agent files (§8.3). Expect a permission prompt for `.claude/`.
5. Scaffold Astro into the current folder without overwriting existing files. Use the minimal template and strict TypeScript; check `npm create astro@latest -- --help` for current non-interactive flags. Then install everything up front, so builders never touch package.json:
   - dependencies: @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono, @astrojs/sitemap;
   - devDependencies: typescript, @astrojs/check, vitest, @playwright/test, @axe-core/playwright, @lhci/cli, linkinator, eslint, eslint-plugin-astro, prettier, prettier-plugin-astro, wrangler;
   - `npx playwright install chromium`;
   - configs: astro.config (static output, sitemap integration, `site` from `SITE_URL`), vitest, playwright (webServer = preview on port 4321), lighthouserc (staticDistDir `./dist`), ESLint, Prettier;
   - `.nvmrc` with the Node major version you're using; `.env.example` with `SITE_URL=` and `OPENTOPOGRAPHY_API_KEY=`;
   - the npm scripts from §7.
6. Python: create `pipeline/.venv`, write `pipeline/requirements.txt`, and install it.
   - If gudhi fails to install, log it in DECISIONS.md. GUDHI is only used in tests, so the F3 builder falls back to the brute-force comparison.
   - If rasterio fails, stop and ask Andrew.
7. Create `docs/STATUS.md` (§9.4), `docs/DECISIONS.md`, and `docs/QUESTIONS.md` (seeded with every [A] item from §3), plus the `docs/builds/` and `docs/checks/` folders.
8. Commit: `chore: scaffold, agents, spec`.

### 9.2 Phases and dependencies
- **Phase 1:** F1 → check.
- **Phase 2:** start F2, F3 and F4a in parallel, as three Agent calls in a single message. Check each one as it returns; checkers run one at a time.
- **Phase 3:** F4b (needs F3 PASS) and F5 (needs F1 + F3) in parallel. Then F6 (needs F4b + F5).
- **Phase 4:** F7, then F8.
- **Phase 5:** F9, the final audit by a fresh checker. At most two fix rounds, through the owning builders.
- **Phase 6:** final report to Andrew (§12).

### 9.3 The build–check loop
For each feature:
1. Mark it `building` in STATUS.md and delegate to its builder (template §8.4).
2. When the builder returns, mark it `checking` and delegate to a **fresh** checker (template §8.4).
3. **PASS or PASS_WITH_NOTES:** commit only that feature's owned paths (`git add <paths>`; `git commit -m "feat(F#): … [checked]"`). Mark it `done` and copy any notes into STATUS.md.
4. **FAIL:** increase the attempt number and send the builder the check report.
5. **After 3 FAILs:** mark it `blocked`, write the problem to QUESTIONS.md, tell Andrew in one short paragraph, and continue with work that doesn't depend on it.
6. Never skip a check. Never overrule a FAIL. Never edit feature code yourself to get a PASS.
7. If you believe a checker is wrong, run a second fresh checker and describe the dispute neutrally. If it also fails the feature, the FAIL stands.
8. When a builder requests a shared-file change or a dependency, make the change yourself, log it in DECISIONS.md, and re-delegate.

### 9.4 Status board (`docs/STATUS.md`)
```
| Feature | Owner | State | Attempt | Last report | Notes |
|---|---|---|---|---|---|
| F1 Site shell | site-builder | done | 2 | docs/checks/F1/attempt-2.md | PASS_WITH_NOTES: … |
```
States: `todo`, `building`, `checking`, `done`, `blocked`. Update the board on every state change. It's how Andrew follows progress.

### 9.5 Report formats

Build report:
```
# Build report — F# <name> — attempt N
Summary: 2–4 sentences
Files changed: list
How to verify: exact commands
Acceptance criteria (self-check): one line per criterion — ✅/❌ + evidence
Needs Andrew: facts or decisions only Andrew can supply
Requests to Control: shared-file changes or dependencies (exact package or diff)
Known limitations:
```

Check report:
```
# Check report — F# <name> — attempt N
Verdict: PASS | PASS_WITH_NOTES | FAIL
Gates: check · lint · unit (n) · pytest (n) · build · e2e (n) · axe · lighthouse (scores) · links · visual · content · tda · data — each ✅ / ❌ / n/a
Acceptance criteria: one line per criterion — evidence (command + result, or screenshot path)
Blocking fixes (FAIL only): numbered; file:line; expected vs actual; how to reproduce
Notes (non-blocking):
Artifacts: paths
```

### 9.6 When to stop and ask Andrew
Ask only when:
- the toolchain is missing or won't install (Node, Python, rasterio);
- the DEM download fails on AWS and the fallback needs his OpenTopography API key;
- a feature is blocked after three attempts;
- you're ready to deploy. You need his domain name (or approval to use the `*.pages.dev` URL for now), his decision on GitHub-connected builds vs. direct upload, and his explicit OK. He runs any `wrangler login` himself.

Decide everything else yourself and log it in DECISIONS.md. Collect content questions in QUESTIONS.md and ask them all at the end.

## 10. Features and acceptance criteria

### F1 Site shell and design system (site-builder)
1. Color, type and spacing tokens live in one file. Light and dark themes work. The OS theme is the default, the toggle persists, and there's no flash of the wrong theme.
2. The header has the wordmark, the §4.3 nav and the gear slot. The nav adapts on mobile. A skip link works, and focus is visible everywhere.
3. The settings panel shell (§4.1): drawer on desktop and bottom sheet on mobile, `aria-expanded`, Esc closes it, focus returns to the gear, and the state is remembered.
4. Fonts are self-hosted and the page makes zero third-party requests.
5. `index.astro` composes the stub components for every §4.3 section, with anchors, and the nav scrolls to them. The 404 page exists.
6. axe reports 0 serious/critical issues. Lighthouse accessibility is ≥ 95 on `/` and `/404`. The layout is clean at 375, 768 and 1280 px in both themes.

### F2 Content and pages (site-builder)
1. Schemas follow §7. Every §3 item appears exactly once. [A] fields are empty and the item has `draft: true`. Nothing appears beyond §3.
2. The production build hides drafts, and dev shows them with a "Draft" badge. Visible text in `dist/` has zero matches for TODO|TBD|lorem|placeholder (case-insensitive).
3. Garden:
   - filter chips by type and by research area;
   - `?type=` and `?tag=` deep links;
   - works without JavaScript;
   - keyboard operable;
   - rows formatted per §4.1.
4. Research cards and topic pages follow §4.3. "Related work" filters the Garden. SVG thumbnails are generated deterministically per slug, with no stock images.
5. Citations follow §4.3: Andrew in bold, buttons only for links that exist, dates as "Mon YYYY".
6. The CV page is generated from content: education, research, presentations, projects. The PDF link appears only if the file exists.
7. Lighthouse accessibility, best practices and SEO are ≥ 95 on `/garden/`, `/cv/` and one `/research/` page.

### F3 Persistence engine (tda-engineer)
1. The API follows §6.2 and the semantics follow §6.1, documented in `docs/tda.md` with the golden example.
2. **Golden test:** a 1×7 grid `[10, 1, 8, 3, 6, 5, 10]` gives:
   - finite bars 5→6 (birth cell 5, death cell 4) and 3→8 (birth cell 3, death cell 2);
   - the essential bar, born at 1 in cell 1.
3. **Checkerboard test:** `[[0,1],[1,0]]` gives one finite bar 0→1 plus the essential bar with 4-connectivity, and no finite bar with 8-connectivity.
4. **Property tests** on ≥ 500 random grids (1×1 to 40×40, with and without ties):
   - births = the number of cells with no ≺-earlier neighbor;
   - finite bars (including zero-length) + essential bars = births;
   - every death kills the younger root;
   - every death cell had ≥ 2 distinct neighbor roots;
   - (birthCell, deathCell) pairs don't change under strictly increasing transforms of the heights.
5. TypeScript and Python produce identical pairs on 200 random grids with ties, from shared fixtures.
6. **GUDHI agreement** on 100 tie-free random grids, with finite bars compared as multisets to within 1e-9:
   - use a GUDHI cubical construction whose connectivity matches 4-neighbors, confirmed with the checkerboard test;
   - if no construction matches, compare the 8-connectivity mode against GUDHI instead, and document why;
   - if GUDHI isn't installed, substitute an independent brute-force comparison and record that.
7. **Benchmark** (Node, `scripts/bench-tda.mjs`): `computeH0` at 326×414 runs in ≤ 300 ms, and `Flood` runs in ≤ 6 ms per frame. Report the measured numbers and the machine.

### F4a Colorado DEM → grid (data-engineer)
1. `npm run data` runs end-to-end from cached tiles and from an empty cache. The download path must be exercised at least once.
2. The tile naming and corner convention are verified and documented. Missing tiles are listed with reasons.
3. `grid.f32`, `meta.json`, `hillshade.webp` and `ATTRIBUTION.md` exist. `meta.bbox` equals the §6.4 bbox exactly. Dimensions are recorded (expected 326 × 414).
4. pytest passes (§6.5 step 7).
5. Sizes: `grid.f32` ≤ 600 KB, `hillshade.webp` ≤ 600 KB.
6. `ATTRIBUTION.md` holds the licence's exact required text and its URL. `docs/data.md` covers provenance and limitations; the lakes table is filled in F4b.
7. Raw tiles are gitignored, and nothing is synthesized.

### F4b Reference barcode (data-engineer; after F3 PASS)
1. `barcode.json` follows §6.5 step 5 (bars ≥ 1 m plus the essential bar), is ≤ 600 KB, and is reproducible.
2. The essential bar is born at the grid's global-minimum cell.
3. The lakes table in `docs/data.md` (top 10, with lat/lon) is complete.

### F5 Synthetic hero (viz-builder)
1. Everything in §6.3 works.
2. The drawn bars equal the engine's bars for the same seed, tested against the renderer's data model.
3. The canvas is non-blank within 500 ms of hydration (e2e pixel-variance check), and the console shows no errors.
4. The controls work with mouse, touch and keyboard. The settings live in F1's panel through `HeroSettings`.
5. With reduced motion there is no autoplay (e2e with emulated `prefers-reduced-motion`).
6. The animation pauses when off-screen and in hidden tabs.
7. p95 frame time is ≤ 22 ms during play (e2e requestAnimationFrame sampling in Chromium at 1280×800).
8. Lighthouse mobile on `/`: performance ≥ 90 and accessibility ≥ 95.

### F6 Colorado explorer (viz-builder; after F4b and F5)
1. Everything in §6.4 works.
2. The live engine barcode on `grid.f32` equals `barcode.json`: identical (bi, di) pairs, with values within rounding.
3. Clicking a bar or a table button jumps the level, highlights the lake and shows the info card. The card's values match the data.
4. Explainer copy uses only §6.6. "About the data" is generated from `meta.json` and `ATTRIBUTION.md`.
5. The map uses the portrait aspect from `meta.json` (about 0.63) without distortion. The layout is clean at 375, 768 and 1280 px in both themes.
6. Data transferred is ≤ 3 MB. Lighthouse mobile: performance ≥ 80, accessibility ≥ 95. The console shows no errors.

### F7 Polish, SEO, performance and accessibility pass (site-builder)
1. Every page meets the §7 budgets.
2. Meta, OG and canonical tags plus the sitemap are valid, and all built from `SITE_URL`.
3. Internal links are clean.
4. A social-card image exists: a static PNG of a hero frame.

### F8 Cloudflare Pages setup (site-builder)
1. `public/_headers` sets:
   - long immutable caching for `/_astro/*`;
   - moderate caching for `/data/*`;
   - security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a Content-Security-Policy that allows only self). Inline theme script: use a hash or document the trade-off.
   - Verify with `npx wrangler pages dev dist` and curl. This runs locally and needs no login.
2. `docs/deploy.md` gives Andrew exact steps for both ways to deploy:
   - **(a) Git integration (recommended):** push the repo to GitHub. In the Cloudflare dashboard, go to Workers & Pages → Create → Pages → Connect to Git, choose framework preset Astro, build command `npm run build`, output `dist`. Set `SITE_URL`; the Node version comes from `.nvmrc`. Every push deploys, and branches get preview URLs.
   - **(b) Direct upload:** `npx wrangler login` (Andrew runs this), then `npm run build && npx wrangler pages deploy dist`.
3. `docs/deploy.md` also gives custom-domain steps:
   - add the domain under the Pages project's Custom domains;
   - an apex domain (`example.com`) must be a zone on the same Cloudflare account, meaning its nameservers point to Cloudflare. Buying the domain through Cloudflare does this automatically;
   - a subdomain at another DNS provider works with a CNAME to `<project>.pages.dev`;
   - add `www` too and redirect it to the apex with a Cloudflare redirect rule;
   - after the domain is live, update `SITE_URL` and rebuild.
4. Optional `.github/workflows/ci.yml` runs `npm run verify` on pull requests. It never deploys; Cloudflare does that.
5. Nothing gets pushed or deployed. `npm run build` with `SITE_URL` set produces correct canonical URLs and sitemap entries.

(If Andrew ever prefers Cloudflare Workers static assets instead of Pages, the only change is a `wrangler.jsonc` with `"assets": { "directory": "./dist", "not_found_handling": "404-page" }`. Note this in docs/deploy.md and don't build it.)

### F9 Final audit (checker, fresh instance)
The whole site, covering:
- every §11 gate on every page;
- a full visual review: every page × 3 widths × 2 themes;
- a content audit against §3;
- an explainer audit against §6.6;
- a data audit (§11 step 10);
- every budget.

Write `docs/checks/F9/attempt-N.md` plus `docs/checks/F9/summary.md`, a one-page summary for Andrew.

### Stretch (only after F9 PASS and only if Andrew says yes)
- **S1. Extra hero modes,** echoing Rich's second canvas:
  - Dye spill: a contaminant plume carried by a curl-noise current with Brownian diffusion; click to release.
  - Fractal pond: the 2D wave equation in a pond shaped like a Koch snowflake or Sierpinski gasket; click to drop.
  - Random rivers: a Scheidegger coalescing-random-walk network colored by Strahler order.
  - Collatz delta: reverse Collatz paths that bend on even/odd steps and braid into one trunk.
- **S2. Islands barcode (H1):** an island is born when the water closes a ring around a hill and dies when the hilltop goes under.
- **S3. Basin mask:** an optional toggle masking the map to USGS Watershed Boundary Dataset regions 14 and 15 (the US portion; document the coverage gap in Mexico).
- **S4. Place labels:** coordinates from USGS GNIS, with the source cited.

## 11. Checker protocol

Run the steps that apply, in order. Record every result, even after a failure.
1. **Static checks:** `npm run check`, `npm run lint`, `npm test`, `pipeline/.venv/bin/python -m pytest pipeline -q`, `ruff check pipeline`.
2. **Build and e2e:** `npm run build`, then `npx playwright test` (including the axe checks) against preview on port 4321.
3. **Lighthouse CI** (mobile, `staticDistDir`) on the affected pages. Compare against the §7 budgets.
4. **Links:** linkinator on `dist/`. Internal links must pass; external failures are warnings.
5. **Visual review:**
   - Screenshot the affected pages at 375×812, 768×1024 and 1280×800, in light and dark, into `docs/checks/<F>/attempt-N/`.
   - Open every PNG. FAIL for: overlapping or clipped text, low contrast, a blank or frozen canvas, horizontal overflow, broken fonts, misalignment, or controls that don't fit.
6. **Content integrity:**
   - Every rendered fact must trace back to §3 or a content file.
   - Grep `dist/` for TODO|TBD|lorem|placeholder; there must be zero matches in visible text.
   - Drafts must be absent from production.
   - Collaborators appear only as coauthors.
7. **TDA correctness** (F3, F5, F6, F9):
   - In `docs/checks/tools/`, write your own brute-force H0: label components with BFS at every distinct level on small grids, then derive births and deaths with the elder rule.
   - Compare it with the engine on ≥ 50 random grids, including ties.
   - Rerun the golden and checkerboard cases.
   - For F6 and F9, confirm JS equals Python on the Colorado grid.
8. **Explainer audit:** every sentence of TDA copy is consistent with §6.6, and every number traces to the data files.
9. **Performance:** frame-time sampling for the canvases, JavaScript bundle sizes from the build output, and data sizes.
10. **Data audit** (F4a, F4b, F6, F9):
    - `meta.bbox` equals the spec bbox exactly, and the grid dimensions are correct.
    - The minimum is near sea level and the maximum is plausible. The highest raw point is near Uncompahgre Peak; verify its coordinates from USGS GNIS or another primary source.
    - The global minimum is near the delta in the south-west.
    - The top lakes make geographic sense: check them against maps and sources (for example, the Great Basin closed basins and the Great Divide Basin).
    - The attribution text matches the licence page word for word.
11. **Hosting** (F8, F9):
    - `npx wrangler pages dev dist` serves the site, and the headers match `_headers`.
    - Unknown routes get the custom 404 page.
    - Canonical URLs use `SITE_URL`.

Verdict rules: see the checker agent definition (§8.3). The checker never edits anything outside `docs/checks/`.

## 12. Final report to Andrew (you, at the end)
Keep it to one screen:
```
# Portfolio build — final report
What's built: pages and features, one line each
How to run: npm run dev · npm run data · npm run verify
Check summary: table F1–F9 → verdict, attempts
Screenshots: docs/checks/F9/attempt-N/
Needs Andrew (content): grouped list, each with the file to edit
Decisions I made: the 5 that matter most (full list in docs/DECISIONS.md)
Known issues and notes
Deploy: ready; steps in docs/deploy.md; waiting for your domain and your OK
Next steps: stretch items S1–S4
```

## 13. Never
- Invent or "fill in" facts, titles, dates, links, coauthors or numbers.
- Copy text, code or assets from richpauloo.com or samzipper.com.
- Push, deploy, run `wrangler login`, create remotes or publish without Andrew's explicit OK.
- Commit secrets, raw DEM tiles, or any file over 5 MB.
- Fake the Colorado data, or ship any other dataset under the Colorado label.
- Add analytics, trackers or third-party runtime requests.
- Skip or overrule a checker FAIL, or mark a feature done without a PASS report on disk.
