"""Build the Colorado River Basin study-area data (spec §6.5 steps 1–4, 6).

Run from the repo root:  npm run data   (= python -m pipeline.build_colorado)

Outputs in public/data/colorado/: grid.f32, barcode.json, meta.json, hillshade.webp, ATTRIBUTION.md,
basin-mask.bin, basin-mask.json and labels.json.
The barcode (step 5) is computed by pipeline.barcode from grid.f32 as read back from disk.
The basin mask (stretch S3) is computed last by pipeline.basin_mask from the USGS WBD and adds
its entries to meta.json. The place labels (stretch S4) come after it, from pipeline.labels and
the USGS GNIS, and do not change meta.json. Raw tiles and the WBD and GNIS zips are cached in
pipeline/data/raw/ (gitignored).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from pipeline import barcode as bc
from pipeline import basin_mask as bm
from pipeline import colorado_dem as cd
from pipeline import labels as lb

REPO = Path(__file__).resolve().parent.parent
RAW_DIR = REPO / "pipeline" / "data" / "raw"
OUT_DIR = REPO / "public" / "data" / "colorado"

MAX_BYTES = 600 * 1024

LICENCE_URL = (
    "https://dataspace.copernicus.eu/explore-data/data-collections/"
    "copernicus-contributing-missions/collections-description/COP-DEM"
)
REGISTRY_URL = "https://registry.opendata.aws/copernicus-dem/"
# Copied word for word from the "User Obligations" section of LICENCE_URL
# (the notice for adapted or modified Copernicus data; GLO-90 = WorldDEM-90).
REQUIRED_NOTICE = (
    "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space "
    "GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
)
CITATION_DOI = "https://doi.org/10.5270/ESA-c5d3d65"
HANDBOOK_URL = (
    "https://dataspace.copernicus.eu/sites/default/files/media/files/2024-06/"
    "geo1988-copernicusdem-spe-002_producthandbook_i5.0.pdf"
)
# Copernicus DEM Product Handbook v5.0 (Airbus, 29 Nov 2022), section 1.1, Table 1.
ACCURACY_NOTE = (
    "The Copernicus DEM Product Handbook (version 5.0, 2022, section 1.1, Table 1) gives an absolute "
    "vertical accuracy of < 4 m (90% linear error) as a global arithmetic mean, validated against "
    "ICESat GLAS reference points and excluding Antarctica and Greenland, and notes that local "
    "deviations can occur. This build does not assess accuracy locally."
)
SURFACE_NOTE = (
    "Copernicus DEM is a Digital Surface Model (DSM): it represents the top-reflective surface of the "
    "Earth, including buildings, infrastructure and vegetation, not the bare ground."
)

HILLSHADE_AZIMUTH = 315.0
HILLSHADE_ALTITUDE = 45.0
HILLSHADE_ZFACTOR = 2.0


def log(msg: str) -> None:
    print(f"[colorado] {msg}", flush=True)


def git_commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def encode_webp(gray: np.ndarray) -> tuple[bytes, int]:
    from PIL import Image

    img = Image.fromarray(gray)
    assert img.mode == "L"
    for quality in (85, 80, 75, 70, 65, 60, 50, 40):
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality, method=6)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue(), quality
    raise RuntimeError("hillshade.webp exceeds 600 KB even at quality 40")


def cell_record(grid: np.ndarray, win: cd.NativeWindow, flat_index: int) -> dict:
    w = grid.shape[1]
    y, x = divmod(int(flat_index), w)
    lat, lon = cd.block_center_lonlat(win, cd.BLOCK, y, x)
    return {
        "value": round(float(grid[y, x]), 3),
        "cell": int(flat_index),
        "x": x,
        "y": y,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
    }


def ordered_argmin(a: np.ndarray) -> int:
    """Smallest (height, index): np.argmin returns the first index among ties."""
    return int(np.argmin(a))


def ordered_argmax(a: np.ndarray) -> int:
    """Largest (height, index) under the §6.1 total order: the last index among ties."""
    flat = a.ravel()
    return int(flat.size - 1 - np.argmax(flat[::-1]))


def native_record(native: np.ndarray, win: cd.NativeWindow, flat_index: int) -> dict:
    y, x = divmod(int(flat_index), native.shape[1])
    lat, lon = win.pixel_lonlat(y, x)
    return {
        "value": round(float(native[y, x]), 3),
        "row": y,
        "col": x,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--raw-dir", type=Path, default=RAW_DIR, help="tile cache directory"
    )
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)
    t_start = time.perf_counter()

    win = cd.native_window()
    tiles = cd.tiles_for_window(win)
    log(f"bbox {cd.BBOX}; native window {win.width} x {win.height}; {len(tiles)} tiles")

    # 1. download (resumable; cached tiles are reused)
    t0 = time.perf_counter()
    present, missing = cd.download_tiles(tiles, args.raw_dir, log)
    t_download = time.perf_counter() - t0
    ocean_tiles = [(r["lat"], r["lonW"]) for r in missing]
    log(f"tiles present {len(present)}, missing {len(missing)} ({t_download:.1f} s)")

    # 2–3. mosaic + clip at native 3″, then 30x30 block minimum
    t0 = time.perf_counter()
    native, grid, _ = cd.compute_grid(args.raw_dir, ocean_tiles)
    raw_min = native_record(native, win, ordered_argmin(native))
    raw_max = native_record(native, win, ordered_argmax(native))
    log(f"native min {raw_min}; max {raw_max}")

    # 4. hillshade: block mean to 30″, Horn hillshade with cos(lat) E–W spacing
    hs_elev = cd.block_mean(native, cd.HILLSHADE_BLOCK)
    del native
    hs_lat = cd.block_centers_lat(win, cd.HILLSHADE_BLOCK)
    shade = cd.hillshade(
        hs_elev,
        hs_lat,
        cd.HILLSHADE_BLOCK * cd.PIXEL_DEG,
        azimuth=HILLSHADE_AZIMUTH,
        altitude=HILLSHADE_ALTITUDE,
        zfactor=HILLSHADE_ZFACTOR,
    )
    gray = np.round(shade * 255.0).astype(np.uint8)
    webp, quality = encode_webp(gray)
    t_process = time.perf_counter() - t0

    # 6. export
    H, W = grid.shape
    assert grid.dtype == np.dtype("<f4") and np.isfinite(grid).all()
    grid_bytes = grid.tobytes(order="C")
    if len(grid_bytes) > MAX_BYTES:
        raise RuntimeError(f"grid.f32 is {len(grid_bytes)} bytes > 600 KB")
    gmin = cell_record(grid, win, ordered_argmin(grid))
    gmax = cell_record(grid, win, ordered_argmax(grid))
    fw, fs, fe, fn = win.footprint()

    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "grid.f32").write_bytes(grid_bytes)
    # 5. reference barcode, computed on grid.f32 as read back from disk
    barcode, barcode_bytes = bc.write_barcode(out, W, H)
    if barcode["grid"]["sha256"] != hashlib.sha256(grid_bytes).hexdigest():
        raise RuntimeError("grid.f32 on disk differs from the grid just written")
    if barcode["essential"]["birthCell"] != gmin["cell"]:
        raise RuntimeError("essential bar is not born at the grid's global-minimum cell")
    log(f"barcode.json {len(barcode_bytes)} B: {barcode['count']} bars ({barcode['stats']})")

    # Support Python 3.10, which lacks the datetime.UTC alias.
    generated_at = dt.datetime.now(dt.timezone.utc)  # noqa: UP017
    meta = {
        "label": "Colorado River Basin study area (RiverNets coverage)",
        "bbox": list(cd.BBOX),
        "bboxOrder": "W, S, E, N (degrees)",
        "center": {"lat": cd.CENTER[0], "lon": cd.CENTER[1]},
        "width": W,
        "height": H,
        "cells": W * H,
        "cellDeg": cd.BLOCK * cd.PIXEL_DEG,
        "rowOrder": "row 0 is north; rows run north to south; cell index i = y * width + x",
        "dtype": "float32 little-endian, row-major (grid.f32)",
        "units": "m",
        "cellCenter": (
            "cell (x, y) covers native pixels cols 30x..30x+29, rows 30y..30y+29 of the clipped native "
            "raster (fewer in the last column/row); its centre is the centre of those pixels. For full "
            "cells: lon = native.extent[0] + (x + 0.5) * cellDeg, lat = native.extent[3] - (y + 0.5) * cellDeg"
        ),
        "edgeBlocks": {
            "lastColumnNativePx": win.width - (W - 1) * cd.BLOCK,
            "lastRowNativePx": win.height - (H - 1) * cd.BLOCK,
        },
        "min": gmin,
        "max": gmax,
        "crs": "EPSG:4326",
        "verticalDatum": "EGM2008 geoid (EPSG:3855), metres",
        "connectivity": 4,
        "tieBreak": "i precedes j iff (h[i], i) < (h[j], j) lexicographically",
        "native": {
            "width": win.width,
            "height": win.height,
            "pixelDeg": cd.PIXEL_DEG,
            "pixelConvention": "PixelIsPoint; pixel centres on lon = k/1200, lat = m/1200",
            "columns": f"k in [{win.k0}, {win.k1})",
            "rows": f"m in ({win.m_south}, {win.m_north}]",
            "extent": [round(fw, 9), round(fs, 9), round(fe, 9), round(fn, 9)],
            "extentNote": (
                "pixel-edge extent of the clipped native raster. The spec bbox edges fall on pixel "
                "centres (to within the residuals below); the west column and north row on the bbox edge "
                "are kept and the east column and south row are dropped (the tiles' own rule), so the "
                "footprint is the bbox shifted by half a pixel (0.000417°, about 34–46 m) west and north."
            ),
            "snapResidualsPx": {k: round(v, 6) for k, v in win.residuals_px.items()},
            "rawMin": raw_min,
            "rawMax": raw_max,
        },
        "derived": cd.derived_values(),
        "source": {
            "name": "Copernicus DEM GLO-90 (COP-DEM_GLO-90-DGED), Cloud-Optimized GeoTIFF",
            "url": "https://copernicus-dem-90m.s3.amazonaws.com/",
            "registry": REGISTRY_URL,
            "tilePattern": "https://copernicus-dem-90m.s3.amazonaws.com/<TILE>/<TILE>.tif, "
            "<TILE> = Copernicus_DSM_COG_30_N{LAT:02d}_00_W{LON:03d}_00_DEM",
            "tiles": {
                "lat": [cd.LAT_RANGE.start, cd.LAT_RANGE.stop - 1],
                "lonW": [cd.LON_RANGE.start, cd.LON_RANGE.stop - 1],
                "requested": len(tiles),
                "used": len(present),
                "missing": missing,
            },
            "surfaceModel": SURFACE_NOTE,
            "verticalAccuracy": ACCURACY_NOTE,
            "productHandbook": HANDBOOK_URL,
        },
        "licence": {
            "name": "Copernicus DEM GLO-90 free licence (ESA / Copernicus)",
            "url": LICENCE_URL,
            "requiredNotice": REQUIRED_NOTICE,
            "citationDoi": CITATION_DOI,
        },
        "processing": [
            (
                "Download the 108 GLO-90 tiles N31–N42 x W108–W116 from the AWS Open Data bucket "
                "(cached in pipeline/data/raw/; a tile may be absent only if it is all ocean)."
            ),
            (
                "Check every tile: 1200 x 1200 px, WGS 84 lon/lat (EPSG:4326 equivalent), 3″ spacing, PixelIsPoint, origin at its SW-named "
                "integer corner, no nodata."
            ),
            (
                f"Mosaic and clip to the bbox at native 3″: {win.width} x {win.height} px. Bbox edges snapped "
                "to the nearest pixel-centre line; west/north edge pixels kept, east/south dropped."
            ),
            (
                f"TDA grid: minimum of each 30 x 30 block of native pixels (0.025°), partial edge blocks "
                f"allowed -> {W} x {H} float32 m. Minimum, not mean, keeps narrow canyons connected."
            ),
            (
                f"Hillshade: block mean of 10 x 10 native pixels (30″) -> {gray.shape[1]} x {gray.shape[0]}; "
                f"Horn gradient with E–W spacing scaled by cos(latitude) per row (WGS84), azimuth "
                f"{HILLSHADE_AZIMUTH:g}°, altitude {HILLSHADE_ALTITUDE:g}°, vertical exaggeration "
                f"{HILLSHADE_ZFACTOR:g}; grayscale WebP quality {quality}."
            ),
            (
                f"Reference barcode: 0-dimensional sublevel-set persistence of grid.f32 (read back from "
                f"disk) by pipeline/tda_ref.py, {bc.CONNECTIVITY}-connectivity, ties broken by (height, "
                f"cell index), elder rule. barcode.json keeps the {barcode['stats']['exportedFinite']} "
                f"bars with persistence >= {bc.MIN_PERSISTENCE:g} m plus the essential bar "
                f"({barcode['count']} of {barcode['stats']['births']} lakes); heights are exact float32 "
                "values, not rounded."
            ),
        ],
        "limitations": [
            SURFACE_NOTE,
            (
                "Resolution: the source is 3″ (about 90 m); the TDA grid is 0.025° (about 2.2 km x "
                "2.8 km) and keeps each block's minimum, so it follows valley floors, under-represents "
                "peaks and ridges, and merges or loses features narrower than a cell."
            ),
            (
                "Rectangle, not basin: the study area is a lat/lon rectangle, not the Colorado River's "
                "hydrologic basin. Water cannot leave through the rectangle's edges, so a valley that "
                "drains out across an edge becomes a closed basin in the grid; several long-lived lakes "
                "are born on the edge for this reason."
            ),
            (
                "Open-pit mines are real depressions in a surface model, and a block minimum keeps "
                "their pit floors, so some deep lakes only a cell or two wide are mine pits (for "
                "example, one lies about 1 km from the published position of Utah's Bingham Canyon Mine)."
            ),
            ACCURACY_NOTE,
        ],
        "hillshade": {
            "file": "hillshade.webp",
            "width": int(gray.shape[1]),
            "height": int(gray.shape[0]),
            "cellDeg": cd.HILLSHADE_BLOCK * cd.PIXEL_DEG,
            "extent": [round(fw, 9), round(fs, 9), round(fe, 9), round(fn, 9)],
            "azimuthDeg": HILLSHADE_AZIMUTH,
            "altitudeDeg": HILLSHADE_ALTITUDE,
            "verticalExaggeration": HILLSHADE_ZFACTOR,
            "webpQuality": quality,
        },
        "files": {
            "grid.f32": {
                "bytes": len(grid_bytes),
                "sha256": hashlib.sha256(grid_bytes).hexdigest(),
            },
            "hillshade.webp": {"bytes": len(webp)},
            "barcode.json": {
                "bytes": len(barcode_bytes),
                "sha256": hashlib.sha256(barcode_bytes).hexdigest(),
            },
        },
        "barcode": {
            "file": "barcode.json",
            "engine": barcode["engine"],
            "connectivity": barcode["connectivity"],
            "tieBreak": barcode["tieBreak"],
            "minPersistence": barcode["minPersistence"],
            "units": barcode["units"],
            "rounding": barcode["rounding"],
            "count": barcode["count"],
            "stats": barcode["stats"],
            "essentialBirthCell": barcode["essential"]["birthCell"],
            "gridSha256": barcode["grid"]["sha256"],
            "columns": "b, d, bi, di, mi (see barcode.json description)",
        },
        "generatedAt": generated_at.replace(microsecond=0).isoformat(),
        "gitCommit": git_commit(),
    }

    (out / "hillshade.webp").write_bytes(webp)
    (out / "meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out / "ATTRIBUTION.md").write_text(attribution_md(), encoding="utf-8")
    # S3 basin mask: USGS WBD HU-2 14 + 15 on this grid; adds basinMask/files to meta.json.
    bm.write(out, args.raw_dir, log)
    # S4 place labels: USGS GNIS points on this grid -> labels.json (meta.json untouched).
    lb.write(out, args.raw_dir, log)
    log(f"grid {W} x {H}: min {gmin}; max {gmax}")
    log(f"grid.f32 {len(grid_bytes)} B, hillshade.webp {len(webp)} B (q{quality})")
    log(
        f"timings: download/cache check {t_download:.1f} s, processing {t_process:.1f} s, "
        f"total {time.perf_counter() - t_start:.1f} s"
    )
    return 0


def attribution_md() -> str:
    return f"""# Attribution

Elevation data: Copernicus DEM GLO-90 (90 m), adapted for this site
(clipped, resampled to a 0.025° block-minimum grid, and hillshaded).

Required notice (Copernicus DEM licence, "User Obligations", for adapted or modified data):

> {REQUIRED_NOTICE}

Licence and notice source: {LICENCE_URL}

Data access: Copernicus DEM on the Registry of Open Data on AWS, {REGISTRY_URL}
(bucket https://copernicus-dem-90m.s3.amazonaws.com/). Citation DOI: {CITATION_DOI}

Surface model note: {SURFACE_NOTE}
"""


if __name__ == "__main__":
    sys.exit(main())
