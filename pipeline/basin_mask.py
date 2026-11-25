"""USGS Watershed Boundary Dataset regions 14 + 15 -> basin mask on the explorer grid (spec S3).

Run from the repo root:  python -m pipeline.basin_mask
(also run at the end of ``npm run data`` = ``python -m pipeline.build_colorado``).

Inputs: the official USGS National Map staged WBD products, one zip per 2-digit hydrologic
unit (HU-2 region), fetched over HTTPS and cached in pipeline/data/raw/wbd/ (gitignored):
  https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/Shape/WBD_<HU>_HU2_Shape.zip
Only ``Shape/WBDHU2.*``, ``Shape/WBDHU6.*`` and the FGDC metadata XML are read, straight
from the zip (nothing is extracted). The shapefile and dBASE readers below are minimal and
strict: anything unexpected stops the build.

Outputs in public/data/colorado/:
  basin-mask.bin   two bit planes over the TDA grid (see FORMAT below)
  basin-mask.json  format, grid alignment, sources, version, coverage notes, attribution, stats
and a ``basinMask`` entry plus ``files["basin-mask.*"]`` in meta.json.

Cell rule: a grid cell is in the basin when at least half of the native 3-arc-second pixels
it covers (the same 30 x 30 blocks, partial edge blocks included, as grid.f32) have their
centre inside the union of the HU-2 14 and 15 polygons.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np

from pipeline import colorado_dem as cd

REPO = Path(__file__).resolve().parent.parent
RAW_DIR = REPO / "pipeline" / "data" / "raw"
WBD_SUBDIR = "wbd"
OUT_DIR = REPO / "public" / "data" / "colorado"

MASK_FILE = "basin-mask.bin"
MASK_META_FILE = "basin-mask.json"
MAX_MASK_BYTES = 50 * 1024

REGIONS = ("14", "15")
REGION_NAMES = {"14": "Upper Colorado Region", "15": "Lower Colorado Region"}
WBD_URL = (
    "https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/Shape/"
    "WBD_{hu}_HU2_Shape.zip"
)
WBD_PRODUCT_PAGE = (
    "https://www.usgs.gov/national-hydrography/watershed-boundary-dataset"
)
WBD_ACCESS_PAGE = (
    "https://www.usgs.gov/national-hydrography/access-national-hydrography-products"
)
USGS_CREDIT_PAGE = "https://www.usgs.gov/information-policies-and-instructions/acknowledging-or-crediting-usgs"
# USGS_CREDIT_PAGE: "Most U.S. Geological Survey (USGS) information resides in the Public
# Domain and may be used without restriction." Its suggested credit for no-cost use is
# "(Product or data name) courtesy of the U.S. Geological Survey".
PUBLIC_DOMAIN_STATEMENT = (
    "Most U.S. Geological Survey (USGS) information resides in the Public Domain and may be "
    "used without restriction."
)
CREDIT_LINE = "Watershed Boundary Dataset (WBD) courtesy of the U.S. Geological Survey"
DATUM_SOURCE = (
    "https://www.usgs.gov/faqs/why-are-nad-83-position-values-so-far-nad-27-values-were-old-"
    "coordinates-wrong"
)
DATUM_QUOTE = (
    "All modern maps and GIS data are cast on NAD 83 or WGS 84, which are equivalent datums "
    "at map scales of 1:5,000 and smaller."
)
NAD83_PRJ_PREFIX = 'GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983"'
# GRS 1980 (the NAD 83 ellipsoid, from the .prj files)
GRS80_A = 6378137.0
GRS80_F = 1 / 298.257222101

FORMAT = {
    "name": "basin-mask-bitplanes-v1",
    "planes": [
        "plane 0 (bytes 0 .. planeBytes-1): 1 = cell is in the basin (HU-2 14 or 15)",
        (
            "plane 1 (bytes planeBytes .. 2*planeBytes-1): 1 = basin cell assigned to HU-2 15 "
            "(Lower Colorado); a cell with plane 0 = 1 and plane 1 = 0 is HU-2 14 (Upper "
            "Colorado); plane 1 is 0 outside the basin"
        ),
    ],
    "bitOrder": "cell index i = y * width + x (row 0 north, as grid.f32); "
    "bit i of a plane is (byte[i >> 3] >> (i & 7)) & 1 (least significant bit first)",
    "padding": "unused high bits of each plane's last byte are 0",
}
CELL_RULE = (
    "A cell is in the basin when at least half of the native 3″ Copernicus pixels it covers "
    "(the same 30 x 30 blocks as grid.f32; 19 px wide in the last column, 18 px tall in the last "
    "row) have their centres inside the union of the WBD HU-2 14 and 15 polygons (GDAL "
    "rasterization, pixel-centre rule). A basin cell is assigned to whichever of 14 and 15 holds "
    "more of its pixels (14 on a tie)."
)


def log(msg: str) -> None:
    print(f"[basin] {msg}", flush=True)


# --- download ------------------------------------------------------------------


def wbd_url(hu: str) -> str:
    return WBD_URL.format(hu=hu)


def download_wbd(hu: str, cache_dir: Path, log=log) -> tuple[Path, dict]:
    """Fetch WBD_<hu>_HU2_Shape.zip into cache_dir (atomic; reused when present).

    A sidecar ``<zip>.json`` records URL, access date, HTTP Last-Modified/ETag, bytes and
    SHA-256 at download time, so a rebuild from the cache is byte-identical.
    """
    import requests

    cache_dir.mkdir(parents=True, exist_ok=True)
    url = wbd_url(hu)
    path = cache_dir / url.rsplit("/", 1)[1]
    side = path.with_name(path.name + ".json")
    if path.exists() and side.exists():
        rec = json.loads(side.read_text(encoding="utf-8"))
        data = path.read_bytes()
        if (
            len(data) != rec["bytes"]
            or hashlib.sha256(data).hexdigest() != rec["sha256"]
        ):
            raise RuntimeError(
                f"cached {path.name} does not match its sidecar; delete both"
            )
        log(f"cached {path.name} ({rec['bytes']:,} B, accessed {rec['accessDate']})")
        return path, rec
    session = requests.Session()
    session.headers["User-Agent"] = "portfolio-data-pipeline/1.0 (python-requests)"
    resp = None
    for attempt in range(4):
        try:
            resp = session.get(url, timeout=300)
        except requests.RequestException as exc:
            log(f"{url}: {exc}; retrying")
        else:
            if resp.status_code == 200:
                break
            log(f"{url}: HTTP {resp.status_code}; retrying")
        resp = None
        if attempt < 3:
            import time

            time.sleep(2**attempt)
    if resp is None:
        raise RuntimeError(
            f"could not download {url}; stopping (no substitute data is used)"
        )
    data = resp.content
    rec = {
        "url": url,
        "accessDate": dt.datetime.now(dt.UTC).date().isoformat(),
        "httpLastModified": resp.headers.get("Last-Modified"),
        "httpEtag": resp.headers.get("ETag"),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    if "Content-Length" in resp.headers and int(resp.headers["Content-Length"]) != len(
        data
    ):
        raise RuntimeError(f"{url}: truncated download")
    tmp = path.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(path)
    side.write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8")
    log(f"downloaded {path.name} ({len(data):,} B)")
    return path, rec


# --- shapefile / dBASE readers (minimal, strict) -----------------------------------


def read_dbf(data: bytes) -> list[dict]:
    """dBASE III records as dicts of stripped strings (deleted records skipped)."""
    if len(data) < 32:
        raise ValueError("dbf too short")
    n, header_len, rec_len = struct.unpack("<IHH", data[4:12])
    fields, off = [], 32
    while data[off] != 0x0D:
        name = data[off : off + 11].split(b"\0")[0].decode("ascii")
        fields.append((name, data[off + 16]))
        off += 32
    if sum(length for _, length in fields) + 1 != rec_len:
        raise ValueError("dbf record length mismatch")
    out = []
    for i in range(n):
        rec = data[header_len + i * rec_len : header_len + (i + 1) * rec_len]
        if len(rec) != rec_len:
            raise ValueError("dbf truncated")
        if rec[:1] == b"*":
            continue
        pos, row = 1, {}
        for name, length in fields:
            row[name] = rec[pos : pos + length].decode("latin-1").strip()
            pos += length
        out.append(row)
    return out


def read_polygons(data: bytes) -> list[list[np.ndarray]]:
    """Polygon (type 5) shapefile -> one list of closed (n, 2) lon/lat rings per record."""
    if struct.unpack(">i", data[0:4])[0] != 9994:
        raise ValueError("not a shapefile")
    if struct.unpack(">i", data[24:28])[0] * 2 != len(data):
        raise ValueError("shapefile length mismatch")
    if struct.unpack("<i", data[32:36])[0] != 5:
        raise ValueError("expected Polygon (type 5) shapefile")
    records, off = [], 100
    while off < len(data):
        _, words = struct.unpack(">2i", data[off : off + 8])
        content = data[off + 8 : off + 8 + 2 * words]
        off += 8 + 2 * words
        if struct.unpack("<i", content[:4])[0] != 5:
            raise ValueError("non-polygon record")
        nparts, npts = struct.unpack("<2i", content[36:44])
        parts = list(struct.unpack(f"<{nparts}i", content[44 : 44 + 4 * nparts]))
        start = 44 + 4 * nparts
        if len(content) != start + 16 * npts:
            raise ValueError("polygon record length mismatch")
        pts = np.frombuffer(content[start:], dtype="<f8").reshape(npts, 2)
        rings = []
        for j, s in enumerate(parts):
            e = parts[j + 1] if j + 1 < nparts else npts
            ring = np.array(pts[s:e], dtype=np.float64)
            if len(ring) < 4 or not np.array_equal(ring[0], ring[-1]):
                raise ValueError("ring not closed")
            rings.append(ring)
        records.append(rings)
    return records


def ring_signed_area(ring: np.ndarray) -> float:
    x, y = ring[:, 0], ring[:, 1]
    return 0.5 * float(np.sum(x[:-1] * y[1:] - x[1:] * y[:-1]))


def read_wbd_zip(path: Path, hu: str) -> dict:
    """Read the HU-2 polygon, its HU-6 polygons, the .prj and the FGDC citation from the zip."""
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())

        def get(name: str) -> bytes:
            if name not in names:
                raise RuntimeError(f"{path.name}: missing {name}")
            return z.read(name)

        prj = get("Shape/WBDHU2.prj").decode("ascii")
        if not prj.startswith(NAD83_PRJ_PREFIX):
            raise RuntimeError(f"{path.name}: unexpected CRS {prj!r}")
        if get("Shape/WBDHU6.prj").decode("ascii") != prj:
            raise RuntimeError(f"{path.name}: HU-6 CRS differs from HU-2")
        hu2_attr = read_dbf(get("Shape/WBDHU2.dbf"))
        hu2_geom = read_polygons(get("Shape/WBDHU2.shp"))
        if len(hu2_attr) != 1 or len(hu2_geom) != 1 or hu2_attr[0]["huc2"] != hu:
            raise RuntimeError(f"{path.name}: expected exactly one HU-2 {hu} polygon")
        hu6_attr = read_dbf(get("Shape/WBDHU6.dbf"))
        hu6_geom = read_polygons(get("Shape/WBDHU6.shp"))
        if len(hu6_attr) != len(hu6_geom) or not all(
            r["huc6"].startswith(hu) for r in hu6_attr
        ):
            raise RuntimeError(f"{path.name}: bad HU-6 layer")
        # HU-12 units lying wholly in Mexico (states == "MX"), for the coverage statistics.
        hu12_attr = read_dbf(get("Shape/WBDHU12.dbf"))
        hu12_geom = read_polygons(get("Shape/WBDHU12.shp"))
        if len(hu12_attr) != len(hu12_geom):
            raise RuntimeError(f"{path.name}: bad HU-12 layer")
        mx12 = [
            (a["huc12"], a["tohuc"], g)
            for a, g in zip(hu12_attr, hu12_geom)
            if a["states"] == "MX"
        ]
        tohuc = {a["huc12"]: a["tohuc"] for a in hu12_attr}
        del hu12_geom
        xml_name = f"WBD_{hu}_HU2_Shape.xml"
        root = ET.fromstring(get(xml_name))
    cite = root.find("idinfo/citation/citeinfo")
    if cite is None:
        raise RuntimeError(f"{path.name}: no FGDC citation")
    return {
        "hu": hu,
        "prj": prj,
        "attr": hu2_attr[0],
        "rings": hu2_geom[0],
        "hu6": [
            (a["huc6"], a["name"], float(a["areasqkm"]), g)
            for a, g in zip(hu6_attr, hu6_geom)
        ],
        "mx12": mx12,
        "tohuc": tohuc,
        "citation": {
            "title": (cite.findtext("title") or "").strip(),
            "pubdate": (cite.findtext("pubdate") or "").strip(),
            "originators": [(o.text or "").strip() for o in cite.findall("origin")],
            "metadataFile": xml_name,
        },
    }


# --- rasterization -------------------------------------------------------------------


def geojson(rings: list[np.ndarray]) -> dict:
    """All rings of one record as one GeoJSON Polygon (GDAL fills it with the even-odd rule)."""
    return {"type": "Polygon", "coordinates": [r.tolist() for r in rings]}


def native_transform(win: cd.NativeWindow):
    from affine import Affine

    fw, _, _, fn = win.footprint()
    return Affine(cd.PIXEL_DEG, 0.0, fw, 0.0, -cd.PIXEL_DEG, fn)


def rasterize_native(shapes, win: cd.NativeWindow) -> np.ndarray:
    """Burn (geometry, value) pairs onto the clipped native 3″ raster (pixel-centre rule)."""
    from rasterio import features

    return features.rasterize(
        shapes,
        out_shape=(win.height, win.width),
        transform=native_transform(win),
        fill=0,
        all_touched=False,
        dtype="uint8",
    )


def block_counts(a: np.ndarray, b: int) -> np.ndarray:
    """Sum of a 0/1 array over b x b blocks anchored north-west (partial edge blocks)."""
    rows = np.arange(0, a.shape[0], b)
    cols = np.arange(0, a.shape[1], b)
    s = np.add.reduceat(a, rows, axis=0, dtype=np.uint32)
    return np.add.reduceat(s, cols, axis=1, dtype=np.uint32)


def block_sizes(win: cd.NativeWindow, b: int) -> np.ndarray:
    h = np.minimum(b, win.height - np.arange(0, win.height, b))
    w = np.minimum(b, win.width - np.arange(0, win.width, b))
    return np.outer(h, w).astype(np.uint32)


def cell_planes(c14: np.ndarray, c15: np.ndarray, cu: np.ndarray, npx: np.ndarray):
    """(basin, lower) boolean planes from per-cell pixel counts."""
    basin = 2 * cu >= npx
    lower = basin & (c15 > c14)
    return basin, lower


def pack_planes(basin: np.ndarray, lower: np.ndarray) -> bytes:
    p0 = np.packbits(basin.ravel().astype(np.uint8), bitorder="little")
    p1 = np.packbits(lower.ravel().astype(np.uint8), bitorder="little")
    return p0.tobytes() + p1.tobytes()


def unpack_planes(
    data: bytes, width: int, height: int
) -> tuple[np.ndarray, np.ndarray]:
    n = width * height
    plane = (n + 7) // 8
    if len(data) != 2 * plane:
        raise ValueError(f"mask is {len(data)} bytes, expected {2 * plane}")
    raw = np.frombuffer(data, dtype=np.uint8)
    bits = [
        np.unpackbits(raw[k * plane : (k + 1) * plane], bitorder="little")
        for k in (0, 1)
    ]
    for b in bits:
        if b[n:].any():
            raise ValueError("non-zero padding bits")
    return tuple(b[:n].reshape(height, width).astype(bool) for b in bits)


# --- geodesy for the area checks --------------------------------------------------------


def _q(phi):
    e2 = GRS80_F * (2 - GRS80_F)
    e = math.sqrt(e2)
    s = np.sin(phi)
    return (1 - e2) * (
        s / (1 - e2 * s * s) - np.log((1 - e * s) / (1 + e * s)) / (2 * e)
    )


def band_area_km2(lat_n, lat_s, dlon_deg) -> np.ndarray:
    """Area on the GRS 80 ellipsoid of a lat/lon cell (exact for the ellipsoid)."""
    dq = _q(np.radians(lat_n)) - _q(np.radians(lat_s))
    return 0.5 * GRS80_A**2 * np.radians(dlon_deg) * dq / 1e6


def polygon_area_check(rings: list[np.ndarray], res_deg: float = 1 / 240) -> float:
    """Ellipsoidal area (km²) of the polygon, rasterized on its own bbox at res_deg."""
    from affine import Affine
    from rasterio import features

    pts = np.vstack(rings)
    w = math.floor(pts[:, 0].min() / res_deg) * res_deg
    n = math.ceil(pts[:, 1].max() / res_deg) * res_deg
    width = math.ceil((pts[:, 0].max() - w) / res_deg) + 1
    height = math.ceil((n - pts[:, 1].min()) / res_deg) + 1
    r = features.rasterize(
        [(geojson(rings), 1)],
        out_shape=(height, width),
        transform=Affine(res_deg, 0, w, 0, -res_deg, n),
        fill=0,
        dtype="uint8",
    )
    lat_n = n - np.arange(height) * res_deg
    rows = band_area_km2(lat_n, lat_n - res_deg, res_deg)
    return float((r.sum(axis=1) * rows).sum())


def grid_cell_areas_km2(win: cd.NativeWindow, b: int) -> np.ndarray:
    """Area of every grid cell's pixel footprint (partial edge cells included)."""
    _, _, _, fn = win.footprint()
    ys = np.arange(0, win.height, b)
    hs = np.minimum(b, win.height - ys)
    lat_n = fn - ys * cd.PIXEL_DEG
    lat_s = lat_n - hs * cd.PIXEL_DEG
    ws = np.minimum(b, win.width - np.arange(0, win.width, b)) * cd.PIXEL_DEG
    return np.outer(band_area_km2(lat_n, lat_s, 1.0), ws)


