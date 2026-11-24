# Build report — F9-R1 data-engineer fixes (LANDMARKS from USGS GNIS/MRDS, data.md wording) — attempt 1

Summary: `pipeline/barcode.py` `LANDMARKS` now uses only primary USGS sources. Place names use GNIS primary coordinates from the official Domestic Names files, cross-checked against the National Map geonames service. Mines use USGS MRDS records. I added Bonneville Salt Flats, Red Rock Pass (ID), and the Mission, Chino and Bagdad mines. I re-ran `--lakes` and pasted its output unedited into docs/data.md, then rewrote the interpretations to match. Ray Mine (#5) is now stated as the Ray open pit: its native pit floor is 0.72 km from MRDS 10210616. The optional check confirmed #11 Mission, #14 Chino and #18 Bagdad as open-pit mines against MRDS. The "≈ 40 m" wording is now "about 34–46 m". No public data byte changed.

Files changed:
- pipeline/barcode.py
  - `LANDMARKS` now has 12 entries. Each records its GNIS feature id or MRDS dep_id and the source URLs, in comments and in the link.
  - New constants `_GNIS` and `_MRDS`.
  - `geography_markdown` prints "outside the rectangle" for a landmark whose cell is −1 (Red Rock Pass). Before, a −1 cell would have indexed `rank[-1]`.
- pipeline/tests/test_barcode.py: +2 tests.
  - `test_landmarks_primary_sources`: every URL is GNIS or MRDS with a numeric id.
  - `test_geography_markdown_outside_landmark`.
- docs/data.md
  - Limitations: the "Open-pit mines" bullet is updated, and "Geometry" now says "about 34–46 m".
  - Geography check: new source paragraph with the GNIS feature ids and MRDS dep_ids, and the regenerated tables.
  - Interpretations: #3, #5, #6 and #7 rewritten, plus a new table for #11, #14 and #18.
  - Red Rock Pass: now uses the GNIS point and UGS PI-39 ("about 5,090 feet", ≈ 1,551 m) in place of Wikipedia.
  - Great Divide Basin: now uses GNIS points, including Oregon Buttes 1592464 and South Pass 1594710, both north of the edge.
  - Run-log row added.
- docs/builds/F9-R1/pits.py and pits.txt: a one-off, read-only check that finds the native 3″ pit floor in each mine lake and measures its distance to the MRDS point.
- public/data/colorado/**: unchanged.

Sources (read 2026-11-24):
- GNIS Domestic Names files (published 2026-11-02): https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_{UT,WY,ID}_Text.zip

  | Name | GNIS id | Lat, lon |
  |---|---|---|
  | Great Salt Lake Desert | 1455061 | 40.6529889, −113.5272152 |
  | Great Salt Lake | 1441459 | 41.1628677, −112.5353656 |
  | Bonneville Salt Flats | 1425872 | 40.7996521, −113.8000029 |
  | Great Divide Basin | 1597072 | 42.0002345, −108.0009183 |
  | Wamsutter | 1609172 | 41.6730144, −107.9792489 |
  | Red Rock Pass, ID | 389236 | 42.3563088, −112.043293 |

- Cross-check: https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/{3,5}/query. It gives the same points to 1e-5°. Great Salt Lake is not in its point layers, which is why I used the file.
- MRDS: https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=…

  | Mine | dep_id | Lat, lon |
  |---|---|---|
  | Bingham | 10069296 | 40.52077, −112.1458 |
  | Ray | 10210616 | 33.18315, −110.99236 |
  | Sierrita | 10137918 | 31.87152, −111.14879 |
  | Mission | 10111429 | 31.99234, −111.0643 |
  | Chino | 10087992 | 32.794, −108.06644 |
  | Bagdad | 10162326 | 34.58474, −113.20857 |

  - All six records list mining method "Open Pit".
  - To find nearby records I used the MRDS feature service: https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0
- UGS PI-39: https://ugspub.nr.utah.gov/publications/public_information/pi-39.pdf

How to verify:
- `pipeline/.venv/bin/python -m pytest pipeline -q` → 294 passed
- `pipeline/.venv/bin/ruff check pipeline` → All checks passed
- `pipeline/.venv/bin/python -m pipeline.barcode --lakes` → identical to the two Geography-check tables in docs/data.md. The lakes table is unchanged from HEAD.
- `pipeline/.venv/bin/python -m pipeline.barcode --lakes -n 20` → the #11, #14 and #18 rows.
- `pipeline/.venv/bin/python docs/builds/F9-R1/pits.py` → matches docs/builds/F9-R1/pits.txt. Its #5–#7 values match the F4b checker's pits.txt (0.72, 0.30, 0.84 km).
- `npm run data` (cache) then `git diff --stat -- public/data/colorado/`:
  - The run took 7.1 s.
  - Only `meta.json` `generatedAt`/`gitCommit` changed, and I restored it with `git checkout`.
  - The final diff is empty, so grid.f32, hillshade.webp, barcode.json, ATTRIBUTION.md and meta.json are byte-identical to HEAD 5752efb.

Acceptance criteria (self-check):
- ✅ Wikipedia LANDMARKS replaced by GNIS (six names) and MRDS (Bingham, Ray, Sierrita, plus Mission, Chino, Bagdad). Ids and URLs are in the code comments, the table links and docs/data.md.
- ✅ `--lakes` re-run and pasted unedited.
- ✅ The changed distances are now in the text:

  | Lake | Before (km) | Now (km) | Basis now |
  |---|---|---|---|
  | #3 | 9.5 | 11.9 | Bonneville Salt Flats; 17.5 to the Great Salt Lake Desert |
  | #5 | 2.3 | 1.4 | birth-cell centre to MRDS; native floor 0.72 |
  | #6 | 1.0 | 0.5 | birth-cell centre to MRDS; native floor 0.30 |
  | #7 | 0.7 | 0.9 | birth-cell centre to MRDS; native floor 0.84 |

  The containment results are unchanged, and the lake now also contains the Bonneville Salt Flats point.
- ✅ Ray Mine (#5) is stated as the Ray open pit, with the evidence and its caveats:
  - The MRDS point (ore-body reference) lies in rim cell 116876. That cell is at 615.2 m, above the 563.2 m spill height, so it is not inside the 2-cell lake.
  - MRDS also lists a minor "Lime Pit" (10234845, significant: No) about 0.7 km from the floor. The doc discloses this.
- ✅ "≈ 40 m" → "about 34–46 m". No other "40 m" remains in docs/data.md.
- ✅ Optional: #11 Mission, #14 Chino and #18 Bagdad are confirmed. For each, the 3–4-cell lake contains the MRDS point's cell, and the native floor is within 1.09, 0.31 and 0.19 km respectively. This is noted in docs/data.md only; no site copy was touched.
- ✅ Tests and ruff pass, and the public data is byte-identical.

Needs Andrew: none.

Requests to Control: none. The site copy "some deep lakes … are mine pits" stays accurate. If F6 or the site ever wants to name specific mines, the sourced list is now in docs/data.md.

Known limitations:
- The GNIS record pages linked in the table (edits.nationalmap.gov/apps/gaz-domestic/public/search/names/<id>) are a JavaScript app. The coordinates were read from the official Domestic Names text files and the map service. I did not use the app's GraphQL API.
- MRDS points are sometimes ore-body or mine-symbol reference points, not pit centres; Ray's is an example. So the "contains the MRDS cell" test is supporting evidence, and the native-floor distance is the main test.
- The pit-floor script is a one-off check in docs/builds/F9-R1/. It is not part of the pipeline, and it needs the raw-tile cache.
- Not done (optional, out of this task's list): sourcing the "Rocky Mountain National Park / Wind River not tested" statement in Limitations. That text is unchanged.
- One sentence still cites Wikipedia: the Great Divide Basin "extends north toward the Oregon Buttes near South Pass". The GNIS points now show that both features are north of the edge.
