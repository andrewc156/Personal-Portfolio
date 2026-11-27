# Check report — F28c Hero and explorer UI feel — attempt 1
Verdict: PASS_WITH_NOTES

Checked the uncommitted working tree on `1fc5125`, using the F28c paths only: `src/components/hero/{Hero,HeroSettings}.astro`, `src/components/explorer/Explorer.astro`, `e2e/hero.spec.ts` and `e2e/explorer.spec.ts`. To check F28c on its own, I also applied only the F28c diff to a throwaway `git worktree` of `1fc5125`, then built and tested it there. That worktree has since been removed.

Gates: check ✅ · lint ✅ · unit (913) ✅ · pytest n/a (pipeline/ unchanged) · build ✅ · e2e ✅ for F28c (see below) · headers e2e ✅ (10/10 under `wrangler dev` on 4321) · axe ✅ · lighthouse ✅ · links ✅ (30, 0 broken) · visual ✅ · content n/a · tda n/a (no engine or render change) · data n/a

e2e results:
- **Combined tree:** 235 passed, 9 failed, 10 skipped. All 9 new F28c tests passed. The 4 F28b test failures are reported in the F28b report. The 5 p95 tests are host-limited and also fail on base.
- **F28c alone on `1fc5125`** (hero, explorer and CLS specs): 133 passed, and the only failures are the 5 p95 tests. `astro check` 0 errors; lint clean.

Lighthouse (mobile, Perf/A11y/BP/SEO) for /rising-water/: light 81/100/96/100, dark 96/100/96/100, CLS 0. The performance budget there is ≥ 80. The BP of 96 is the existing `image-aspect-ratio` audit on `hillshade.webp`, which F28 doesn't touch. On `/`: 100/100/100/100 in both themes.

## Acceptance criteria
1. **Plans 09 and 12 implemented as written: ✅.**
   - Plan 09: three `@media (pointer: coarse) { … font-size: 1rem }` blocks, each placed right after the cited rule (`Hero.astro:213–219`, `HeroSettings.astro:223–228`, `Explorer.astro:642–647`).
   - Plan 12: the explorer guard is verbatim; the hero-readout guard is an addition.
   - There are no source changes beyond those CSS blocks. No JS, markup, canvas or `src/lib/**` change.
2. **Drawer/sheet: n/a** (F28b).
3. **Reduced motion: ✅.** No motion was added. Hero and explorer reduced-motion e2e tests pass: static frame, no autoplay.
4. **No input zoom on touch: ✅ in emulation** (Chromium and WebKit).
   - Touch (coarse) computes `#hero-mode`, `#hero-seed`, `#ex-speed` and `#ex-pacing` at 16 px. A mouse at 1280 keeps them at 14 px.
   - No horizontal overflow at 320, 375 or 390.
   - Hero toolbar at 320: the select spans x 16–195 and Settings x 203–304, so they fit on one row.
   - Explorer at 375: Speed is at x 160–237 and Pacing at 66–210. Pacing sits on its own row, as it does on base.
   - The before/after crops of the explorer controls differ only in the select text size (≤ 0.44 % of pixels). At 1280 they are pixel-identical.
5. **Compositor-only, p95: ✅ (advisory).** No animated properties were added. Local p95 run alone: F28 66.7 ms ×5 (twice), base 66.7–83.3 ms. This host quantises rAF to 15 fps, so the number is host-limited and unchanged; hosted CI is authoritative.
6. **No dependencies, CSP hashes only: ✅.** 0 `style=` attributes and no new inline scripts. With the built CSP injected, /, /rising-water/ and /404.html show 0 violations in both engines.
7. **`npm run verify`: ✅ for F28c alone**, apart from the host-limited p95. The combined tree's red e2e comes from the F28b tests.
8. **Look unchanged except #91: ✅.** The /rising-water/ top view at 375, 768 and 1280 in light and dark is pixel-identical to base (35 px of noise at 1280 dark). The only look change is the approved 16 px touch text.

Readouts stay instant (`f28-check-probe.mjs instant`):
- Explorer: all 7 readouts and outputs change synchronously on `input`, with 0 animations, 0 child elements and 0 undefined custom elements.
- Hero: during play it made 7–10 writes in 1.5 s with 0 animations and 0 children, in both engines.

The new tests check what they claim:
- **Touch tests:** each first asserts that `(pointer: coarse)` matches, so they can't pass vacuously.
- **QA-13 touch variant:** measures the real 16 px font against the select's inner width, with ≥ 20 px of slack.
- **Pacing fit check:** confirms the label and the select share a row.
- **Readout guards:** they would catch any WAAPI/CSS animation or a `<number-flow>` child.

## Notes (non-blocking)
- **Real iPhone Safari still needed:** check that tapping Animation, Seed (in Settings), Speed and Pacing doesn't zoom. Emulation only shows the computed 16 px.
- **p95 ≤ 22 ms:** needs the hosted Chromium CI run on the candidate.
- **Commit order:** F28c commits cleanly on its own; I verified it in isolation. If it's committed after F28b, F28b's fixes must land first, or CI will go red on F28b's tests.
- **Blank line:** `e2e/hero.spec.ts` has a double blank line before the QA-13 touch loop. Prettier accepts it; cosmetic only.

## Artifacts
- `docs/checks/F28c/attempt-1/compare-rising-water-{375,768,1280}.png` and `compare-excontrols-{375,768,1280}.png`: base vs F28 in light and dark (all viewed). Diff numbers are in `docs/checks/F28b/attempt-1/compare-diffstats.json`, and the raw shots are in `docs/checks/F28b/attempt-1/shots/`.
- Probe JSON with font sizes, overflow and readouts: `docs/checks/F28b/attempt-1/probe/cur-{chromium,webkit}-*.json`
- Lighthouse: `docs/checks/F28b/attempt-1/lhci-{light,dark}/localhost-rising_water_-*.report.json`
- Tools: `docs/checks/tools/f28-check-*`
- Housekeeping: port 4321 is free. The working-tree diff outside `docs/` is unchanged by this check (sha1 `edee29be…` before and after).
