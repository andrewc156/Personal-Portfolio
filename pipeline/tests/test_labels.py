"""Tests for the S4 place labels (pipeline/labels.py). No network needed.

Most tests read the committed public/data/colorado/labels.json. Tests that compare against the
cached USGS GNIS zips (pipeline/data/raw/gnis/, gitignored) are skipped when the cache is absent.
The source check reads the GNIS text with its own minimal parser, not pipeline.labels.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
import zipfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:  # local to this module; no conftest
    sys.path.insert(0, str(REPO))

from pipeline import colorado_dem as cd
from pipeline import labels as lb

OUT = REPO / "public" / "data" / "colorado"
GNIS_CACHE = REPO / "pipeline" / "data" / "raw" / lb.GNIS_SUBDIR
SPEC_BBOX = (
    -115.201667,
    31.817500,
    -107.060833,
    42.157500,
)  # spec §6.4, typed independently


@pytest.fixture(scope="module")
def meta() -> dict:
    return json.loads((OUT / "meta.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def raw() -> bytes:
    return (OUT / lb.LABELS_FILE).read_bytes()


@pytest.fixture(scope="module")
def doc(raw) -> dict:
    return json.loads(raw)


# --- file -------------------------------------------------------------------------------------


def test_size_and_count(raw, doc):
    assert len(raw) <= 10 * 1024
    assert doc["count"] == len(doc["labels"])
    assert 25 <= doc["count"] <= 40


def test_fields_and_values(doc):
    allowed = {"id", "name", "display", "class", "category", "priority", "lat", "lon", "x", "y",
               "anchor"}  # fmt: skip
    for lab in doc["labels"]:
        assert set(lab) <= allowed, lab
        assert {
            "id",
            "name",
            "class",
            "category",
            "priority",
            "lat",
            "lon",
            "x",
            "y",
        } <= set(lab)
        assert lab["category"] in ("peak", "water", "city", "basin", "canyon")
        assert lab["priority"] in (1, 2, 3)
        assert lab.get("display", "x") != lab["name"]  # display only when it differs
        assert ("anchor" in lab) == (lab["class"] in ("Stream", "Valley", "Arroyo"))
    # every category is used, and priority 1 has the key references
    assert {lab["category"] for lab in doc["labels"]} == set(lb.CATEGORIES)
    p1 = {lab["name"] for lab in doc["labels"] if lab["priority"] == 1}
    assert {"Colorado River", "Lake Powell", "Lake Mead", "Uncompahgre Peak",
            "Great Salt Lake Desert", "Great Divide Basin"} <= p1  # fmt: skip


def test_no_duplicates(doc):
    labs = doc["labels"]
    for key in (
        lambda d: d["id"],
        lambda d: d["name"],
        lambda d: d.get("display", d["name"]),
        lambda d: (d["x"], d["y"]),
        lambda d: (d["lat"], d["lon"]),
    ):
        vals = [key(d) for d in labs]
        assert len(vals) == len(set(vals))


def test_grid_reference(doc, meta):
    g = doc["grid"]
    grid = (OUT / "grid.f32").read_bytes()
    assert (
        g["sha256"]
        == hashlib.sha256(grid).hexdigest()
        == meta["files"]["grid.f32"]["sha256"]
    )
    assert (g["width"], g["height"], g["cellDeg"]) == (meta["width"], meta["height"],
                                                       meta["cellDeg"])  # fmt: skip
    assert g["extent"] == meta["native"]["extent"]
    assert g["pixelDeg"] == meta["native"]["pixelDeg"]


def test_meta_json_not_changed_by_labels(meta):
    assert "labels" not in meta
    assert lb.LABELS_FILE not in meta["files"]


def test_attribution(doc):
    a = doc["attribution"]
    assert a["credit"].endswith("courtesy of the U.S. Geological Survey")
    assert "Public Domain" in a["publicDomain"]
    assert a["creditSource"].startswith("https://www.usgs.gov/")


# --- bbox and grid cell -------------------------------------------------------------------------


def test_inside_bbox(doc, meta):
    w, s, e, n = SPEC_BBOX
    assert meta["bbox"] == list(SPEC_BBOX)
    for lab in doc["labels"]:
        assert w < lab["lon"] < e and s < lab["lat"] < n, lab["name"]


def test_cell_matches_latlon(doc, meta):
    """Cell from the explorer's convention: the native 3″ pixel containing the point, // 30."""
    west, _, _, north = meta["native"]["extent"]
    px = meta["native"]["pixelDeg"]
    nw, nh = meta["native"]["width"], meta["native"]["height"]
    block = round(meta["cellDeg"] / px)
    assert block == 30
    for lab in doc["labels"]:
        fc = (lab["lon"] - west) / px
        fr = (north - lab["lat"]) / px
        # not ambiguous: at least 1e-3 px (about 0.1 m) from a native pixel edge
        assert min(fc % 1, 1 - fc % 1) > 1e-3 and min(fr % 1, 1 - fr % 1) > 1e-3, lab[
            "name"
        ]
        col, row = math.floor(fc), math.floor(fr)
        assert 0 <= col < nw and 0 <= row < nh
        assert (lab["x"], lab["y"]) == (col // block, row // block), lab["name"]
        # the cell's footprint contains the point, and its centre is within half a cell
        x0, x1 = (
            west + lab["x"] * block * px,
            west + min(nw, (lab["x"] + 1) * block) * px,
        )
        y0, y1 = (
            north - lab["y"] * block * px,
            north - min(nh, (lab["y"] + 1) * block) * px,
        )
        assert x0 <= lab["lon"] < x1 and y1 < lab["lat"] <= y0
        clat, clon = cd.block_center_lonlat(
            cd.native_window(), block, lab["y"], lab["x"]
        )
        assert abs(clat - lab["lat"]) <= meta["cellDeg"] / 2
        assert abs(clon - lab["lon"]) <= meta["cellDeg"] / 2


def test_cell_matches_barcode_landmark_rule(doc, meta):
    """Same answer as pipeline.barcode.latlon_cell, used for the lakes table landmarks."""
    from pipeline import barcode as bc

    win = cd.native_window()
    for lab in doc["labels"]:
        i = bc.latlon_cell(win, meta["width"], meta["height"], lab["lat"], lab["lon"])
        assert i == lab["y"] * meta["width"] + lab["x"], lab["name"]


# --- source match (needs the cached GNIS zips) ------------------------------------------------

needs_cache = pytest.mark.skipif(
    not all((GNIS_CACHE / f"DomesticNames_{st}_Text.zip").exists()
            for st in sorted({p.st for p in lb.SELECTION})),
    reason="GNIS cache (pipeline/data/raw/gnis/) absent; run python -m pipeline.labels",
)  # fmt: skip


def _gnis_rows(st: str) -> dict[str, list[str]]:
    """feature_id -> fields, read with a plain split on '|' (independent of pipeline.labels)."""
    with zipfile.ZipFile(GNIS_CACHE / f"DomesticNames_{st}_Text.zip") as zf:
        lines = zf.read(f"Text/DomesticNames_{st}.txt").decode("utf-8").splitlines()
    header = lines[0].lstrip("﻿").split("|")
    assert header[:3] == ["feature_id", "feature_name", "feature_class"]
    assert header[15:17] == ["prim_lat_dec", "prim_long_dec"]
    return {ln.split("|", 1)[0]: ln.split("|") for ln in lines[1:]}


@needs_cache
def test_source_files_match_cache(doc):
    files = {f["state"]: f for f in doc["source"]["files"]}
    assert set(files) == {p.st for p in lb.SELECTION}
    for st, f in files.items():
        data = (GNIS_CACHE / f"DomesticNames_{st}_Text.zip").read_bytes()
        assert hashlib.sha256(data).hexdigest() == f["sha256"]
        assert len(data) == f["bytes"]
        assert f["url"] == lb.gnis_url(st)
        assert f["pubdate"] == "20261102"


@needs_cache
def test_ids_names_coordinates_match_gnis(doc):
    by_id = {p.fid: p for p in lb.SELECTION}
    rows = {st: _gnis_rows(st) for st in {p.st for p in lb.SELECTION}}
    assert [lab["id"] for lab in doc["labels"]] == [p.fid for p in lb.SELECTION]
    for lab in doc["labels"]:
        r = rows[by_id[lab["id"]].st][str(lab["id"])]
        assert lab["name"] == r[1]
        assert lab["class"] == r[2]
        # exact: the JSON number reproduces the file's decimal string
        assert lab["lat"] == float(r[15]) and lab["lon"] == float(r[16]), lab["name"]


@needs_cache
def test_reproducible_from_cache(tmp_path, raw):
    for name in ("meta.json", "grid.f32"):
        (tmp_path / name).write_bytes((OUT / name).read_bytes())
    lb.write(tmp_path, REPO / "pipeline" / "data" / "raw", log=lambda _m: None)
    assert (tmp_path / lb.LABELS_FILE).read_bytes() == raw
