# Build report — F7 Polish, SEO, performance and accessibility pass — attempt 1

Summary: **Revision (Control decision DECISIONS #53, option b):** the 404 page no longer has `noindex`. Its HTTP 404 status keeps it out of indexes, and §7 requires SEO ≥ 95 on every page. It still has no canonical and no og:url. e2e/seo.spec.ts now asserts the 404 status and the *absence* of a robots meta. The Rising water YAML comment is updated (Request 2 approved). check, lint and test were rerun and are green.

Every page now has a canonical URL, a meta description, Open Graph and Twitter tags (from the new `Seo.astro`), plus an absolute social-card image. All of these are built from `Astro.site`, so they follow `SITE_URL`. The 404 page has no canonical (no `noindex`, per #53). `robots.txt` is an Astro endpoint, so its sitemap URL is also absolute from `SITE_URL`. A script generates the social card deterministically (1200×630 PNG, 168.6 KB). The Control-listed fixes are in: an /about/ link in the footer, a Garden description built from the types that are actually present, a tighter anchor test, and Rising water dated 2026-11. The earlier conflict (noindex vs SEO ≥ 95 on /404.html) is resolved by dropping noindex.

Files changed:
- src/components/site/Seo.astro (new): description (clamped to ≤ 160 characters), canonical, og:type/site_name/locale/title/description/url/image(+type/width/height/alt), twitter:card/title/description/image/image:alt. On 404 (`Astro.routePattern === '/404'`) it omits the canonical and og:url and emits no robots meta (DECISIONS #53).
- src/layouts/BaseLayout.astro: imports Seo and renders `<Seo title={fullTitle} description={description} />` in place of the old description meta. `<title>` stays here. The inline theme script is byte-identical (the diff touches only the import line and that one line).
- src/pages/robots.txt.ts (new endpoint, owned for this task). No public/robots.txt was created. Output: `User-agent: *`, `Allow: /`, `Sitemap: <SITE_URL>/sitemap-index.xml`.
- public/og/social-card.png (new): 1200×630, 8-bit RGB, 168.6 KB. Hero seed 7 at level 0.28, light theme, composited with the name and tagline from profile.yaml.
- scripts/og-image.mjs (new): the generator. It uses Playwright (already installed) plus `yaml` and @fontsource files (already dependencies). No new dependencies.
- src/components/site/Footer.astro: `© year Andrew Chincea · About · Built with help from Claude Code`, still one line.
- src/pages/garden/index.astro: the meta description is derived from `presentTypes`, which are the non-draft types in production. Production gives "All of Andrew Chincea's work: posters and projects, filterable by type and research area." Dev, with drafts, also lists preprints and talks.
- src/content/work/project-rising-water.yaml: `date: '2026-11'` (quoted like the other content files). The top comment now reads `# Spec §3, confirmed by Andrew. Date is the month F6 (the explorer) passed its check.` (Request 2, approved).
- e2e/shell.spec.ts (anchor test only): after the DECISIONS #41 settle, each target's top must equal its `scroll-margin-top` within ±2 px and `scrollY > 0`. A section too close to the page end to reach the top must have the page at max scroll and its top at or below the margin.
- e2e/seo.spec.ts (new): covers every public page (canonical, description, og/twitter, the image, one h1, lang), the 404, the sitemap and robots.txt. Details under criterion 2.

How to verify:
- `npm run check` (0 errors, 0 warnings, 0 hints), `npm run lint` (clean), `npm test` (15 files, 439 passed). All three were run.
- Checker: `npm run build && npx playwright test e2e/seo.spec.ts e2e/shell.spec.ts`, then `npm run links` and `LHCI_URLS=/,/garden/,/research/,/research/water-quality/,/research/tda-rivernets/,/research/number-theory/,/research/spectral-fractals/,/cv/,/about/,/rising-water/,/404.html npm run lhci`. Use the DECISIONS #50 protocol: warm-up run, then the median of ≥ 3.
- Also check `dist/robots.txt`, `dist/sitemap-index.xml`, `dist/sitemap-0.xml` and `dist/og/social-card.png` after the build.
- To regenerate the social card: start any server for the site (`npx astro dev --port 4407`), then run `node scripts/og-image.mjs --base http://localhost:4407`. Options: `--seed 7 --level 0.28 --out public/og/social-card.png` (these are the defaults). The output is deterministic (two runs were byte-identical). The script exits 1 if the PNG is over 300 KB. Stop the server afterwards.

Acceptance criteria (self-check):
1. Every page meets the §7 budgets — ✅. With no noindex, Lighthouse's is-crawlable audit passes on /404.html, so its SEO score is no longer capped at about 69. F7 adds no JavaScript and about 1.5 KB of `<head>` HTML per page. The OG image is not loaded by any page. The new footer link is in a text block and underlined. On dev, axe found 0 violations on /, /garden/, /about/, /cv/ and an unknown route, at 375 and 1280 px in light and dark. The latest check reports show page JS ≤ 16 KB gzip (F5, F6), CLS ≤ 0.004, all 100s on /, /404.html, /garden/, /cv/ and /research/tda-rivernets/, and /rising-water/ at 97/100/96/100 (BP 96 is the deliberate hillshade aspect, left alone). Lighthouse's canonical audit only fails relative URLs, hreflang conflicts or every page pointing to the root. A canonical on :4321 while LHCI serves another port passes (checked in node_modules/lighthouse/core/audits/seo/canonical.js). Lighthouse now also finds a valid robots.txt. I could not run build or Lighthouse, so this is reasoned, not measured.
2. Meta, OG, canonical and sitemap are built from SITE_URL — ✅. On dev, every page's canonical is `http://localhost:4321<path>` (the config fallback), with exactly one h1 and a description ≤ 160 characters. The longest is /rising-water/ at 148. The About bio (223 characters) is clamped to its first sentence (141 characters). After the revision, the 404 route returns 404 on dev with no robots meta, no canonical and no og:url. The existing dist/sitemap-0.xml (from the last checker build) lists exactly /, /about/, /cv/, /garden/, /research/, the 4 topics and /rising-water/, with no 404. The sitemap integration excludes it, so no change was needed. robots.txt on dev returned `Sitemap: http://localhost:4321/sitemap-index.xml`. seo.spec.ts takes the expected origin from `page.url()` and `baseURL`, with no hard-coded domain. It asserts:
   - exactly one canonical equal to that origin + path;
   - og:url equals the canonical; og:title and twitter:title equal `<title>`; og/twitter descriptions equal the meta description;
   - og:image is absolute on the site origin and equals twitter:image; it returns 200 as image/png, and its IHDR says 1200×630;
   - no robots meta on public pages;
   - the 404 returns status 404, has no robots meta (no noindex), has no canonical, has one h1 and sets `lang`;
   - the sitemap index and its children list exactly the 10 pages, on the origin, with no 404;
   - robots.txt has `User-agent: *`, no `Disallow: /`, and `Sitemap: <origin>/sitemap-index.xml`.
3. Internal links are clean — ✅. A crawl of all 11 rendered pages on dev found 24 distinct internal hrefs/srcs, all 200. That includes /rising-water/ (now live), /about/ (new footer link), /garden/?type=… and ?tag=…, the 4 topic pages, /research/, /favicon.svg and /data/colorado/hillshade.webp. The anchors #mission, #work, #research and #open-science exist.
4. A social-card image exists as a static PNG of a hero frame — ✅. public/og/social-card.png, 1200×630, 168.6 KB (≤ 300 KB), real map and barcode canvases from the hero renderer.

Other checks:
- Rising water date: it renders as "Nov 2026" in the home Recent work, the Garden row and the CV (Projects). Production Garden order is Rising water (Nov 2026), then the fractal poster (Mar 2025). Dev order is OwlPath (undated draft), Dec 2026 RiverNets draft, Nov 2026 Rising water, Mar 2026 talk draft, Mar 2025.
- Anchor test on dev at 1280×800: #mission lands with top 15.8 px and #work with top 16.0 px (margin 16 px), so the "top lands at viewport top" branch genuinely holds for both. #research and #open-science land at max scroll, which the end-of-page branch covers.

Needs Andrew:
- Real domain ([A]). Until Cloudflare sets `SITE_URL`, canonical, og:image and sitemap URLs use the fallback. F8 must set it to the *.pages.dev URL.
- The social card shows the draft tagline "Mathematics, statistics, and water." (confirmed: false). If Andrew changes the name or tagline, rerun `node scripts/og-image.mjs`.
- The About meta description is the first sentence of the draft bio, so it updates automatically when the bio is confirmed.

Requests to Control:
1. Resolved: DECISIONS #53, option (b). noindex was dropped from the 404 page.
2. Resolved: the Rising water YAML comment was replaced as suggested.
3. Left as is, per Control: the Garden lede's "Ongoing projects come first" describes nothing visible in production until OwlPath is published.
None open.

Known limitations:
- I couldn't build, so the sitemap, `dist/robots.txt` and the 404's `Astro.routePattern` detection (now used only to omit the canonical and og:url) weren't confirmed against a production build. Astro emits extension endpoints as files regardless of `trailingSlash` and `build.format`, and dev served `/robots.txt` with 200 and text/plain. The existing dist sitemap already matched the expected page list.
- The OG image URL is the same for every page (one site-wide card). og:type is `website` everywhere.
- On a short production home page, #work could end up in the end-of-page branch of the anchor test instead of the strict top branch. It does not at 1280×800 on dev (with drafts), and #mission certainly does not. The checker should look at the measured values if in doubt.
- The description clamp in Seo.astro only affects the About page today (223 → 141 characters). Every other description is under 160 and passes through unchanged.
