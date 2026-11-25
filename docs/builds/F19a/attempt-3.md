# Build report — F19a Copy voice — attempt 3

Summary: Garden now says “Here's some of my work,” and About and Garden metadata describe it as selected work. The RiverNets poster and MAA talk descriptions use first-person plural without naming collaborators; the author lists and other metadata are unchanged.

Files changed:
- `src/pages/garden/index.astro`
- `src/pages/about/index.astro`
- `e2e/site.spec.ts`
- `src/content/work/poster-rivernets-analytics-day-2026.yaml`
- `src/content/work/talk-maa-southeastern-2026.yaml`
- `docs/builds/F19a/attempt-3.md`

How to verify:
- In an isolated copy of the tracked working sources and dependencies: `npm run check` (139 files, 0 errors, warnings, or hints) and `npm test -- tests/unit/content` (17 passed). The live `.astro` directory was not written by these checks.
- `./node_modules/.bin/eslint src/pages/garden/index.astro src/pages/about/index.astro e2e/site.spec.ts` and `./node_modules/.bin/prettier --check src/pages/garden/index.astro src/pages/about/index.astro e2e/site.spec.ts` both passed. Scoped `git diff --check` passed.

Acceptance criteria (self-check):
- ✅ Garden and About no longer claim completeness. Static assertions confirmed the Garden lede and exact-text test agree, with sort wording unchanged.
- ✅ Parsed YAML comparison against HEAD confirmed that only the descriptions differ in the two records, collaborators remain in `authors` and not in descriptions, and both descriptions fit the 160-character limit.

Needs Andrew: Existing unconfirmed copy still awaits approval; no new facts or decisions needed for these fixes.

Requests to Control: None.

Known limitations: Build, preview, e2e, and Lighthouse were not run; independent checker re-verification is pending.