# --- independent check: cell-centre point-in-polygon by scanline -----------------------------


def centres(win: cd.NativeWindow, b: int) -> tuple[np.ndarray, np.ndarray]:
    """(lat per row, lon per column) of grid cell centres, partial edge blocks included."""
    H = -(-win.height // b)
    W = -(-win.width // b)
    lat = np.array([cd.block_center_lonlat(win, b, y, 0)[0] for y in range(H)])
    lon = np.array([cd.block_center_lonlat(win, b, 0, x)[1] for x in range(W)])
    return lat, lon


def scanline_inside(
    rings: list[np.ndarray], lat: np.ndarray, lon: np.ndarray
) -> np.ndarray:
    """Even-odd point-in-polygon of every (lat[y], lon[x]); written independently of GDAL."""
    x0 = np.concatenate([r[:-1, 0] for r in rings])
    y0 = np.concatenate([r[:-1, 1] for r in rings])
    x1 = np.concatenate([r[1:, 0] for r in rings])
    y1 = np.concatenate([r[1:, 1] for r in rings])
    out = np.zeros((lat.size, lon.size), dtype=bool)
    for iy, la in enumerate(lat):
        hit = (y0 > la) != (y1 > la)
        xs = x0[hit] + (la - y0[hit]) * (x1[hit] - x0[hit]) / (y1[hit] - y0[hit])
        xs.sort()
        out[iy] = (np.searchsorted(xs, lon, side="right") % 2) == 1
    return out


def point_in_rings(rings: list[np.ndarray], lat: float, lon: float) -> bool:
    return bool(scanline_inside(rings, np.array([lat]), np.array([lon]))[0, 0])


# --- build ------------------------------------------------------------------------------------


def compute(raw_dir: Path = RAW_DIR, log=log, probe=None) -> dict:
    """Download (or reuse) the WBD zips and compute the planes and all statistics."""
    win = cd.native_window()
    H = -(-win.height // cd.BLOCK)
    W = -(-win.width // cd.BLOCK)
    wbd = {}
    for hu in REGIONS:
        path, rec = download_wbd(hu, raw_dir / WBD_SUBDIR, log)
        wbd[hu] = read_wbd_zip(path, hu) | {"download": rec}

    native = {
        hu: rasterize_native([(geojson(wbd[hu]["rings"]), 1)], win) for hu in REGIONS
    }
    overlap_px = int(np.count_nonzero(native["14"] & native["15"]))
    union = native["14"] | native["15"]
    npx = block_sizes(win, cd.BLOCK)
    c14 = block_counts(native["14"], cd.BLOCK)
    c15 = block_counts(native["15"], cd.BLOCK)
    cu = block_counts(union, cd.BLOCK)
    del native
    basin, lower = cell_planes(c14, c15, cu, npx)
    assert basin.shape == (H, W) == npx.shape

    # HU-6 breakdown of basin cells (by the majority of each cell's pixels).
    hu6_list = [u for hu in REGIONS for u in wbd[hu]["hu6"]]
    if len(hu6_list) > 254:
        raise RuntimeError("too many HU-6 units for a uint8 label raster")
    labels = rasterize_native(
        [(geojson(u[3]), k + 1) for k, u in enumerate(hu6_list)], win
    )
    best = np.zeros((H, W), dtype=np.uint32)
    best_label = np.zeros((H, W), dtype=np.int32)
    for k in range(len(hu6_list)):
        c = block_counts(labels == k + 1, cd.BLOCK)
        better = c > best
        best[better] = c[better]
        best_label[better] = k + 1
    del labels
    area = grid_cell_areas_km2(win, cd.BLOCK)
    hu6_stats = []
    for k, (code, name, wbd_km2, _) in enumerate(hu6_list):
        sel = basin & (best_label == k + 1)
        if sel.any():
            hu6_stats.append(
                {"huc6": code, "name": name, "cells": int(sel.sum()),
                 "areaKm2": round(float(area[sel].sum()), 1), "wbdAreaKm2": wbd_km2,
                 "inStudyAreaPct": round(100 * float(area[sel].sum()) / wbd_km2, 1)}
            )  # fmt: skip

    # Basin cells whose pixels lie mostly in WBD HU-12 units wholly in Mexico (states "MX").
    mx = [(geojson(u[2]), 1) for hu in REGIONS for u in wbd[hu]["mx12"]]
    mx_cells = basin & (2 * block_counts(rasterize_native(mx, win), cd.BLOCK) >= npx)
    mexico = {
        "hu12Units": sum(len(wbd[hu]["mx12"]) for hu in REGIONS),
        "basinCells": int(mx_cells.sum()),
        "areaKm2": round(float(area[mx_cells].sum()), 1),
        "southernmostCellLat": round(
            float(centres(win, cd.BLOCK)[0][np.nonzero(mx_cells.any(axis=1))[0].max()]),
            6,
        )
        if mx_cells.any()
        else None,
        "rule": "basin cells with at least half their pixels in WBD HU-12 units whose states "
        "attribute is exactly 'MX' (a lower bound: HU-12s shared with a U.S. state are not "
        "counted)",
    }
    if probe is not None:
        lat, lon = probe
        hits = [
            {"huc12": code, "tohuc": to}
            for hu in REGIONS
            for code, to, rings in wbd[hu]["mx12"]
            if point_in_rings(rings, lat, lon)
        ]
        mexico["gridMinimumCell"] = {"lat": lat, "lon": lon, "inMexicoOnlyHu12": hits}

    # Where does each HU-12 of HU-4 1508 (Sonora) drain? Follow tohuc to its terminal code.
    tohuc = {k: v for hu in REGIONS for k, v in wbd[hu]["tohuc"].items()}
    sonora_terminals: dict[str, int] = {}
    sonora_leaves = set()
    for code in sorted(c for c in tohuc if c.startswith("1508")):
        seen, c = [], code
        while c in tohuc and c not in seen:
            seen.append(c)
            c = tohuc[c]
        sonora_terminals[c] = sonora_terminals.get(c, 0) + 1
        sonora_leaves.update(x[:4] for x in seen)
    sonora_trace = {
        "hu12Units": sum(sonora_terminals.values()),
        "terminals": dict(sorted(sonora_terminals.items())),
        "hu4sOnPaths": sorted(sonora_leaves),
        "rule": "for every HU-12 in HU-4 1508, follow WBD's tohuc (downstream HU-12) until a "
        "code that is not an HU-12 of regions 14/15; count those terminal codes",
    }

    # Area checks: rasterized full-region area vs the WBD attribute, and in-bbox areas.
    region_stats = {}
    for hu in REGIONS:
        attr_km2 = float(wbd[hu]["attr"]["areasqkm"])
        rast_km2 = polygon_area_check(wbd[hu]["rings"])
        cells = int((basin & (lower if hu == "15" else ~lower)).sum())
        region_stats[hu] = {
            "name": wbd[hu]["attr"]["name"],
            "states": wbd[hu]["attr"]["states"],
            "wbdAreaKm2": attr_km2,
            "rasterizedAreaKm2": round(rast_km2, 1),
            "rasterizedVsWbdPct": round(100 * (rast_km2 - attr_km2) / attr_km2, 3),
            "cells": cells,
            "cellAreaKm2": round(
                float(area[basin & (lower if hu == "15" else ~lower)].sum()), 1
            ),
            "ringCount": len(wbd[hu]["rings"]),
            "vertexCount": int(sum(len(r) for r in wbd[hu]["rings"])),
        }
    pixel_area_union = float(
        (block_counts(union, cd.BLOCK).astype(np.float64) / npx * area).sum()
    )
    stats = {
        "cells": int(basin.size),
        "basinCells": int(basin.sum()),
        "basinFraction": round(float(basin.mean()), 6),
        "basinAreaKm2": round(float(area[basin].sum()), 1),
        "studyAreaKm2": round(float(area.sum()), 1),
        "basinAreaFraction": round(float(area[basin].sum() / area.sum()), 6),
        "pixelUnionAreaKm2": round(pixel_area_union, 1),
        "boundaryCells": int(((cu > 0) & (cu < npx)).sum()),
        "overlapPixels14and15": overlap_px,
        "regions": region_stats,
        "mexicoOnlyHu12": mexico,
        "sonoraDrainage": sonora_trace,
        "hu6": hu6_stats,
    }
    return {"win": win, "wbd": wbd, "basin": basin, "lower": lower, "stats": stats}


def build_meta(res: dict, grid_meta: dict, mask_bytes: bytes) -> dict:
    win, wbd, stats = res["win"], res["wbd"], res["stats"]
    sonora = [h for h in stats["hu6"] if h["huc6"].startswith("1508")]
    great_divide = [h for h in stats["hu6"] if h["huc6"] == "140402"]
    mexico = stats["mexicoOnlyHu12"]

    trace = stats["sonoraDrainage"]
    terminals = ", ".join(f"{k} ({v})" for k, v in trace["terminals"].items())
    hits = mexico.get("gridMinimumCell", {}).get("inMexicoOnlyHu12", [])
    min_hu12 = ", ".join(
        f"{h['huc12']} (states MX, downstream {h['tohuc']})" for h in hits
    )

    def pct(code: str) -> float:
        return next(h["inStudyAreaPct"] for h in stats["hu6"] if h["huc6"] == code)

    return {
        "format": FORMAT
        | {
            "file": MASK_FILE,
            "planeBytes": (grid_meta["cells"] + 7) // 8,
            "bytes": len(mask_bytes),
        },
        "description": (
            "Mask of the TDA grid (grid.f32) to the U.S. Geological Survey Watershed Boundary "
            "Dataset hydrologic regions 14 (Upper Colorado) and 15 (Lower Colorado)."
        ),
        "grid": {
            "file": "grid.f32",
            "sha256": grid_meta["files"]["grid.f32"]["sha256"],
            "bbox": grid_meta["bbox"],
            "width": grid_meta["width"],
            "height": grid_meta["height"],
            "cells": grid_meta["cells"],
            "cellDeg": grid_meta["cellDeg"],
            "rowOrder": grid_meta["rowOrder"],
            "extent": grid_meta["native"]["extent"],
            "native": {
                "width": win.width,
                "height": win.height,
                "pixelDeg": cd.PIXEL_DEG,
            },
        },
        "cellRule": CELL_RULE,
        "source": {
            "name": "USGS Watershed Boundary Dataset (WBD), 2-digit hydrologic units (HU-2), "
            "National Map staged products, Shapefile",
            "productPage": WBD_PRODUCT_PAGE,
            "accessPage": WBD_ACCESS_PAGE,
            "layer": "Shape/WBDHU2 (one polygon per zip); Shape/WBDHU6 only for the hu6 statistics",
            "regions": [
                {
                    "huc2": hu,
                    "name": wbd[hu]["attr"]["name"],
                    "url": wbd[hu]["download"]["url"],
                    "title": wbd[hu]["citation"]["title"],
                    "pubdate": wbd[hu]["citation"]["pubdate"],
                    "featureLoadDate": wbd[hu]["attr"]["loaddate"],
                    "tnmid": wbd[hu]["attr"]["tnmid"],
                    "accessDate": wbd[hu]["download"]["accessDate"],
                    "httpLastModified": wbd[hu]["download"]["httpLastModified"],
                    "bytes": wbd[hu]["download"]["bytes"],
                    "sha256": wbd[hu]["download"]["sha256"],
                }
                for hu in REGIONS
            ],
            "originators": wbd["14"]["citation"]["originators"],
            "crs": "NAD 83 geographic (GCS_North_American_1983, GRS 1980), from WBDHU2.prj",
            "datumNote": (
                "NAD 83 coordinates are used as WGS 84 (EPSG:4326) without a datum shift. USGS: "
                f'"{DATUM_QUOTE}" ({DATUM_SOURCE}). The grid is about 1:5,000,000 or smaller '
                "on screen and its cells are 0.025°."
            ),
        },
        "attribution": {
            "credit": CREDIT_LINE,
            "publicDomain": PUBLIC_DOMAIN_STATEMENT,
            "creditSource": USGS_CREDIT_PAGE,
            "originatorsNote": (
                'WBD metadata: "Acknowledgment of the originating agencies would be appreciated '
                'in products derived from these data." Originators: U.S. Geological Survey '
                "(USGS); U.S. Department of Agriculture - Natural Resource Conservation Service "
                "(NRCS); U.S. Environmental Protection Agency (EPA); other Federal, State, and "
                "local partners."
            ),
        },
        "coverage": [
            (
                "Mexico, included: the S3 brief expected WBD to stop at the border, but this WBD "
                "release extends region 15 into Mexico. WBD metadata: areas along the border "
                '"have been updated to include harmonized hydrologic units and hydrography that '
                "extends across the border\", in collaboration with Mexico's INEGI. In the study "
                "area this includes the Colorado's lower river and delta (HU-6 150301) down to "
                f"the south edge. {mexico['basinCells']} basin cells lie mostly in HU-12 units "
                "whose states attribute is only MX (regions 14 and 15 have "
                f"{mexico['hu12Units']} such units; see stats.mexicoOnlyHu12). The grid's lowest "
                f"cell (meta.min) is in HU-12 {min_hu12} and is inside the mask."
            ),
            (
                "Mexico, gap: WBD covers Mexico only as far as its harmonized units go. A one-off "
                "check against the USGS WBD map service (docs/data.md) found that in the study "
                "area only 4 cells, in the south-west corner around 31.87° N, 115.19° W, lie "
                "mostly in no WBD unit at all. Those cells are 0 here; no Mexican boundary has "
                "been drawn or invented. This build did not compare WBD's Mexican units with "
                "INEGI's own hydrography."
            ),
            (
                "Region is not drainage: WBD region 15 includes HU-4 1508 Sonora. Following "
                "WBD's own downstream codes (tohuc), every one of its "
                f"{trace['hu12Units']} HU-12 units stays inside 1508 and ends at "
                f"{terminals} (stats.sonoraDrainage), so none drains to the Colorado. Region 14 "
                "includes HU-6 140402 Great Divide Closed Basin. Both are inside this mask "
                "because they are part of the WBD regions. Cells: "
                f"Sonora {sum(h['cells'] for h in sonora)}, Great Divide Closed Basin "
                f"{sum(h['cells'] for h in great_divide)} (see stats.hu6). Land along the west "
                "edge between about 32.5° and 35.1° N is WBD region 18 (California) and is "
                "outside the mask."
            ),
            (
                "Study-area edges: parts of both regions lie outside the bbox, so the mask covers "
                "only the part of each region inside the rectangle (stats.hu6.inStudyAreaPct; "
                f"for example Colorado Headwaters {pct('140100')}% and Upper Green "
                f"{pct('140401')}%)."
            ),
            (
                "Resolution: the mask is per 0.025° cell (about 2.2 km x 2.8 km); "
                f"{stats['boundaryCells']} cells straddle the basin boundary and are decided by "
                'the half-of-pixels rule. WBD metadata: "At a minimum, the HUs are delineated '
                'at 1:24,000-scale in the conterminous United States".'
            ),
        ],
        "stats": stats,
        "reproducible": (
            "No timestamps; the same cached WBD zips and grid give the same bytes. accessDate is "
            "the date the zip was downloaded (from the cache sidecar)."
        ),
    }


def write(out_dir: Path = OUT_DIR, raw_dir: Path = RAW_DIR, log=log) -> dict:
    meta_path = out_dir / "meta.json"
    grid_meta = json.loads(meta_path.read_text(encoding="utf-8"))
    res = compute(
        raw_dir, log, probe=(grid_meta["min"]["lat"], grid_meta["min"]["lon"])
    )
    basin, lower = res["basin"], res["lower"]
    if basin.shape != (grid_meta["height"], grid_meta["width"]):
        raise RuntimeError(f"mask {basin.shape} differs from grid {grid_meta['height']} x "
                           f"{grid_meta['width']}")  # fmt: skip
    mask_bytes = pack_planes(basin, lower)
    if len(mask_bytes) > MAX_MASK_BYTES:
        raise RuntimeError(f"{MASK_FILE} is {len(mask_bytes)} B > 50 KB")
    mmeta = build_meta(res, grid_meta, mask_bytes)
    mjson = (json.dumps(mmeta, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    (out_dir / MASK_FILE).write_bytes(mask_bytes)
    (out_dir / MASK_META_FILE).write_bytes(mjson)

    grid_meta["basinMask"] = {
        "file": MASK_FILE,
        "metaFile": MASK_META_FILE,
        "format": FORMAT["name"],
        "source": "USGS Watershed Boundary Dataset HU-2 regions 14 and 15, including WBD's "
        "harmonized units in Mexico (see basin-mask.json coverage)",
        "credit": CREDIT_LINE,
        "basinCells": mmeta["stats"]["basinCells"],
    }
    grid_meta["files"][MASK_FILE] = {
        "bytes": len(mask_bytes),
        "sha256": hashlib.sha256(mask_bytes).hexdigest(),
    }
    grid_meta["files"][MASK_META_FILE] = {
        "bytes": len(mjson),
        "sha256": hashlib.sha256(mjson).hexdigest(),
    }
    meta_path.write_text(
        json.dumps(grid_meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    s = mmeta["stats"]
    log(
        f"{MASK_FILE} {len(mask_bytes)} B, {MASK_META_FILE} {len(mjson)} B; basin cells "
        f"{s['basinCells']} / {s['cells']} ({s['basinFraction']:.4f}); "
        f"area {s['basinAreaKm2']:,} of {s['studyAreaKm2']:,} km²"
    )
    for hu, r in s["regions"].items():
        log(f"HU-2 {hu}: {r}")
    return mmeta


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--raw-dir", type=Path, default=RAW_DIR, help="cache directory (wbd/ inside)"
    )
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)
    write(args.out_dir, args.raw_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
