# Check report — F27 Explorer focus, touch, keyboard and no-JS fixes (QA-06, QA-07, QA-08, QA-10) — attempt 1
Verdict: PASS_WITH_NOTES

Candidate: uncommitted working tree on `main` @ `20d59f9` (F24–F27 together). Shared gate results are in `docs/checks/F24/attempt-1.md`.

Gates: check ✅ · lint ✅ · unit ✅ (913; `cursor.test.ts` included) · pytest ✅ · build ✅ · e2e ✅ for the explorer (the whole `explorer.spec.ts` passed, including the 6 new F27 tests, label/verification/basin-mask tests and the CSP explorer test under wrangler) · axe ✅ (`/rising-water/` 0 violations at 375 and 1280, light and dark) · lighthouse ✅ (`/rising-water/` 96/100/96/100, CLS 0; the BP item is the old `image-aspect-ratio` result) · links ✅ (`#lakes`, `#how-to-read`, `#about-data` targets exist) · visual ✅ · content ✅ · data ✅ (cursor reading checked against the raw grid, below) · tda n/a

## Per-finding table

| QA finding | Repro (from QA report) | Result | Evidence |
|---|---|---|---|
| QA-06 Show leaves focus in table | 390×844: focus "Show lake 5 on the map", press Enter, wait, press Tab | ✅ Focus moves to the map stage with a solid focus ring and `aria-describedby="ex-card-title ex-card-text ex-keys"`. The card reads "Lake 5 · birth cell 117202" and the stage is at the top of the viewport (scrollY 2862 → 495). The next Tab → **Play**, not "Show lake 6". The screenshot shows the map in view, the ring and the Lake 5 pit label. | `qa06-default-after-enter-390.png`, `qa06-scroll-trace-settled.txt`, `F24/attempt-1/probes-f27.json` |
| QA-07 tap readout disappears on release | Touch viewport, tap the middle of the map, read at 900 ms | ✅ After 900 ms the reading is "Elevation 1,099.5 m (3,607 ft) at 36.9954° N, 111.1396° W · dry". A second tap replaces it with a different cell. Mouse hover still clears on leave (e2e). | `probes-f27.json` |
| QA-08 no keyboard cell inspection | Focus map; try to inspect a cell without a pointer | ✅ The sequence is Enter → → → Shift+↓. The polite live region and the hint both read "Cursor at column 165 of 326, row 218 of 414: Elevation 1,623.9 m (5,328 ft) at 36.7204° N, 111.0896° W · dry". The water level doesn't move while the cursor is on; after Esc, → moves the level again. I checked the reading independently against the raw `grid.f32`: cell (col 164, row 217, 0-based) = **1623.856 m**, and lat 42.1575 − 217.5×0.025 = 36.72 ✓. The cursor ring is visible on the canvas. | `qa08-cursor-1280.png`, `probes-f27.json` |
| QA-10 endless loading without JS | JS off, open `/rising-water/` | ✅ The `<noscript>` note is visible with links to the lakes table, How to read and About the data. "Loading the elevation grid…", the controls and readouts are hidden. The stage has no tabindex. The relief and 21 table rows are present. | `qa10-nojs-390.png`, `F25/attempt-1/sheet-nojs.png`, `probes-f27.json` |

Regressions checked: explorer Play advances the level (−2.9 → 188 m in 1.2 s); 40 place-label elements are present; maps are drawn in light and dark at 320–1280 with no horizontal overflow; the bigger `.ex-hover` box (4.2em) caused no CLS (`cls.spec` 4/4 including `/rising-water/`, LHCI CLS 0); 0 console errors in all probes.

## Notes (non-blocking)
1. **Edge case: Enter during the focus scroll.** If a keyboard user presses Enter on a Show button while the browser is still smooth-scrolling to that button (within about 1 s of tabbing to it), `src/components/explorer/explorer-client.ts:325-327` reads the stage rect mid-scroll. If the stage is then in view, no scroll is started, the page finishes scrolling down to the table, and focus is left on the now offscreen map (`qa06-scroll-trace.txt`, "default"/"paused-first" rows). After the scroll has settled (the realistic flow, and the QA repro) it works. A more robust version would always `scrollIntoView` unless the stage is fully in view after `scrollend`. This is the same smooth-scroll timing family as the F25 QA-11 blocker.
2. Longitudes differ from the naive cell centre by about 0.0004° (111.0896 vs 111.0892). This comes from the existing `cellCenter`, not F27, and is far below the cell size.
3. `@media (scripting: none)` needs Chrome 120+, Firefox 113+ or Safari 17+, as the builder notes.

Artifacts:
- `docs/checks/F27/attempt-1/`: `qa06-*.png/txt`, `qa07-tap-persist-390.png`, `qa08-cursor-1280.png`, `qa10-nojs-390.png`.
- Tools: `docs/checks/tools/f24-27-probes.mjs`, `f24-27-qa06-scroll.mjs`.
