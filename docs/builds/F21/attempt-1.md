# Build report — F21 Collatz Steps — attempt 1

Summary: Collatz delta now defaults to 50 mathematical steps; its native Steps slider spans 1–120, works by keyboard, and preserves the value across mode changes, replay, and new seeds until the form is reset. The readout reports exact totals through 50 and distinguishes the drawn sample; from 51 through 120 it says “Sampled branches” and makes no claim about a total. Playback still takes 540 ticks for a full nine-second replay at 1×, followed by the existing hold.

## Files changed

- `src/components/hero/{HeroSettings.astro,hero-client.ts}` — Collatz-only form row, existing live output/reset wiring, and form value passed to the mode.
- `src/lib/viz/hero/modes/{collatz,meta,shell,types}.ts` — bounded geometry and exact counts, display disclosure, configuration and still-frame updates.
- `tests/unit/viz/modes/collatz.test.ts`, `e2e/hero.spec.ts` — exact depth/count, connected BigInt paths, fixed clock, and keyboard/mode/seed/replay/reset regression coverage.
- `docs/builds/F21/attempt-1.md` — this report.

## How to verify

- `npx vitest run tests/unit/viz` — 249/249 passed (20 files). Before production edits, targeted unit tests failed at the actual old depth of 30; a standalone Chromium probe also confirmed the Steps slider was absent.
- `npx prettier --check src/components/hero/{HeroSettings.astro,hero-client.ts} src/lib/viz/hero/modes/{collatz,meta,shell,types}.ts tests/unit/viz/modes/collatz.test.ts e2e/hero.spec.ts`; same paths with `npx eslint`; `git diff --check` — clean.
- `npx astro check --tsconfig /Users/andrewchincea/.hermes/cache/scratch/f21-tsconfig.json --minimumSeverity warning` — 0 errors/warnings in 105 files (all `src`, hero e2e, mode unit tests). The unscoped check picked up archived F19 checker candidates with duplicate globals; broadening the scratch check to unrelated test files exposed five `Buffer` type errors outside F21. No shared configuration changed.
- `npx astro dev --host 127.0.0.1 --port 4421 --ignore-lock`; from the repo, `node /Users/andrewchincea/.hermes/cache/scratch/f21-dev-probe.mjs` for the standalone browser flow and `node /Users/andrewchincea/.hermes/cache/scratch/f21-perf.mjs` for complete replays and a blank rAF control. Screenshots from the flow (`f21-50-light.png`, `f21-120-light.png`, `f21-120-dark-mobile.png`) are in the same scratch directory. The Playwright suite, production build/preview, Lighthouse and port 4321 were not used.

## Acceptance criteria (self-check)

- ✅ **Exact through 50, bounded beyond.** A lazy complete depth-first walk through 50 visits 379,600 nodes once and retains 51 cumulative counts (204 bytes). An independent breadth-first unit oracle agrees at every depth through 50. At 50 the canvas draws 3,217 nodes (3,216 edges); at 120 it draws 9,937 nodes (9,936 edges), with no enumeration of the complete high-depth tree. Values in sampled geometry use BigInt, and unit tests check the parent equation on every painted edge, including odd values past the Number safe-integer limit. The seed-independent sample keeps a doubling trunk and continuous ancestral paths; deeper selections extend the same prefix.
- ✅ **Settings and a11y.** Standalone Chromium verified keyboard Home/End/ArrowLeft, live output, actual pixel changes from 50 to 120, full-depth readout/summary while paused, persistence through Pond, new seed and replay, and reset to 50 with the existing return to Rising water. Verified light/dark canvas redraw, resize to 375 px, no readout overflow at 320/375 px at depths 50/120, DPR 3 clamped to 2, zero serious/critical axe violations with the Collatz panel open in mobile dark, and zero console errors in the flow.
- ✅ **Bounded drawing and responsiveness.** At most 96 edges in the active level, grouped by stroke width; completed levels are raster-cached and only appended during ordinary playback. Headless Chromium at 1280×800 painted the actual 50th and 120th levels at DPR 1 and 2 after 540 ticks (9.02–9.12 s wall time). Main-thread draw method p95 was 0.6–0.9 ms at 50 and 0.8–1.3 ms at 120 in headless shell. The cold extension from the default cache to 120 took 8.5–13.4 ms in the full replay probes; a DPR 2 keyboard jump from 1 to 120 repainted in about 31 ms in the final flow probe, including about 24 ms in the full still redraw. The 120-step picture is visibly denser and distinct from 50.
- ⚠️ **End-to-end frame timing is not certified on this host.** Headless shell measured ~66.7 ms rAF p95 for both depths and ~66.8 ms on a blank page; a second run in full Chromium headless measured 66.7 ms on blank and 66.7–83.4 ms with the art. The unchanged 22 ms gate did not pass here, even on a blank page. The 120 maximum is supported by bounded work and the measured interactive/paint costs above, not a production frame-time PASS.
- ✅ **Default Rising stays lazy.** Dev Chromium requested only `meta.ts` from the mode directory on Rising startup; `collatz.ts` was fetched on switch. Extra-mode creation remains dynamic and Collatz geometry/count caches allocate only when used. Standalone ES2022 esbuild minify+gzip comparisons against HEAD: +108 bytes for eager `hero-client.ts` + `meta.ts` and +863 bytes for deferred `collatz.ts` + `shell.ts` (module estimates, not production bundle sizing).

Needs Andrew: None.

Requests to Control: No extra paths or dependencies needed for F21. Run the unchanged production timing/bundle gates on a runner with a healthy blank rAF baseline, and run the new hero regression there. The unrelated full-check archive/type issues are noted above; no changes made to shared files.
