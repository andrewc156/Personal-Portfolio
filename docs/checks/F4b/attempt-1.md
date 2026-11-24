# Check report — F4b Reference barcode — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check n/a · lint n/a (JS) · unit n/a · pytest ✅ (292 passed) · ruff ✅ · build n/a · e2e n/a · axe n/a · lighthouse n/a · links n/a · visual n/a · content ✅ (notes 1–3) · tda ✅ · data ✅

Scope: this was a data-only check, as instructed.
- I did not run build, preview, e2e or Lighthouse, and I did not look at src/** (except importing the committed, unmodified `src/lib/tda`) or e2e/**.
- I wrote nothing under public/data/colorado/ or pipeline/data/raw/. My two pipeline reruns went to the session scratchpad, outside the repo, and I deleted them afterwards.
- After the check, the committed `barcode.json` SHA-256 and `meta.json` `generatedAt` (10:01:08) are unchanged.
- No screenshots were needed.

## Acceptance criteria
1. ✅ **barcode.json follows §6.5 step 5, is ≤ 600 KB and is reproducible.**
   - **Independent H0.** I wrote `docs/checks/tools/f4b_h0.py` from scratch: a union-find over the (h, i) order with 4-neighbours and the elder rule. It does not import pipeline/ or src/.
     - It agrees exactly with my own O(n²) BFS brute force (relabel components before every insertion; a component's age is its ≺-minimum cell) on 300 random grids up to 9×9, half with heavy ties. The comparison covers pairs, mergedInto and order.
     - The golden 1×7 case and the 2×2 checkerboard case both pass.
   - **Colorado grid.** I read grid.f32 as `<f` 326×414 and ran my union-find on it.
     - Counts: births 1217; finite 1216 (1009 positive, 207 zero-length); 599 with d − b ≥ 1 m plus 1 essential = **600**.
     - barcode.json has 600 bars. Its (b, d, bi, di, mi) tuples are **identical, including order**, to my result.
     - Every b equals `h[bi]` and every d equals `h[di]` exactly, with no rounding.
     - The smallest persistence in the file is exactly 1.0 (three bars have d − b = 1.0, so the threshold is applied as ≥). The largest excluded bar is 0.9924 m.
     - Evidence: `docs/checks/F4b/attempt-1/independent-h0.txt`.
   - **TS engine.** The committed `src/lib/tda` (no working-tree diff) was imported directly in Node 26 (`docs/checks/tools/f4b_ts_compare.mjs`).
     - `computeH0` stats: births 1217, finite 1216, zeroLength 207, essential 1, in 26 ms.
     - Its ≥ 1 m bars plus the essential bar equal both barcode.json and my union-find exactly, including order. Evidence: `ts-compare.txt`.
   - **Size.** 33,492 B, which is ≤ 614,400.
   - **Format.** Columns are `b, d, bi, di` plus `mi` (DECISIONS #36). `d = null` only for the last (essential) bar.
   - **Reproducibility.** I ran `npm run data -- --out-dir <scratch>/run1` and then `run2`.
     - barcode.json is byte-identical across run1, run2 and the committed file. SHA-256 d4e195e8…f75 equals `meta.files["barcode.json"].sha256`, and the bytes (33,492) match.
     - grid.f32, hillshade.webp and ATTRIBUTION.md are also identical three ways.
     - meta.json differs only in `generatedAt`.
     - Logs: `run1.txt`, `run2.txt`.
2. ✅ **Essential bar at the global minimum.**
   - My argmin under (h, i) is cell 133025, h = −2.885450839996338.
   - That equals barcode.json `essential.birthCell` and its last bar (bi 133025, di = mi = −1), and it equals `meta.min.cell`.
   - The essential bar is unique.
3. ✅ **Lakes table is complete.**
   - `pipeline/.venv/bin/python -m pipeline.barcode --lakes` prints 5 blocks: the top-10 table, a summary, the geography table, the landmark table and a blank-line-separated tail. Each block appears **verbatim and contiguous** in docs/data.md (`lakes-compare.txt`).
   - Separately, I recomputed persistence, birth, death, birth/death cell, mergedInto and lat/lon for all 10 rows with my own code (partial edge blocks handled). All of them match (`geo.txt`).

**F4a criteria still hold.**
- grid.f32, hillshade.webp and ATTRIBUTION.md are byte-identical to `git show HEAD:` (`cmp`).
- `meta.bbox` equals the §6.4 bbox exactly; the grid is 326 × 414.
- Nothing under public/data/colorado exceeds 600 KB.
- barcode.json is not gitignored.
- pytest 292 passed; ruff: All checks passed.

**F4a notes 1–3 are fixed.**
1. The half-pixel offset now reads "about 34–46 m" (build_colorado.py:236, meta `native.extentNote`, docs/data.md:77). My WGS 84 recomputation gives 39.45 / 34.44 m E–W at the S/N edges and 46.20 / 46.28 m N–S.
2. "2021 release" is gone. `grep 2021` over pipeline/*.py, the tests, docs/data.md, meta.json and ATTRIBUTION.md finds nothing.
3. The vertical accuracy is now sourced. I downloaded the PDF from the cited URL (HTTP 200, 3,541,026 B; cover: "Version: 5.0", "Date: 29. November 2022"). Section "1.1 Overview", "Table 1: Copernicus DEM specification parameters (DGED and DTED format)", reads:
   - "Absolute Vertical Accuracy 1) 2) 3) < 4m (90% linear error)"
   - "1) Validation results based on TanDEM-X DEM/ WorldDEM ICESat GLAS reference points (TanDEM-X Mission Goal: < 10m; global arithmetic mean value)"
   - "2) Excluding Antarctica and Greenland …"
   - "3) … all accuracy statistics and values stated in this document are calculated as an arithmetic mean. Local deviations can occur."

   meta `source.verticalAccuracy`, `limitations[4]` and the docs/data.md Limitations all say what the handbook says.
   - The same table confirms "WGS84-G1150 (EPSG 4326)" and "EGM2008 (EPSG 3855)", which also settles F4a note 5.
   - The handbook introduction (before §1.1) confirms the DSM wording and "flattening of water bodies".

## Content integrity (docs/data.md, meta.json human-readable fields)
Every number I checked traces to the data or to my recomputation:
- 600 / 599 / 1217 / 1009 / 207 / 410;
- top-10 range 466.2–263.6 m;
- rank 47 of 599, 94.0 m, 680 cells;
- lake sizes 12278 / 107 / 1060 / 192 / 2 / 2 / 2 / 20 / 9 / 308 cells;
- 9.5 / 2.3 / 1.0 / 0.7 km distances to the builder's landmark points.

`meta.processing[5]` and `meta.limitations` contain no unsourced or untrue statement. The F6 "About the data" inputs are sound.

## Geography audit (§11 step 10): primary sources I looked up myself
- **Great Salt Lake / Bonneville (rank 3): confirmed.**
  - USGS GNIS (carto.nationalmap.gov geonames service, layer 5) gives Great Salt Lake Desert (gaz_id 1455061, primary point 40.65299, −113.52723) and Bonneville Salt Flats (1425872, 40.79966, −113.80002). Both fall in cells that lie inside lake 17991 just before it spills at 1,671.5 m.
  - GNIS has no point for Great Salt Lake itself (it is an area feature). The builder's Wikipedia point is in cell 12820, h = 1278.0 m, which is the lake surface, and that cell is in the same lake.
  - Red Rock Pass, ID: GNIS 389236 at 42.35631 N, −112.0433, which is north of 42.1575. That confirms "outside the rectangle".
  - Utah Geological Survey PI-39 (https://ugspub.nr.utah.gov/publications/public_information/pi-39.pdf) says: "The lowest outlet for Lake Bonneville, Red Rock Pass in Idaho, had an elevation of about 5,090 feet". That is 1,551 m, so docs/data.md's "about 1,552 m" is correct.
- **Great Divide Basin (rank 47): confirmed, and the north edge cuts it.**
  - GNIS 1597072 points (42.00024, −107.98398) and (42.00024, −108.00093) both map to cell 2244, inside lake 2273. Wamsutter (GNIS 1609172, 41.67302, −107.97926) maps to cell 6482, also inside lake 2273.
  - Oregon Buttes (GNIS 1592464, 42.255 N) and South Pass (GNIS 1594710, 42.370 N) are north of the edge.
  - USGS Bulletin 1256 (https://pubs.usgs.gov/bul/1256/report.pdf, search result) places the eastern Oregon Buttes area in the Great Divide Basin. So "the north edge cuts the basin" holds.
- **Open-pit mines.** I used USGS MRDS records and also found the native pit floor in the raw tiles (read-only, `docs/checks/tools/f4b_pits.py`, output in `pits.txt`):
  - **#6 Bingham:** MRDS 10069296 "Bingham Open Pit Mine", operation type Surface, 40.52077, −112.1458. It is in birth cell 21312. The native block minimum (1378.2 m) is at 40.52167, −112.14917, 0.30 km from MRDS. Confirmed.
  - **#7 Sierrita:** MRDS 10137918 "Sierrita", Producer, 31.87152, −111.14879. It is in birth cell 134148. The native minimum (749.5 m) is 0.84 km from MRDS. Confirmed.
  - **#5 Ray:** MRDS 10210616 "Ray Mine", operation type Surface, 33.18315, −110.99236. The native minimum (249.0 m) is at 33.17667, −110.99250, **0.72 km from MRDS but 3.07 km from the Wikipedia point the builder used**. The MRDS point is in cell 116876, the cell just north of the 2-cell lake, at h 615.2.
    - So the identification is stronger than the builder's "probably" suggests. The cautious wording is not an overclaim (see note 1).
- **Edge-closed valleys (#1, 2, 4, 8, 9, 10).** My code confirms that each birth cell is in column 325 (east) or row 0 (north), and that #3, #5, #6 and #7 are interior.
  - The data.md wording ("valley closed off by the rectangle's edge") makes no further claim, and that is appropriate.
  - It is plausible from the coordinates: #1 is the upper Rio Grande near 37.72 N and #4/#10 are Snake-tributary valleys at 42.15 N. These are all exorheic in reality. I did not verify them beyond the edge test, and the doc does not claim more.
- **Overclaims:** none found.

## Notes (non-blocking)
1. **Prefer the primary landmark coordinates** (pipeline/barcode.py `LANDMARKS`, ~line 190; docs/data.md landmark table).
   - The builder said USGS GNIS couldn't be read. Its ArcGIS service works without JS: `https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/5/query?where=gaz_name='Great Divide Basin'&outSR=4326&f=json`. USGS MRDS pages give mine coordinates (`https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10210616`).
   - Switching to these sources would turn #5 from "probably Ray Mine (2.3 km)" into "pit floor 0.7 km from the USGS MRDS Ray Mine record".
   - No conclusion in the doc changes with the switch: every containment result above is the same with GNIS or MRDS coordinates.
2. **Handbook nuance.** Table 1's footnote says the validation is "based on TanDEM-X DEM/ WorldDEM ICESat GLAS reference points". meta says "validated against ICESat GLAS reference points". That is accurate, but F6 could add "(TanDEM-X/WorldDEM validation)" for precision.
3. **Inconsistent half-pixel figure.** docs/data.md Limitations "Geometry" still says the offset is "≈ 40 m", while step 2 and meta say "about 34–46 m". Use one wording.
4. **meta.json changes on every run** (`generatedAt`, `gitCommit`), as disclosed. barcode.json has no timestamp and is fully reproducible.

## Artifacts
- docs/checks/tools/f4b_h0.py: independent union-find H0 plus BFS brute force; selftest and Colorado comparison
- docs/checks/tools/f4b_ts_compare.mjs: committed TS engine vs barcode.json vs my pairs
- docs/checks/tools/f4b_geo.py: independent cell lat/lon, edge test, lake-before-spill containment with builder and primary coordinates
- docs/checks/tools/f4b_pits.py: native pit floors from the raw tiles (read-only)
- docs/checks/F4b/attempt-1/: independent-h0.txt, ts-compare.txt, run1.txt, run2.txt, lakes-compare.txt, geo.txt, gnis.txt, pits.txt

Sources:
- Copernicus DEM Product Handbook v5.0: https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf
- USGS GNIS / National Map geonames: https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer
- USGS MRDS: https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10069296, …10210616
- USGS MRDS feature service (Sierrita 10137918): https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0
- UGS PI-39: https://ugspub.nr.utah.gov/publications/public_information/pi-39.pdf
- USGS Bulletin 1256: https://pubs.usgs.gov/bul/1256/report.pdf
