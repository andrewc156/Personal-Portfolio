# Build report — F13a Place labels data (stretch S4, data part) — attempt 1

Summary: Added `pipeline/labels.py`, which reads 39 hand-picked USGS GNIS feature IDs from the official GNIS Domestic Names state files (published 2026-11-02). It copies each record's name, class and primary coordinates unrounded, maps each point to its explorer grid cell, and writes `public/data/colorado/labels.json` (9,962 B, with a USGS credit line). The step runs last in `npm run data`, does not touch `meta.json` or `basin-mask.*`, and gives the same bytes when rerun from the cache and from an empty cache. docs/data.md has a new "Place labels (stretch S4)" section, and the stale F12a sentence about 1508 now records Andrew's 2026-11-24 decision (DECISIONS #78).

Files changed:
- pipeline/labels.py (new): download and cache with a SHA-256 sidecar, GNIS reader, cell mapping, labels.json writer
- pipeline/tests/test_labels.py (new): 12 tests
- pipeline/build_colorado.py: calls `lb.write(out, args.raw_dir, log)` after the basin mask; docstring updated
- public/data/colorado/labels.json (new)
- docs/data.md: intro line; F12a Coverage sentence fixed; new "Place labels (stretch S4)" section (source/version table, attribution, format, selection criteria, the 39-label table generated from labels.json, verification); 3 run-log rows
- docs/builds/F13a/attempt-1.md
- Not committed (gitignored): pipeline/data/raw/gnis/DomesticNames_{AZ,CO,NV,UT,WY}_Text.zip plus .json sidecars

How to verify:
- `pipeline/.venv/bin/python -m pytest pipeline -q` → 606 passed (12 new in test_labels.py)
- `pipeline/.venv/bin/ruff check pipeline` → All checks passed
- `pipeline/.venv/bin/python -m pipeline.labels` and then `git status --short public/` → only labels.json is new; rerunning gives the same bytes
- `npm run data -- --out-dir <scratch>`, then `cmp` against public/data/colorado/* → every file is identical except meta.json `generatedAt`/`gitCommit` (33.1 s)
- `pipeline/.venv/bin/python -m pipeline.labels --raw-dir <empty dir> --out-dir <dir holding copies of meta.json and grid.f32>` → downloads 5 zips with the same SHA-256s; labels.json is identical

Acceptance criteria (self-check):
- ✅ Reproducible step: it is wired into `npm run data`. Rerun from cache, full `npm run data` to scratch and the empty-cache run all gave the same labels.json bytes. There are no timestamps; the access date comes from the cache sidecar. `test_reproducible_from_cache` covers this.
- ✅ labels.json + attribution: 39 labels (priority 1/2/3 = 14/16/9; categories peak 7, water 12, city 11, basin 4, canyon 5). `attribution.credit` = "Place names and coordinates: Geographic Names Information System (GNIS) courtesy of the U.S. Geological Survey", with the USGS public-domain statement and the crediting page URL (same form as WBD). `source.files` gives the URL, pubdate 20261102, access date 2026-11-25 (UTC), HTTP Last-Modified, bytes and SHA-256 for each file.
- ✅ Tests prove bbox, cell mapping and source match:
  - `test_inside_bbox`: checked against the spec bbox, typed independently in the test.
  - `test_cell_matches_latlon`: recomputes the cell from meta.native.extent and pixelDeg, checks that the cell footprint contains the point and that the cell centre is within half a cell, and checks that no label is within 0.001 px of a pixel edge.
  - `test_cell_matches_barcode_landmark_rule`: gives the same result as barcode.latlon_cell.
  - `test_ids_names_coordinates_match_gnis`: an independent `|`-split reader of the cached zips finds the same id, name, class and lat/lon.
  - `test_source_files_match_cache`: the zips' SHA-256 and size match labels.json.
  - `test_no_duplicates`: ids, names, map texts, coordinates and cells are all unique.
- ✅ No fabricated coordinates: SELECTION holds only feature IDs, display names, categories and priorities. All positions are read from GNIS, and the build stops if a GNIS name differs from the expected one. Outside the US, only the Colorado River label (its GNIS record's mouth, in Baja California) is used. The delta, the Gulf of California and the Mexican towns are left out: GNIS has no records for them, and the NGA GEOnet Names Server timed out from this machine.
- ✅ Size reported: labels.json is 9,962 B, under the 10,240 B target, and the build enforces the limit.
- ✅ pytest and ruff clean: 606 passed; ruff check clean. The two new files are also `ruff format`-clean. `ruff format --check` still flags build_colorado.py and test_barcode.py, which were unformatted before this task, so I left them alone.

Needs Andrew: none.

Requests to Control:
- F13b (viz) should show `labels.json` → `attribution.credit` in the "About the data" section when labels are on. ATTRIBUTION.md is unchanged, which matches how F12a kept the WBD credit in basin-mask.json.
- F13b notes:
  - Labels with `anchor: "mouth"` (9 labels: the 4 rivers Colorado, Green, Gila and Little Colorado, plus Grand Canyon, Glen Canyon, Cataract Canyon, Black Canyon of the Gunnison, Bingham Canyon) mark the feature's downstream end, not its middle.
  - Use `display` when it is present (2 labels), otherwise `name`.
  - Las Vegas is at x = 2, next to the west edge, so its text may need to sit to the east.

Known limitations:
- The category set is the five from the brief. The open-pit lakes (ranks 5, 6, 7, 11, 14, 18) get no labels because these GNIS files have no Mine class. Bingham Canyon is labelled, but its point is the canyon mouth, 5.8 km from lake 6's birth cell.
- Labels relate to the lakes as follows:
  - Lake rank 3 contains 7 labels.
  - Ranks 47 and 106 contain Great Divide Basin.
  - Glen Canyon falls inside lake rank 41 (106.6 m, 26 cells), which I did not interpret.
  - Edge-born lakes get no labels.
- The "mouth" convention for Stream/Valley primary points comes from an archived USGS GNIS FAQ (2009 snapshot). The current GNIS format doc (2 Oct 2026) does not state it explicitly, but the records agree with it: the Colorado River's source point is in Rocky Mountain National Park and its primary point is at the mouth.
- NAD 83 coordinates are used as WGS 84 without a shift, as for the basin mask.
- The GNIS access date is 2026-11-25 in UTC (2026-11-24 local).

## Addendum (Control request)

Rewrote the `coverage[]` strings in `basin-mask.json` for public readers. The F12b explorer shows them word for word in "About the data". The maintainer detail (the one-off WBD map-service check, the 12 disagreeing cells, the brief's expectation, DECISIONS #78) stays in docs/data.md only.
- Generator: `pipeline/basin_mask.py` `build_meta()` → `coverage`.
  - Nothing in the strings refers to the S3 brief, `docs/data.md`, `meta.min`, or `stats.*` paths.
  - Every number still comes from `stats`.
  - Kept facts:
    - WBD region 15 continues into Mexico (WBD metadata quote, "in collaboration with Mexico's INEGI"; `inegiNote()` still matches it).
    - 1039 basin cells are in all-Mexico units.
    - The grid's lowest cell is in HU-12 150301080302 (downstream code OCEAN) and is inside the mask.
    - 4 south-west cells (around 31.87° N, 115.19° W) are in no WBD unit and are outside the mask.
    - Subregion 1508 Sonora: 634 HU-12s end at CLOSED BASIN (22), MEXICO (117), OCEAN (495), and none drains to the Colorado.
    - Great Divide Closed Basin.
    - Cells: Sonora 1609, Great Divide Closed Basin 1426.
    - Region 18 along the west edge.
    - Edge shares and resolution.
- `basin-mask.json`: 14,056 B → 13,882 B. New SHA-256 `f9f3e4d60b6cc1583a827e66431a9180b2436f9f424e23e170afec8f959d578f` (was `d1658674358c605b6662bc6adb2769cdbd81897e35b7efcfbba6267f7e06012e`). meta.json `files["basin-mask.json"]` is updated to match.
- Unchanged: `basin-mask.bin` (byte-identical), `meta.basinMask`, all other meta.json keys, `labels.json`. No test pinned the old wording. `test_basin_mask` still checks for "Mexico", "INEGI" and "1508", and it passes.
- Checks:
  - pytest: 606 passed.
  - ruff check: clean.
  - `npx vitest run tests/unit/viz/explorer`: 6 files, 80 tests passed.
  - `npm run data -- --out-dir <scratch>`: all outputs, including the new basin-mask.json and labels.json, are byte-identical to the committed files except meta.json `generatedAt`/`gitCommit`.

## Recovery review

- The labels generator, coverage text, and metadata hashes were complete at handoff. I replaced `datetime.UTC` with the Python 3.10-compatible `datetime.timezone.utc` in `pipeline/labels.py`, `pipeline/basin_mask.py` and `pipeline/build_colorado.py`. The targeted Ruff suppressions preserve the documented Python minimum.
- `pipeline/.venv/bin/python -m pytest pipeline -q` passed all 606 tests. `pipeline/.venv/bin/ruff check pipeline` passed. The cached full pipeline rebuilt all seven data files byte-for-byte and matched `meta.json` apart from `generatedAt` and `gitCommit`. The local interpreter was Python 3.13.
- The earlier empty-cache repeat used the same GNIS releases and UTC access date. A later cold run can update access-date provenance or pick up a new upstream release.
