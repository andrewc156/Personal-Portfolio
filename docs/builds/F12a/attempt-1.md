# Build report — F12a Basin mask data (stretch S3, data part) — attempt 1

Summary: I added a reproducible pipeline step, `pipeline/basin_mask.py`, which runs last in `npm run data` and can also run alone. It downloads the official USGS National Map WBD HU-2 Shapefiles for regions 14 and 15 (published 2025-01-08) and rasterizes their union onto exactly the 326 × 414 explorer grid, using the same native 3″ lattice and the same 30 × 30 blocks. It writes `basin-mask.bin` (33,742 B; two 1-bit planes: basin, and region 15) plus `basin-mask.json`, and adds `basinMask` and `files` entries to `meta.json`. **Important finding: the brief's premise that WBD stops at the US–Mexico border is false for this release.** WBD region 15 includes INEGI-harmonized units in Mexico down to the Gulf of California, and the grid's lowest cell is inside the mask. Within the study area only 4 south-west corner cells fall in no WBD unit. This is documented from the data, and no boundary was invented.

Files changed:
- `pipeline/basin_mask.py` (new): download, strict Shapefile/dBASE reader, rasterization, planes, statistics, metadata, and the patch to meta.json.
- `pipeline/build_colorado.py`: docstring, plus a call to `basin_mask.write()` after the other exports.
- `pipeline/tests/test_basin_mask.py` (new, 31 tests).
- `public/data/colorado/basin-mask.bin` (new, 33,742 B; gzip -9 2,077 B).
- `public/data/colorado/basin-mask.json` (new, 14,056 B; gzip -9 4,766 B).
- `public/data/colorado/meta.json`: adds `basinMask` and `files["basin-mask.bin"]` / `files["basin-mask.json"]`. Every other key is unchanged, including `generatedAt` and `gitCommit` from the DEM build.
- `docs/data.md`: intro line, new section "Basin mask (stretch S3)" (source, version, access, attribution, processing, format, results, coverage, verification, GNIS table), and 3 run-log rows.
- `docs/builds/F12a/attempt-1.md` (this report).
- Not committed: raw downloads in `pipeline/data/raw/wbd/` (272 MB, gitignored by `pipeline/data/raw/`; `git check-ignore` confirms).

How to verify:
- `pipeline/.venv/bin/python -m pytest pipeline -q` → 594 passed (31 in `test_basin_mask.py`; the 4 recompute tests skip if the WBD cache is absent).
- `pipeline/.venv/bin/ruff check pipeline` → All checks passed.
- `pipeline/.venv/bin/python -m pipeline.basin_mask` (≈ 40 s from an empty cache, ≈ 20 s cached) → same bytes.
- `npm run data -- --out-dir <scratch>` → all 7 outputs byte-identical to the committed files except `meta.json` `generatedAt`/`gitCommit`.
- JS consumers: `npx vitest run tests/unit/viz/explorer` → 66 passed with the extended meta.json.

Acceptance criteria (self-check):
- ✅ Reproducible pipeline step. `npm run data` runs it, and so does `python -m pipeline.basin_mask`. The download path ran twice from an empty cache: both zips had the same SHA-256 and the outputs were byte-identical. The output has no timestamps; the access date comes from the cache sidecar.
- ✅ Artifact and metadata in `public/data/colorado/`. The format is documented in `basin-mask.json` → `format` and in docs/data.md: bit i = `(byte[i>>3] >> (i&7)) & 1`, i = y·W + x, row 0 north; plane 0 = basin, plane 1 = region 15.
- ✅ Grid alignment proven by test. `test_dims_equal_grid` checks dims 414 × 326 and that grid bbox/width/height/cellDeg/rowOrder/extent and the grid.f32 SHA-256 equal meta. `test_alignment_against_independent_point_in_polygon` uses a non-GDAL even-odd test of every cell centre: it agrees except on boundary cells, and any 1-cell shift more than doubles the disagreement. `test_bit_order_matches_js_formula` checks the bit order.
- ✅ Sanity points from USGS GNIS Domestic Names (published 2026-11-02, feature IDs cited in the test and docs):
  - Uncompahgre Peak, Grand Junction and Moab are in 14.
  - Lake Mead, Las Vegas, Phoenix and Flagstaff are in 15.
  - Salt Lake City, Great Salt Lake and Ely, NV are outside.
  - Denver and Albuquerque are east of the bbox (off the grid) and outside both source polygons.
  - Each in-grid point has a uniform 5 × 5 neighbourhood. GNIS Domestic Names has no "Hoover Dam" record, so Lake Mead (GNIS 7862) is used.
