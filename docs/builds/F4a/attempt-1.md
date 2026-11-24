# Build report — F4a Colorado DEM → grid — attempt 1

Summary: `npm run data` now builds `public/data/colorado/{grid.f32, meta.json, hillshade.webp, ATTRIBUTION.md}` from real Copernicus DEM GLO-90 tiles on AWS (108/108 tiles, none missing, no nodata, nothing filled or synthesized). The tile corner convention was checked on one real tile before the bulk download. The bbox snaps to 9,769 × 12,408 native pixels and a 326 × 414 block-minimum grid, as the spec expects. The full pipeline ran end to end from an empty cache (94.2 s) and from the cache (≈ 7–8 s), and both runs gave byte-identical outputs.

Files changed:
- pipeline/colorado_dem.py (new): download, tile checks, mosaic/clip, block min/mean, hillshade, derived values
- pipeline/build_colorado.py (new): `python -m pipeline.build_colorado` driver and exports (`--raw-dir`, `--out-dir` options)
- pipeline/tests/test_colorado.py (new): 17 tests
- public/data/colorado/grid.f32, meta.json, hillshade.webp, ATTRIBUTION.md (new, generated)
- docs/data.md (new)
- docs/builds/F4a/attempt-1.md
- I added no `__init__.py` and no conftest. `pipeline` imports as a namespace package. The test adds the repo root to `sys.path` inside its own module only. pipeline/data/raw/ holds 108 tiles plus tileList.txt (485 MB, gitignored).

How to verify:
- `npm run data` (from cache, ≈ 8 s)
- Empty cache: `npm run data -- --raw-dir <new empty dir> --out-dir <tmp dir>` (≈ 95 s), then `cmp <tmp dir>/grid.f32 public/data/colorado/grid.f32`
- `pipeline/.venv/bin/python -m pytest pipeline -q --ignore=pipeline/tests/test_tda_ref.py` → 17 passed. With the TDA tests included, the full `pytest pipeline` gives 282 passed.
- `pipeline/.venv/bin/ruff check pipeline --exclude pipeline/tda_ref.py,pipeline/tests/test_tda_ref.py` → All checks passed
- `git check-ignore -v pipeline/data/raw/tileList.txt` → `.gitignore:6:pipeline/data/raw/`

Acceptance criteria (self-check):
1. ✅ Download path tested twice from an empty cache.
   - First run, empty `pipeline/data/raw/`: downloaded 108/108 tiles in 81.9 s, then stopped at my tile CRS check. The tiles have a WGS 84 GEOGCS with no EPSG code. I fixed the check to compare `proj=longlat, datum=WGS84`.
   - Second run, a new empty `--raw-dir`: success. tileList.txt and 108 tiles were downloaded in 87.2 s; 94.2 s in total; `grid.f32` and `hillshade.webp` were byte-identical to the committed files.
   - Cached `npm run data`: success in 7.4–7.9 s (cache check 0.1 s, processing ≈ 7 s).
2. ✅ Convention verified on `Copernicus_DSM_COG_30_N36_00_W112_00_DEM` (HTTP 200, 4,778,000 B).
   - The tile is 1200², PixelIsPoint. Geotransform: (1/1200, 0, −112.000416667, 0, −1/1200, 37.000416667). Pixel centres run lon −112.0…−111.000833 and lat 37.0…36.000833.
   - So the name is the south-west (lower-left) integer corner. The south row and east column belong to the neighbouring tiles, which matches the bucket readme.
   - Every tile is re-checked during the build: size, spacing, origin, CRS, PixelIsPoint. All 108 are 1200 px wide.
   - Missing tiles: none. All 108 returned HTTP 200 and all appear in the bucket's tileList.txt. The 404 rules (only N31 W113–W116, and only if absent from tileList.txt, count as ocean; anything else stops the build) are in docs/data.md and `meta.source.tiles.missing` (empty).
