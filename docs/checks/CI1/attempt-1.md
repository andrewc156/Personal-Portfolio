# Check report — CI1 Fix failing GitHub CI test (mobile nav keyboard reachability) — attempt 1

Verdict: PASS_WITH_NOTES

Gates: check ✅ (0/0/0) · lint ✅ · unit ✅ (779/779 on a quiet machine; see note 2) · pytest ✅ (594) · ruff ✅ · build ✅ · e2e ✅ for CI1 (full run 146 passed / 5 failed / 8 skipped; all 5 failures are in F10's e2e/hero.spec.ts and are not CI1's, see note 3) · cls+shell --repeat-each 3 ✅ (120/120) · axe ✅ (shell light/dark, site light/dark, hero axe passes on rerun) · lighthouse ✅ (/ mobile, 3 runs: perf 100, a11y 100, BP 100, SEO 100, CLS 0) · links n/a · visual ✅ · headers/CSP ✅ (headers.spec 8/8 against wrangler, 0 violations) · content n/a · tda n/a · data n/a

## Acceptance criteria

1. **The root cause is real.** ✅ I built the pre-fix header (`git show HEAD:src/components/site/Header.astro`) in a scratch copy outside the repo. The build has no `focusin` script.
   - **Minimal Chromium probe** (`docs/checks/tools/ci1-probe.mjs`): a 100px link in a 200px overflow-x list. When 0, 1, 10, 50 or 99 px of the link is hidden, `scrollLeft` stays 0. Chromium only scrolls once the link is fully hidden (100px hidden gives scrollLeft 150). This confirms that Chromium leaves a partly clipped link where it is.
   - **Pre-fix build, my own sweep** (`docs/checks/tools/ci1-nav-sweep.mjs`, widths 300–840 step 4, Tab ×6 then Shift+Tab ×5): 45 of 1496 focus stops are clipped in IBM Plex, 54 of 1496 in the real DejaVu Sans 2.37 TTFs.
   - **Exact CI repro with real DejaVu at 412px:** "Rising water" is clipped by 1.47px with `scrollLeft` 0. This matches the CI log (run 45514628540: `Error: Rising water is scrolled into view when focused`, cls.spec.ts:171, 412px). Screenshot: docs/checks/CI1/attempt-1/PREFIX-dejavu-412-light-focus-rising.png.
   - **The new tests fail without the fix.** I ran the repo's new cls.spec and shell.spec against a preview of the pre-fix build on 4321 (`docs/checks/tools/ci1-prefix.config.mjs`). 4 tests failed and 2 passed:
     - 320 and 375 fail with "IBM Plex Sans: Rising water fully visible when focused (link 303.5–380.7 …)";
     - 412 fails with "IBM Plex Sans: CV fully visible when focused (link 397.1–414.4, list 0.0–412.0)";
     - shell "nav stays usable on mobile" fails on `toBeInViewport({ratio:1})` for link 5;
     - 768 and 832 pass, as expected, because nothing clips there.

   So the tests now catch the bug on macOS in Plex, without needing Linux fonts.
2. **The fix is in the component and the tests are not loosened.** ✅
   - The fix is a focusin handler plus `scroll-padding-inline` in src/components/site/Header.astro:62-80 and :189-191.
   - The test diff only tightens:
     - widths go from 320/412/832 to 320/375/412/768/832;
     - the tolerance goes from ±1px to ±0.5px, and the 4px ring is now required when the row scrolls;
     - Shift+Tab is added in both Plex and the wide font;
     - the order assertions are kept, and the one-row and same-height checks are kept;
     - shell.spec goes from `toBeInViewport()` to `toBeInViewport({ ratio: 1 })`.
   - **Post-fix sweep, widths 300–832 step 2, ring 4px, forward and back:** 0 failures out of 2937 stops in each of Plex, real DejaVu and Verdana. Desktop widths 834–1400 (ring 0) have 0 failures out of 286 in Plex and in DejaVu. Tab order is correct at every width.
3. **CSP.** ✅
   - Astro **inlined** the script as `<script type="module">`, 414 bytes, on all 10 HTML pages. It was not bundled to a file, even though the builder's report says it was (see note 1).
   - Its sha256 `qAPn5qN6…MZ0=` is in the CSP `script-src` in dist/_headers. scripts/write-headers.mjs adds it automatically, and I checked that every inline script hash on every page appears in the CSP.
   - `npx wrangler pages dev dist --port 8788`:
     - `HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts` passes 8/8, including zero CSP violations on every page and the 404.
     - My own check (`docs/checks/tools/ci1-csp.mjs`) loads / at 412, 375 and 320. It found 0 `securitypolicyviolation` events, 0 console errors or warnings, and the script **runs** under the CSP: Tab to "CV" gives scrollLeft 19, 55 and 110, with the ring fully inside. Before the fix, scrollLeft was 0 at 412.
