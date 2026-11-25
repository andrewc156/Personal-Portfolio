# Build report — F12b Basin mask toggle (stretch S3, UI) — attempt 1

Summary: The explorer has a new "Basin mask" checkbox, off by default, labelled "USGS Watershed Boundary Dataset regions 14–15 (Upper Colorado Region and Lower Colorado Region)". The label is built from basin-mask.json. The mask files are fetched only the first time the mask is switched on, either by the checkbox or by `#mask=basin`. Before anything is drawn, both files are checked against meta.json (length, files entry, SHA-256, grid identity, padding bits, plane 1 ⊆ plane 0, basin-cell count). When the mask is on, every cell outside it is dimmed and hatched, land and water alike, and the boundary is drawn as a crisp line on device pixels. The lakes table gets a "Pit in basin" column, and the hover text, info card and hidden summary each mention the mask. The flood, the barcode and the lakes are still computed on the whole grid, and the mask never enters that computation. "About the data" now has a "Basin mask" section built from basin-mask.json: the credit line, source and release, public-domain statement, cell rule, an INEGI note and the coverage notes verbatim.

Files changed:
- src/lib/viz/explorer/basin.ts (new): decoding, file/hash/plane checks, upsampling (`axisCells`, `screenAxes`, `axisEdges`, `upsampleMask`), `paintHatch`, hash state (`parseMaskHash`, `maskHash`), `regionsLabel`
- src/lib/viz/explorer/controller.ts: `setBasin`, `basinAt`, `basinShown`, `basinLabel`, `basinBuildMs`; the cached layer is drawn between the water and the selection/labels; mask notes in hover and card; summary flag
- src/lib/viz/explorer/text.ts: `SummaryInput.basin` (label) adds one sentence to the summary
- src/lib/viz/explorer/types.ts: `ColoradoMeta.basinMask?`, `BasinMaskFile`
- src/lib/viz/explorer/about.ts: `basinFacts`, `inegiNote`
- src/components/explorer/explorer-client.ts: `loadBasin` (lazy, verified), `wireBasin` (toggle, status, hash, table column, error state)
- src/components/explorer/Explorer.astro: the toggle, its description and its status line, plus CSS
- src/components/explorer/LakesTable.astro: hidden "Pit in basin" column and one explanatory sentence
- src/components/explorer/AboutData.astro: "Basin mask" subsection
- src/components/explorer/build-data.ts: `readBasinMaskInfo` (build fails if meta lists a mask file that is missing, or if the credit lines differ)
- src/pages/rising-water/index.astro: passes `basin` to the three components
- tests/unit/viz/explorer/basin.test.ts (new, 15 tests)
- e2e/explorer.spec.ts: 13 new tests in "explorer: basin mask"; the third-party check now uses `baseURL`'s origin instead of a hard-coded 4321 and asserts that basin-mask is not fetched on load

How to verify:
- `npm run check`: 0 errors, 0 warnings
- `npm run lint`: clean
- `npx vitest run tests/unit/viz/explorer`: 80 passed (6 files)
- `npx playwright test e2e/explorer.spec.ts` (checker, against preview on 4321)

Decisions:
- Barcode and lakes table are not filtered. The computation stays on the whole grid, so it remains §6.1-exact. The table gets a "Pit in basin" marker column instead: "yes (region 14/15)" or "no", read from the verified mask at the lake's birth cell. The column is hidden while the mask is off, and the rows never change. The copy says explicitly that the lakes and the barcode still cover the whole rectangle. No claim is made that the mask changes persistence.
- Hash state: before this change the explorer kept no state in the URL hash; the hash was used only for section anchors. The new format is `#mask=basin`. A hash counts as state only if it parses as key=value with `mask` set to a known value. Anchors such as `#lakes` and `#about-data` are ignored and left untouched, so old URLs behave exactly as before. Switching the mask off removes only a state hash. Writes use `history.replaceState`, so there is no scroll and no history spam. The page listens to `hashchange` only for state hashes. On load the checkbox is forced unchecked, so a checked state the browser restores on reload can't show a mask that hasn't been loaded; `autocomplete="off"` is set as well.
- Rendering and upsampling: each device pixel takes the cell under its centre (`axisCells`). This is the same rule as `cellAtFraction` (hover) and as nearest-neighbour drawImage (water). A unit test checks it against `cellAtFraction` at three canvas sizes. At hillshade resolution (10 native px per hillshade px, 30 per cell), hillshade pixel p belongs to cell ⌊p/3⌋, so every cell edge falls on a hillshade pixel edge; this is also unit-tested. The boundary is stroked on the integer device-pixel lines between inside and outside pixels (`axisEdges`), as a 2·dpr accent line over a 4·dpr surface halo. Segments on the study-area rectangle are skipped because they mark the edge of the data, not the basin. The layer is rasterised once per canvas size and theme (about 60 ms at 1280 px, DPR 2) and then copied 1:1 each frame. With the mask on, render p50 is 0.6 ms and p95 is 1.0 ms, and the frame path allocates nothing.
- Error state: a missing, truncated or bit-flipped mask produces one `console.error` and a role="status" message next to the toggle: "The basin mask failed to load (reason), so it is not shown. The map, the barcode and the table work as before." The checkbox is unchecked but left enabled so the reader can retry, and the hash state is cleared. Nothing else changes.

