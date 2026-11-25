# Colorado River Basin study-area data

How `public/data/colorado/` is built from Copernicus DEM GLO-90 (spec §6.4, §6.5).
Rebuild with `npm run data` (runs `python -m pipeline.build_colorado`). Code:
`pipeline/build_colorado.py` (driver, exports), `pipeline/colorado_dem.py` (download, mosaic,
downsampling, hillshade) and `pipeline/barcode.py` (reference barcode, lakes table). Tests:
`pipeline/tests/test_colorado.py`, `pipeline/tests/test_barcode.py`. The optional basin mask from the
USGS Watershed Boundary Dataset is described in "Basin mask (stretch S3)" below. Every number below
is read from `meta.json` (or `basin-mask.json`) or from the pipeline log of the run that produced it.

## Provenance

| Item | Value |
|---|---|
| Dataset | Copernicus DEM GLO-90 (COP-DEM_GLO-90-DGED), Cloud-Optimized GeoTIFF. No release or version is claimed: the F4a check found no release marker in the tiles' tags, the bucket readme or the licence page. |
| Access | AWS Open Data bucket `copernicus-dem-90m`, over HTTPS, no account: `https://copernicus-dem-90m.s3.amazonaws.com/<TILE>/<TILE>.tif` |
| Tile name | `Copernicus_DSM_COG_30_N{LAT:02d}_00_W{LON:03d}_00_DEM`, LAT 31–42, LON 108–116 (108 tiles) |
| Registry | https://registry.opendata.aws/copernicus-dem/ |
| Licence | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM (linked from the registry entry) |
| Horizontal CRS | WGS 84 geographic (EPSG:4326) |
| Vertical datum | EGM2008 geoid (EPSG:3855), metres |
| Resolution | 3 arc-seconds (1/1200°, about 90 m N–S, 74 m E–W at 37° N) |
| Product handbook | Copernicus DEM Product Handbook, version 5.0 (Airbus Defence and Space, 29 Nov 2022): https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf |

The exact attribution text is in `public/data/colorado/ATTRIBUTION.md`, copied from the licence
page's "User Obligations" section (the notice for adapted or modified WorldDEM-90 data).

### Tile naming and corner convention (verified)

Before the bulk download one tile, `Copernicus_DSM_COG_30_N36_00_W112_00_DEM`, was fetched
(HTTP 200, 4,778,000 bytes) and inspected with rasterio:

- size 1200 × 1200, float32, WGS 84 geographic, tag `AREA_OR_POINT=Point`;
- geotransform `(1/1200, 0, -112.000416667, 0, -1/1200, 37.000416667)`, bounds
  left −112.000417, bottom 36.000417, right −111.000417, top 37.000417.

So pixel centres run lon −112.0 … −111.000833 and lat 37.0 … 36.000833: the name `N36 W112`
is the tile's **south-west (lower-left) integer corner** (lat 36, lon 112° W). The west column sits on
lon −112.0 and the north row on lat 37.0; the south row (lat 36.0) and east column (lon −111.0) belong
to the neighbouring tiles. This matches the bucket's readme
(https://copernicus-dem-30m.s3.amazonaws.com/readme.html: the original 1201-px tiles had their shared
east column and south row removed; the easting is the centre of the left-most pixels). Every tile is
re-checked during the build (size, WGS 84 lon/lat, 1/1200° spacing, origin at its named corner,
PixelIsPoint); any mismatch stops the build. All 108 tiles are below 50° N and all are 1200 px wide.

Note: the tiles carry a WGS 84 GEOGCS without an EPSG authority code, so the check compares the CRS
definition (`proj=longlat, datum=WGS84`) rather than the EPSG number.

### Missing tiles

None. All 108 tiles (N31–N42 × W108–W116) downloaded with HTTP 200, and all 108 are listed in the
bucket's `tileList.txt`. The registry states that ocean areas have no tiles and their height may be
taken as 0 m; the pipeline would accept a missing tile only if it is absent from `tileList.txt` **and**
is one of N31 W113–W116 (northern Gulf of California, the only plausible ocean in this bbox). Any other
404, or a listed tile that 404s, stops the build. The 404 log is recorded in `meta.json` →
`source.tiles.missing` (empty for this build).

### Nodata

No tile declares a nodata value and the mosaic has no NaN and no value ≤ −1000 m; the build would
stop if it did. 4,045 native pixels are exactly 0 m and 16 are below 0 m; all lie in lat 31.82–32.00° N,
lon 115.00–114.70° W (the Colorado River delta / head of the Gulf of California). These are values
present in the tiles, not filled by the pipeline.

## Processing steps

1. **Download** the 108 tiles sequentially (polite: one request at a time, up to 4 attempts with
   exponential backoff, a generic User-Agent) into `pipeline/data/raw/` (gitignored, about 0.5 GB).
   Writes are atomic (`.part` then rename), so an interrupted run resumes; cached tiles are reused.
2. **Mosaic and clip** to the bbox `[-115.201667, 31.817500, -107.060833, 42.157500]` (W, S, E, N) at
   native 3″. All pixel centres lie on the global lattice lon = k/1200, lat = m/1200.
   - Snapping: bbox × 1200 = W −138242.0004, S 38181.0000, E −128472.9996, N 50589.0000, i.e. the
     bbox edges fall on pixel-**centre** lines (residuals ≤ 0.0004 px). They are rounded to the
     nearest lattice line and the tiles' own half-open rule is applied: columns k ∈ [−138242, −128473)
     and rows m ∈ (38181, 50589] → **9,769 × 12,408** native pixels (121,213,752).
   - The pixel-edge footprint of the clipped raster is therefore
     [−115.202083, 31.817917, −107.06125, 42.157917], the bbox shifted half a pixel (0.000417°,
     ≈ 34–46 m: 34.4–39.4 m E–W from the north to the south edge, 46.2–46.3 m N–S) west and north. `meta.bbox` is the spec bbox exactly; the footprint and the snap
     residuals are recorded separately in `meta.native`.
   - Memory: the full native mosaic is held as one float32 array (≈ 485 MB); no row-band streaming
     was needed.
