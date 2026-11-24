# Build report — D1 GitHub Pages base-path support — attempt 1

Summary: I added one helper, `src/lib/url.ts`, and passed every root-relative internal URL in src/ through it. That covers nav and section anchors, page links, Garden chips, work-item `links.*`, the CV PDF, the favicon, og:image, the hillshade preload and `<img>`, the explorer data fetches, and the robots.txt Sitemap line. With `BASE_PATH=/Personal-Portfolio/`, every same-origin href, src and fetch resolves under `/Personal-Portfolio/`. With BASE_PATH unset, the helper returns its input unchanged, so the default (Cloudflare) output has the same URLs as before. Content files still store root-relative paths (`links.site: /rising-water/` is unchanged). The base is added only where links are rendered.

## Helper API (`src/lib/url.ts`)
- `BASE: string` is `import.meta.env.BASE_URL`, normalised to a leading and trailing slash (`'/'` or `'/Personal-Portfolio/'`). It works in .astro frontmatter, in client bundles and in Vitest (where it is `'/'`).
- `normalizeBase(base?: string): string`: `''`/`'/'` → `'/'`; `'a'`, `'/a'`, `'//a//'` → `'/a/'`.
- `withBase(path: string, base = BASE): string`:
  - Prefixes root-relative paths: `'/garden/?tag=x'` → `'/Personal-Portfolio/garden/?tag=x'`, `'/#mission'` → `'/Personal-Portfolio/#mission'`, `'/'` → `'/Personal-Portfolio/'`.
  - Returns these unchanged: absolute URLs (`https:`, `mailto:`), protocol-relative `//…`, relative paths, `#frag`, `?q`, `''`.
  - Idempotent: a path that already starts with the base is not prefixed twice. Seo relies on this, because `Astro.url.pathname` already includes the base.
  - With base `'/'` it returns its input unchanged.
- `stripBase(pathname: string, base = BASE): string`: `'/Personal-Portfolio/cv/'` → `'/cv/'`. Paths outside the base are returned unchanged. Seo uses it for the 404 detection.

