# Check report — F25 Shell, Settings sheet and Garden fixes (QA-03, QA-11, QA-16 shell, QA-17) — attempt 1
Verdict: FAIL

Candidate: uncommitted working tree on `main` @ `20d59f9` (F24–F27 together). Shared gate results are in `docs/checks/F24/attempt-1.md`.

Gates: check ✅ · lint ✅ · unit ✅ (913; `garden-state.test.ts` 7/7) · pytest ✅ (606) · build ✅ · e2e ⚠️ (212 passed; every F25 test passed: narrow sheet ×2, wide drawer, history focus ×3, in-page link, no-JS ×2, garden ×2. The 6 failures are F26 hero timing tests that need hosted CI) · axe ✅ (0 violations on `/`, `/rising-water/` and `/garden/` at 375 and 1280, light and dark, and with the 1280 drawer open. The open 375 sheet has 1 **minor** violation: `aria-allowed-role`. See note 1) · lighthouse ✅ (see F24) · links ✅ · visual ✅ (320/375/768/1280 × light/dark, reduced motion, no-JS; every screenshot reviewed through contact sheets) · content ✅ · tda n/a · data n/a

## Per-finding table

| QA finding | Repro (from QA report) | Result | Evidence |
|---|---|---|---|
| QA-03 focus escapes the narrow sheet | 390×844, open Settings (header gear and hero Settings), focus Reset, press Tab repeatedly | ✅ Fixed for both openers. The panel has `role="dialog"` and `aria-modal="true"`, and header and main are inert. 40 Tabs + 10 Shift+Tabs from Reset never left the panel. Esc returns focus to the opener used, with 0 `[inert]` left. A tap on the covered page (195,80) closes the sheet and focuses the opener. **Regression check at 1280:** the drawer has no role, nothing is inert, and a background click leaves it open. Theme toggle works. | `F24/attempt-1/probes-f25.json`, `qa03-sheet-390-tabbing.png`, `qa03-wide-drawer-1280.png` |
| QA-11 offscreen focus after Back | `/` → header Research (Enter) → wait for scrolling to settle → Tab to "Water-quality prediction…" → Back (same-document `/#research` → `/`) → Tab | ❌ **Not fixed with default motion.** At 1024, 1280 and 1440: after Back, `scrollY` = 0 but focus stays on the article link (top 1907–1995 px). The next Tab focuses "Related work →" and scrolls to 1612–1724, the exact D01 symptom. With `reducedMotion: 'reduce'` the same steps pass (focus goes to body; Tab → Skip link at scrollY 0). | `qa11-samedoc-candidate.txt`, `qa11-samedoc-candidate-reduced-motion.txt`, `qa11-timing.txt`; tools `f24-27-qa11-samedoc.mjs`, `f24-27-qa11-timing.mjs` |
| QA-16 (shell) dead no-JS buttons | JS off: Tab through `/`, try the theme toggle and gear | ✅ With JS off on `/`, `/garden/`, `/rising-water/` and `/cv/`, the theme toggle and gear are `disabled`, dimmed (0.55) and skipped by Tab: the first 25 Tabs hit no button or select. With JS on, all shell and hero controls are enabled, and a rAF sampler over the first 3 s found **no** dimmed frame. Control's `:root.js .hero__btn:disabled {opacity:1}` works as intended. | `probes-f25.json`, `qa16-nojs-home-1280.png`, `sheet-nojs.png` |
| QA-17 unlisted Type deep link | Open `/garden/?type=preprint` (also software, dataset), with `&tag=water-quality` | ✅ The active chip (Preprints/Software/Datasets) has `aria-current`. A Clear link (`/garden/?tag=water-quality`) is shown, with "Showing 0 of 9 items" and the empty-state text. Clear → 9 items, focus on "All types". `?type=bogus&x=1` is normalised to `?x=1`. | `probes-f25.json`, `qa17-garden-preprint-375.png` |

## Blocking fixes
1. **QA-11: focus is reconciled before the smooth scroll restoration finishes.**
   - **Where:** `src/components/site/focus-restore.ts:84-86` (`afterRestore` waits only two rAFs), together with `src/styles/global.css:20-23` (`scroll-behavior: smooth` when motion is allowed).
   - **Cause:** on a same-document Back from `/#research` to `/`, Chromium animates the scroll restoration. The instrumented trace (`qa11-timing.txt`) shows scrollY at popstate 1615, then 1591 → 1481 → 1135 → 693 → … → 0 over about 300 ms. `reconcileFocus()` runs about 50 ms in, while the focused link is still in view, so it does nothing. Then the page lands at 0 with focus about 1,900 px below.
   - **Expected:** after Back to `/` at the top, focus is not offscreen, and the next Tab stays near the top.
   - **Actual:** focus stays on the article link, and Tab jumps to Research.
   - **Repro:** `npm run build`, then preview on 4321, then `node docs/checks/tools/f24-27-qa11-samedoc.mjs`. It fails at all 3 widths; with `RM=1` it passes.
   - **Suggested fix:** reconcile once scrolling settles, using the `scrollend` event with a fallback poll until `scrollY` is stable for 2 frames and a cap of about 1 s, or reconcile again on `scrollend`.
   - **Tighten `e2e/shell.spec.ts:551-566`:** it presses Tab and `goBack()` while the forward smooth scroll is still running, so it misses the real flow. Wait for `scrollY` to settle after Enter (the QA steps say "wait for scrolling to settle") before Tab and Back.
   - The full D01 path in real Chrome (Back ×2 with bfcache) ends in this same same-document Back, so it is affected too.

## Notes (non-blocking)
1. **`aria-allowed-role` (minor):** `src/components/site/settings.ts:35` sets `role="dialog"` on the `<aside id="settings-panel">` (`SettingsPanel.astro:14`), and ARIA in HTML doesn't allow `dialog` on `aside`. axe rates it minor, so it doesn't fail the serious/critical gate. A `div` wrapper, or switching the element, would clear it.
2. **The narrow modal sheet has no scrim**, so the covered page looks interactive. It is inert and a tap closes the sheet. This is a visual choice, flagged only for design review.
3. **Playwright's Chromium disables bfcache**, so the cross-document `pageshow(persisted)` path is unexercised, as the builder also notes.

Artifacts:
- `docs/checks/F25/attempt-1/`: `qa03-*.png`, `qa11-*.txt/png`, `qa16-nojs-home-1280.png`, `qa17-garden-preprint-375.png`, `sheet-{home,rw,rwmap,garden,panels,nojs,reduced,probes}.png` (contact sheets of all 50 matrix screenshots; the individual PNGs were deleted to save disk), `visual-axe.json` (axe, overflow: 0 horizontal overflow everywhere; console errors: none).
- Tools: `docs/checks/tools/f24-27-probes.mjs`, `f24-27-visual.mjs`, `f24-27-sheets.py`, `f24-27-qa11-*.mjs`.