3. **TDA grid:** minimum of each 30 × 30 block of native pixels (0.025° cells, ≈ 2.2 km E–W ×
   2.8 km N–S), blocks anchored at the north-west corner. Partial edge blocks use only real pixels:
   the last column is 19 px wide and the last row 18 px tall. Result **326 × 414 = 134,964** float32
   metres. Minimum, not mean, keeps narrow canyons connected. No ocean fill was needed.
4. **Hillshade:** block mean of 10 × 10 native pixels (30″) → **977 × 1,241** (partial edge blocks
   averaged over real pixels). Horn gradient; E–W spacing per row is the WGS 84 length of 30″ of
   longitude at that row's latitude (∝ cos latitude), N–S spacing the WGS 84 meridian length;
   sun azimuth 315°, altitude 45°, vertical exaggeration 2; output gray = 255 × max(0, cos incidence),
   saved as grayscale WebP (quality 85, 179,574 bytes). The image covers the same footprint as the grid.
5. **Reference barcode** (`pipeline/barcode.py`, called by `build_colorado` right after `grid.f32`
   is written). `grid.f32` is read back from disk (and its SHA-256 checked against the bytes just
   written), then `pipeline.tda_ref.compute_h0` computes H0 sublevel-set persistence with
   4-connectivity, ties broken by (height, cell index), elder rule (spec §6.1). Every finite bar with
   death − birth ≥ 1 m (float64 difference of the float32 heights) is exported, plus the essential bar.
   The build stops if there is not exactly one essential bar or if it is not born at `meta.min.cell`.
6. **Export** to `public/data/colorado/`:
   - `grid.f32`: little-endian float32, row-major, north row first; cell index i = y·W + x
     (539,856 bytes; SHA-256 in `meta.json` → `files`).
   - `meta.json`: bbox, width, height, cellDeg, rowOrder, min/max with cells and lat/lon, CRS, vertical
     datum, source and URL, licence and required notice, processing steps, connectivity (4), tie-break
     rule, generatedAt, gitCommit, plus native-raster details and derived values.
   - `barcode.json` (see below), `hillshade.webp`, `ATTRIBUTION.md`.
   - `meta.json` also carries `barcode` (summary and grid SHA-256), `files["barcode.json"]`
     (bytes, SHA-256), `limitations` (the human-readable list below) and `source.verticalAccuracy`.

### barcode.json format

- Metadata: `format`, `description`, `units` (m), `connectivity` (4), `tieBreak`, `minPersistence`
  (1), `persistenceRule`, `rounding`, `order`, `grid` (file, width, height, bytes, **sha256** of
  `grid.f32`; the F6 explorer can compare it with the file it loaded), `engine`, `count`, `stats`
  (births, finite, positive, zero-length, exported, below threshold, essential) and `essential`
  (birth cell and height).
- Columns, one entry per bar: `b` birth height (m), `d` death height (m, `null` for the essential
  bar), `bi` birth cell (the lake's pit and its id), `di` death cell (the pass where it spills; −1 for
  the essential bar), `mi` **mergedInto**: the birth cell of the older lake that absorbs it (elder
  rule; −1 for the essential bar). This is what the F6 info card's "merged into lake Z" needs.
  Cells are indices into `grid.f32`, i = y·W + x, row 0 north.
- **No rounding.** The spec allows rounding to 0.1 m, but the file is only about 33 KB unrounded, so
  each `b` and `d` is the exact float32 grid height written as Python's shortest round-trip decimal
  of that value as a double. JSON parsing then gives back exactly `heights[bi]` and `heights[di]`
  for a `Float32Array` of `grid.f32` (tested in Python: `b == float(grid[bi])`). So no ≥ 1 m bar can
  look shorter than 1 m and nothing is reordered; `bi`, `di` and `mi` are exact integers.
- Order: sweep order (by the (h, i) rank of the death cell; several deaths at one cell oldest first),
  with the essential bar last, the same order `tda_ref.py` and `src/lib/tda` produce.
- Reproducible: no timestamps, a fixed key order and fixed separators, so the same `grid.f32` always
  gives the same bytes (tested).
- This build: 600 bars (599 finite + 1 essential) out of 1,217 births; 33,492 bytes; SHA-256 in
  `meta.json` → `files`.

Cell lat/lon: the centre of the native pixels a cell covers. For full cells
lon = −115.202083 + (x + 0.5)·0.025 and lat = 42.157917 − (y + 0.5)·0.025.

## Derived values (rechecked)

| Quantity | Spec §6.4 | Pipeline (WGS 84) |
|---|---|---|
| Span | 8.140834° × 10.34° | 8.140834° × 10.34° |
| E–W at centre lat 36.9875° | ≈ 725 km | 724.7 km (770.8 km at the south edge, 672.8 km at the north edge) |
| N–S | ≈ 1,148 km | 1,147.5 km |
| Display aspect (W/H, × cos 36.9875°) | ≈ 0.63 | 0.6289 |
| Native size | ≈ 9,769 × 12,408 | 9,769 × 12,408 |
| TDA grid | 326 × 414 = 134,964 | 326 × 414 = 134,964 |
| Hillshade | ≈ 977 × 1,241 | 977 × 1,241 |

