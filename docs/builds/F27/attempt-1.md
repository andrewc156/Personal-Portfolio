# Build report — F27 Explorer focus, touch, keyboard and no-JS fixes — attempt 1

Summary: This attempt fixes QA-06, QA-07, QA-08 and QA-10 from `docs/qa/f23-production/report.md` on `/rising-water/`.
- **QA-06:** "Show" in the lakes table now moves focus to the map. The map's description reads the selected lake's card, and the next Tab goes to Play.
- **QA-07:** A tapped cell's reading stays visible until another tap, a tap outside the map, or Escape. Mouse hover still clears when the pointer leaves the map.
- **QA-08:** Enter on the focused map turns on a keyboard cell cursor. The arrow keys, Shift, Page Up/Down and Home/End move it; Enter or Escape turns it off. The reading goes to a debounced, polite live region.
- **QA-10:** Without JavaScript, a `<noscript>` note replaces the loading state and links to the lakes table, How to read and About the data. The map is no longer a dead tab stop.

Files changed:
- src/lib/viz/explorer/cursor.ts (new): pure cursor logic: key → move, clamping, start cell, "column x of W, row y of H".
- src/lib/viz/explorer/controller.ts: inspection state (`hoverCell` / `pinnedCell` / `cursorCell`). Adds `setCursor`, `moveCursorKey`, `clearPinned` and `shownCell`; touch pinning; dismissal by a tap outside the map; the drawn cursor ring (no per-frame allocation); a debounced (400 ms) polite announcer; Enter/Escape handling on the stage.
- src/components/explorer/Explorer.astro:
  - The stage's tabindex, aria-describedby and aria-keyshortcuts are now added by JS (`data-keys` holds the list).
  - Card title and text get ids.
  - The hint names the Enter cursor; `.ex-hover` min-height goes from 2.8em to 4.2em.
  - The `#ex-keys` help documents the cursor keys; a new `[data-ex-cell-live]` polite region is added.
  - A `<noscript>` note, plus `@media (scripting: none)` rules that hide the status, readouts, strip, card, controls, hint and legend.
  - The `.ex-stage[data-focus-ring]:focus` ring.
- src/components/explorer/explorer-client.ts: `makeFocusable()` runs once the controller is running. It sets tabindex 0, aria-describedby "ex-card-title ex-card-text ex-keys" and aria-keyshortcuts. Show buttons focus the stage with `preventScroll` before the existing scroll; a keyboard activation (`detail === 0`) forces the focus ring. The live region is passed to the controller.
- tests/unit/viz/explorer/cursor.test.ts (new, 9 tests).
- e2e/explorer.spec.ts: new describe "explorer: F27 focus, touch, keyboard and no-JS" (6 tests).
- docs/builds/F27/attempt-1.md.

How to verify:
- `npx vitest run tests/unit/viz/explorer` → 9 files, 105 tests passed.
- `npm run test` → 37 files, 913 tests passed.
- `npx astro dev --port 4424 --ignore-lock`, then `PW_BASE_URL=http://localhost:4424 npx playwright test e2e/explorer.spec.ts -g 'F27'` → 6 passed.
- `npx eslint src/lib/viz/explorer src/components/explorer src/pages/rising-water e2e/explorer.spec.ts tests/unit/viz/explorer` → clean. Prettier check on the same paths → clean.
- `npx astro check` and `npm run lint` fail only because of the environment (see Requests to Control). No errors are reported for F27 paths except two duplicate-global errors in explorer-client.ts that come from the same stray copies.

Acceptance criteria (self-check):
- ✅ QA-06: 390×844, keyboard Enter on "Show lake 5 on the map":
  - the stage is focused, the outline is solid, and aria-describedby starts with the card;
  - the card title is "Lake 5 · birth cell …";
  - the map scrolls into view, ArrowDown works, and Tab lands on Play.
  - Evidence: e2e "F27 QA-06". A manual trace shows scrollY going 2862 → 495 with focus on `ex-stage`, then Tab to Play.