- ✅ Plausible fraction. 97,311 / 134,964 cells = 0.721; 603,746 km² of 830,507 km², which is 84 % of WBD 14 + 15. The rasterized full-region areas match WBD `areasqkm` to within 0.001 %.
- ✅ Sources, version, coverage gap and attribution are documented in `basin-mask.json` (`source`, `attribution`, `coverage`) and docs/data.md:
  - URLs and FGDC title/pubdate 20250108, HTTP Last-Modified, access date 2026-11-25 UTC, SHA-256.
  - The credit "Watershed Boundary Dataset (WBD) courtesy of the U.S. Geological Survey", built from the USGS crediting page's suggested form, which is quoted with its URL, along with the public-domain sentence.
- ✅ pytest and ruff are clean.
- ✅ No fabricated data. All geometry comes from the USGS zips. The Mexican gap cells are left 0, and nothing is interpolated or substituted.
- ✅ Size reported: 33,742 B (target ≤ 50 KB), metadata 14,056 B.

Needs Andrew:
- Region 15 includes HU-4 1508 "Sonora". By WBD's own downstream codes, all 634 of its HU-12s drain to OCEAN, MEXICO or CLOSED BASIN within 1508, never to the Colorado (1,609 cells in the mask). Region 14 includes the Great Divide Closed Basin (1,426 cells). Should the toggle keep the brief's definition (HU-2 14 ∪ 15, as built), or exclude 1508? Excluding it would need a third plane or a rebuilt plane 0, and I can do either in a follow-up.

Requests to Control:
- Spec S3 says "the US portion; document the coverage gap in Mexico". The data shows WBD covers Mexico here, so F12b's toggle label and copy should not say "US portion only". Suggested wording: "USGS Watershed Boundary Dataset regions 14–15", with the credit line.
- F12b: if the explorer shows the mask, "About the data" should show `basinMask.credit` (or `basin-mask.json` → `attribution.credit`). I did not change `ATTRIBUTION.md`, because `about.ts` parses it and checks the Copernicus notice.
- No new Python packages are needed. It uses rasterio (and its `affine` dependency), numpy and requests, which are already in place.
- `public/_headers` `/data/*` already covers the new files. No change is needed.

Known limitations:
- The coverage statements about Mexico rely on WBD's harmonized units. I did not compare them with INEGI's hydrography. The "only 4 cells in no WBD unit" figure comes from a one-off query of the generalized WBD map service (0.002°), recorded in docs/data.md with the exact URL. It is not part of the pipeline.
- NAD 83 vertices are used as WGS 84 without a shift. USGS calls the two datums equivalent at 1:5,000 and smaller, and the cells are 0.025°.
- The mask is one bit per 0.025° cell. 1,840 cells straddle the boundary and are decided by the ≥ half-of-pixels rule (ties go in). The explorer will need to upsample it to mask the 30″ hillshade, and the edge will look blocky.
- The access date is in UTC (2026-11-25), which was the evening of 2026-11-24 local time.
- A future WBD release would change the zip SHA-256, pubdate and possibly the mask. Rebuilding from an empty cache would pick it up, and the change would show in `source.regions`.