Acceptance criteria (self-check):
- ✅ Toggle is keyboard accessible with a visible label. It is a native checkbox with `<label for>` "Basin mask" and `aria-describedby` pointing at the description. The e2e test switches it on and off with Space.
- ✅ Lazy load. e2e: no `basin-mask` request on load, or with an anchor hash; the request happens on first toggle; turning it off and on again does not refetch.
- ✅ Verified against meta.json. Checks cover size, the files entry, SHA-256 of both .bin and .json, the basin-mask.json grid (size, bbox, extent, cellDeg, grid.f32 SHA-256), padding bits, plane 1 ⊆ plane 0, and plane-0 popcount = meta.basinMask.basinCells. Unit test: the committed file passes; region counts equal stats (41,956 and 55,355).
- ✅ Plane 0 is decoded with `(byte[i >> 3] >> (i & 7)) & 1` (unit test with a hand-built buffer).
- ✅ Corrupt or missing mask shows a clear error and the explorer keeps working. e2e covers 404, one flipped bit (SHA-256) and truncation (size). In each case the status is shown, the checkbox is unchecked, the hash is cleared, and Play and the table buttons still work.
- ✅ Alignment. Unit test: all 10 on-grid GNIS points from docs/data.md (parsed, not retyped) have the expected 14, 15 or outside value, including Lake Mead = 15 and Great Salt Lake = outside. e2e: on the rendered canvas the Lake Mead pixel has alpha 0 and the Great Salt Lake pixel alpha > 0; `basinAt` returns [15, 0]; with the mask off, alpha is 0 again.
- ✅ Light and dark are readable (self-screenshots at 1280 light, 1280 dark, 768 dark and 375 light). In dark mode the accent boundary is closer in hue to the neutral water; the hatching is the main cue there.
- ✅ Nothing overflows at 375, 768 or 1280, and axe reports no serious or critical violations with the mask on. Six e2e tests (3 widths × 2 themes) pass against the dev server.
- ✅ / to confirm: Lighthouse. The mask is not on the critical path: no fetch until opt-in, the code is inside the existing explorer bundle, and the added HTML is the About subsection. I did not run Lighthouse; the checker should.
- ✅ No third-party requests (e2e, origin taken from baseURL).
- ✅ Unit tests cover decoding, checks, upsampling (hillshade and screen), hatching, the hash, and the copy helpers.
- ✅ Copy: "USGS Watershed Boundary Dataset regions 14–15"; "US portion" appears nowhere (e2e asserts this). The credit comes from basin-mask.json (e2e `[data-basin-credit]`). The INEGI note is rendered only when the coverage notes record it, and it quotes the WBD metadata from them. No TDA claims beyond §6.6.
- e2e run against my dev server (`PW_BASE_URL=http://localhost:4412`, private `--output` dir): 34 of 35 passed. The one failure is "data transferred ≤ 3 MB", at 3.25 MB in dev. Of that, 1.83 MB is unminified Vite deps and the dev toolbar; the data alone is 0.76 MB, unchanged because the mask is not loaded. That test is meant for preview. One earlier run also hit a Playwright artifact ENOENT, because another agent was writing to the shared `test-results/`; it passed on rerun with a private output dir.

Needs Andrew: nothing new. DECISIONS #78 (keep 14 + 15 including 1508 Sonora) is followed as built.

Requests to Control:
1. Optional, for the data-engineer (public/data is not mine): basin-mask.json `coverage[0]` begins "the S3 brief expected WBD to stop at the border". That is project jargon, and it now appears verbatim on the public page. `coverage[1]` says "(docs/data.md)". Consider rewording both for readers. The page renders whatever the file says, so no explorer change would be needed.
2. Add a DECISIONS entry for the choices above: no filtering, a marker column, `#mask=basin` hash state, display-only mask.

Known limitations:
- After every resize the hatch layer is re-rasterised (about 60 ms at DPR 2, 1280 px). It is not debounced, so a continuous window drag can stutter slightly with the mask on.
- In dark mode the boundary line (accent light blue) has less contrast against neutral water than in light mode; the hatching still marks outside cells clearly.
- The strip (barcode or diagram) does not mark bars whose pit is outside the mask; only the table, the card and the hover do.
- I did not run the existing non-basin e2e tests against a production build, Lighthouse, or the full verify; those are for the checker.
