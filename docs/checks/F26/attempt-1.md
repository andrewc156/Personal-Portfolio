# Check report — F26 Hero playback and accessibility fixes (QA-04, QA-05, QA-09, QA-13, QA-14, QA-15, QA-16 hero) — attempt 1
Verdict: PASS_WITH_NOTES

Candidate: uncommitted working tree on `main` @ `20d59f9` (F24–F27 together). Shared gate results are in `docs/checks/F24/attempt-1.md`.

Gates: check ✅ · lint ✅ · unit ✅ (913; playback, url, barcode-hit, text and model included) · pytest ✅ · build ✅ · e2e ⚠️ (all 16 new F26 tests pass, and so does every other hero test **except 6**: the 5 p95 frame-time tests, which need hosted CI, and "pauses in a hidden tab", a flake that is pre-existing on this machine; see below) · axe ✅ (hero spec axe light/dark and extra modes pass; my own axe on `/` passes at 375 and 1280 in both themes) · lighthouse ✅ (`/` 100/100/100/100, CLS 0) · links ✅ · visual ✅ · content ✅ (the no-JS note "A still picture. The animation needs JavaScript." is plain UI copy; the selection and summary text use only birth, spill and persistence values computed from the model) · tda n/a · data n/a

## Per-finding table

| QA finding | Repro (from QA report) | Result | Evidence |
|---|---|---|---|
| QA-04 reduced motion mid-play | Home playing; switch emulation to `reduce`; don't press Play | ✅ The canvas hash is identical across 1.1 s, the label reads Play, and `playing=false`. Play restarts playback. A Collatz switch under reduce stays paused. Collatz playing, then reduce → paused, canvas still. | `F24/attempt-1/probes-f26.json` |
| QA-05 pause lost on mode switch | 390×844: pause Rising, set level 27%, select Dye → … → back to Rising | ✅ Dye, pond, rivers and collatz all stay paused (label Play). On return to Rising, progress is **exactly 0.27**. After Play, the next mode autoplays (regression check). | `probes-f26.json` |
| QA-09 live summary stale / no selection | Seed 305613, loop off, speed 3, play from 0, sample the live region; then ↓↓ | ✅ 4 distinct summaries during the run (0% → 76% → 100% playing → Paused 100%), not per frame. ↓↓ announces "Selected Lake 2: born at 108 m, spills into Lake 1 at 420 m, persistence 312 m." | `probes-f26.json` |
| QA-13 selector clips "Rising water" at 320 | 320×640 touch viewport, closed selector | ✅ The select is 179 px wide at 320 (label on its own row), 161 at 375, 192 at 768 and 1280. Text is 77 px plus 16 px padding plus an arrow, so it fits everywhere, with no horizontal overflow, and Settings stays on the select's row. The screenshot shows the full "Rising water". | `qa13-toolbar-320.png`, `probes-f26.json` |
| QA-14 blank chart space selects distant bar | Seed 123456, maxBars 32, barcode, 100%, hover far right of a short bar | ✅ Shortest bar (row 17, 5.5 px wide): hovering the bar → row 17; **60 px right → −1**; 4 px right → row 17 (tolerance). | `qa14-blank-hover-1200.png`, `probes-f26.json` |
| QA-15 URL doesn't follow mode/seed | `/?x=1&mode=collatz&seed=123456#hero-title`, switch modes, New terrain | ✅ → `?x=1&mode=dye&seed=123456#hero-title` → New terrain `seed=366880` → Rising drops `mode`. `history.length` is unchanged (2 → 2). Reopening the URL gives the same seed. | `probes-f26.json` |
| QA-16 (hero) dead no-JS controls | JS off, Tab through Home, try Play / New terrain | ✅ The select, Settings, Play and New terrain are disabled, and the hero box has no tabindex. 30 Tabs never landed in the hero. The static picture and note fit at 320 and 375. With JS on, all are enabled and never dimmed (see F25). Delaying JS 800 ms at 320/360/375/390 gives **CLS 0** for the note → readout swap (the readout box is a fixed 55 px). | `qa16-nojs-hero-390.png`, `nojs-hero-figure-320.png`, `cls-narrow.txt` |

## Tests that need hosted CI (not counted as product FAIL)
- `e2e/hero.spec.ts:657` p95 frame time ≤ 22 ms during play at 1280×800.
- `e2e/hero.spec.ts:1259` dye / pond / rivers / collatz: p95 frame time ≤ 22 ms at 1280×800.
  - These are the known limitation of this Mac (headless rAF about 33 ms). F26 adds no per-frame allocation (milestone check is integer math; `performance.now()` runs only on a milestone change) and doesn't touch the frame-time tests.
- `e2e/hero.spec.ts:639` "pauses in a hidden tab" (expects frames to stay at f0, got f0+1). **This is pre-existing and not caused by F26.**
  - Same machine, same command (`--repeat-each=25 -g "pauses in a hidden tab"`): baseline worktree at `20d59f9` failed **15/25**; candidate failed **11/25** (8/8 vs 7/8 at `--repeat-each=8`).
  - Hypothesis: one rAF already queued before the synthetic `visibilitychange` still draws once at 33 ms frame pacing. Confirm on hosted CI.

## Notes (non-blocking)
1. With JS on, the no-JS readout note is in the HTML until the module runs. The fixed-height readout means no layout shift (measured), but slow connections may briefly show the note.
2. Explicit selections are announced on their own; later pause summaries append them. That is reasonable, but verify with a real screen reader later (QA limits).

Artifacts:
- `docs/checks/F26/attempt-1/`: `qa13-toolbar-320.png`, `qa14-blank-hover-1200.png`, `qa16-nojs-hero-390.png`, `nojs-hero-figure-{320,375}.png`, `cls-narrow.txt`, `hidden-tab-repeat*.log`, `baseline-hidden-tab-repeat*.log`.
- Tools: `docs/checks/tools/f24-27-probes.mjs`, `f24-27-nojs-hero.mjs`, `f24-27-cls-narrow.mjs`.