- ✅ QA-07: on a hasTouch/isMobile context, the tapped cell's reading (elevation equal to `heights[cell]`) is still shown after 900 ms. The live region gets it too. A second tap replaces it; a tap on the h1 and Escape on the map each restore the hint. Evidence: e2e "F27 QA-07: a tapped cell…".
- ✅ Mouse hover is unchanged: the reading clears on pointerleave even after a mouse click (e2e "F27 QA-07: mouse hover…"). The existing hover test's text and `data-hover-cell` contract is kept.
- ✅ QA-08: Enter turns the cursor on at the centre cell. The e2e checks →, Shift+↓, PageUp, Home, ← (clamped at the west edge) and End, and the water level does not move. The reading has the form "Cursor at column 326 of 326, row r of 414: Elevation …", built from grid.f32 heights and meta.json. The debounced polite live region speaks the final position. The cursor ring changes the canvas pixel. Escape turns it off and the arrows move the level again; Enter re-enters at the last cursor cell.
  - Keys are documented in `#ex-keys` (aria-describedby), the visible hint and aria-keyshortcuts.
  - Evidence: e2e "F27 QA-08", unit tests in cursor.test.ts, and the screenshot /Users/andrewchincea/.hermes/cache/scratch/f27-cursor-col.png.
- ✅ QA-10: JS disabled at 390×844:
  - the noscript note is visible with links to #lakes and #about-data;
  - "Loading the elevation grid…", the controls, readouts and hint are hidden;
  - the stage has no tabindex or aria-keyshortcuts;
  - the relief and all 21 table rows are present.
  - With JS on, the note is absent and the stage has tabindex 0.
  - Evidence: e2e "F27 QA-10" ×2 and the screenshot /Users/andrewchincea/.hermes/cache/scratch/f27-nojs.png.
- ✅ Numbers come from the data: elevations, coordinates and the grid size (W=326, H=414) all come from grid.f32 and meta.json through the existing `hoverText` / `cellCenter`. Nothing is typed by hand.
- ✅ CSP: no new inline `style=""` or `on*` attributes. The noscript block is plain markup, and the scoped CSS goes through the normal Astro stylesheet.
- ✅ Performance: the cursor is drawn with `strokeRect` / `fillRect` on precomputed edges, with no per-frame allocation. DPR stays capped at 2. Announcements are timer-debounced and only run on keyboard or touch input, never on mouse hover or playback.
- ⚠️ Existing explorer e2e tests were not re-run, as the task instructed (only the new tests). These existing behaviours were deliberately kept:
  - arrows, Home/End, Up/Down and Escape on the stage work as before while the cursor is off;
  - `markInert` still removes the attributes, which now also never exist before the explorer is ready;
  - the hint is still emptied in the error state.

Needs Andrew: none.

Requests to Control:
1. `npx astro check` (99 errors) and `npm run lint` (926 errors) fail repo-wide because of untracked checker copies under `docs/checks/F19a/attempt-2/test-results/candidate/` and `docs/checks/F19b/attempt-{1,2}/test-results/{baseline,copy-only,viz-only,candidate}/`.
   - They duplicate `src/`, `e2e/` and tsconfig files, which causes duplicate `HTMLElement.__explorer` / `__hero` global declarations and ESLint "multiple candidate TSConfigRootDirs".
   - Suggested fix: delete those test-results copies, or add `docs/checks/**/test-results` to the tsconfig `exclude` and the ESLint ignores.
   - All errors reported for F27-owned files come from these copies.
2. Run the full explorer e2e suite in the checker run. The `.ex-hover` box grew to 4.2em, which shifts content below the map slightly; there are no CLS-at-load implications because it is static.

Known limitations:
- The cursor is a mode on the existing map focus stop (Enter toggles it), because the arrows already move the water level there. It stays on after blur until Enter or Escape.
- `@media (scripting: none)` needs Chrome 120+, Firefox 113+ or Safari 17+. Older browsers with JS off show the note and the old loading text together.
- Tested only in Chromium (emulated touch), not on physical iOS or with a real screen reader.
