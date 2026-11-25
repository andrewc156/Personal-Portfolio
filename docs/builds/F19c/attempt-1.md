# Build report — F19c Visual polish — attempt 1

Summary: Kept the home page’s Decide/Learn sequence and identity. Increased Mission and section type, used an editorial heading column and inset rules, gave citations more definition, and made Contact a directory of full-width links with email first. Research now uses distinct local SVG illustrations, and the Rising water intro and description use the same formation-and-merging language as the hero without replacing the technical definitions.

Files changed:
- `src/components/home/{Mission,RecentWork,ResearchGrid,OpenScience,Teaching,Contact}.astro`
- `src/components/content/{ResearchCard,ResearchThumb,ContactLinks}.astro`, `src/components/content/thumb.ts`
- `src/pages/index.astro`, `src/pages/rising-water/index.astro`
- `e2e/site.spec.ts`, `tests/unit/content/thumb.test.ts`, `docs/builds/F19c/attempt-1.md`

How to verify:
- Fast checks in a clean tree: `npm run check && npm run lint && npm test`. All three passed in a scratch copy of the current tracked files plus the new unit test: Astro 0 errors/warnings/hints, lint clean, 827 tests passed.
- Dev: `npx astro dev --host 127.0.0.1 --port 4421 --ignore-lock`. Compare `/#mission`, `/#work`, `/#research`, `/#open-science`, `/#contact`, and `/rising-water/` in both themes at 375/768/1280px. On home, turn off JS and Tab from Email to GitHub. Builder port was closed after verification.
- Checker only, against the production build: `npm run e2e -- e2e/site.spec.ts` and the normal accessibility/performance gates.

Acceptance criteria (self-check):
- ✅ Familiar composition and visual identity: section order, anchors, and conditional Teaching intact; unchanged hero, tokens, fonts, accent, data, and engine. At 375/768/1280px, measured section headings ≈24/29/36px and Mission lead ≈20/22/26px.
- ✅ Three distinct, deterministic SVGs: invented river branches, nested squares, and recursive triangles. Each is visibly labeled “Illustration,” hidden from assistive technology, and identical on home and its topic page. No external assets, plotting of measurements, or runtime JS added.
- ✅ Contact and responsive fit: Chromium dev, JS off, both themes at all three widths: 0px horizontal overflow, three 44px-high Contact links, visible keyboard focus from email to GitHub. Research uses one column at 375px and three equal columns with aligned related-work links at 768px and 1280px. Evidence: `~/.hermes/cache/scratch/f19c-{research,contact}-{375,1280}-{light,dark}.png`.
- ✅ Rising water lede and meta use lake formation and merging; lede names the older lake and the infinite bar. Verified metadata-derived grid dimensions and precomputed-relief provenance in dev. Technical explainer and data below are untouched.

Needs Andrew: None new. Previously unconfirmed copy remains unconfirmed.

Requests to Control: Keep the nested checker candidate snapshots in `docs/checks/` outside the checkout when running repo-wide checks; they caused duplicate type declarations and ambiguous ESLint roots in the working tree. No source or dependency changes requested.

Known limitations: Production build, preview, e2e suite, and Lighthouse were not run by the builder.
