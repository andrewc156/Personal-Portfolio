# Status board

| Feature | Owner | State | Attempt | Last report | Notes |
|---|---|---|---|---|---|
| Phase 0 Setup | control | done | 1 | — | Toolchain, scaffold, agents, configs, venv |
| F1 Site shell | site-builder | done | 2 | docs/checks/F1/attempt-2.md | PASS_WITH_NOTES: a few type/size literals outside tokens.css; 375 header not pinned while sheet open (by design); F8 CSP needs hashes for 2 inline scripts |
| F2 Content and pages | site-builder | done | 2 | docs/checks/F2/attempt-2.md | PASS_WITH_NOTES: anchor test only proves scroll for below-fold sections (F7); /garden/ meta description lists drafted types (F7); no unit tests for format.ts/thumb.ts |
| F3 Persistence engine | tda-engineer | done | 1 | docs/checks/F3/attempt-1.md | PASS_WITH_NOTES: advanceTo allocates a closure per call (doc says only event array); backward advanceTo replays all events from bottom — F5/F6 must handle; browser frame timing to confirm in F5/F6 |
| F4a Colorado DEM → grid | data-engineer | done | 1 | docs/checks/F4a/attempt-1.md | PASS_WITH_NOTES: fix in F4b — half-pixel range "34–46 m", source "2021 release" unsourced, vertical-accuracy claim unsourced |
| F4b Reference barcode | data-engineer | done | 1 | docs/checks/F4b/attempt-1.md | PASS_WITH_NOTES: switch LANDMARKS to USGS GNIS/MRDS coords (Ray Mine confirmed); unify "≈ 40 m" wording in data.md Limitations |
| F5 Synthetic hero | viz-builder | done | 2 | docs/checks/F5/attempt-2.md | PASS_WITH_NOTES: pass diamond can cover pit ring when adjacent; "17 / m" wrap (use NBSP); destroy() leaves timers; hidden tab only emulated |
| F6 Colorado explorer | viz-builder | done | 2 | docs/checks/F6/attempt-2.md | PASS_WITH_NOTES: first-run Lighthouse cold-start outlier (58; 14/15 runs = 97) — consider Worker for computeH0; e2e covers only hash-path corruption; map hint shown in error state |
| F7 Polish / SEO / perf / a11y | site-builder | done | 1 | docs/checks/F7/attempt-1.md | PASS_WITH_NOTES: footer wraps at 375 (clean); social card bakes in draft name/tagline — rerun scripts/og-image.mjs after confirming; home description is just the tagline |
| F8 Cloudflare Pages setup | site-builder | done | 1 | docs/checks/F8/attempt-1.md | PASS_WITH_NOTES: CSP headroom 322 chars (~5 hashes); ci.yml also runs on push to main; GitHub Pages will serve _headers as a plain file (harmless) |
| D1 GitHub Pages base path | site-builder | done | 1 | docs/checks/D1/attempt-1.md | PASS_WITH_NOTES; workflow actions bumped to current majors, cancel-in-progress false |
| C1 Content from Andrew's CV | site-builder | done | 3 | docs/checks/C1/attempt-3.md | PASS_WITH_NOTES: 458 unit tests, 291 Python tests, 115 browser tests, eight Lighthouse routes at median 100, 64 screenshots reviewed. Earlier reports redacted. Its checked OwlPath URL was omitted from initial integration and restored in F9-R2. |
| F9 Final audit | checker | done | 3 | docs/checks/F9/attempt-3.md | PASS_WITH_NOTES: all gates pass. Lighthouse /rising-water/ image-aspect-ratio note, with scores within budget. See docs/checks/F9/summary.md. |

States: todo · building · checking · done · blocked

## Proposed features after F9

F9 has passed. The following plan follows the order of the megaprompt's stretch items. Andrew approved all four on 2026-11-24.

| Feature | Spec item | State | Scope |
|---|---|---|---|
| CI1 Fix failing GitHub CI | site-builder | done | 1 | docs/checks/CI1/attempt-1.md | PASS_WITH_NOTES (`7e9b745`): real a11y bug: Chromium doesn't scroll partly clipped focused links; focusin fix + stricter tests. Script is inlined and CSP-hashed. Unit tests in tda flood/properties can time out under heavy load. |
| F10 Extra hero modes | S1 | accepted (attempt 2 PASS_WITH_NOTES, docs/checks/F10/attempt-2.md) | Add Dye spill, Fractal pond, Random rivers, and Collatz delta to the hero. |
| F11 Islands barcode | S2 | F11a engine done, PASS_WITH_NOTES (docs/checks/F11a/attempt-1.md, `248ebae`); F11b hero strip todo after F10 | Show when islands appear and disappear during flooding using an H1 barcode. |
| F12 Basin mask | S3 | F12a done, PASS_WITH_NOTES (docs/checks/F12a/attempt-1.md, `4c32017`); F12b built, checker queued | Add an optional explorer mask using USGS Watershed Boundary Dataset regions 14 and 15. Document the coverage gap in Mexico. |
| F13 Place labels | S4 | checking (F13a checker attempt 1) | Add explorer place labels using coordinates from USGS GNIS and cite the source. |
