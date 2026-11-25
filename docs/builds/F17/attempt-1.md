# Build report — F17 Garden header link — attempt 1

Summary: The shared header now links directly to Garden. Its four homepage links follow their section order, followed by Garden, Rising water, and CV. The existing active-link and keyboard-scroll logic applies to all seven links.

Files changed:

- `src/components/site/nav.ts` moves Work ahead of Research and adds Garden through `withBase('/garden/')`.
- `e2e/shell.spec.ts` verifies the rendered order, follows Garden, checks its active-page marker, and covers the seventh keyboard stop on mobile.
- `e2e/cls.spec.ts` checks the seven links in both keyboard directions with IBM Plex Sans and a wider fallback.

How to verify:

- `npm run check && npm run lint && npm test`
- Checker: `npm run build && npx playwright test e2e/shell.spec.ts e2e/cls.spec.ts`

Acceptance criteria (self-check):

- ✅ The link array matches the requested order: Mission, Work, Research, Open science, Garden, Rising water, CV.
- ✅ Garden uses the same base-path helper and active-page path comparison as the other standalone links. The updated browser assertion covers navigation and `aria-current="page"`.
- ✅ The mobile nav keeps its existing one-row horizontal scrolling CSS. The updated browser matrix covers all seven links with original and wider fonts at 320, 375, 412, 768, and 832 px.
- ✅ Astro check passed with zero diagnostics across 143 files. Lint and all 799 unit tests passed.

Needs Andrew: Nothing.

Requests to Control: Verify the browser matrix and the Garden link on the GitHub Pages base path.

Known limitations: Browser measurements, including desktop near the 832 px breakpoint, await the independent checker.
