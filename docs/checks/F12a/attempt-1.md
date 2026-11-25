# Check report — F12a Basin mask data (stretch S3, data part) — attempt 1

Verdict: PASS_WITH_NOTES

Gates: check ✅ (0 errors, 0 warnings, 0 hints) · lint ✅ (eslint and prettier clean) · unit ✅ (779 passed, 24 files; explorer 66 passed) · pytest ✅ (594 passed) · ruff ✅ · build ✅ (10 pages) · e2e ✅ (e2e/explorer.spec.ts 23/23 on preview :4321) · axe ✅ (inside explorer spec, 375/768/1280 light and dark) · lighthouse n/a · links n/a · visual n/a (data-only feature, no screenshots taken) · content n/a · tda n/a · data ✅

## Acceptance criteria

1. **Reproducible: ✅**
   - `pipeline/.venv/bin/python -m pipeline.basin_mask --out-dir <scratch>` was seeded with `git show HEAD:public/data/colorado/meta.json` and took about 20 s from the cache. `basin-mask.bin`, `basin-mask.json` and the patched `meta.json` are all `cmp`-identical to the working-tree files.
   - `npm run data -- --out-dir <scratch>` took 27.9 s. `ATTRIBUTION.md`, `barcode.json`, `basin-mask.bin`, `basin-mask.json`, `grid.f32` and `hillshade.webp` are identical.
   - `meta.json` differs only in the documented `generatedAt` and `gitCommit` fields (lines 199–200).
   - The cached zips' SHA-256 values (`shasum -a 256`) match `basin-mask.json` → `source.regions`.
   - The public data files were unchanged after pytest.

2. **Grid alignment: ✅** Tool: `docs/checks/tools/f12a_mask_check.py`. It has its own `.shp` reader, its own even-odd scanline and point-in-polygon test, and its own bit decoder `(byte[i>>3]>>(i&7))&1`. It does not import anything from the pipeline. Log: `docs/checks/F12a/mask_check.log`.
   - **Layout and grid.** The file is 33,742 B = 2 × ⌈134,964/8⌉, and the padding bits are 0. The grid is 326 × 414, and its bbox, width, height, cellDeg, rowOrder and native extent all equal meta.json. Plane 1 has no bits outside plane 0. The decoded plane-0 count is 97,311, which matches both JSON files.
   - **Full grid against the WBD HU-2 polygons** (cell centres taken from the native 30-pixel blocks, including the short last column and row). The centre rule and the mask disagree in 93 cells, and **0 of 130,894 non-edge cells** disagree.
   - **Random sample.** 1,467 cells, seed 20261124, each more than 0.03° from either HU-2 boundary: **0 disagreements on plane 0 and 0 on plane 1**. For plane 1, 0 disagreements remain once cells on the 14/15 internal boundary are excluded.
   - **Shift test** (interior cells): no shift gives 92 disagreements. One-cell shifts give 807 (N), 812 (S), 859 (E) and 860 (W); diagonal shifts give 1,217 and 1,224. Every shift is about 9× worse.

3. **Sanity points: ✅**
   - I downloaded the USGS GNIS Domestic Names state files myself (CO, UT, NV, AZ; `Last-Modified` Mon, 02 Nov 2026). The feature IDs and decimal coordinates match the docs/data.md table exactly.
   - Mask results:
     - Region 14: Uncompahgre Peak 188678, Grand Junction 204662, Moab 1430389.
     - Region 15: Lake Mead 7862, Las Vegas 847388, Phoenix 44784, Flagstaff 29046.
     - Outside: Salt Lake City 1454997, Great Salt Lake 1441459, Ely 859671.
   - Every point agrees with my point-in-polygon test, and each has a uniform 5 × 5 neighbourhood.
   - I confirmed that GNIS Domestic Names has no "Hoover Dam" record (only "Hoover Dam Spring", AZ 5929), so substituting Lake Mead is justified.

4. **Sources and attribution: ✅**
   - **URLs.** Both zip URLs return 200. On the live object for region 15, `Last-Modified` (Wed, 08 Jan 2025 21:49:49 GMT), `ETag` and `Content-Length` match the sidecar. The WBD product page, the access page (which links the HU2 folder) and the NAD 83 FAQ all return 200.
   - **FGDC metadata.** The XML in each zip has pubdate 20250108, and its titles match the quoted titles exactly. The quoted "Acknowledgment of the originating agencies would be appreciated…" sentence and the "1:24,000-scale" sentence appear verbatim. The four originators match `idinfo/citation`, and the datum is NAD 83.
   - **USGS crediting page** (WebFetch):
     - The public-domain sentence matches word for word.
     - The no-cost suggested form is "(Product or data name) courtesy of the U.S. Geological Survey". The credit "Watershed Boundary Dataset (WBD) courtesy of the U.S. Geological Survey" follows it.
     - The NAD 83/WGS 84 "equivalent datums at map scales of 1:5,000 and smaller" sentence matches verbatim.
   - **Raw files.** `git check-ignore -v` shows that `pipeline/data/raw/` (.gitignore:6) covers the zips and sidecars. `git ls-files pipeline/data` is empty. No raw files are tracked or untracked-visible.