## Files changed
- src/lib/url.ts (new)
- src/components/content/work.ts: `researchHref`, `gardenTagHref` and `primaryHref` (a work item's own link) go through `withBase`.
- src/components/content/Citation.astro: the title link (`links.site`) and every link button go through `withBase`. External URLs pass through unchanged.
- src/components/site/nav.ts: all six nav hrefs, including the `/#mission`-style anchors.
- src/components/site/Header.astro: the wordmark href and its `aria-current` use `withBase('/')`. `isCurrent` still compares against the now-based nav hrefs.
- src/components/site/Footer.astro: the About link.
- src/components/site/Seo.astro: canonical and og:url use `withBase(Astro.url.pathname)`, which is idempotent, so there is no double prefix. og:image and twitter:image use `withBase('/og/social-card.png')`. The 404 test uses `stripBase`.
- src/layouts/BaseLayout.astro: the favicon.
- src/components/home/RecentWork.astro: the "All work" link.
- src/components/hero/Hero.astro: the link to the explorer.
- src/components/explorer/Explorer.astro: the hillshade `<img src>`.
- src/pages/rising-water/index.astro: the hillshade `<link rel="preload">`.
- src/lib/viz/explorer/data.ts: `DATA_BASE = withBase('/data/colorado/')`, used by every grid.f32, meta.json and barcode.json fetch.
- src/pages/404.astro: the home link.
- src/pages/about/index.astro: the `/#research`, `/garden/` and `/cv/` links.
- src/pages/cv/index.astro: a local CV PDF path goes through `withBase`.
- src/pages/garden/index.astro: the "All" chips, the type and tag chips, and the reset link.
- src/pages/research/[slug].astro: the Research breadcrumb and the Rising water link.
- src/pages/robots.txt.ts: the Sitemap line is `new URL(withBase('/sitemap-index.xml'), site)`, which equals `new URL('sitemap-index.xml', site + base)`.
- scripts/og-image.mjs: it now navigates relative to `--base`, so a sub-path server URL works. The default (`http://localhost:4407` → `/?seed=7`) behaves as before.
- docs/builds/D1/attempt-1.md (this report)

Not changed, because they already work under a sub-path:
- src/content/work/project-rising-water.yaml: kept as `/rising-water/`; the base is added at render time.
- garden-client.ts: its URL sync builds from `location.pathname`, which already includes the base.
- hero-client.ts: it only reads `location.search`.
- Fonts and CSS: they come from Vite/Astro-emitted assets, which are base-aware. There are no hard-coded `url(/…)` in src.

## How to verify
```
npm run check && npm run lint && npm test
BASE_PATH=/Personal-Portfolio/ npx astro dev --port 4409   # crawl http://localhost:4409/Personal-Portfolio/
npx astro dev --port 4409                                   # crawl http://localhost:4409/
# checker: BASE_PATH=/Personal-Portfolio/ SITE_URL=https://andrewc156.github.io npm run build
#   then grep -rE '(href|src)="/' dist | grep -v '"/Personal-Portfolio/' should be empty
```

## Acceptance criteria (self-check)
- ✅ `npm run check`: 0 errors, 0 warnings, 0 hints (113 files). `npm run lint`: ESLint and Prettier clean. `npm test`: 439/439 pass.
- ✅ Helper behaviour: I ran a throwaway Vitest file covering root base, sub-path base, query, fragment, already-based paths, a `/Personal-Portfolio-x/` near-miss, external URLs, `mailto:`, `//`, `stripBase` and `normalizeBase`. It passed 2/2. I created it temporarily under tests/unit/ to match the Vitest include pattern, then moved it to the scratchpad. It is not in the repo; see Requests to Control.
- ✅ Base crawl (`BASE_PATH=/Personal-Portfolio/`, Playwright, 12 pages: home, about, cv, garden, garden?tag, research index, 4 topic pages, rising-water, 404):
  - Every same-origin request and every `[href]`/`[src]` started with `/Personal-Portfolio/` and returned 200. The only exceptions were dev-only Vite module URLs, which are not part of the build.
  - Requests included `/Personal-Portfolio/data/colorado/{grid.f32,meta.json,barcode.json,hillshade.webp}`.
  - BAD list was empty.
- ✅ Explorer under base: "600 of 600" appeared.
- ✅ Hero under base: the canvas rendered (565×283).
- ✅ Garden under base: clicking the number-theory chip gave `/Personal-Portfolio/garden/?tag=number-theory`, and Back returned to `/Personal-Portfolio/garden/`.
- ✅ Nav anchors under base: clicking Mission, Research, Work and Open science gave `/Personal-Portfolio/#…` on the home page.
- ✅ Seo under base: canonical and og:url are `http://localhost:4321/Personal-Portfolio/garden/` (no double prefix), and og:image is `…/Personal-Portfolio/og/social-card.png`.
- ✅ Hillshade under base: the preload and `<img>` both use `/Personal-Portfolio/data/colorado/hillshade.webp`.
- ✅ robots.txt under base: `Sitemap: http://localhost:4321/Personal-Portfolio/sitemap-index.xml`.
- ✅ Root crawl (BASE_PATH unset): same 12 pages, all refs and requests root-relative and 200, "600 of 600" appeared, garden URL sync stays under `/garden/`, and nav anchors go to `/#…`.
- ✅ Root output: canonical is `http://localhost:4321/garden/`, robots has `Sitemap: http://localhost:4321/sitemap-index.xml`, the home-page href list is the same set as before (`/`, `/#mission`, `/cv/`, `/garden/?tag=…`, …), and `aria-current="page"` is still on `/cv/` and on the wordmark at `/`.
- ✅ 0 console errors, except the expected one on the 404 page (the document's own 404 status).
- ✅ The dev server on port 4409 is stopped. Only my own process (PID-matched on port 4409) was killed.

## Needs Andrew
None.

## Requests to Control
1. Optional: add a permanent unit test for the helper as `tests/unit/url.test.ts` (I don't own tests/). A suggested version is at /private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/1f67abd1-ed51-4a07-9073-e87a4f7de7b0/scratchpad/ut/url.test.ts. Change its import path to `../../src/lib/url` if you put it at tests/unit/url.test.ts; that is the path it already uses.
2. Checker: please run a production build with `BASE_PATH=/Personal-Portfolio/ SITE_URL=https://andrewc156.github.io`. Grep dist for root-relative `href="/`, `src="/` and `url(/` that lack the base, and confirm that `_astro` asset and font URLs are prefixed. I could not run build.

## Known limitations
- Under a sub-path, `robots.txt` lives at `/Personal-Portfolio/robots.txt`, which crawlers don't read (accepted in DECISIONS #59). Its `Allow: /` is left as is.
- The 404 page: GitHub Pages serves only the root `/404.html` for unknown paths. Its links are base-prefixed, so they still work from any path.
- No e2e specs were changed. They run with base '/', and the default output is unchanged.
