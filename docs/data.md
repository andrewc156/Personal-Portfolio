# Colorado River Basin study-area data

How `public/data/colorado/` is built from Copernicus DEM GLO-90 (spec §6.4, §6.5).
Rebuild with `npm run data` (runs `python -m pipeline.build_colorado`). Code:
`pipeline/build_colorado.py` (driver, exports) and `pipeline/colorado_dem.py` (download, mosaic,
downsampling, hillshade). Tests: `pipeline/tests/test_colorado.py`. Every number below is read from
`meta.json` or from the pipeline log of the run that produced it.

## Provenance

| Item | Value |
|---|---|
| Dataset | Copernicus DEM GLO-90 (COP-DEM_GLO-90-DGED, 2021 release), Cloud-Optimized GeoTIFF |
| Access | AWS Open Data bucket `copernicus-dem-90m`, over HTTPS, no account: `https://copernicus-dem-90m.s3.amazonaws.com/<TILE>/<TILE>.tif` |
| Tile name | `Copernicus_DSM_COG_30_N{LAT:02d}_00_W{LON:03d}_00_DEM`, LAT 31–42, LON 108–116 (108 tiles) |
| Registry | https://registry.opendata.aws/copernicus-dem/ |
| Licence | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM (linked from the registry entry) |
| Horizontal CRS | WGS 84 geographic (EPSG:4326) |
| Vertical datum | EGM2008 geoid (EPSG:3855), metres |
| Resolution | 3 arc-seconds (1/1200°, about 90 m N–S, 74 m E–W at 37° N) |

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
     ≈ 37–46 m) west and north. `meta.bbox` is the spec bbox exactly; the footprint and the snap
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
5. *(Reference barcode — F4b.)*
6. **Export** to `public/data/colorado/`:
   - `grid.f32`: little-endian float32, row-major, north row first; cell index i = y·W + x
     (539,856 bytes; SHA-256 in `meta.json` → `files`).
   - `meta.json`: bbox, width, height, cellDeg, rowOrder, min/max with cells and lat/lon, CRS, vertical
     datum, source and URL, licence and required notice, processing steps, connectivity (4), tie-break
     rule, generatedAt, gitCommit, plus native-raster details and derived values.
   - `hillshade.webp`, `ATTRIBUTION.md`.

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
by the reference barcode in F4b.

## Limitations

- **Surface model.** Copernicus DEM is a Digital Surface Model: heights include vegetation, buildings
  and infrastructure, not bare ground. Water bodies are flattened in the source.
- **Resolution.** The source is 3″ (≈ 90 m). The TDA grid is 0.025° (≈ 2.2 × 2.8 km) and keeps the
  minimum of each block, so it follows valley floors and under-represents peaks and ridges; lakes
  and spill points narrower than a cell are merged or lost. The hillshade is a 30″ block mean with
  2× vertical exaggeration, for display only.
- **Rectangle ≠ basin.** The study area is a lat/lon rectangle (RiverNets coverage), not the
  Colorado River's hydrologic basin. It can omit parts of the basin (for example headwaters beyond
  the east or north edges) and includes neighbouring closed basins. The edges cut through terrain, so
  water can "leave" only by merging inside the rectangle.
- **Geometry.** The grid is equirectangular in degrees; a cell is ≈ 2.2 km E–W at 37° N and wider in
  the south than in the north. The clipped footprint is offset half a native pixel (≈ 40 m) from the
  nominal bbox (see step 2).
- **Vertical accuracy.** The dataset's stated absolute vertical accuracy is < 4 m (90 % linear error);
  bars or differences of a few metres are within the noise.

## Longest-lived lakes

Filled in by the reference-barcode step (F4b): the 10 longest-lived lakes with birth and death
elevations and the lat/lon of their birth and death cells, computed by `pipeline/tda_ref.py` on the
exact `grid.f32` array.

## Run log (this build)

| Run | Cache | Result | Time |
|---|---|---|---|
| `npm run data` | empty `pipeline/data/raw/` | 108/108 tiles downloaded in 81.9 s; then stopped at the tile check (EPSG-code comparison, since fixed) | 82.3 s |
| `npm run data` | full cache | success | 7.9 s total (cache check 0.1 s, processing 7.6 s) |
| `npm run data -- --raw-dir <new empty dir> --out-dir <scratch dir>` | empty | success: tileList.txt + 108/108 tiles downloaded (87.2 s); `grid.f32` and `hillshade.webp` byte-identical to the committed outputs | 94.2 s total |
| `npm run data` (final) | full cache | success, outputs unchanged | ≈ 8 s |
