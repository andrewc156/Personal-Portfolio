# Build report — C1 Content update from Andrew's CV — attempt 2

Summary: I fixed both blocking items from docs/checks/C1/attempt-1.md and the three non-blocking notes Control asked for.
- **Fix 1 (CV bullets):** the RiverNets CV bullets now use the CV's own wording. I also restored the CV wording everywhere a CV bullet had been shortened, so nothing is regrouped or reattributed.
- **Fix 2 (contact rows):** every contact row now has the same layout at a given width.
- **Superscript:** the *k*th title is now typeset as in the CV (`<i>k</i><sup>th</sup>`).
- **Non-breaking spaces:** "R² = value" can no longer split across lines.
- **Position line:** on research pages it now stays within the text measure.

Worktree: `/Users/andrewchincea/personalPortfolio/.claude/worktrees/agent-a302a2e8cd44f54ea`, branch `worktree-agent-a302a2e8cd44f54ea`. Nothing is committed.

## Files changed (attempt 2)
- `src/content/research/water-quality.yaml`
  - The CV highlights are now all 8 RiverNets bullets, in the CV's wording.
  - Fix 1a: "…R² = 0.38 for specific conductance and 0.12 for pH at unseen stations, versus 0.02 for the best alternative."
  - Fix 1b: "…from MERIT Hydro 90 m flow directions (67,401 nodes for the Colorado basin, compressed to 67), along with graphs for the Chattahoochee basin."
  - The other shortened bullets are restored to the CV text: the five variables, "tracking data completeness by station and variable", "matching the full Laplacian to within 10⁻⁸ while running about 150× faster", the holdouts, and the ERA5-Land bullet.
  - NBSP around "=" in R² values.
- `src/content/research/number-theory.yaml`
  - The Python-experiments bullet is restored to the CV wording ("calculating empirical averages, growth constants, and relative errors").
  - Every "$k$th" is now `$k$^th^`.
  - NBSP in "*k* ≥ 2" and "*k* = 2".
- `src/content/research/spectral-fractals.yaml`: two CV bullets are restored in full ("…to show how fractal geometry shapes the spectrum, and extended…" and "(see Presentations)").
- `src/content/work/paper-kth-power-divisor.yaml`, `talk-maa-southeastern-2026.yaml`: `$k$^th^`, plus NBSP around = and ≥.
- `src/content/work/project-nyc-subway.yaml`: "MTA incident records" is now "MTA major-incident records", as in the CV.
- `src/components/content/format.ts`: `mathSegments` and `plainText` also handle `^…^` superscript (no spaces inside). Segments gain `sup?: boolean`. `plainText` strips both kinds of delimiter, so "$k$^th^" becomes "kth".
- `src/components/content/MathText.astro`: renders `sup` segments as `<sup class="sup">`. A scoped style sets 0.7em, line-height 0 and vertical-align 0.5em so line spacing doesn't change.
- `src/components/content/ContactLinks.astro` (Fix 2): each row is a grid.
  - Below 30rem, each label sits on its own line above its value, for every row.
  - From 30rem up, labels share a fixed 6rem column, at the same x as before (139 px at 768, 212 px at 1280).
  - `overflow-wrap: anywhere` stays as a fallback.
- `src/pages/research/[slug].astro`: `.topic__facts` gets `max-width: var(--measure)`.
- `e2e/site.spec.ts`: `plain()` also strips `^…^`. The CV publication test also asserts `.citation__title sup` is "th".
- `tests/unit/content/format.test.ts`: covers superscript segments; a lone caret, carets around spaces and `2^10` are left alone; `plainText('$k$th')`.
- `docs/builds/C1/attempt-2.md` (this report)

Files changed across both attempts: the attempt-1 list (docs/builds/C1/attempt-1.md) plus the files above. No new files in attempt 2 apart from this report.

## How to verify
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run lint`: clean.
- `npm test`: 18 files, 458 passed. The new cases were folded into existing tests.
- Checker: `npm run build && npx playwright test`, then the check report's `docs/checks/tools/c1/shots.mjs` at 375, 768 and 1280.

## Acceptance criteria (self-check)
Checked with ad-hoc Playwright scripts against `npx astro dev --port 4410`. The server is now stopped.

1. ✅ **Fix 1:** /cv/ Research experience → RiverNets renders exactly the 8 CV bullets.
   - Bullet 3 ends "…compressed to 67), along with graphs for the Chattahoochee basin."
   - Bullet 5 ends "…R² = 0.38 for specific conductance and 0.12 for pH at unseen stations, versus 0.02 for the best alternative."
   - **Audit of other shortened text:** I re-read every CV bullet I had shortened on the CV page, research pages, cards, Garden descriptions, mission and bio.
     - All shortened CV highlights are restored to the CV wording.
     - The remaining summaries (cards, Methods items, descriptions, mission, bio) don't combine or reattribute numbers.
     - The research pages' Methods and Results already matched the CV's grouping (the checker marked them ✅).
2. ✅ **Fix 2:** in every row of the Contact block on /, /about/ and /cv/, the value starts at the same x.
   - At 320 and 375 px: x=16, all stacked.
   - At 768 px: x=139, all inline.
   - At 1280 px: x=212, all inline.
   - Overflow is 0 everywhere. Screenshots at 375 and 768 checked by eye.
3. ✅ **Superscript (note):** `<i class="math">k</i><sup class="sup">th</sup>` appears on /, /garden/, /research/, /research/number-theory/ and /cv/. No raw `$` or `^` markup shows in visible text, meta tags or aria-labels. Meta descriptions read "kth".
4. ✅ **Non-breaking spaces (note):** on /research/water-quality/ every "R² = value" uses U+00A0 on both sides of "=", and no plain-space "R² =" is left. The CV bullets use the same text.
5. ✅ **Position line (note):** its right edge equals the prose paragraph's right edge: 832 px at 1280, 359 px at 375.
6. ✅ **Regression probe:**
   - axe: 0 violations of any impact on /, /garden/, /research/water-quality/, /cv/ and /about/, at 375 and 1280 px, light and dark.
   - 0 overflow.
   - On all 10 routes: no phone digits, no `tel:`, no References heading, no TODO/TBD/lorem/placeholder, and no `tda-rivernets`.
   - No console errors other than the worktree font 403s noted in attempt 1.
7. ✅ **Old-slug grep** (src/, e2e/, tests/, lighthouserc.cjs, scripts/, docs/deploy.md): only `e2e/seo.spec.ts:118`, the intentional 404 test. `e2e/headers.spec.ts` no longer contains it.

## Needs Andrew
Unchanged from attempt 1:
- the OwlPath URL;
- confirm there's no advisor for the fractals position;
- the draft tagline, hero question, mission, bio and Open-science sentence;
- the hero keywords.

The checker's note 2 (item order inside CV sections) and note 3 (capitalisation follows §3, and sentence case for skill groups) are left as they are. Andrew may prefer the CV's order or title case.

## Requests to Control
- Request 1 from attempt 1 (`e2e/shell.spec.ts` footer Source assertion) still applies if it hasn't been applied yet.
- Request 3 from attempt 1 (DECISIONS #21 slugs) still applies if it hasn't been applied yet.
- Nothing new.

## Known limitations
- The `^…^` superscript markup requires no spaces inside the carets. It is used only for "th" after *k*.
- I didn't run build, preview, e2e or Lighthouse, per the rules.