## Extremes (for the geography check)

| | Value | Location (index) | Lat, lon of the cell/pixel centre |
|---|---|---|---|
| Raw native minimum | −2.885 m | row 12241, col 511 | 31.956667° N, 114.775833° W |
| Raw native maximum | 4,339.021 m | row 4904, col 9288 | 38.070833° N, 107.461667° W |
| TDA grid minimum | −2.885 m | cell 133025 (x 17, y 408) | 31.945417° N, 114.764583° W |
| TDA grid maximum | 3,697.834 m | cell 56383 (x 311, y 172) | 37.845417° N, 107.414583° W |

The grid minimum equals the raw minimum (block-min preserves it) and lies in the south-west
corner near the Colorado River delta at about sea level. The raw maximum lies within about 0.1 km of
the published position of Uncompahgre Peak (San Juan Mountains); its value is about 26 m below the
published summit height of about 4,365 m, as expected for a 90 m product whose pixel does not centre
on the summit. The grid maximum is lower because each cell is the *minimum* of a 2.2 × 2.8 km block.
The closed-basin expectations of §6.4 (Great Salt Lake / Bonneville, Great Divide Basin) are checked
against the reference barcode in "Longest-lived lakes" below.

## Limitations

- **Surface model.** Copernicus DEM is a Digital Surface Model: heights include vegetation, buildings
  and infrastructure, not bare ground. Water bodies are flattened in the source.
- **Resolution.** The source is 3″ (≈ 90 m). The TDA grid is 0.025° (≈ 2.2 × 2.8 km) and keeps the
  minimum of each block, so it follows valley floors and under-represents peaks and ridges; lakes
  and spill points narrower than a cell are merged or lost. The hillshade is a 30″ block mean with
  2× vertical exaggeration, for display only.
- **Rectangle ≠ basin.** The study area is a lat/lon rectangle (RiverNets coverage), not the
  Colorado River's hydrologic basin. Spec §6.4 expects it to leave out the Colorado's source in Rocky
  Mountain National Park (east of 107.06° W) and the Green River's headwaters in the Wind River Range
  (north of 42.16° N); this build did not test those two statements against a source. It includes
  neighbouring closed basins. The edges cut through terrain and water cannot leave across them, so a
  valley that drains out across an edge becomes a closed basin in the grid. Six of the ten
  longest-lived lakes below are born on the east or north edge for this reason.