4. **Gates.** ✅
   - check, lint, unit, pytest, ruff and build are green.
   - Full `npx playwright test` against preview on 4321: 146 passed, 8 skipped (headers.spec without HEADERS_BASE_URL), and 5 failed, all in F10's hero.spec (note 3).
   - `npx playwright test e2e/cls.spec.ts e2e/shell.spec.ts --repeat-each 3`: 120/120 passed, with all 15 nav-row runs green.
5. **Linux fonts.** ✅ I downloaded the real DejaVu Sans 2.37 TTFs from the official dejavu-fonts GitHub release (tarball sha256 fa9ca4d1…17d7). My harness loads them through `@font-face` and forces `--font-sans` the same way the spec does. The 412px case passes after the fix: 0 of 11 stops clipped with the ring included. Before the fix, the same harness reproduces the CI clip exactly (1.47px, scrollLeft 0). See the limitation below about FreeType vs CoreText.
6. **No regression.** ✅
   - **Screenshots:** 80 header PNGs in Plex and real DejaVu, at 320/375/412/768/1280, light and dark. Each case has four states: at rest, focus on "Rising water", focus on "CV", and focus on "Mission" after Shift+Tab. They are in docs/checks/CI1/attempt-1/, and I opened all of them through the 10 contact sheets in docs/checks/CI1/attempt-1/sheets/.
     - In every state the focused link and its ring are fully visible inside the row.
     - There is no overflow, overlap or wrapping.
     - The ring stays clear of the edge shadows.
     - Desktop at 1280 is unchanged.
   - **Resting header vs pre-fix:** pixel-identical (PIL difference bbox None) in all 20 at-rest shots (10 Plex, 10 DejaVu).
   - **axe:** shell light and dark have 0 serious or critical issues. The font-swap CLS tests (/, /garden/, /cv/, /rising-water/) pass, all 3 repeats.
7. **Lighthouse on / (mobile).** ✅ Three runs, each with performance, accessibility, best practices and SEO at 100. CLS 0, TBT 0–43ms, LCP about 905ms. The page script grows by 414 bytes uncompressed, which is negligible against the 120 KB gzip budget.

## Blocking fixes
None.

## Notes (non-blocking)
1. The builder's report is wrong on one point. It calls the script an "Astro-bundled module script (same-origin, so CSP-safe)". Astro actually inlines it (dist/index.html, `<script type="module">var e=document.querySelector(\`.site-nav ul\`)…`). It is CSP-safe only because scripts/write-headers.mjs hashes it into `script-src`. That works and is verified, so no code change is needed. Control should still know that this adds one more hashed inline script on every page.
2. `npm test` failed twice while the machine was overloaded (load average about 74 with other builders running). Both were 5s `TestTimeoutError`s in tests/unit/tda/flood.test.ts and properties.test.ts, which CI1 does not touch. After the load dropped, the same command passed 779/779. This is not a CI1 problem, but those tests are sensitive to timing under load.
3. These F10 failures are not CI1's: in the full run, hero.spec.ts:443 (p95 frame time), :521 ×2 (hero axe light and dark), :632 (mode selector) and :842 (extra modes pause off-screen). In a hero.spec-only rerun, 44/45 passed and only :842 still failed (frames 5→6 while off-screen). The hero axe tests passed on that rerun against the same dist and the same header, so the header did not cause the axe failures. F10 is mid-work in src/lib/viz/hero/** and src/components/hero/**.
4. Limitation: I could not run an actual ubuntu runner or a Linux container. The DejaVu repro uses the real font files on macOS Chromium, where the text is shaped by CoreText rather than FreeType, so advance widths can differ by fractions of a pixel. The fix reads real geometry at focus time and my sweep passes at every 2px width step, so this does not affect the result. The final confirmation is the next GitHub CI run.
5. Optional, for Control: the builder's suggested `PW_BASE_URL` override for playwright.config.ts is reasonable, but it is a Phase 0 shared file and outside CI1's scope.

## Artifacts
- docs/checks/CI1/attempt-1/*.png: 80 header shots, `{,dejavu-}{320,375,412,768,1280}-{light,dark}-{rest,focus-rising,focus-cv,focus-mission-back}.png`
- docs/checks/CI1/attempt-1/sheets/*.png: 10 contact sheets
- docs/checks/CI1/attempt-1/PREFIX-dejavu-412-light-focus-rising.png: the CI bug reproduced on the pre-fix build
- docs/checks/CI1/attempt-1/lhci/: 3 Lighthouse reports for /
- docs/checks/tools/ci1-nav-sweep.mjs, ci1-probe.mjs, ci1-shots.mjs, ci1-csp.mjs, ci1-prefix.config.mjs, ci1-lhci.cjs
