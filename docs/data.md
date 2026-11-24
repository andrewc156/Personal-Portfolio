# Colorado River Basin study-area data

How `public/data/colorado/` is built from Copernicus DEM GLO-90 (spec §6.4, §6.5).
Rebuild with `npm run data` (runs `python -m pipeline.build_colorado`). Code:
`pipeline/build_colorado.py` (driver, exports), `pipeline/colorado_dem.py` (download, mosaic,
downsampling, hillshade) and `pipeline/barcode.py` (reference barcode, lakes table). Tests:
`pipeline/tests/test_colorado.py`, `pipeline/tests/test_barcode.py`. Every number below is read from
`meta.json` or from the pipeline log of the run that produced it.

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
  minimum keeps their floors, so some deep lakes only one or two cells wide are mine pits (three of
  the top ten lie within 2.3 km of published mine coordinates; see below).
- **Geometry.** The grid is equirectangular in degrees; a cell is ≈ 2.2 km E–W at 37° N and wider in
  the south than in the north. The clipped footprint is offset half a native pixel (≈ 40 m) from the
  nominal bbox (see step 2).
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
of the birth cell in {j : (h[j], j) ≺ (h[di], di)}. Landmark coordinates are the ones on the linked
pages (read 2026-11-24); each landmark maps to the grid cell whose native pixels contain it.

| # | Birth cell on the rectangle edge? | Nearest landmark within 25 km of the birth cell (km) | Landmarks inside the lake just before it spills |
|---|---|---|---|
| 1 | east edge | - | - (107 cells) |
| 2 | east edge | - | - (1060 cells) |
| 3 | no | Great Salt Lake Desert (9.5) | Great Salt Lake Desert, Great Salt Lake (12278 cells) |
| 4 | north edge | - | - (192 cells) |
| 5 | no | Ray Mine (2.3) | - (2 cells) |
| 6 | no | Bingham Canyon Mine (1.0) | Bingham Canyon Mine (2 cells) |
| 7 | no | Sierrita mine (0.7) | Sierrita mine (2 cells) |
| 8 | east edge | - | - (20 cells) |
| 9 | east edge | - | - (9 cells) |
| 10 | north edge | - | - (308 cells) |

Longest-lived exported lake whose extent just before it spills contains each landmark:

