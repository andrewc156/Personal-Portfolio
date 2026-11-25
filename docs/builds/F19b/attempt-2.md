# Build report — F19b Hero first frame and framing — attempt 2

## Summary
Kept the deterministic raised first frame, stronger relief, 12-bar default, 16:9 framing, caption and explorer spacing from attempt 1. Fixed a stale hover: a pointer held over the map now highlights the surviving lake’s row after a merge; touch still pins the selected row. Hardened the reduced-motion test’s startup wait without changing the 800 ms observation, two-frame allowance, or 22 ms timing gates.

## Files changed
- Recovery edits: `src/lib/viz/hero/controller.ts`, `e2e/hero.spec.ts`, and this report.
- Retained attempt-1 changes: `src/lib/viz/hero/{model,render-map}.ts`, `src/lib/viz/hero/modes/meta.ts`, `src/components/hero/Hero.astro`, `tests/unit/viz/{start.test.ts,modes/meta.test.ts}`, `src/components/explorer/LakesTable.astro`, and `src/pages/rising-water/index.astro` (spacing only).

## How to verify
```bash
npm run check
npm test -- tests/unit/viz
files=(src/lib/viz/hero/{controller,model,render-map}.ts src/lib/viz/hero/modes/meta.ts src/components/hero/Hero.astro tests/unit/viz/{start.test.ts,modes/meta.test.ts} e2e/hero.spec.ts src/components/explorer/LakesTable.astro src/pages/rising-water/index.astro)
node_modules/.bin/eslint "${files[@]}"
node_modules/.bin/prettier --check "${files[@]}"
git diff --check -- "${files[@]}"
```
Dev-only self-checks (scratch scripts, not test suites): start `npx astro dev --port 4419` (append `--ignore-lock` only if another dev session holds the lock), then `node ~/.hermes/cache/scratch/f19b-hover-probe.mjs`, `node ~/.hermes/cache/scratch/f19b-dev-probe.mjs`, and `node ~/.hermes/cache/scratch/f19b-motion-probe.mjs`.

## Acceptance criteria (self-check)
- ✅ **Type, unit, and lint:** Astro check: 150 files, no diagnostics; scoped viz unit: 240 tests across 20 files; scoped ESLint, Prettier, and diff check clean. Existing tests compare rendered intervals against engine bars and cover elder-rule coloring; new start tests cover six seeds, the cap and wet-share selection. No engine or Colorado data changes.
- ✅ **First frame and framing:** Dev Chromium, seed 42, at 375/768/1280 px in light and dark: canvas already non-blank on frame 1 when the controller attaches, 6–7 total live lakes at progress 0.14–0.15, 12 rows, 16:9, no readout overflow or console errors, no layout shifts observed. Production 500 ms gate belongs to checker.
- ✅ **Pointer, loop/replay, and accessibility:** Reproduced stale hover in dev (`row 2 → 2`, expected `0`); same probe after fix gave `2 → 0`. Touch tap pinned row 0; a tap outside displayed lake rows cleared it. Replay and the next-seed loop both reset to 0. Keyboard settings, focus scope and pause/scrub live summary remain covered by existing specs; Escape and explicit selections release the map hover.
- ✅ **Motion and render budget design:** Dev reduced-motion frame stayed at progress 0.45, `running=false`, frame count 2 across 800 ms. Off-screen and simulated hidden-tab reads showed no frame increments; DPR-3 emulation rendered at DPR 2 (pixel rounding). Hover follow reuses the current Flood state and scans displayed rows only during map hover; it adds no per-frame allocations. Relief computation remains off the frame path.
- ✅ **Explorer scope:** Verified all three literal spaces in rendered `/rising-water/` text. Data files total 820,883 bytes, unchanged and below 3 MB on disk; the production transfer/Lighthouse checks remain checker-owned.
- ✅ **Copy:** Decision #87’s exact caption is preserved; no new personal claims. The essential-bar exception is already explained in the strip’s accessible label.
- ❌ **Frame-time gate not established:** The archived interrupted checker log (`portfolio-f19-interrupted-checks-7a659bc/F19b-attempt-1/gate-e2e.log` in Hermes scratch) records five Mac rAF timing failures, p95 66.7–83.4 ms in that run against ≤22 ms. F9 attempt 4 separately documented slow blank-page rAF on the same environment. No timing thresholds or sampling were changed; no current PASS claimed.
- ❌ **Production gates not run by builder:** No build, preview, Playwright suite, or Lighthouse. F9 attempt 4 recorded 18.2 KB gzip of homepage JS against the 120 KB budget; no dependencies were added here, but final gzip/Lighthouse require a new checker build.

## Needs Andrew
Approve the exact hero caption already recorded as unconfirmed in Decision #87.

## Requests to Control
- Include the still-untracked `tests/unit/viz/start.test.ts` and this report in the F19b change set. Commission a fresh checker for production, browser and budget gates; use hosted Chromium for the timing verdict without weakening the assertions.
- Keep the `/rising-water/` explainer wording alignment in the separately owned task; this retry changed only whitespace there.

## Known limitations
A lake filtered out of the strip has no row to highlight. The initial rise skips the lowest levels on first load only, and the exact start composition depends on the grid and settings. Dev self-checks were Chromium-only and are not a substitute for the production checker run.