- **Open-pit mines.** A surface model shows open-pit mines as real depressions, and the block
  minimum keeps their floors, so some deep lakes only a few cells wide are mine pits. Three of the
  top ten (#5–#7) and three more of the top twenty (#11, #14, #18) have their native pit floor within
  1.1 km of a USGS MRDS open-pit mine record; see below.
- **Geometry.** The grid is equirectangular in degrees; a cell is ≈ 2.2 km E–W at 37° N and wider in
  the south than in the north. The clipped footprint is offset half a native pixel (about 34–46 m)
  from the nominal bbox (see step 2).
- **Vertical accuracy.** The Copernicus DEM Product Handbook (v5.0, 2022, §1.1, Table 1; URL in
  Provenance) gives an absolute vertical accuracy of < 4 m (90 % linear error) for GLO-90, as a global
  arithmetic mean validated against ICESat GLAS points (excluding Antarctica and Greenland), and
  notes that local deviations can occur. This build does not assess accuracy locally, so bars of a
  few metres should not be read as real features.

## Longest-lived lakes

Generated by `pipeline/.venv/bin/python -m pipeline.barcode --lakes` from the committed `grid.f32` /
`meta.json` (pasted unedited; no number typed by hand). Ranked by persistence (death − birth),
excluding the essential bar; ties would go to the earlier bar in sweep order. Lat/lon are cell
centres (the centre of the native pixels the cell covers, `colorado_dem.block_center_lonlat`; the
same values as `meta.min`/`meta.max`), i = y·W + x with row 0 north. Elevations are shown to 0.1 m
here; `barcode.json` has the exact values. Merge target 133025 is the essential lake.

| # | Persistence (m) | Birth (m) | Birth cell | Birth lat, lon | Death (m) | Death cell | Death lat, lon | Merges into lake (birth cell) |
|---|---|---|---|---|---|---|---|---|
| 1 | 466.2 | 2710.8 | 58027 | 37.7204° N, 107.0692° W | 3177.1 | 55088 | 37.9454° N, 107.1896° W | 133025 |
| 2 | 397.5 | 1560.2 | 94865 | 34.8954° N, 107.0692° W | 1957.7 | 106927 | 33.9704° N, 107.0692° W | 133025 |
| 3 | 395.8 | 1275.7 | 17991 | 40.7704° N, 113.6646° W | 1671.5 | 59738 | 37.5704° N, 113.1896° W | 133025 |
| 4 | 336.6 | 1428.0 | 50 | 42.1454° N, 113.9396° W | 1764.6 | 4925 | 41.7704° N, 114.3146° W | 133025 |
| 5 | 314.2 | 249.0 | 117202 | 33.1704° N, 110.9896° W | 563.2 | 117529 | 33.1454° N, 110.9646° W | 133025 |
| 6 | 313.0 | 1378.2 | 21312 | 40.5204° N, 112.1396° W | 1691.2 | 21313 | 40.5204° N, 112.1146° W | 133025 |
| 7 | 303.3 | 749.5 | 134148 | 31.8704° N, 111.1396° W | 1052.8 | 134150 | 31.8704° N, 111.0896° W | 133025 |
| 8 | 268.8 | 2633.2 | 44335 | 38.7704° N, 107.0692° W | 2902.0 | 45637 | 38.6704° N, 107.1146° W | 133025 |
| 9 | 264.5 | 2917.5 | 27709 | 40.0454° N, 107.0692° W | 3182.0 | 27057 | 40.0954° N, 107.0692° W | 133025 |
| 10 | 263.6 | 1520.0 | 18 | 42.1454° N, 114.7396° W | 1783.6 | 8491 | 41.4954° N, 114.8146° W | 133025 |

Essential bar (never dies): born at -2.885 m in cell 133025 (31.9454° N, 114.7646° W).
Exported bars: 600 (599 finite with persistence ≥ 1 m + 1 essential), of 1217 births (1009 positive finite bars, 207 zero-length). Grid SHA-256 7775c4fd6800862b3ed79942f96fe6f96b59e2dc25aee358f23e09fed145e08a.

### Geography check

Also generated by `python -m pipeline.barcode --lakes`. "On the edge" means the birth cell is in the
grid's first/last row or column. "Inside the lake just before it spills" is the 4-connected component
of the birth cell in {j : (h[j], j) ≺ (h[di], di)}. Each landmark maps to the grid cell whose native
pixels contain it. Landmark coordinates come from primary USGS sources (read 2026-11-24; the feature
ids and URLs are also in `pipeline/barcode.py` `LANDMARKS`):

- **Place names: USGS GNIS** primary coordinates from the official GNIS Domestic Names files
  (published 2026-11-02),
  `https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_{UT,WY,ID}_Text.zip`.
  The National Map geonames service
  (https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer, layers 3 and 5) returns the
  same points to 1e-5°. Great Salt Lake is a lake and is not in that service's point layers, but it is
  in the file. Feature ids: Great Salt Lake Desert 1455061, Great Salt Lake 1441459, Bonneville Salt
  Flats 1425872, Great Divide Basin 1597072, Wamsutter 1609172, Red Rock Pass (ID) 389236. The table
  links each one to its GNIS record page.
- **Mines: USGS Mineral Resources Data System (MRDS)** record coordinates,
  `https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=<id>`. Every record lists mining method
  "Open Pit". The records are Bingham Open Pit Mine 10069296, Ray Mine 10210616, Sierrita 10137918,
  Mission Mine 10111429, Chino Mine 10087992 and Bagdad 10162326.

| # | Birth cell on the rectangle edge? | Nearest landmark within 25 km of the birth cell (km) | Landmarks inside the lake just before it spills |
|---|---|---|---|
| 1 | east edge | - | - (107 cells) |
| 2 | east edge | - | - (1060 cells) |
| 3 | no | Bonneville Salt Flats (11.9) | Great Salt Lake Desert, Great Salt Lake, Bonneville Salt Flats (12278 cells) |
| 4 | north edge | - | - (192 cells) |
| 5 | no | Ray Mine (1.4) | - (2 cells) |
| 6 | no | Bingham Canyon Mine (0.5) | Bingham Canyon Mine (2 cells) |
| 7 | no | Sierrita mine (0.9) | Sierrita mine (2 cells) |
| 8 | east edge | - | - (20 cells) |
| 9 | east edge | - | - (9 cells) |
| 10 | north edge | - | - (308 cells) |

Longest-lived exported lake whose extent just before it spills contains each landmark:

| Landmark (source) | Lat, lon | Cell | Lake (birth cell) | Rank | Persistence (m) | Birth (m) | Death (m) | Birth lat, lon | Lake cells |
|---|---|---|---|---|---|---|---|---|---|
| [Great Salt Lake Desert](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/1455061) | 40.6530, -113.5272 | 19626 | 17991 | 3 | 395.8 | 1275.7 | 1671.5 | 40.7704° N, 113.6646° W | 12278 |
| [Great Salt Lake](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/1441459) | 41.1629, -112.5354 | 12820 | 17991 | 3 | 395.8 | 1275.7 | 1671.5 | 40.7704° N, 113.6646° W | 12278 |
| [Bonneville Salt Flats](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/1425872) | 40.7997, -113.8000 | 17660 | 17991 | 3 | 395.8 | 1275.7 | 1671.5 | 40.7704° N, 113.6646° W | 12278 |
| [Great Divide Basin](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/1597072) | 42.0002, -108.0009 | 2244 | 2273 | 47 | 94.0 | 1943.8 | 2037.8 | 41.9954° N, 107.2646° W | 680 |
| [Wamsutter, WY (in the Great Divide Basin)](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/1609172) | 41.6730, -107.9792 | 6482 | 2273 | 47 | 94.0 | 1943.8 | 2037.8 | 41.9954° N, 107.2646° W | 680 |
| [Red Rock Pass, ID](https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/389236) | 42.3563, -112.0433 | outside the rectangle | | | | | | | |
| [Bingham Canyon Mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10069296) | 40.5208, -112.1458 | 21312 | 21312 | 6 | 313.0 | 1378.2 | 1691.2 | 40.5204° N, 112.1396° W | 2 |
| [Ray Mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10210616) | 33.1831, -110.9924 | 116876 | none | | | | | | |
| [Sierrita mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10137918) | 31.8715, -111.1488 | 134148 | 134148 | 7 | 303.3 | 749.5 | 1052.8 | 31.8704° N, 111.1396° W | 2 |
| [Mission Mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10111429) | 31.9923, -111.0643 | 132521 | 132521 | 11 | 260.3 | 611.7 | 872.1 | 31.9954° N, 111.0646° W | 4 |
| [Chino Mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10087992) | 32.7940, -108.0664 | 122209 | 122209 | 14 | 259.0 | 1538.4 | 1797.4 | 32.7954° N, 108.0646° W | 3 |
| [Bagdad mine](https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10162326) | 34.5847, -113.2086 | 98531 | 98531 | 18 | 224.7 | 610.6 | 835.3 | 34.5954° N, 113.2146° W | 3 |

Interpretation (cautious; only where the coordinates above and the linked source support it):

| # | Interpretation |
|---|---|
| 1 | Birth cell on the east edge (x = 325): a valley closed off by the rectangle's edge (see Limitations). |
| 2 | Birth cell on the east edge: edge-closed valley. |
| 3 | Great Salt Lake Desert / Bonneville basin: the birth cell is 11.9 km from the GNIS point for the Bonneville Salt Flats and 17.5 km from the one for the Great Salt Lake Desert. Just before it spills, the lake contains the GNIS points for the Great Salt Lake Desert, the Bonneville Salt Flats and the Great Salt Lake. |
| 4 | Birth cell on the north edge: edge-closed valley. |
| 5 | Ray Mine open pit (Arizona; MRDS 10210616, mining method Open Pit). The birth-cell centre is 1.4 km from the MRDS point. The lake's native (3″) floor, 249.0 m at 33.17667° N, 110.99250° W, is 0.72 km from it. The MRDS point (reference: ore body) falls in the next cell north (116876). That cell's block minimum is 615.2 m, above the lake's 563.2 m spill height, so the point lies on the pit's rim cell and not inside the 2-cell lake. MRDS also lists a small non-metallic "Lime Pit" (10234845, significant: No) 0.7 km from the floor. A 314 m deep closed pit next to the Ray ore body is the Ray open pit. |
| 6 | Bingham Canyon Mine open pit (Utah; MRDS 10069296 "Bingham Open Pit Mine"). The birth-cell centre is 0.5 km and the native floor (1378.2 m) 0.30 km from the MRDS point, and the 2-cell lake contains the MRDS point's cell. |
| 7 | Sierrita mine open pit (Arizona; MRDS 10137918). The birth-cell centre is 0.9 km and the native floor (749.5 m) 0.84 km from the MRDS point, and the 2-cell lake contains the MRDS point's cell. |
| 8 | Birth cell on the east edge: edge-closed valley. |
| 9 | Birth cell on the east edge: edge-closed valley. |
| 10 | Birth cell on the north edge: edge-closed valley. |

Beyond the top ten (from `--lakes -n 20` and the landmark table above), three more lakes are
open-pit copper mines by the same test. The lake contains the MRDS point's cell and is only 3–4 cells:

| # | Interpretation |
|---|---|
| 11 | Mission Mine open pit (Arizona; MRDS 10111429, mining method Open Pit; the record's point is "between two parts of Mission Pit"). The birth-cell centre is 0.34 km and the native floor (611.7 m at 32.00083° N, 111.07000° W) 1.09 km from the MRDS point. The 4-cell lake contains the point's cell. |
| 14 | Chino (Santa Rita) Mine open pit (New Mexico; MRDS 10087992, mining method Open Pit; the point is "the approximate center of the Chino Mines open pit"). The birth-cell centre is 0.23 km and the native floor (1538.4 m) 0.31 km from the MRDS point. The 3-cell lake contains the point's cell. |
| 18 | Bagdad mine open pit (Arizona; MRDS 10162326, operation type Surface, mining method Open Pit). The birth-cell centre is 1.31 km and the native floor (610.6 m at 34.58417° N, 113.20667° W) 0.19 km from the MRDS point. The 3-cell lake contains the point's cell. |

The native-floor positions above are the lowest 3″ pixel inside each lake's cells, read from the
cached raw tiles once (read-only) for this check
(`docs/builds/F9-R1/pits.py`, output in `docs/builds/F9-R1/pits.txt`). They agree with the F4b checker's independent values
for #5–#7. The lowest pixel has the lake's birth height in every case, as block-min requires.

Essential bar: born at the grid minimum, −2.885 m in cell 133025 (31.9454° N, 114.7646° W), in the
south-west corner near the Colorado River delta (see Extremes).

**§6.4 expectations:**

- **Bonneville / Great Salt Lake: yes.** The third-longest-lived lake (395.8 m) is born in the
  Great Salt Lake Desert and contains the Great Salt Lake before it spills at 1,671.5 m near
  37.57° N, 113.19° W. That spill point is the lowest exit *inside the rectangle* on the 0.025°
  block-minimum grid. It is not Lake Bonneville's historical outlet. That outlet is Red Rock Pass,
  Idaho, "about 5,090 feet" (≈ 1,551 m) per Utah Geological Survey PI-39
  (https://ugspub.nr.utah.gov/publications/public_information/pi-39.pdf). Its GNIS point (389236) is
  42.3563° N, 112.0433° W, north of the rectangle's 42.1575° N edge ("outside the rectangle" above).
- **Great Divide Basin: yes, but not among the longest-lived.** A lake born at 1,943.8 m in cell
  2273 (41.9954° N, 107.2646° W, row 6, near the north edge) contains the GNIS points for both the
  Great Divide Basin and Wamsutter, WY, before it spills at 2,037.8 m. Its persistence is 94.0 m,
  rank 47 of 599 exported finite bars. The GNIS point for the basin, 42.0002° N, is only 17 km south of
  the rectangle's north edge (42.1575° N). The basin extends north toward the Oregon Buttes near South
  Pass (https://en.wikipedia.org/wiki/Great_Divide_Basin). The GNIS points for the Oregon Buttes
  (1592464, 42.2549° N) and South Pass (1594710, 42.3700° N) are both north of the edge. So the edge
  cuts the basin, and this lake is only the part of it inside the rectangle.
- **Context:** the rectangle also cuts off the Colorado's source (Rocky Mountain National Park, east
  of the east edge) and the Green River's headwaters (north of the north edge), per spec §6.4. Neither
  was tested here against a source, and the barcode says nothing about them directly. The many
  edge-born lakes are a property of the rectangle, not of the terrain.

## Basin mask (stretch S3)

`basin-mask.bin` and `basin-mask.json` let the explorer show only the Colorado River Basin, as
defined by the USGS Watershed Boundary Dataset (WBD) hydrologic regions 14 (Upper Colorado) and 15
(Lower Colorado). Code: `pipeline/basin_mask.py` (run last by `npm run data`, or alone with
`pipeline/.venv/bin/python -m pipeline.basin_mask`). Tests: `pipeline/tests/test_basin_mask.py`.
Every number below is in `basin-mask.json` → `stats` unless it says otherwise.

### Source

| Item | Value |
|---|---|
| Dataset | USGS Watershed Boundary Dataset (WBD), 2-digit hydrologic units (HU-2), USGS National Map staged products, Shapefile |
| Region 14 | https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/Shape/WBD_14_HU2_Shape.zip |
| Region 15 | https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/Shape/WBD_15_HU2_Shape.zip |
| Version | FGDC metadata in each zip: "USGS Watershed Boundary Dataset (WBD) for 2-digit Hydrologic Unit - 14 (published 20250108) Shapefile" (and the same for 15); pubdate 20250108. HTTP Last-Modified: 8 Jan 2025. HU-2 feature `loaddate`: 2020-12-21 (14), 2021-06-30 (15). |
| Access | Downloaded 2026-11-25 (UTC) over HTTPS, no account; 104,512,674 B (14) and 180,502,107 B (15). SHA-256 values are in `basin-mask.json` → `source.regions`. Cached in `pipeline/data/raw/wbd/` (gitignored) with a sidecar JSON per zip. |
| Layers read | `Shape/WBDHU2` for the mask (one polygon per zip: 1 ring, 109,538 vertices for 14; 1 ring, 156,601 vertices for 15). `Shape/WBDHU6` and `Shape/WBDHU12` only for the statistics below. Files are read from the zip in memory; nothing is extracted. |
| CRS | NAD 83 geographic (GRS 1980), from `WBDHU2.prj`. Used as WGS 84 with no datum shift. USGS: "All modern maps and GIS data are cast on NAD 83 or WGS 84, which are equivalent datums at map scales of 1:5,000 and smaller." (https://www.usgs.gov/faqs/why-are-nad-83-position-values-so-far-nad-27-values-were-old-coordinates-wrong) |
| Product pages | https://www.usgs.gov/national-hydrography/watershed-boundary-dataset, https://www.usgs.gov/national-hydrography/access-national-hydrography-products |

Why the staged Shapefile and not the WBD map service: the zips are the dated, citable release (with
FGDC metadata and a fixed SHA-256), and they carry the full-resolution polygons. The map service
(https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer) was used only for the one-off
coverage check below.

**Attribution (public domain).** The USGS page "Acknowledging or Crediting USGS"
(https://www.usgs.gov/information-policies-and-instructions/acknowledging-or-crediting-usgs) says:
"Most U.S. Geological Survey (USGS) information resides in the Public Domain and may be used without restriction."
For no-cost use it suggests the credit "(Product or data name) courtesy of the U.S. Geological
Survey", so the credit used here is:

> Watershed Boundary Dataset (WBD) courtesy of the U.S. Geological Survey

The WBD metadata adds: "Acknowledgment of the originating agencies would be appreciated in products
derived from these data." Its listed originators are the U.S. Geological Survey (USGS), the U.S.
Department of Agriculture - Natural Resource Conservation Service (NRCS), the U.S. Environmental
Protection Agency (EPA), and other Federal, State and local partners. The credit, the public-domain
statement and the originators are in `basin-mask.json` → `attribution`, and the credit is also in
`meta.json` → `basinMask.credit`. `ATTRIBUTION.md` (the Copernicus notice) was not changed. Whether
the explorer's "About the data" shows the WBD credit is up to F12b.

### Processing

1. Download both zips (sequential, up to 4 attempts, generic User-Agent, atomic write). Check the
   `.prj` (NAD 83), that `WBDHU2` holds exactly one record with `huc2` 14 or 15, and read the FGDC
   citation. A strict built-in Shapefile/dBASE reader stops on anything unexpected. No new Python
   package is needed (rasterio, numpy and requests are already pinned).
2. Rasterize each HU-2 polygon with GDAL (rasterio `features.rasterize`, pixel-centre rule) onto the
   **clipped native 3″ raster**: the same 9,769 × 12,408 pixel lattice and footprint as the DEM
   (`meta.native.extent`).
3. Count each grid cell's native pixels inside 14, inside 15, and inside their union, over the same
   30 × 30 blocks as `grid.f32` (anchored north-west; the last column is 19 px wide and the last row
   18 px tall). **Cell rule:** a cell is in the basin when at least half of its pixels are inside the
   union. A basin cell belongs to 15 if more of its pixels are in 15 than in 14, and to 14 otherwise
   (14 on a tie). The two polygons overlap in 0 pixels.
4. Write two bit planes (below), `basin-mask.json`, and the `basinMask` entry plus
   `files["basin-mask.bin"]` and `files["basin-mask.json"]` (bytes, SHA-256) in `meta.json`. The step
   edits only those keys of `meta.json`. Run alone, it keeps the DEM build's `generatedAt` and
   `gitCommit`.

### basin-mask.bin format

- 33,742 bytes = 2 planes × 16,871 bytes (⌈134,964 / 8⌉), one bit per grid cell.
- Cell index i = y·W + x, row 0 north, exactly as `grid.f32`. Bit i of a plane is
  `(byte[i >> 3] >> (i & 7)) & 1` (least significant bit first). The unused high bits of each
  plane's last byte are 0.
- **Plane 0** (bytes 0–16,870): 1 = basin (HU-2 14 or 15). The toggle only needs this plane.
- **Plane 1** (bytes 16,871–33,741): 1 = basin cell assigned to 15 (Lower Colorado). Plane 0 = 1
  with plane 1 = 0 means 14 (Upper Colorado). Plane 1 is 0 outside the basin.
- `basin-mask.json` records the format, the grid it belongs to (bbox, width, height, cellDeg,
  rowOrder, native extent and the SHA-256 of `grid.f32`), the cell rule, sources, version,
  attribution, coverage notes and statistics. It has no timestamps.

### Result

| Quantity | Value |
|---|---|
| Basin cells | 97,311 of 134,964 (0.7210) |
| Region 14 / 15 cells | 41,956 / 55,355 |
| Basin area in the study area (sum of cell areas, GRS 80) | 603,745.7 km² of 830,506.9 km² (0.7270) |
| Same area from the pixel-level union | 603,669.3 km² |
| Cells straddling the boundary (0 < pixels inside < all) | 1,840 |
| WBD area of 14 + 15 (`areasqkm`) | 293,569.02 + 424,356.02 km² |
| Rasterized full-region area vs WBD `areasqkm` (15″ raster on each region's own bbox) | −0.001 % (14), +0.001 % (15) |

Share of each HU-6 inside the study area (cell area ÷ WBD `areasqkm`): the units cut by the edges
are 140100 Colorado Headwaters 48.9 %, 140401 Upper Green 67.7 %, 140200 Gunnison 70.8 %,
140402 Great Divide Closed Basin 82.6 %, 140500 White-Yampa 89.7 %, 140801 Upper San Juan 91.4 %,
150801 Rio Sonoyta 38.6 %, 150803 Rio De Bavispe 3.0 %, 150502 San Pedro-Willcox 69.5 %,
150503 Santa Cruz 74.1 %, 150100 Lower Colorado-Lake Mead 92.8 %, 150301 Lower Colorado 94.0 % and
150400 Upper Gila 95.5 %. The rest are 99.2–100.2 % inside. Values just above 100 % come from the
cell-majority rule.

### Coverage: Mexico, and region versus drainage

- **Mexico is included, not missing.** The S3 brief assumed WBD stops at the border. This WBD release
  does not. Its metadata says areas along the border "have been updated to include harmonized
  hydrologic units and hydrography that extends across the border", in collaboration with Mexico's
  INEGI. Region 15's HU-4s 1503 Lower Colorado, 1505 Middle Gila and 1508 Sonora list MX among their
  states. In the study area the mask includes the Colorado's lower river and delta (HU-6 150301)
  down to the south edge: 1,039 basin cells (6,579.6 km²) lie mostly in HU-12 units whose `states`
  attribute is only "MX". The grid's lowest cell (`meta.min`, 31.945417° N, 114.764583° W) is in
  HU-12 150301080302 (states MX, downstream code OCEAN) and is **inside** the mask.
- **The gap.** WBD covers Mexico only as far as its harmonized units go, and this build did not
  compare those units with INEGI's own hydrography. In the study area, the only land in no WBD unit is
  4 cells in the south-west corner (rows 411–413, columns 0–1, around 31.83–31.87° N,
  115.19–115.165° W). They are 0 in the mask. No Mexican boundary was drawn, filled or invented.
- **One-off check (not part of the pipeline).** On 2026-11-25 (UTC), the HU-2 layer of the USGS WBD
  map service was queried with the study-area bbox
  (`https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/1/query?geometry=-115.201667,31.8175,-107.060833,42.1575&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=huc2,name,loaddate&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=geojson`,
  generalized to 0.002°). It returned regions 10, 13, 14, 15, 16, 17 and 18. Labelling every cell by
  the majority of its pixels gave 14: 41,958, 15: 55,357, 16: 26,799, 13: 7,750, 17: 1,401,
  18: 1,386, 10: 309, none: 4 cells. Region 14 or 15 by this generalized layer disagrees with the
  mask in 12 boundary cells. Point queries on the HU-2 and HU-12 layers at 31.87° N, 115.19° W
  returned no unit. At 32.8° N and 32.95° N, 115.19° W they returned region 18 (HU-12s 181002040402
  "Gordons Well" and 181002040403 "Deer Peak", both closed basins). The west-edge land between about
  32.5° and 35.1° N is region 18 (California) and is outside the mask.
- **Region is not drainage.** WBD regions are administrative groupings of hydrologic units, not
  exact drainage areas. Region 15 includes HU-4 1508 Sonora. Following WBD's own `tohuc`
  (downstream HU-12) codes, all 634 of its HU-12s stay inside 1508 and end at OCEAN (495),
  MEXICO (117) or CLOSED BASIN (22) (`stats.sonoraDrainage`). None drains to the Colorado. Region
  14 includes HU-6 140402 Great Divide Closed Basin. Both are inside the mask because they belong
  to the regions: 1,609 cells of 1508 Sonora and 1,426 of the Great Divide Closed Basin
  (`stats.hu6`). Whether the explorer should drop 1508 is a decision for Control and Andrew; the
  mask follows the brief (HU-2 14 ∪ 15).
- **Study-area edges.** The mask covers only the part of each region inside the rectangle (see the
  HU-6 shares above).
- **Resolution.** One bit per 0.025° cell (≈ 2.2 × 2.8 km). The WBD metadata says "At a minimum,
  the HUs are delineated at 1:24,000-scale in the conterminous United States". At this cell size
  the 1,840 boundary cells, not WBD's precision, limit the mask.

### Verification

- **Grid alignment** (`test_dims_equal_grid`, `test_alignment_against_independent_point_in_polygon`):
  the planes are 414 × 326. `basin-mask.json` → `grid` equals `meta.json` (bbox, width, height,
  cellDeg, rowOrder, native extent) and the SHA-256 of `grid.f32`. An independent even-odd
  point-in-polygon test of every cell centre, written without GDAL, agrees with plane 0 except in
  cells on the boundary (each disagreement has both values in its 3 × 3 neighbourhood). Shifting the
  mask by one cell in any of the 8 directions more than doubles the disagreements.
- **Rasterization** (`stats.regions.*.rasterizedVsWbdPct`): each full region, rasterized on its own
  bbox and summed on the GRS 80 ellipsoid, matches WBD's `areasqkm` to within 0.001 %.
- **Sanity points** (`test_gnis_sanity_points`, `test_points_against_source_polygons`): primary
  coordinates from the USGS GNIS Domestic Names state files, published 2026-11-02
  (`https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip`).
  Each point's cell and its 5 × 5 neighbourhood have the expected value, and the point-in-polygon
  test on the source polygons agrees. GNIS Domestic Names has no "Hoover Dam" record, so the Lake
  Mead reservoir record stands in for it.

| Place | GNIS ID | Lat, lon (NAD 83) | Expected | Mask |
|---|---|---|---|---|
| Uncompahgre Peak | 188678 | 38.0714529, −107.4625289 | 14 | 14 |
| Grand Junction | 204662 | 39.0638705, −108.5506486 | 14 | 14 |
| Moab | 1430389 | 38.5733155, −109.5498395 | 14 | 14 |
| Lake Mead | 7862 | 36.1725406, −114.4298448 | 15 | 15 |
| Las Vegas, NV | 847388 | 36.1749705, −115.137223 | 15 | 15 |
| Phoenix | 44784 | 33.4483771, −112.0740373 | 15 | 15 |
| Flagstaff | 29046 | 35.1980671, −111.6512725 | 15 | 15 |
| Salt Lake City | 1454997 | 40.7607794, −111.8910474 | outside | outside |
| Great Salt Lake | 1441459 | 41.1628677, −112.5353656 | outside | outside |
| Ely, NV | 859671 | 39.2474393, −114.8886296 | outside | outside |
| Denver | 201738 | 39.7391536, −104.9847034 | outside | east of the bbox, so not on the grid; outside both polygons |
| Albuquerque | 928679 | 35.0844909, −106.6511367 | outside | east of the bbox, so not on the grid; outside both polygons |

- **Plausibility** (`test_fraction_plausible`): basin fraction 0.721 of cells. The in-bbox basin area
  is less than WBD's 14 + 15 total and is 84 % of it. The majority-rule area is within 0.5 % of the
  pixel-level union.
- **Reproducibility** (`test_reproducible_from_cache`): recomputing from the cached zips gives
  byte-identical `basin-mask.bin` and `basin-mask.json`. A run from an empty cache (fresh download)
  also gave identical bytes.

## Run log (this build)

| Run | Cache | Result | Time |
|---|---|---|---|
| `npm run data` | empty `pipeline/data/raw/` | 108/108 tiles downloaded in 81.9 s; then stopped at the tile check (EPSG-code comparison, since fixed) | 82.3 s |
| `npm run data` | full cache | success | 7.9 s total (cache check 0.1 s, processing 7.6 s) |
| `npm run data -- --raw-dir <new empty dir> --out-dir <scratch dir>` | empty | success: tileList.txt + 108/108 tiles downloaded (87.2 s); `grid.f32` and `hillshade.webp` byte-identical to the committed outputs | 94.2 s total |
| `npm run data` (final) | full cache | success, outputs unchanged | ≈ 8 s |
| `npm run data` (F4b, with barcode) | full cache | success; `grid.f32`, `hillshade.webp`, `ATTRIBUTION.md` byte-identical to the F4a commit; `barcode.json` 33,492 B, 600 bars | ≈ 6.5 s |
| `npm run data` (F9-R1, LANDMARKS from GNIS/MRDS) | full cache | success; `grid.f32`, `hillshade.webp`, `barcode.json`, `ATTRIBUTION.md` byte-identical to HEAD 5752efb; only `meta.json` `generatedAt`/`gitCommit` changed, and that file was restored | 7.1 s |
| `python -m pipeline.basin_mask` (F12a) | empty `pipeline/data/raw/wbd/` | both WBD zips downloaded; `basin-mask.bin` 33,742 B, `basin-mask.json`; `meta.json` gains `basinMask` and two `files` entries | ≈ 40 s |
| `npm run data -- --out-dir <scratch>` (F12a) | full cache | success; all seven outputs byte-identical to the committed ones except `meta.json` `generatedAt`/`gitCommit` | 39.0 s |
| `python -m pipeline.basin_mask --raw-dir <new empty dir> --out-dir <scratch>` (F12a) | empty | both zips downloaded again (same SHA-256); `basin-mask.bin`, `basin-mask.json`, `meta.json` byte-identical | 41.9 s |
