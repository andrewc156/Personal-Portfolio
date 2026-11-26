# Build report — F28c Hero and explorer UI feel — attempt 1

Summary: I implemented plan 12 (don't-animate guards) and plan 09 (16 px fields on touch devices; Andrew approved it in DECISIONS #91). Plan 12 needed no source change. It adds the explorer guard exactly as written and a matching hero-readout guard. Plan 09 adds one `@media (pointer: coarse)` block per component, so `#hero-mode`, `#hero-seed`, `#ex-speed` and `#ex-pacing` compute to 16 px on touch devices and stay at 14 px with a mouse. Nothing changed in canvas, render, engine, `src/lib/**`, JS, markup, the no-JS paths or reduced-motion behaviour.

## Per-plan status

| Plan | Status | Notes |
|---|---|---|
| 12 don't-animate viz guards | ✅ done (tests only) | Explorer test is verbatim from the plan. It's in `explorer: motion and pausing` and uses the spec's existing `ready()` helper (20 s timeout) instead of the inline 60 s `waitForFunction`, as the plan asks. **Small addition:** a hero guard. The plan's table lists `[data-hero-readout]` but its test only covers the explorer, and the brief says "explorer/hero readouts". The hero test watches the readout with a MutationObserver for 1.5 s during play and asserts writes > 0, more than one distinct text, 0 animations and 0 child elements. |
| 09 viz inputs 16 px on touch | ✅ done | CSS exactly as the plan's targets, each block placed right after the cited rule. Both plan tests are in, each with a `matchMedia('(pointer: coarse)')` precondition. **Additions:** desktop 14 px guards for hero and explorer ("desktop unchanged"); a touch QA-13 variant at 320/375/390 (the existing QA-13 test runs without touch, so it never sees the 16 px select); and a "Linear (metres)" same-line/fit check in the explorer touch test. |

## Files changed
- `src/components/hero/Hero.astro`: +8, `@media (pointer: coarse) { .hero__toolbar select { font-size: 1rem } }`
- `src/components/hero/HeroSettings.astro`: +7, the same for `.number-row input` (the seed field)
- `src/components/explorer/Explorer.astro`: +7, the same for `.ex-controls select`
- `e2e/explorer.spec.ts`: +3 tests (plan 12 guard; touch ≥16 px with Pacing fit; desktop 14 px)
- `e2e/hero.spec.ts`: +6 tests (touch ≥16 px; desktop 14 px; readout guard; touch QA-13 ×3 widths)
- `docs/builds/F28c/attempt-1.md` (this report)

No new inline `style` attributes or scripts. All CSS is inside the existing scoped `<style>` blocks, so the CSP is unaffected.

## Tests added (all e2e, **UNRUN by me**; the checker runs them)
- explorer `explorer: motion and pausing` › `readouts and slider outputs update as plain text with no animation (F28)`
- explorer `explorer: F27 focus, touch, keyboard and no-JS` › `touch: explorer selects are at least 16px (no iOS focus zoom) (F28)`, `desktop: explorer selects keep their 14px size (F28)`
- hero `controls` › `touch: hero fields are at least 16px (no iOS focus zoom) (F28)`, `desktop: hero fields keep their 14px size (F28)`
- hero `motion and pausing` › `the readout updates as plain text with no animation during play (F28)`
- hero `F26 playback and accessibility` (next to the existing QA-13 loop) › `QA-13 (F28, touch 16px): … at 320px / 375px / 390px`

## How to verify
```
npm run check && npm run lint && npm test
npx playwright test e2e/hero.spec.ts e2e/explorer.spec.ts -g "F28|QA-13"   # checker
npx playwright test e2e/hero.spec.ts e2e/explorer.spec.ts                  # full suites incl. p95 gate
```

## Real check output
- `npm run check`: `Result (169 files): 0 errors, 0 warnings, 0 hints`
- `npm run lint`: eslint clean; `All matched files use Prettier code style!`
- `npm test`: `Test Files 37 passed (37) · Tests 913 passed (913)`
- `npx tsc --noEmit`: no errors in `e2e/hero.spec.ts` or `e2e/explorer.spec.ts`

**Self-check probe** (my own Playwright script against `astro dev --port 4403`, Chromium; server killed afterwards). It ran the same logic as the new tests:

| Context | coarse | hero-mode / hero-seed | ex-speed / ex-pacing | QA-13 slack (≥20) / Settings right / overflow | Pacing "Linear (metres)" |
|---|---|---|---|---|---|
| desktop 1280 | false | 14 / 14 px | 14 / 14 px | 83.2 / 982 / 0 | — |
| touch 320 | true | 16 / 16 px | 16 / 16 px | 57.2 / 304 / 0 | same line, right 210 |
| touch 375 | true | 16 / 16 px | 16 / 16 px | 39.2 / 359 / 0 | same line, right 210 |
| touch 390 | true | 16 / 16 px | 16 / 16 px | 54.2 / 374 / 0 | same line, right 210 |

- Explorer guard (1280): `changed: 6, anims: 0, custom: 0`. This matches F28a `probe5.json`.
- Hero guard (1280, playing): `writes: 9, distinct: 10, anims: 0, children: 0` in 1.5 s.
- I looked at the 320/375 toolbar screenshots: "Rising water" shows in full, the Settings button is on the same row, and the label is on its own line below 350 px. In the explorer at 375, Pacing sits on its own row below Play/Speed. **That wrap already exists:** forcing 14 px gives the same row tops (Play/Speed 1854, Pacing 1898 at 375; 1857/1901 at 390). So 16 px adds no wrap, and "Linear (metres)" stays on one line with its label.

## Acceptance criteria (self-check, F28 plan §Acceptance)
1. Accepted plans implemented as written: ✅ (additions only, listed above)
2. Drawer/sheet interruptibility: n/a (F28b)
3. Reduced motion: ✅ unchanged (no motion added; the guards cover both modes)
4. No input zoom on touch: ✅ for viz fields, 16 px computed under coarse pointer (probe above). A real-iPhone feel check is still due.
5. Compositor-only / hero p95: ✅ no animated properties added. Font size on four form controls only; nothing in the frame loop changed. The hosted-CI p95 gate applies.
6. No new dependencies, CSP hashes only: ✅
7. `npm run verify`: partial ✅ (check/lint/test green). Build, e2e, links and lhci are the checker's.
8. Look changes only with Andrew's approval: ✅ DECISIONS #91 (touch-only 16 px; desktop verified at 14 px)

## Risks / items for the checker
- `(pointer: coarse)` emulation: Playwright Chromium with `hasTouch: true` matches `pointer: coarse` (verified: `coarse: true`). Each touch test asserts this first, so an emulation change shows up as a clear failure rather than a false pass.
- `#hero-seed` is inside the closed Settings panel. The font-size read uses `getComputedStyle`, which works on undisplayed elements (verified: 16 px).
- The hero readout guard depends on autoplay at 1280×800 without reduced motion, the same as the existing "mouse: Play/Pause" test.
- Plan 08 (SelectRow, site-builder) covers the Settings-panel selects. That's not in my files, and I left it alone.
- Real iPhone Safari: tap Animation, Seed (Settings), Speed and Pacing and confirm there's no zoom. Emulation can't prove this.

Needs Andrew: none (09 approved in #91).
Requests to Control: none.
Known limitations: e2e not run by me (per role). The probe ran against the dev server, not a production build.
