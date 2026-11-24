"""Tests for the reference barcode (spec §6.5 steps 5–7, §10/F4b). No network needed.

They read the committed public/data/colorado/{grid.f32, meta.json, barcode.json}.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:  # local to this module; no conftest
    sys.path.insert(0, str(REPO))

from pipeline import barcode as bc
from pipeline import colorado_dem as cd
from pipeline.tda_ref import compute_h0

OUT = REPO / "public" / "data" / "colorado"


@pytest.fixture(scope="module")
def meta() -> dict:
    return json.loads((OUT / "meta.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def barcode() -> dict:
    return json.loads((OUT / "barcode.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def grid(meta) -> np.ndarray:
    return bc.read_grid(OUT / "grid.f32", meta["width"], meta["height"])


def test_reproducible_byte_identical(meta, tmp_path):
    """Two fresh runs on a copy of grid.f32 give the committed barcode.json byte for byte."""
    (tmp_path / "grid.f32").write_bytes((OUT / "grid.f32").read_bytes())
    committed = (OUT / "barcode.json").read_bytes()
    for _ in range(2):
        _, data = bc.write_barcode(tmp_path, meta["width"], meta["height"])
        assert data == committed
        assert (tmp_path / "barcode.json").read_bytes() == committed


def test_size_and_columns(barcode):
    assert (OUT / "barcode.json").stat().st_size <= 600 * 1024
    n = barcode["count"]
    for col in ("b", "d", "bi", "di", "mi"):
        assert len(barcode[col]) == n, col
    assert barcode["stats"]["exportedFinite"] + barcode["stats"]["essential"] == n


def test_metadata_matches_grid(meta, barcode):
    raw = (OUT / "grid.f32").read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert barcode["grid"]["sha256"] == sha == meta["barcode"]["gridSha256"]
    assert meta["files"]["grid.f32"]["sha256"] == sha
    assert (barcode["grid"]["width"], barcode["grid"]["height"]) == (
        meta["width"],
        meta["height"],
    )
    assert barcode["connectivity"] == meta["connectivity"] == 4
    assert barcode["tieBreak"] == meta["tieBreak"]
    assert barcode["minPersistence"] == 1.0 and barcode["units"] == "m"
    assert meta["barcode"]["count"] == barcode["count"]
    bc_bytes = (OUT / "barcode.json").read_bytes()
    assert meta["files"]["barcode.json"]["sha256"] == hashlib.sha256(bc_bytes).hexdigest()


def test_essential_bar_at_global_minimum(meta, barcode, grid):
    ess = [k for k, d in enumerate(barcode["d"]) if d is None]
    assert ess == [barcode["count"] - 1]  # exactly one, listed last
    k = ess[0]
    assert barcode["bi"][k] == meta["min"]["cell"] == int(np.argmin(grid))
    assert barcode["bi"][k] == barcode["essential"]["birthCell"]
    assert barcode["b"][k] == float(grid.ravel()[meta["min"]["cell"]])
    assert barcode["di"][k] == -1 and barcode["mi"][k] == -1


def test_finite_bars_valid(meta, barcode, grid):
    flat = grid.ravel()
    n_cells = meta["width"] * meta["height"]
    for k in range(barcode["count"] - 1):
        b, d = barcode["b"][k], barcode["d"][k]
        bi, di, mi = barcode["bi"][k], barcode["di"][k], barcode["mi"][k]
        assert d is not None
        assert 0 <= bi < n_cells and 0 <= di < n_cells and 0 <= mi < n_cells
        assert b < d and d - b >= 1.0
        # Values are exact (unrounded) float32 grid heights at the cells.
        assert b == float(flat[bi]) and d == float(flat[di])
        assert math.isfinite(b) and math.isfinite(d)


def test_matches_tda_ref(meta, barcode, grid):
    res = compute_h0(grid, connectivity=4)
    want = [b for b in res.finite if b.death - b.birth >= 1.0] + res.essential
    assert barcode["count"] == len(want)
    assert barcode["bi"] == [b.birth_cell for b in want]
    assert barcode["di"] == [b.death_cell for b in want]
    assert barcode["mi"] == [b.merged_into for b in want]
    assert barcode["stats"]["births"] == res.births
    assert barcode["stats"]["zeroLengthBars"] == len(res.zero_length)


def test_matches_tda_ref_cli(meta, barcode):
    """F3's documented CLI on the committed file gives the same columns."""
    proc = subprocess.run(
        [sys.executable, "-m", "pipeline.tda_ref", str(OUT / "grid.f32"),
         str(meta["width"]), str(meta["height"]), "--min-persistence", "1"],
        cwd=REPO, capture_output=True, text=True, check=True,
    )  # fmt: skip
    cli = json.loads(proc.stdout)
    for col in ("b", "d", "bi"):
        assert cli[col] == barcode[col], col
    assert cli["di"] == barcode["di"]


def test_lat_lon_helpers(meta):
    win = cd.native_window()
    w, h = meta["width"], meta["height"]
    for key in ("min", "max"):
        rec = meta[key]
        lat, lon = bc.cell_latlon(win, w, rec["cell"])
        assert (round(lat, 6), round(lon, 6)) == (rec["lat"], rec["lon"])
        assert bc.latlon_cell(win, w, h, lat, lon) == rec["cell"]
    assert bc.latlon_cell(win, w, h, 45.0, -110.0) == -1


def test_lake_before_death_small():
    # 1 x 7 golden grid from docs/tda.md: lake 3 spills at cell 2; just before, it is {3, 4, 5}.
    g = np.array([[10, 1, 8, 3, 6, 5, 10]], dtype=np.float32)
    order = np.lexsort((np.arange(g.size), g.ravel()))
    rank = np.empty(g.size, dtype=np.int64)
    rank[order] = np.arange(g.size)
    assert bc.lake_before_death(g, rank, 3, 2) == {3, 4, 5}
    assert bc.lake_before_death(g, rank, 5, 4) == {5}
    assert bc.lake_before_death(g, rank, 1, -1) == set(range(7))


def test_top_lakes_table(barcode):
    top = bc.top_lakes(barcode, 10)
    assert len(top) == 10 and barcode["count"] - 1 not in top
    pers = [barcode["d"][k] - barcode["b"][k] for k in top]
    assert pers == sorted(pers, reverse=True)
    table = bc.lakes_markdown(barcode, 10)
    assert table.count("\n| ") >= 10 and "Essential bar" in table
