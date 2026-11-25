# Build report — F22 Collatz starts at step one — attempt 1

Collatz now paints exactly one complete mathematical layer before animating, including on direct entry, reentry, reduced-motion entry, replay, seed changes, and automatic loops. The Steps slider still defaults to 50, spans 1–120, and previews the full selected depth after a deliberate change while paused. The partial growth front advances from layer one without the old 30% warm-up or a jump past the next layer; the 540-tick (nine-second at 1×) clock and 2.5-second loop hold are unchanged.

## Files changed

- `src/lib/viz/hero/modes/{collatz,shell,types}.ts` — first-layer growth front, explicit paused preview, Collatz-specific reset/readout/summary handling. No other hero mode’s behavior changed.
- `tests/unit/viz/modes/collatz.test.ts`, `e2e/hero.spec.ts` — startup, replay, timing, one-step minimum, exact first raster, and F21 slider coverage.
- `docs/builds/F22/attempt-1.md` — this report.

## How to verify

- `npx vitest run tests/unit/viz/modes/collatz.test.ts -t 'starts normal playback|opens reduced-motion|replays from layer|one-step minimum'` — expected RED before production edits: fronts of 27.386…, 120, 0, and 0 instead of 1. `npx vitest run tests/unit/viz` — 252/252 passed (20 files) after the fix.
- `npx astro check --tsconfig /Users/andrewchincea/.hermes/cache/scratch/f21-tsconfig.json --minimumSeverity warning` — 105 files, zero errors/warnings. Prettier and ESLint passed on the five changed TypeScript files; `git diff --check` passed.
- `npx astro dev --host 127.0.0.1 --port 4422 --ignore-lock`, then `node /Users/andrewchincea/.hermes/cache/scratch/f22-dev-probe.mjs` — standalone Chromium passed the new exact-paint and updated F21 browser flows, and independently verified the playing new-seed reset, 540-tick completion, hold, and automatic loop reset with a controlled clock.

## Acceptance criteria (self-check)

- ✅ **Actual first paint.** The browser test snapshots the first visible canvas draw in the constructor’s microtask, including any partial overlay. It equals the single completed-edge raster captured from a separate, full preview at the same seed and depth; the final preview raster differs. Readout and summary report one complete layer on that first paint.
- ✅ **Reduced motion and controls.** Direct reduced-motion entry stays paused at layer one; the browser flow covers Home/End, full paused previews, reentry at selected depth 120 with only one layer visible, paused new seed, replay, and reset to 50. The one-step minimum renders both numbers without repeatedly looping on successive frames.
- ✅ **Progress and disclosure.** Unit tests check partial growth on the first tick at 120 and completion only on tick 540. Exact totals through 50, bounded connected sampling, and sampled wording above 50 retain F21 coverage.

Needs Andrew: None.

Requests to Control: Run the normal checker gates. No shared-file changes or dependencies needed.

Known limitations: No production build/preview, Playwright suite, Lighthouse, or port 4321 was used; production timing is not certified by the standalone dev probe.
