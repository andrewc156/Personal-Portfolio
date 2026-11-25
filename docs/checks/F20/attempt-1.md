# Check report — F20 Hero Settings cog — attempt 1

Verdict: PASS

Gates: check ✅ (exact diff and source comparison) · lint ✅ (Hero.astro ESLint and Prettier) · unit n/a · pytest n/a · build ✅ (`npm run build`, 10 pages) · e2e ✅ (12 Chromium tests, including six independent viewport/theme cases in one test) · axe ✅ (zero serious/critical findings in both themes) · lighthouse n/a · links n/a · visual ✅ · content n/a · tda n/a · data n/a

Acceptance criteria:
- ✅ `git diff --check` and `cmp` passed. Built a fresh `git archive` of `2aebc0f` with only the exact `Hero.astro` diff applied; all 10 added lines are the SVG. Untracked checker snapshots were excluded.
- ✅ Chromium 159: the 16 × 16 cog uses the same viewBox/path/circle and stroke styling as the header cog, inherits the button color, and is visible beside “Settings” in both themes. Inspected all six screenshots (375 × 812, 768 × 1024, 1280 × 800); no overlap, clipping, or toolbar/page overflow. The existing 320 px toolbar case also passed.
- ✅ The SVG is `aria-hidden="true"`, `focusable="false"`, and absent from the button’s accessibility snapshot. The visible label is still “Settings” and the accessible button name is still “Animation settings”. Tab from the mode selector lands directly on the button.
- ✅ Clicking the cog opens the same panel and focuses its heading; clicking Close restores focus to the hero button. Enter and Space open it, Escape closes it, and both triggers’ `aria-expanded` values track the panel throughout. No console errors in the independent matrix.

Notes: Scoped F20 check only; the full F9 audit was not rerun. Playwright managed production preview on port 4321; verified no listener remained and removed the scratch build.

Artifacts: `docs/checks/F20/attempt-1/{375,768,1280}-{light,dark}.png`.
