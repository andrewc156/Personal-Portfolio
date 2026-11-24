# Check report — F4a Colorado DEM → grid — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check n/a · lint n/a (JS) · unit n/a · pytest ✅ (17 passed, TDA test ignored) · ruff ✅ · build n/a · e2e n/a · axe n/a · lighthouse n/a · links n/a · visual n/a (hillshade image inspected) · content ✅ (with notes 1–3) · tda n/a · data ✅

Scope: data-only check, as instructed. I did not run build, preview, e2e or Lighthouse. I did not read or judge F2/F3 files. Nothing under public/data/colorado/ or pipeline/data/raw/ was written. Both reruns wrote to the session scratchpad outside the repo, and those directories were deleted afterwards.

## Acceptance criteria
1. ✅ **End-to-end runs, both paths.**
   - Cached run: `npm run data -- --out-dir <scratch>` succeeded in 6.6 s. `grid.f32`, `hillshade.webp` and `ATTRIBUTION.md` are byte-identical to the committed files (`cmp`). `meta.json` differs only in `generatedAt`.
   - Empty cache, which I ran myself: `npm run data -- --raw-dir <empty tmp> --out-dir <tmp>` succeeded. It made 109 downloads (tileList.txt plus 108 tiles) in 81.5 s, 88.1 s in total.
   - The outputs from the empty-cache run are byte-identical to the committed `grid.f32` and `hillshade.webp`. All 108 downloaded tiles and tileList.txt are byte-identical to the cached ones in pipeline/data/raw/.
   - Logs: docs/checks/F4a/attempt-1/run-cached.txt, run-empty-cache.txt.