3. ✅ All four files exist. `meta.bbox` = `[-115.201667, 31.8175, -107.060833, 42.1575]` exactly (tested).
   - width 326, height 414, cells 134,964; native size 9,769 × 12,408; hillshade 977 × 1,241.
   - Snapping: the bbox edges fall on pixel-centre lines (residuals ≤ 0.0004 px). The tiles' own half-open rule applies: the west column and north row are kept, the east column and south row dropped.
   - So the pixel footprint is [−115.202083, 31.817917, −107.06125, 42.157917], half a pixel (≈ 40 m) west and north of the bbox. It is recorded in `meta.native.extent` and `snapResidualsPx`.
   - Partial edge blocks: the last column is 19 px wide and the last row 18 px tall.
   - Derived values rechecked (WGS 84): span 8.140834° × 10.34°; 724.7 km E–W at 36.9875°; 1,147.5 km N–S; display aspect 0.6289.
4. ✅ pytest: 17 passed. Covers bbox and shape, native-window maths, derived values, no NaN, plausible min and max, global minimum in the SW, min/max records, LE float32 byte layout and SHA-256, north-row-first lat/lon formula, block-min and block-mean edge handling, sizes, WebP dimensions, attribution text, meta fields. Also grid reproducibility from the raw cache, skipped when the cache is absent. The barcode reproducibility test is left for F4b.
5. ✅ grid.f32 is 539,856 B; hillshade.webp is 179,574 B (WebP quality 85). Both are ≤ 614,400 B.
6. ✅ ATTRIBUTION.md quotes the licence's "User Obligations" notice for adapted data word for word: "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved".
   - Source URL: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM (linked from the registry's License field). It also gives the registry URL, the DOI and the surface-model (DSM) note.
   - docs/data.md covers provenance, every step, limitations (surface model, resolution, rectangle ≠ basin, geometry, vertical accuracy) and a labelled "Longest-lived lakes" section reserved for F4b.
7. ✅ `pipeline/data/raw/` is gitignored (verified with `git check-ignore`). Nothing is interpolated, filled or substituted. No ocean fill was needed.

Geography findings (recorded in docs/data.md, not stated on the site):
- Raw native minimum: −2.885 m at 31.956667° N, 114.775833° W (row 12241, col 511). This is the Colorado River delta area, SW corner, about sea level.
- 4,045 native pixels are exactly 0 m and 16 are below 0 m. All lie in 31.82–32.00° N, 115.00–114.70° W. These values come from the tiles, not from a fill.
- Raw native maximum: 4,339.021 m at 38.070833° N, 107.461667° W (row 4904, col 9288). That is about 0.1 km from Uncompahgre Peak's published position and about 26 m below its published ≈ 4,365 m (90 m DSM pixel).
- TDA grid minimum: −2.885 m at cell 133025 (x 17, y 408), 31.945417° N, 114.764583° W.
- TDA grid maximum: 3,697.834 m at cell 56383 (x 311, y 172), 37.845417° N, 107.414583° W. It is lower than the raw maximum because each cell is a block minimum.
- The closed-basin expectations (Bonneville, Great Divide Basin) are left for the F4b barcode.

Needs Andrew: none (no API key needed; AWS worked).

Requests to Control: none. No new dependencies; only numpy, rasterio, requests and pillow are used.

Known limitations:
- `meta.json` holds `generatedAt` and `gitCommit` (`git rev-parse HEAD` at generation, currently 8a2b7c5…, before this feature is committed), so meta.json changes on every run even when grid.f32 and hillshade.webp do not. Reproducibility is checked on the grid bytes and SHA-256.
- The hillshade uses 2× vertical exaggeration (recorded in meta) so it reads at 30″. It is display-only.
- The native mosaic is built in memory (≈ 485 MB float32) rather than streamed. That is fine on this machine (16 GB) but needs about 1.5 GB peak.
- OpenTopography fallback is not implemented. AWS succeeded and the spec allows the fallback only if AWS fails.
