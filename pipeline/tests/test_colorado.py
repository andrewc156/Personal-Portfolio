"""Tests for the Colorado DEM outputs (spec §6.5 step 7). No network needed.

They read the committed outputs in public/data/colorado/. The grid
reproducibility test recomputes from cached raw tiles and is skipped when the
cache (gitignored) is absent.
"""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:  # local to this module; no conftest
    sys.path.insert(0, str(REPO))

from pipeline import colorado_dem as cd
from pipeline.build_colorado import LICENCE_URL, REQUIRED_NOTICE

OUT = REPO / "public" / "data" / "colorado"
RAW = REPO / "pipeline" / "data" / "raw"
SPEC_BBOX = [-115.201667, 31.817500, -107.060833, 42.157500]


@pytest.fixture(scope="module")
def meta() -> dict:
    return json.loads((OUT / "meta.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def grid(meta) -> np.ndarray:
    raw = (OUT / "grid.f32").read_bytes()
    return np.frombuffer(raw, dtype="<f4").reshape(meta["height"], meta["width"])


# --- bbox and shape --------------------------------------------------------


def test_bbox_exact(meta):
    assert meta["bbox"] == SPEC_BBOX
    assert list(cd.BBOX) == SPEC_BBOX


def test_shape(meta, grid):
    assert (meta["width"], meta["height"]) == (326, 414)
    assert meta["cells"] == 326 * 414 == 134_964
    assert grid.shape == (414, 326)
    assert meta["cellDeg"] == pytest.approx(0.025)
    assert (meta["native"]["width"], meta["native"]["height"]) == (9769, 12408)


def test_native_window_math():
    win = cd.native_window()
    assert (win.width, win.height) == (9769, 12408)
    assert all(abs(r) < 1e-3 for r in win.residuals_px.values())
    assert len(cd.tiles_for_window(win)) == 108
    assert -(-win.width // cd.BLOCK) == 326 and -(-win.height // cd.BLOCK) == 414


def test_derived_values(meta):
    d = meta["derived"]
    assert d["spanDeg"] == {"lon": 8.140834, "lat": 10.34}
    assert 715 < d["spanKm"]["eastWestAtCenterLat"] < 735
    assert 1140 < d["spanKm"]["northSouth"] < 1155
    assert d["displayAspect"] == pytest.approx(0.63, abs=0.005)


# --- values ----------------------------------------------------------------


def test_no_nan(grid):
    assert np.isfinite(grid).all()


def test_plausible_min_max(meta, grid):
    assert -100.0 < float(grid.min()) < 100.0  # near sea level, south-west
    assert 3000.0 < float(grid.max()) < 4400.0  # block minima sit below peaks
    raw = meta["native"]
    assert 4000.0 < raw["rawMax"]["value"] < 4500.0
    assert raw["rawMin"]["value"] == pytest.approx(float(grid.min()), abs=1e-3)


def test_global_min_in_south_west(meta, grid):
    i = int(np.argmin(grid))  # first index among ties = smallest (h, i)
    y, x = divmod(i, meta["width"])
    assert meta["min"]["cell"] == i
    assert y > 0.75 * meta["height"] and x < 0.25 * meta["width"]
    assert meta["min"]["lat"] < 33.5 and meta["min"]["lon"] < -113.5


def test_min_max_records(meta, grid):
    for key in ("min", "max"):
        rec = meta[key]
        assert rec["cell"] == rec["y"] * meta["width"] + rec["x"]
        assert grid[rec["y"], rec["x"]] == pytest.approx(rec["value"], abs=1e-3)
    assert meta["max"]["value"] == pytest.approx(float(grid.max()), abs=1e-3)


# --- byte layout (what the JS loader does: new Float32Array(buf), LE) -------


def test_byte_layout(meta, grid):
    raw = (OUT / "grid.f32").read_bytes()
    w, h = meta["width"], meta["height"]
    assert len(raw) == w * h * 4
    for i in (0, 1, w - 1, w, meta["min"]["cell"], meta["max"]["cell"], w * h - 1):
        (v,) = struct.unpack_from("<f", raw, 4 * i)
        assert v == grid[i // w, i % w]
    assert hashlib.sha256(raw).hexdigest() == meta["files"]["grid.f32"]["sha256"]
    assert meta["rowOrder"].startswith("row 0 is north")
    assert "little-endian" in meta["dtype"]


def test_north_row_first(meta):
    # Cell latitude decreases with y (row 0 north) and matches the documented formula.
    n_edge = meta["native"]["extent"][3]
    w_edge = meta["native"]["extent"][0]
    for key in ("min", "max"):
        rec = meta[key]
        if rec["y"] < meta["height"] - 1:
            assert rec["lat"] == pytest.approx(
                n_edge - (rec["y"] + 0.5) * 0.025, abs=1e-6
            )
        if rec["x"] < meta["width"] - 1:
            assert rec["lon"] == pytest.approx(
                w_edge + (rec["x"] + 0.5) * 0.025, abs=1e-6
            )
    assert meta["min"]["y"] > meta["height"] // 2


# --- block reductions --------------------------------------------------------


def test_block_min_partial_edges():
    a = np.arange(7 * 5, dtype=np.float32).reshape(7, 5)
    m = cd.block_min(a, 3)
    assert m.shape == (3, 2)
    assert m[0, 0] == 0 and m[0, 1] == 3 and m[2, 0] == 30 and m[2, 1] == 33


def test_block_mean_partial_edges():
    a = np.arange(7 * 5, dtype=np.float32).reshape(7, 5)
    m = cd.block_mean(a, 3)
    assert m.shape == (3, 2)
    assert m[2, 1] == pytest.approx((33 + 34) / 2)
    assert m[0, 0] == pytest.approx(np.mean(a[:3, :3]))


# --- other outputs -------------------------------------------------------------


def test_sizes():
    assert (OUT / "grid.f32").stat().st_size <= 600 * 1024
    assert (OUT / "hillshade.webp").stat().st_size <= 600 * 1024


def test_hillshade(meta):
    from PIL import Image

    with Image.open(OUT / "hillshade.webp") as img:
        assert img.format == "WEBP"
        assert img.size == (977, 1241)
        assert (meta["hillshade"]["width"], meta["hillshade"]["height"]) == img.size


def test_attribution():
    text = (OUT / "ATTRIBUTION.md").read_text(encoding="utf-8")
    assert REQUIRED_NOTICE in text
    assert LICENCE_URL in text
    assert "Digital Surface Model" in text


def test_meta_fields(meta):
    for key in (
        "bbox", "width", "height", "cellDeg", "rowOrder", "min", "max", "crs",
        "verticalDatum", "source", "licence", "processing", "connectivity",
        "tieBreak", "generatedAt", "gitCommit",
    ):  # fmt: skip
        assert key in meta, key
    assert meta["crs"] == "EPSG:4326"
    assert meta["connectivity"] == 4
    assert meta["source"]["tiles"]["requested"] == 108
    for rec in meta["source"]["tiles"]["missing"]:
        assert rec["reason"].startswith("all-ocean")


# --- reproducibility -------------------------------------------------------------


def _cache_complete() -> bool:
    win = cd.native_window()
    return all(
        (RAW / f"{cd.tile_name(la, lo)}.tif").exists()
        for la, lo in cd.tiles_for_window(win)
    )


@pytest.mark.skipif(
    not _cache_complete(), reason="raw tile cache not present (gitignored)"
)
def test_grid_reproducible_from_cache(meta):
    ocean = [(r["lat"], r["lonW"]) for r in meta["source"]["tiles"]["missing"]]
    _, grid, _ = cd.compute_grid(RAW, ocean)
    assert grid.tobytes() == (OUT / "grid.f32").read_bytes()