2. ✅ **Tile naming and corner convention.**
   - I fetched the N36 W112 tile with an HTTP Range request: 206 response, total 4,778,000 B, which matches the builder's figure.
   - I opened N42 W108 remotely with `/vsicurl/`: 1200², transform origin (−108.000417, 43.000417), AREA_OR_POINT=Point, first pixel centre (−108.0, 43.0).
   - Across all 108 cached tiles, my own tool confirms first-pixel centre = (−lo, la+1) and last = (−lo+1−1/1200, la+1/1200). So the name is the SW integer corner, and the east column and south row belong to the neighbouring tiles.
   - This agrees with the bucket readme (https://copernicus-dem-90m.s3.amazonaws.com/readme.html: shared east and south rows/columns removed, 1201 → 1200).
   - Missing tiles: none. The 404 policy and reasons are in docs/data.md and `meta.source.tiles.missing`, and the code is at pipeline/colorado_dem.py:160–212.
3. ✅ **Outputs, bbox and dimensions.**
   - All four files exist.
   - `meta.bbox` = `[-115.201667, 31.8175, -107.060833, 42.1575]`, which equals the §6.4 bbox exactly (Python list equality).
   - Recorded dimensions: 326 × 414 = 134,964 cells, native 9,769 × 12,408, hillshade 977 × 1,241.
4. ✅ **pytest.** `pipeline/.venv/bin/python -m pytest pipeline -q --ignore=pipeline/tests/test_tda_ref.py` → 17 passed.
   - ruff (with the TDA files excluded) → All checks passed.
   - The §6.5 step 7 barcode-reproducibility test is correctly deferred to F4b.
5. ✅ **Sizes.** grid.f32 is 539,856 B and hillshade.webp is 179,574 B, both ≤ 614,400. Nothing under public/data/colorado/ is over 5 MB (`find -size +5M` is empty).
6. ✅ **Attribution and data.md.**
   - I compared ATTRIBUTION.md's quoted notice character for character (whitespace-normalised, © = U+00A9) against the "User Obligations" section of https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM. It is an exact match to the "adapted or modified … WorldDEM-90" notice.
   - That URL is the one the registry's License field links to (https://registry.opendata.aws/copernicus-dem/).
   - The page has no separate GLO-90 as-is notice, so using the adapted notice is right: the data is clipped, resampled and hillshaded. The URL is included, as are the DSM note and the DOI.
   - docs/data.md covers provenance, every step and limitations. Its lakes section is reserved for F4b.
   - Evidence: licence-compare.txt.
7. ✅ **Raw tiles ignored, nothing synthesized.**
   - `git check-ignore -v` on tileList.txt and a .tif → `.gitignore:6:pipeline/data/raw/`. `git ls-files` lists no .tif. public/data/colorado/ is not ignored, so the outputs will be committed.
   - Nothing is synthesized: the native mosaic has 0 NaN and 0 values ≤ −1000. No tile declares nodata. No ocean fill was used.
   - The 4,045 zero and 16 negative pixels are tile values in lat 31.818–32.003, lon −115.0 to −114.703. That matches docs/data.md.

## Independent data audit (docs/checks/tools/f4a_independent.py, rasterio + numpy only, no pipeline imports)
- **Mosaic.** I built a 10,800 × 14,400 union mosaic, placing each tile by its own geotransform (pixel centres on the 1/1200 lattice). It has no overlap and no NaN.
- **Bbox snapping.** All four bbox edges fall exactly on pixel-centre lines: W −115.201667, E −107.060833, N 42.1575, S 31.8175. The closed set is 9,770 × 12,409. With the half-open rule (drop the east column and south row) it is 9,769 × 12,408. Footprint: [−115.2020833, 31.8179167, −107.06125, 42.1579167], which matches `meta.native.extent`.
- **Block minimum.** I recomputed the 30×30 block minimum with explicit loops over all 134,964 blocks. It is **exactly equal** to grid.f32 read with `struct.unpack('<…f')` and reshaped as i = y·W + x. Big-endian and north/south-flipped readings do not match.
  - I printed 10 sample blocks, including the four corners and partial edges: (0,325) is 30×19, (413,0) is 18×30, (413,325) is 18×19, (413,150) is 18×30 and (200,325) is 30×19. All agree with the file.
  - The SHA-256 matches meta.
- **Extremes.**
  - Raw min: −2.885 m, row 12241 col 511, 31.956667 N, 114.775833 W.
  - Raw max: 4,339.021 m, row 4904 col 9288, 38.070833 N, 107.461667 W.
  - Grid min: cell 133025 (x 17, y 408), centre 31.945417, −114.764583.
  - Grid max: 3,697.834 m, cell 56383 (x 311, y 172).
  - Each extreme is unique, with no ties. All values match meta.json and docs/data.md.
- **Geography: maximum.** NGS datasheet PID JL0798 "UNCOMPAHGRE" (https://geodesy.noaa.gov/cgi-bin/ds_mark.prl?PidBox=JL0798) gives NAD 83(1992) 38°04′17.96898″N 107°27′43.52138″W (38.071658, −107.462089) and NAVD 88 4365.0 m.
  - The raw max is 0.099 km from it and 25.98 m lower. The builder's "≈ 0.1 km, ≈ 26 m below" is correct.
  - USGS GNIS id 188678 (cited by Wikipedia) is a JavaScript app that I could not read with curl, so NGS is the primary source I used.
- **Geography: minimum.** The minimum is near sea level (−2.885 m) in the SW corner, 43 km from the bbox SW corner. It falls inside the Colorado River delta's latitude range of 31°45′–32°10′ N given in the Ramsar information sheet (https://rsisd7.unepgrid.ch/RISapp/files/RISrep/MX814RISformer1998_EN.pdf, from search results) and about 25 km from Wikipedia's delta point (31.74 N, 114.66 W).
- **Hillshade.**
  - It decodes as 977 × 1241. PIL reports it as RGB because WebP has no grey mode, but the channels differ by at most 1, so it is grey.
  - I viewed it as a PNG (docs/checks/F4a/attempt-1/hillshade.png). North is up. The Grand Canyon is at the expected row (about 727 of 1241). The Uintas, Wasatch, San Juans and Basin-and-Range are all recognisable. There are no seams at tile boundaries.
- **§6.4 derived values** (my own WGS 84 code, f4a_derived.py):
  - span 8.140834° × 10.34°;
  - E–W 724.75 km at 36.9875° (770.77 km at the south edge, 672.81 km at the north edge);
  - N–S 1,147.52 km;
  - display aspect 0.62888;
  - centre (36.9875, −111.13125) = bbox midpoint.
  - All of these match meta.derived and docs/data.md.

## Notes (non-blocking)
1. **Half-pixel offset range is slightly wrong.**
   - Where: pipeline/build_colorado.py:211 (so public/data/colorado/meta.json:59 `native.extentNote`) and docs/data.md:75 say the half-pixel offset is "about 37–46 m".
   - Expected: E–W half a pixel is 39.4 m at the south edge and 34.4 m at the north edge; N–S it is 46.2–46.3 m. So the range is "about 34–46 m".
   - Reproduce: WGS 84 parallel length × (1/2400)°.
2. **"2021 release" is unsourced.**
   - Where: pipeline/build_colorado.py:219 (meta.json:97 `source.name`) and docs/data.md:13.
   - I found no "2021" release marker in the tile tags (only AREA_OR_POINT), the bucket readme or the licence page's release table. The tiles' Last-Modified date is 2022-05-09.
   - Cite a source or drop the phrase before F6 renders "About the data" from meta.json.
3. **Vertical accuracy is unsourced.** docs/data.md:144 says "< 4 m (90 % linear error)", but neither the registry, the readme nor the licence page states this. Add a citation (for example the Copernicus DEM Product Handbook or the validation report linked from the readme) or remove it.
4. **meta.json changes on every run.** `generatedAt` and `gitCommit` change each run, as the builder disclosed. `gitCommit` will name the commit *before* F4a. Reproducibility is correctly asserted on the grid bytes and SHA-256.
5. **CRS label.** meta says "EPSG:4326" while the tiles carry a WGS 84 GEOGCS with no authority code. It is equivalent and documented in docs/data.md.
6. **Grid maximum at the block centre.** The grid max cell is about 25 km from the peak, as expected for a block minimum. The builder states this correctly.

## Artifacts
- docs/checks/F4a/attempt-1/run-cached.txt, run-empty-cache.txt (pipeline logs)
- docs/checks/F4a/attempt-1/independent.txt (output of docs/checks/tools/f4a_independent.py)
- docs/checks/F4a/attempt-1/derived.txt (output of docs/checks/tools/f4a_derived.py)
- docs/checks/F4a/attempt-1/licence-compare.txt
- docs/checks/F4a/attempt-1/hillshade.png (gitignored)
