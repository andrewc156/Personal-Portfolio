# Check report — F15 Footer credit removal — attempt 1

Verdict: PASS

Gates: check ✅ (143 files, 0 diagnostics) · lint ✅ · unit ✅ (799) · pytest n/a · build ✅ (10 pages) · e2e ✅ (1 targeted Chromium test) · axe n/a · Lighthouse n/a · links ✅ (footer targets) · visual ✅ (6 captures reviewed) · content ✅ · TDA n/a · data n/a

## Acceptance criteria

- ✅ The shared footer omits “Built with help from Claude Code.” An independent HTML parser found one footer on each of the 10 built pages, including the custom 404, and found zero occurrences of the credit anywhere in the generated HTML.
- ✅ Each built footer retains copyright, About and Source. The HTML parser and browser probe confirmed `/about/` and the existing GitHub repository URL. The focused production check, `PW_BASE_URL=http://localhost:4321 npx playwright test e2e/shell.spec.ts -g 'footer shows'`, passed.
- ✅ All six home footer screenshots at 375×812, 768×1024 and 1280×800 in light and dark mode were opened and reviewed. The three groups fit on one line at every width. Zero page, footer or paragraph overflow and no clipping or stray separators.

## Notes

The candidate is accepted main at `cc75f4d` plus the F15 profile flag and the isolated footer assertion, without the F17 navigation edits. Full integrated Lighthouse, accessibility and pipeline checks follow in F9.

Artifacts: `docs/checks/F15/attempt-1/` contains command logs, six footer screenshots and geometry measurements. Reproduce the geometry check with `node docs/checks/tools/f15-footer.mjs` against production preview on port 4321.
