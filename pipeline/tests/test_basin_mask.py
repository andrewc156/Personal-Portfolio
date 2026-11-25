"""Tests for the S3 basin mask (pipeline/basin_mask.py). No network needed.

Most tests read the committed outputs in public/data/colorado/. Tests that recompute from the
cached USGS WBD zips (pipeline/data/raw/wbd/, gitignored) are skipped when the cache is absent.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:  # local to this module; no conftest
    sys.path.insert(0, str(REPO))

from pipeline import basin_mask as bm
from pipeline import colorado_dem as cd

OUT = REPO / "public" / "data" / "colorado"
WBD_CACHE = REPO / "pipeline" / "data" / "raw" / bm.WBD_SUBDIR

# Sanity points: primary feature coordinates (prim_lat_dec, prim_long_dec, NAD 83) from the USGS
# Geographic Names Information System (GNIS) Domestic Names state files, published 2026-11-02:
#   https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip
# (name, GNIS feature_id, state file, lat, lon, expected): expected is "14", "15" or None (outside).
# GNIS Domestic Names has no record named "Hoover Dam", so the Lake Mead reservoir record is used.
GNIS_POINTS = [
    ("Uncompahgre Peak", 188678, "CO", 38.0714529, -107.4625289, "14"),
    ("Grand Junction", 204662, "CO", 39.0638705, -108.5506486, "14"),
    ("Moab", 1430389, "UT", 38.5733155, -109.5498395, "14"),
    ("Lake Mead", 7862, "NV", 36.1725406, -114.4298448, "15"),
    ("Las Vegas", 847388, "NV", 36.1749705, -115.137223, "15"),
    ("Phoenix", 44784, "AZ", 33.4483771, -112.0740373, "15"),
    ("Flagstaff", 29046, "AZ", 35.1980671, -111.6512725, "15"),
    ("Salt Lake City", 1454997, "UT", 40.7607794, -111.8910474, None),
    ("Great Salt Lake", 1441459, "UT", 41.1628677, -112.5353656, None),
    ("Ely", 859671, "NV", 39.2474393, -114.8886296, None),
    ("Denver", 201738, "CO", 39.7391536, -104.9847034, None),
    ("Albuquerque", 928679, "NM", 35.0844909, -106.6511367, None),
]
# Outside the study-area bbox, so they cannot be on the grid at all.
OFF_GRID = {"Denver", "Albuquerque"}


@pytest.fixture(scope="module")
def meta() -> dict:
    return json.loads((OUT / "meta.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def mmeta() -> dict:
    return json.loads((OUT / bm.MASK_META_FILE).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def planes(meta):
    data = (OUT / bm.MASK_FILE).read_bytes()
    return bm.unpack_planes(data, meta["width"], meta["height"])


def cell_of(meta: dict, lat: float, lon: float) -> tuple[int, int] | None:
    """Grid cell (x, y) whose native-pixel footprint contains (lat, lon), or None."""
    w, _, _, n = meta["native"]["extent"]
    x = math.floor((lon - w) / meta["cellDeg"])
    y = math.floor((n - lat) / meta["cellDeg"])
    if 0 <= x < meta["width"] and 0 <= y < meta["height"]:
        return x, y
    return None


# --- format and grid alignment --------------------------------------------------------


def test_files_size_and_hashes(meta, mmeta):
    data = (OUT / bm.MASK_FILE).read_bytes()
    plane = (meta["cells"] + 7) // 8
    assert len(data) == 2 * plane == 33_742
    assert len(data) <= 50 * 1024
    assert mmeta["format"]["planeBytes"] == plane
    assert mmeta["format"]["bytes"] == len(data)
    assert meta["files"][bm.MASK_FILE] == {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    mj = (OUT / bm.MASK_META_FILE).read_bytes()
    assert meta["files"][bm.MASK_META_FILE]["sha256"] == hashlib.sha256(mj).hexdigest()
    assert meta["basinMask"]["file"] == bm.MASK_FILE
    assert meta["basinMask"]["metaFile"] == bm.MASK_META_FILE


def test_dims_equal_grid(meta, mmeta, planes):
    basin, lower = planes
    assert basin.shape == lower.shape == (meta["height"], meta["width"]) == (414, 326)
    g = mmeta["grid"]
    for key in ("bbox", "width", "height", "cells", "cellDeg", "rowOrder"):
        assert g[key] == meta[key], key
    assert g["extent"] == meta["native"]["extent"]
    assert g["sha256"] == meta["files"]["grid.f32"]["sha256"]
    raw = (OUT / "grid.f32").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == g["sha256"]
    assert len(raw) == 4 * g["cells"]
    assert (g["native"]["width"], g["native"]["height"]) == (9769, 12408)


def test_planes_consistent(planes, mmeta, meta):
    basin, lower = planes
    assert not (lower & ~basin).any()  # region-15 bits only inside the basin
    s = mmeta["stats"]
    assert int(basin.sum()) == s["basinCells"] == meta["basinMask"]["basinCells"]
    assert int(lower.sum()) == s["regions"]["15"]["cells"]
    assert int((basin & ~lower).sum()) == s["regions"]["14"]["cells"]
    assert sum(h["cells"] for h in s["hu6"]) == s["basinCells"]
    assert s["overlapPixels14and15"] == 0


def test_bit_order_matches_js_formula(planes, meta):
    """bit i = (byte[i >> 3] >> (i & 7)) & 1 with i = y * width + x, row 0 north."""
    basin, lower = planes
    data = (OUT / bm.MASK_FILE).read_bytes()
    plane = (meta["cells"] + 7) // 8
    rng = np.random.default_rng(0)
    for i in rng.integers(0, meta["cells"], 500):
        y, x = divmod(int(i), meta["width"])
        assert ((data[i >> 3] >> (i & 7)) & 1) == basin[y, x]
        assert ((data[plane + (i >> 3)] >> (i & 7)) & 1) == lower[y, x]


# --- sanity points (USGS GNIS) --------------------------------------------------------


@pytest.mark.parametrize("name,fid,st,lat,lon,expected", GNIS_POINTS)
def test_gnis_sanity_points(meta, planes, name, fid, st, lat, lon, expected):
    basin, lower = planes
    c = cell_of(meta, lat, lon)
    if name in OFF_GRID:
        w, s, e, n = meta["bbox"]
        assert not (w <= lon <= e and s <= lat <= n)
        assert c is None  # off the grid, so it cannot be in the mask
        assert expected is None
        return
    assert c is not None, name
    x, y = c
    if expected is None:
        assert not basin[y, x], name
    else:
        assert basin[y, x], name
        assert bool(lower[y, x]) == (expected == "15"), name
    # Not a boundary coincidence: the 5 x 5 neighbourhood agrees.
    win = basin[max(0, y - 2) : y + 3, max(0, x - 2) : x + 3]
    assert (win == basin[y, x]).all(), name


def test_grid_minimum_cell_in_mask(meta, planes, mmeta):
    """WBD region 15 reaches the delta in Mexico; the lowest grid cell is in it (docs/data.md)."""
    basin, lower = planes
    x, y = meta["min"]["x"], meta["min"]["y"]
    assert basin[y, x] and lower[y, x]
    hits = mmeta["stats"]["mexicoOnlyHu12"]["gridMinimumCell"]["inMexicoOnlyHu12"]
    assert [h["huc12"] for h in hits] == ["150301080302"]


# --- plausibility ---------------------------------------------------------------------


def test_fraction_plausible(mmeta, planes, meta):
    basin, _ = planes
    s = mmeta["stats"]
    frac = basin.mean()
    assert s["basinFraction"] == pytest.approx(frac, abs=1e-6)
    assert 0.6 < frac < 0.85
    # In-bbox basin area cannot exceed the WBD areas of both regions, and it is most of them.
    total = sum(r["wbdAreaKm2"] for r in s["regions"].values())
    assert s["basinAreaKm2"] < total
    assert 0.75 < s["basinAreaKm2"] / total < 0.95
    # Majority-rule cells reproduce the pixel-level union area to within 0.5 %.
    assert s["basinAreaKm2"] == pytest.approx(s["pixelUnionAreaKm2"], rel=5e-3)
    # The rasterized full-region polygons reproduce WBD's areasqkm attribute.
    for r in s["regions"].values():
        assert abs(r["rasterizedVsWbdPct"]) < 0.1
    # Study area: the bbox footprint on the ellipsoid.
    assert s["studyAreaKm2"] == pytest.approx(830_000, rel=0.01)


# --- metadata, attribution, docs ------------------------------------------------------


def test_metadata_sources_and_attribution(mmeta):
    src = mmeta["source"]
    assert [r["huc2"] for r in src["regions"]] == ["14", "15"]
    for r in src["regions"]:
        assert r["url"] == bm.wbd_url(r["huc2"])
        assert r["url"].startswith("https://prd-tnm.s3.amazonaws.com/StagedProducts/")
        assert len(r["pubdate"]) == 8 and r["pubdate"].isdigit()
        assert r["pubdate"] in r["title"]
        assert len(r["sha256"]) == 64
        assert len(r["accessDate"]) == 10
    att = mmeta["attribution"]
    assert att["credit"] == bm.CREDIT_LINE
    assert att["publicDomain"] == bm.PUBLIC_DOMAIN_STATEMENT
    assert att["creditSource"] == bm.USGS_CREDIT_PAGE
    cov = " ".join(mmeta["coverage"])
    assert "Mexico" in cov and "INEGI" in cov and "1508" in cov


def test_docs_mention_mask():
    text = (REPO / "docs" / "data.md").read_text(encoding="utf-8")
    assert bm.CREDIT_LINE in text
    assert bm.PUBLIC_DOMAIN_STATEMENT in text
    assert bm.USGS_CREDIT_PAGE in text
    assert "basin-mask.bin" in text and "Mexico" in text
    for hu in bm.REGIONS:
        assert bm.wbd_url(hu) in text


# --- unit tests of the helpers (synthetic inputs) ----------------------------------------


def test_pack_unpack_roundtrip():
    rng = np.random.default_rng(1)
    basin = rng.random((5, 7)) < 0.5
    lower = basin & (rng.random((5, 7)) < 0.5)
    data = bm.pack_planes(basin, lower)
    assert len(data) == 2 * 5  # ceil(35 / 8) = 5 bytes per plane
    b2, l2 = bm.unpack_planes(data, 7, 5)
    assert (b2 == basin).all() and (l2 == lower).all()
    # cell 0 is the least significant bit of byte 0
    one = np.zeros((1, 9), bool)
    one[0, 0] = True
    assert bm.pack_planes(one, np.zeros_like(one))[:2] == b"\x01\x00"


def test_unpack_rejects_bad_padding():
    data = bytearray(bm.pack_planes(np.zeros((1, 9), bool), np.zeros((1, 9), bool)))
    data[1] |= 0x80
    with pytest.raises(ValueError):
        bm.unpack_planes(bytes(data), 9, 1)


def test_block_counts_partial_edges():
    a = np.ones((7, 5), dtype=np.uint8)
    c = bm.block_counts(a, 3)
    assert c.tolist() == [[9, 6], [9, 6], [3, 2]]
    win = cd.native_window()
    npx = bm.block_sizes(win, cd.BLOCK)
    assert npx.shape == (414, 326)
    assert npx[0, 0] == 900 and npx[-1, -1] == 18 * 19
    assert int(npx.sum()) == win.width * win.height


def test_cell_rule_half_and_tie():
    npx = np.array([[900, 900, 900, 342]], dtype=np.uint32)
    cu = np.array([[450, 449, 900, 171]], dtype=np.uint32)
    c14 = np.array([[450, 449, 450, 100]], dtype=np.uint32)
    c15 = np.array([[0, 0, 450, 71]], dtype=np.uint32)
    basin, lower = bm.cell_planes(c14, c15, cu, npx)
    assert basin.tolist() == [[True, False, True, True]]
    assert lower.tolist() == [[False, False, False, False]]  # tie 450/450 -> 14


def _shp_polygon(rings: list[list[tuple[float, float]]]) -> bytes:
    pts = [p for r in rings for p in r]
    parts, k = [], 0
    for r in rings:
        parts.append(k)
        k += len(r)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    content = struct.pack(
        "<i4d2i", 5, min(xs), min(ys), max(xs), max(ys), len(rings), len(pts)
    )
    content += struct.pack(f"<{len(parts)}i", *parts)
    content += b"".join(struct.pack("<2d", *p) for p in pts)
    rec = struct.pack(">2i", 1, len(content) // 2) + content
    total = 100 + len(rec)
    header = struct.pack(">7i", 9994, 0, 0, 0, 0, 0, total // 2)
    header += struct.pack(
        "<2i4d4d", 1000, 5, min(xs), min(ys), max(xs), max(ys), 0, 0, 0, 0
    )
    return header + rec


def test_read_polygons_and_even_odd():
    outer = [(0.0, 0.0), (0.0, 4.0), (4.0, 4.0), (4.0, 0.0), (0.0, 0.0)]  # clockwise
    hole = [(1.0, 1.0), (3.0, 1.0), (3.0, 3.0), (1.0, 3.0), (1.0, 1.0)]
    recs = bm.read_polygons(_shp_polygon([outer, hole]))
    assert len(recs) == 1 and len(recs[0]) == 2
    assert bm.ring_signed_area(recs[0][0]) == -16.0
    assert bm.point_in_rings(recs[0], 0.5, 0.5)
    assert not bm.point_in_rings(recs[0], 2.0, 2.0)  # in the hole
    assert not bm.point_in_rings(recs[0], 5.0, 2.0)


def test_read_dbf():
    fields = [(b"huc2", 2), (b"name", 8)]
    rec_len = 1 + sum(n for _, n in fields)
    header_len = 32 + 32 * len(fields) + 1
    head = struct.pack("<B3BIHH20x", 3, 25, 1, 1, 2, header_len, rec_len)
    desc = b"".join(
        n.ljust(11, b"\0") + b"C" + b"\0" * 4 + bytes([ln]) + b"\0" * 15
        for n, ln in fields
    )
    body = b" 14Upper   " + b"*15Deleted "
    rows = bm.read_dbf(head + desc + b"\r" + body + b"\x1a")
    assert rows == [{"huc2": "14", "name": "Upper"}]


def test_band_area_matches_numerical_integral():
    """Closed-form ellipsoidal band area vs a numerical integral of the area element."""
    e2 = bm.GRS80_F * (2 - bm.GRS80_F)
    phi = np.radians(np.linspace(31.0, 43.0, 200_001))
    dA = bm.GRS80_A**2 * (1 - e2) * np.cos(phi) / (1 - e2 * np.sin(phi) ** 2) ** 2
    numeric = np.trapezoid(dA, phi) * np.radians(8.0) / 1e6
    closed = float(bm.band_area_km2(43.0, 31.0, 8.0))
    assert closed == pytest.approx(numeric, rel=1e-9)


# --- recomputation from the cached WBD zips (skipped without the cache) -----------------------

needs_cache = pytest.mark.skipif(
    not all((WBD_CACHE / f"WBD_{hu}_HU2_Shape.zip").exists() for hu in bm.REGIONS),
    reason="WBD zips not cached (run python -m pipeline.basin_mask)",
)


@pytest.fixture(scope="module")
def recomputed(meta):
    return bm.compute(
        REPO / "pipeline" / "data" / "raw",
        log=lambda _m: None,
        probe=(meta["min"]["lat"], meta["min"]["lon"]),
    )


@needs_cache
def test_reproducible_from_cache(recomputed, meta):
    data = bm.pack_planes(recomputed["basin"], recomputed["lower"])
    assert data == (OUT / bm.MASK_FILE).read_bytes()
    mj = bm.build_meta(recomputed, meta, data)
    text = (json.dumps(mj, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    assert text == (OUT / bm.MASK_META_FILE).read_bytes()


@needs_cache
def test_alignment_against_independent_point_in_polygon(recomputed, planes):
    """Cell-centre even-odd test (no GDAL) agrees with the mask except at boundary cells, and
    any one-cell shift of the mask agrees much worse: the mask sits on the grid, not beside it."""
    basin, _ = planes
    win = recomputed["win"]
    lat, lon = bm.centres(win, cd.BLOCK)
    rings = recomputed["wbd"]["14"]["rings"] + recomputed["wbd"]["15"]["rings"]
    inside = bm.scanline_inside(
        recomputed["wbd"]["14"]["rings"], lat, lon
    ) | bm.scanline_inside(recomputed["wbd"]["15"]["rings"], lat, lon)
    assert len(rings) == 2
    d0 = int((inside != basin).sum())
    assert d0 < 0.01 * basin.size
    # Every disagreement is a boundary cell: its 3 x 3 neighbourhood holds both values.
    pad = np.pad(basin, 1, mode="edge")
    for y, x in zip(*np.nonzero(inside != basin)):
        nb = pad[y : y + 3, x : x + 3]
        assert nb.any() and not nb.all()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                shifted = np.roll(np.roll(basin, dy, axis=0), dx, axis=1)
                core = (slice(2, -2), slice(2, -2))
                assert int((inside[core] != shifted[core]).sum()) > 2 * d0


@needs_cache
def test_points_against_source_polygons(recomputed):
    wbd = recomputed["wbd"]
    for name, _, _, lat, lon, expected in GNIS_POINTS:
        got = [hu for hu in bm.REGIONS if bm.point_in_rings(wbd[hu]["rings"], lat, lon)]
        assert got == ([expected] if expected else []), name


@needs_cache
def test_cache_sidecars(recomputed, mmeta):
    for r in mmeta["source"]["regions"]:
        path = WBD_CACHE / r["url"].rsplit("/", 1)[1]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == r["sha256"]
