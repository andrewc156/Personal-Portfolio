# Build report — F19b Hero first frame and framing — attempt 3

Summary: Replaced the 4–35% sampled startup search with a deterministic search at live-bar and wet-share boundaries. At 375 × 812, seed 25 now starts at 43.91% progress with five lakes, four tied to drawn bars and at least 15 m deep, and 26.15% water; before the fix it started with one lake. No terrain generation, per-frame code, timing gate, runner config, or F19a copy changed.

Files changed:
- `src/lib/viz/hero/model.ts` — startup scoring and cap-aware fallback.
- `src/lib/viz/hero/controller.ts` — reuse engine heights and height order instead of copying them at startup.
- `e2e/hero.spec.ts` — desktop and mobile deterministic frame-1 regressions that sample before rAF can advance playback.
- `tests/unit/viz/start.test.ts` — seed 25 under both pacing modes, narrow overlaps and no-viable-level fallbacks.
- `docs/builds/F19b/attempt-3.md` — this report.

How to verify:
- `npx vitest run tests/unit/viz`
- `npx eslint src/lib/viz/hero/model.ts src/lib/viz/hero/controller.ts tests/unit/viz/start.test.ts e2e/hero.spec.ts`
- `npx prettier --check src/lib/viz/hero/model.ts src/lib/viz/hero/controller.ts tests/unit/viz/start.test.ts e2e/hero.spec.ts`
- On the checker runner: `npx playwright test e2e/hero.spec.ts -g 'first frame has several lakes|p95 frame time'` against the exact built candidate. For a builder self-check, `npx astro dev --port 4419 --ignore-lock` and open `http://localhost:4419/?seed=25` at 375 × 812 with cleared settings and no reduced-motion override.

Acceptance criteria (self-check):
- ✅ Mobile seed 25/#87: the unit regression failed before the fix (1 deep drawn lake vs. ≥3). A standalone Chromium dev probe captured frame 1 on repeated mobile loads: 5 live lakes, 4 deep drawn lakes, 26.15% wet, byte-identical probe output on reload. Desktop seed 42 at 1280 × 800: 6 live lakes, 5 deep drawn lakes, 10.55% wet, also deterministic.
- ✅ Framed balance: the startup picker maximizes the number of live drawn lakes at least 15 m deep up to 40% wet; ties favor 15% wet, then earlier progress. The checker's approximately 44.4% alternative adds an engine lake outside the drawn rows, so it does not improve the drawn count and the picker keeps the drier frame. A dev probe of seeds 1–30 at 375, 768 and 1280 px captured frame 1 in all 90 cases; each had at least two live and two deep drawn lakes, and no frame exceeded 40% wet.
- ✅ Fallback: if pacing/the wet cap rules out several deep drawn lakes, keep the best legal frame (one or zero deep lakes if that's all the terrain affords, with the same wet-share tie-break). If a tied lowest plateau alone exceeds 40% wet, start at progress 0; no legal level exists. No seed replacement or cap relaxation.
- ✅ Replay, loop, reduced motion and bar cap: Chromium dev confirmed replay and the next-seed loop start at 0; reduced motion starts paused at 45%; checked default views drew at most 12 rows. Bar selection and engine values were not changed.
- ✅ Startup work stays out of the render loop: boundary candidates scale with the drawn rows, with binary searches into the existing height order; no height-array copy or extra flood pass. A warmed local Node selector-only probe on 39,900 cells averaged under 0.003 ms per call (not a frame-time result).
- ✅ Scoped checks: 245 viz unit tests across 20 files passed, as did scoped ESLint, Prettier, and `git diff --check`. Builder dev server stopped and port 4419 was verified clear.
- ❌ Independent production gates pending: no E2E runner, build, preview, Lighthouse, or 4321 used for this builder round. The mandatory p95 ≤22 ms gate has not been verified for this exact candidate; timing checks and thresholds are unchanged.

Needs Andrew: No new decision for this fix. The existing F19b caption still awaits approval (#87).

Requests to Control: No shared-file or dependency changes. Verify the exact candidate on a representative Chromium runner, including the untouched timing gate and both first-frame regressions.

Known limitations: A seed may have fewer than three deep drawn lakes within the wet cap; fallback is intentionally best-effort, as above. Dev probes do not establish production timing or full F5/F6 acceptance.
