# Build report — F9 Font layout shift — fix round 1 (audit attempt 2)

## Summary

The interrupted builder had already implemented the font fix, mobile navigation change, grouped footer, home description, and regression tests. I reviewed those changes against the first audit and reran the permitted fast checks. The measured production CLS remains a checker gate.

## Files changed

- `src/styles/fonts.css`, `tokens.css`, and `global.css` define and select local metric-adjusted fallbacks for Plex Sans and Mono.
- `src/layouts/BaseLayout.astro` preloads the self-hosted regular and semibold Latin Sans fonts using Vite asset URLs.
- `src/components/site/Header.astro` gives the mobile navigation a single horizontally scrollable row.
- `src/components/site/Footer.astro` keeps the credit together and wraps between footer items.
- `src/pages/index.astro` supplies a page-specific description using §3.
- `e2e/cls.spec.ts` exercises delayed font delivery on four routes and keyboard navigation at three widths.

## How to verify

Builder commands: `npm run check`, `npm run lint`, `npm test`.

Checker: run §11 on the integrated site. After the production build, `npx playwright test e2e/cls.spec.ts` starts preview on port 4321. Measure CLS for every route against the strict 0.05 limit. The older checker probes override the whole font stack in their forced-wide scenarios. Also measure with the production stack intact so the metric overrides are exercised.

## Acceptance criteria (self-check)

- ✅ Static checks: Astro checked 115 files with zero errors, warnings, or hints. ESLint and Prettier passed.
- ✅ Unit tests: 445 passed in 16 files.
- ✅ Code inspection: both preload imports reference the same Fontsource files as the CSS. The mobile nav uses nowrap on the list and disables item shrink.
- Pending checker: delayed-font CLS, production Lighthouse budgets, keyboard reachability, and visual review with the integrated C1 content.

## Needs Andrew

None for this fix.

## Requests to Control

Run the independent F9 audit on the integrated worktree.

## Known limitations

The builder checks do not measure browser layout shifts. Actual fallback selection depends on installed system fonts.