| Landmark (source) | Lat, lon | Cell | Lake (birth cell) | Rank | Persistence (m) | Birth (m) | Death (m) | Birth lat, lon | Lake cells |
|---|---|---|---|---|---|---|---|---|---|
| [Great Salt Lake Desert](https://en.wikipedia.org/wiki/Great_Salt_Lake_Desert) | 40.7000, -113.6000 | 18972 | 17991 | 3 | 395.8 | 1275.7 | 1671.5 | 40.7704° N, 113.6646° W | 12278 |
| [Great Salt Lake](https://en.wikipedia.org/wiki/Great_Salt_Lake) | 41.1670, -112.5330 | 12820 | 17991 | 3 | 395.8 | 1275.7 | 1671.5 | 40.7704° N, 113.6646° W | 12278 |
| [Bingham Canyon Mine](https://en.wikipedia.org/wiki/Bingham_Canyon_Mine) | 40.5230, -112.1510 | 21312 | 21312 | 6 | 313.0 | 1378.2 | 1691.2 | 40.5204° N, 112.1396° W | 2 |
| [Ray Mine](https://en.wikipedia.org/wiki/Ray_Mine) | 33.1494, -110.9872 | 117528 | none | | | | | | |
| [Sierrita mine](https://en.wikipedia.org/wiki/Sierrita_mine) | 31.8739, -111.1339 | 134148 | 134148 | 7 | 303.3 | 749.5 | 1052.8 | 31.8704° N, 111.1396° W | 2 |
| [Great Divide Basin](https://en.wikipedia.org/wiki/Great_Divide_Basin) | 42.0003, -107.9839 | 2244 | 2273 | 47 | 94.0 | 1943.8 | 2037.8 | 41.9954° N, 107.2646° W | 680 |
| [Wamsutter, WY (in the Great Divide Basin)](https://en.wikipedia.org/wiki/Wamsutter,_Wyoming) | 41.6681, -107.9792 | 6482 | 2273 | 47 | 94.0 | 1943.8 | 2037.8 | 41.9954° N, 107.2646° W | 680 |

Interpretation (cautious; only where the coordinates above and the linked source support it):

| # | Interpretation |
|---|---|
| 1 | Birth cell on the east edge (x = 325): a valley closed off by the rectangle's edge (see Limitations). |
| 2 | Birth cell on the east edge: edge-closed valley. |
| 3 | Great Salt Lake Desert / Bonneville basin: the birth cell is 9.5 km from the Great Salt Lake Desert's listed coordinates, and just before it spills the lake also contains the Great Salt Lake's coordinates. |
| 4 | Birth cell on the north edge: edge-closed valley. |
| 5 | Probably the Ray Mine open pit (Arizona): the birth cell is 2.3 km from its listed coordinates and the lake is 2 cells. The mine's own cell is not inside this lake, so this is less certain than 6 and 7. |
| 6 | Bingham Canyon Mine open pit (Utah): 1.0 km from its listed coordinates; the 2-cell lake contains that cell. |
| 7 | Sierrita mine open pit (Arizona): 0.7 km from its listed coordinates; the 2-cell lake contains that cell. |
| 8 | Birth cell on the east edge: edge-closed valley. |
| 9 | Birth cell on the east edge: edge-closed valley. |
| 10 | Birth cell on the north edge: edge-closed valley. |

Essential bar: born at the grid minimum, −2.885 m in cell 133025 (31.9454° N, 114.7646° W), in the
south-west corner near the Colorado River delta (see Extremes).

**§6.4 expectations:**

- **Bonneville / Great Salt Lake: yes.** The third-longest-lived lake (395.8 m) is born in the
  Great Salt Lake Desert and contains the Great Salt Lake before it spills at 1,671.5 m near
  37.57° N, 113.19° W. That spill point is the lowest exit *inside the rectangle* on the 0.025°
  block-minimum grid. It is not Lake Bonneville's historical outlet: Red Rock Pass, Idaho, at about
  1,552 m (https://en.wikipedia.org/wiki/Lake_Bonneville), listed at 42.3556° N, 112.0444° W
  (https://en.wikipedia.org/wiki/Red_Rock_Pass), lies north of the rectangle's 42.1575° N edge.
- **Great Divide Basin: yes, but not among the longest-lived.** A lake born at 1,943.8 m in cell
  2273 (41.9954° N, 107.2646° W, row 6, near the north edge) contains both the Great Divide Basin's
  listed coordinates and Wamsutter, WY, before it spills at 2,037.8 m. Its persistence is 94.0 m,
  rank 47 of 599 exported finite bars. The rectangle's north edge (42.1575° N) cuts the basin, which
  extends north toward the Oregon Buttes near South Pass (Wikipedia, Great Divide Basin). So this lake
  is only the part of the basin inside the rectangle.
- **Context:** the rectangle also cuts off the Colorado's source (Rocky Mountain National Park, east
  of the east edge) and the Green River's headwaters (north of the north edge), per spec §6.4. Neither
  was tested here against a source, and the barcode says nothing about them directly. The many
  edge-born lakes are a property of the rectangle, not of the terrain.

## Run log (this build)

| Run | Cache | Result | Time |
|---|---|---|---|
| `npm run data` | empty `pipeline/data/raw/` | 108/108 tiles downloaded in 81.9 s; then stopped at the tile check (EPSG-code comparison, since fixed) | 82.3 s |
| `npm run data` | full cache | success | 7.9 s total (cache check 0.1 s, processing 7.6 s) |
| `npm run data -- --raw-dir <new empty dir> --out-dir <scratch dir>` | empty | success: tileList.txt + 108/108 tiles downloaded (87.2 s); `grid.f32` and `hillshade.webp` byte-identical to the committed outputs | 94.2 s total |
| `npm run data` (final) | full cache | success, outputs unchanged | ≈ 8 s |
| `npm run data` (F4b, with barcode) | full cache | success; `grid.f32`, `hillshade.webp`, `ATTRIBUTION.md` byte-identical to the F4a commit; `barcode.json` 33,492 B, 600 bars | ≈ 6.5 s |