5. **Mexico coverage: ✅**
   - **Shapefile check** (`docs/checks/tools/f12a_mexico.py`, log `docs/checks/F12a/mexico.log`):
     - The WBDHU2 `states` value for region 15 is "AZ,CA,MX,NM,NV,UT". The HU-4s whose states include MX are 1503, 1505 and 1508.
     - Of region 15's 4,379 HU-12s, 545 have `states` == "MX", which matches the builder's 545, and 629 include MX.
     - Of the 1,568 grid cells more than 0.05° south of a piecewise-linear US–Mexico border, **1,485 are in the mask**. The southernmost mask row is at 31.8204° N, the bbox's last row.
   - **USGS WBD REST service** (MapServer/1 point queries):
     - 32.0° N, 114.9° W (Mexico) is in region 15.
     - 31.87° N, 115.19° W returns no feature, which confirms the documented 4-cell gap.
     - 32.8° N, 115.19° W is in region 18.
   - The FGDC `supplinf` field contains the quoted "harmonized hydrologic units … INEGI" sentence verbatim.
   - **Wording.** docs/data.md ("Mexico is included, not missing" and "The gap") and `basin-mask.json` → `coverage` and `meta.json` → `basinMask.source` describe this accurately. A grep for "US portion" or "U.S. portion" finds 0 matches in all three files. The 1,039-cell "MX-only HU-12" figure is labelled as a lower bound, which is consistent with my 1,485.
   - **Sonora drainage.** I traced `tohuc` independently (`docs/checks/tools/f12a_sonora.py`): 634 HU-12s, ending at OCEAN 495, MEXICO 117 and CLOSED BASIN 22. All paths stay inside 1508, which matches `stats.sonoraDrainage`.

6. **Size and consumers: ✅**
   - `basin-mask.bin` is 33,742 B, under the 50 KB limit (2,077 B with gzip -9). `basin-mask.json` is 14,056 B.
   - `npx vitest run tests/unit/viz/explorer`: 66/66 passed.
   - `npm run build`, then `npx playwright test e2e/explorer.spec.ts` on preview :4321: 23/23 passed, including "About the data is generated from meta.json and ATTRIBUTION.md".
   - The new files are copied to `dist/data/colorado/`.

7. **Gates: ✅**
   - pytest: 594 passed.
   - ruff: All checks passed.
   - `npm run check`: 0/0/0.
   - `npm run lint`: clean.
   - `npm test`: 779 passed.

Data audit (§11 step 10, adapted):
- `meta.bbox` is unchanged and equal to `basin-mask.json` → `grid.bbox`.
- The grid minimum cell (31.945417° N, 114.764583° W, delta) is inside the mask.
- Uncompahgre Peak, which is near `rawMax`, is in region 14.
- The attribution matches the licence page word for word.

## Blocking fixes

None.

## Notes (non-blocking)

1. **INEGI is not credited.** `basin-mask.json` → `attribution.originatorsNote` and the docs/data.md attribution paragraph list only the four `idinfo` originators. The FGDC lineage names "Government of Mexico, Institute of Statistics, Geography and Informatics (INEGI)" as the originator of the source citations "Subcuencas…" and "Hidrografica", and about 1,000–1,500 mask cells come from those harmonized Mexican units. The metadata asks for "acknowledgment of the originating agencies", so F12b could add INEGI to the credit or to "About the data". This is optional, because the quoted originators are accurate as `idinfo` states them.
2. **Stale sentence after DECISIONS #78.** docs/data.md, section "Coverage", says "Whether the explorer should drop 1508 is a decision for Control and Andrew". Andrew decided on 2026-11-24 to keep 1508. Control could update the sentence at commit time or in F12b.
3. **Majority rule versus centre test.** The ≥ half-of-pixels rule differs from a pure cell-centre test in 93 boundary cells (about 0.07 %). This is expected and documented (`cellRule`), and none of those cells is off the boundary.
4. **Access date in UTC.** The access date is 2026-11-25 (UTC), the day after the local date. This is documented.
5. **Datum.** NAD 83 is used as WGS 84 without a shift. This is justified by the quoted USGS FAQ at a 0.025° cell size.

## Artifacts

- /Users/andrewchincea/personalPortfolio/docs/checks/F12a/attempt-1.md
- /Users/andrewchincea/personalPortfolio/docs/checks/F12a/mask_check.log
- /Users/andrewchincea/personalPortfolio/docs/checks/F12a/mexico.log
- /Users/andrewchincea/personalPortfolio/docs/checks/F12a/sonora.log
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f12a_mask_check.py (independent decoder, shapefile reader, point-in-polygon test, shift and sanity checks)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f12a_points.json (GNIS coordinates I looked up myself)
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f12a_mexico.py
- /Users/andrewchincea/personalPortfolio/docs/checks/tools/f12a_sonora.py
- The scratch reruns, extracted WBD layers and GNIS files are in the session scratchpad and are not kept.
