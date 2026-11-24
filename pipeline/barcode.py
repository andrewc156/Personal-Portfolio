"""Reference barcode of the Colorado TDA grid (spec §6.5 step 5, step 6 barcode.json, step 8).

The barcode is computed by ``pipeline.tda_ref.compute_h0`` (F3's independent reference) on the
float32 array read back from ``grid.f32`` (never an in-memory copy), with 4-connectivity and the
§6.1 tie-break. Run from the repo root:

    python -m pipeline.barcode            # rebuild barcode.json from public/data/colorado/grid.f32
    python -m pipeline.barcode --lakes    # print the docs/data.md lakes table (markdown)

``npm run data`` (pipeline.build_colorado) calls ``write_barcode`` after writing grid.f32.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from pipeline import colorado_dem as cd
from pipeline.tda_ref import Bar, H0Result, compute_h0

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "public" / "data" / "colorado"

CONNECTIVITY = 4
MIN_PERSISTENCE = 1.0  # metres
TIE_BREAK = "i precedes j iff (h[i], i) < (h[j], j) lexicographically"
MAX_BYTES = 600 * 1024

FORMAT_NOTE = (
    "Columnar: bar k is (b[k], d[k], bi[k], di[k], mi[k]). b = birth height (m) = h[bi], "
    "d = death height (m) = h[di], null for the essential bar. bi = birth cell (the lake's pit, "
    "its id), di = death cell (the pass where it spills), mi = mergedInto, the birth cell of the "
    "older lake that absorbs it (elder rule). di = mi = -1 for the essential bar. Cells are "
    "indices into grid.f32, i = y * width + x, row 0 north. Values are NOT rounded: each b and d "
    "is the exact float32 grid value written as the shortest decimal that parses to the same "
    "double, so b[k] === heights[bi[k]] and d[k] === heights[di[k]] for a Float32Array of "
    "grid.f32. Bars are in sweep order (by the (h, i) rank of the death cell; several deaths at "
    "one cell oldest-first), with the essential bar last, exactly as pipeline/tda_ref.py and "
    "src/lib/tda emit them."
)


def read_grid(path: Path, width: int, height: int) -> np.ndarray:
    """grid.f32 as an (H, W) float32 array (little-endian, row-major, north row first)."""
    data = np.fromfile(path, dtype="<f4")
    if data.size != width * height:
        raise ValueError(f"{path} has {data.size} values, expected {width * height}")
    return data.reshape(height, width)


def exported_bars(res: H0Result, min_persistence: float = MIN_PERSISTENCE) -> list[Bar]:
    """Finite bars with death - birth >= min_persistence (sweep order), then the essential bar."""
    bars = [b for b in res.finite if b.death - b.birth >= min_persistence]
    return bars + list(res.essential)


def build_barcode(grid_path: Path, width: int, height: int) -> tuple[dict, H0Result]:
    raw = grid_path.read_bytes()
    grid = read_grid(grid_path, width, height)
    res = compute_h0(grid, connectivity=CONNECTIVITY)
    if len(res.essential) != 1:
        raise RuntimeError(f"expected one essential bar, got {len(res.essential)}")
    bars = exported_bars(res)
    finite = [b for b in bars if not b.essential]
    positive = [b for b in res.finite if b.death > b.birth]
    doc = {
        "format": "rising-water barcode v1",
        "description": FORMAT_NOTE,
        "units": "m",
        "connectivity": CONNECTIVITY,
        "tieBreak": TIE_BREAK,
        "minPersistence": MIN_PERSISTENCE,
        "persistenceRule": "death - birth >= minPersistence, computed in float64 from the float32 heights",
        "rounding": "none (exact float32 values)",
        "order": "sweep order, essential bar last",
        "grid": {
            "file": "grid.f32",
            "width": width,
            "height": height,
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        },
        "engine": "pipeline/tda_ref.py compute_h0",
        "count": len(bars),
        "stats": {
            "cells": width * height,
            "births": res.births,
            "finiteBars": len(res.finite),
            "positiveBars": len(positive),
            "zeroLengthBars": len(res.finite) - len(positive),
            "exportedFinite": len(finite),
            "positiveBelowThreshold": len(positive) - len(finite),
            "essential": len(res.essential),
        },
        "essential": {
            "birthCell": res.essential[0].birth_cell,
            "birth": res.essential[0].birth,
        },
        "b": [float(b.birth) for b in bars],
        "d": [None if b.essential else float(b.death) for b in bars],
        "bi": [int(b.birth_cell) for b in bars],
        "di": [int(b.death_cell) for b in bars],
        "mi": [int(b.merged_into) for b in bars],
    }
    return doc, res


def encode(doc: dict) -> bytes:
    """Deterministic JSON: metadata indented, each column on one line."""
    cols = ("b", "d", "bi", "di", "mi")
    head = {k: v for k, v in doc.items() if k not in cols}
    lines = json.dumps(head, indent=2, ensure_ascii=False).rstrip("}").rstrip()
    parts = [lines + ","]
    for n, k in enumerate(cols):
        sep = "," if n < len(cols) - 1 else ""
        parts.append(
            f'  "{k}": {json.dumps(doc[k], separators=(",", ":"), allow_nan=False)}{sep}'
        )
    parts.append("}")
    return ("\n".join(parts) + "\n").encode("utf-8")


def write_barcode(out_dir: Path, width: int, height: int) -> tuple[dict, bytes]:
    doc, _ = build_barcode(out_dir / "grid.f32", width, height)
    data = encode(doc)
    if len(data) > MAX_BYTES:
        raise RuntimeError(f"barcode.json is {len(data)} bytes > 600 KB")
    (out_dir / "barcode.json").write_bytes(data)
    return doc, data


# --- lakes table (docs/data.md) ---------------------------------------------------


def cell_latlon(win: cd.NativeWindow, width: int, cell: int) -> tuple[float, float]:
    y, x = divmod(int(cell), width)
    return cd.block_center_lonlat(win, cd.BLOCK, y, x)


def top_lakes(doc: dict, n: int = 10) -> list[int]:
    """Indices of the n finite bars with the largest persistence (ties: earlier in sweep order)."""
    finite = [k for k, d in enumerate(doc["d"]) if d is not None]
    return sorted(finite, key=lambda k: (-(doc["d"][k] - doc["b"][k]), k))[:n]


def _fmt_ll(lat: float, lon: float) -> str:
    return f"{lat:.4f}° N, {-lon:.4f}° W"


def lakes_markdown(doc: dict, n: int = 10) -> str:
    win = cd.native_window()
    w = doc["grid"]["width"]
    rows = [
        (
            "| # | Persistence (m) | Birth (m) | Birth cell | Birth lat, lon | Death (m) "
            "| Death cell | Death lat, lon | Merges into lake (birth cell) |"
        ),
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for rank, k in enumerate(top_lakes(doc, n), start=1):
        b, d, bi, di, mi = (doc[c][k] for c in ("b", "d", "bi", "di", "mi"))
        rows.append(
            f"| {rank} | {d - b:.1f} | {b:.1f} | {bi} | {_fmt_ll(*cell_latlon(win, w, bi))} "
            f"| {d:.1f} | {di} | {_fmt_ll(*cell_latlon(win, w, di))} | {mi} |"
        )
    e = doc["essential"]
    rows.append("")
    rows.append(
        f"Essential bar (never dies): born at {e['birth']:.3f} m in cell {e['birthCell']} "
        f"({_fmt_ll(*cell_latlon(win, w, e['birthCell']))})."
    )
    s = doc["stats"]
    rows.append(
        f"Exported bars: {doc['count']} ({s['exportedFinite']} finite with persistence ≥ "
        f"{doc['minPersistence']:g} m + {s['essential']} essential), of {s['births']} births "
        f"({s['positiveBars']} positive finite bars, {s['zeroLengthBars']} zero-length). "
        f"Grid SHA-256 {doc['grid']['sha256']}."
    )
    return "\n".join(rows)


# --- geography check (docs/data.md) --------------------------------------------------

# Published reference points, each with the page its coordinates were read from (checked 2026-11-24).
LANDMARKS = (
    ("Great Salt Lake Desert", 40.7, -113.6, "https://en.wikipedia.org/wiki/Great_Salt_Lake_Desert"),
    ("Great Salt Lake", 41.167, -112.533, "https://en.wikipedia.org/wiki/Great_Salt_Lake"),
    ("Bingham Canyon Mine", 40.523, -112.151, "https://en.wikipedia.org/wiki/Bingham_Canyon_Mine"),
    ("Ray Mine", 33.14944, -110.98722, "https://en.wikipedia.org/wiki/Ray_Mine"),
    ("Sierrita mine", 31.87389, -111.13389, "https://en.wikipedia.org/wiki/Sierrita_mine"),
    ("Great Divide Basin", 42.00028, -107.98389, "https://en.wikipedia.org/wiki/Great_Divide_Basin"),
    ("Wamsutter, WY (in the Great Divide Basin)", 41.66806, -107.97917,
     "https://en.wikipedia.org/wiki/Wamsutter,_Wyoming"),
)  # fmt: skip


NEAR_KM = 25.0


def latlon_cell(
    win: cd.NativeWindow, width: int, height: int, lat: float, lon: float
) -> int:
    """Grid cell whose native pixels contain (lat, lon); -1 outside the rectangle."""
    col = round(lon * cd.PX_PER_DEG) - win.k0
    row = win.m_north - round(lat * cd.PX_PER_DEG)
    if not (0 <= col < win.width and 0 <= row < win.height):
        return -1
    return (row // cd.BLOCK) * width + col // cd.BLOCK


def km_between(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance (spherical, R = 6371 km) between two (lat, lon) points."""
    p1, p2 = np.radians(a[0]), np.radians(b[0])
    dl = np.radians(b[1] - a[1])
    c = np.sin(p1) * np.sin(p2) + np.cos(p1) * np.cos(p2) * np.cos(dl)
    return float(6371.0 * np.arccos(min(1.0, max(-1.0, c))))


def lake_before_death(grid: np.ndarray, rank: np.ndarray, bi: int, di: int) -> set[int]:
    """Cells of lake bi just before it spills at di: the 4-connected component of bi in
    {j : (h[j], j) precedes (h[di], di)}. di = -1 means the whole grid (essential lake)."""
    height, width = grid.shape
    limit = rank[di] if di >= 0 else rank.size
    seen = {bi}
    stack = [bi]
    while stack:
        i = stack.pop()
        y, x = divmod(i, width)
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < height and 0 <= xx < width:
                j = yy * width + xx
                if j not in seen and rank[j] < limit:
                    seen.add(j)
                    stack.append(j)
    return seen


def geography_markdown(doc: dict, grid: np.ndarray, n: int = 10) -> str:
    win = cd.native_window()
    height, width = grid.shape
    order = np.lexsort((np.arange(grid.size), grid.ravel()))
    rank = np.empty(grid.size, dtype=np.int64)
    rank[order] = np.arange(grid.size)
    marks = [(name, lat, lon, url, latlon_cell(win, width, height, lat, lon))
             for name, lat, lon, url in LANDMARKS]  # fmt: skip
    edge = {"x0": "west edge", f"x{width - 1}": "east edge", "y0": "north edge",
            f"y{height - 1}": "south edge"}  # fmt: skip
    out = [
        (
            f"| # | Birth cell on the rectangle edge? | Nearest landmark within {NEAR_KM:g} km of "
            "the birth cell (km) | Landmarks inside the lake just before it spills |"
        ),
        "|---|---|---|---|",
    ]
    for rnk, k in enumerate(top_lakes(doc, n), start=1):
        bi, di = doc["bi"][k], doc["di"][k]
        y, x = divmod(bi, width)
        on_edge = [v for key, v in edge.items() if key in (f"x{x}", f"y{y}")]
        ll = cell_latlon(win, width, bi)
        near = min(marks, key=lambda m: km_between(ll, (m[1], m[2])))
        near_km = km_between(ll, (near[1], near[2]))
        near_txt = f"{near[0]} ({near_km:.1f})" if near_km <= NEAR_KM else "-"
        lake = lake_before_death(grid, rank, bi, di)
        inside = [m[0] for m in marks if m[4] in lake]
        out.append(
            f"| {rnk} | {', '.join(on_edge) or 'no'} | {near_txt} "
            f"| {', '.join(inside) or '-'} ({len(lake)} cells) |"
        )
    out.append("")
    out.append(
        "Longest-lived exported lake whose extent just before it spills contains each landmark:"
    )
    out.append("")
    out.append("| Landmark (source) | Lat, lon | Cell | Lake (birth cell) | Rank | Persistence (m) "
               "| Birth (m) | Death (m) | Birth lat, lon | Lake cells |")  # fmt: skip
    out.append("|---|---|---|---|---|---|---|---|---|---|")
    ranked = top_lakes(doc, doc["count"])
    for name, lat, lon, url, cell in marks:
        hit = None
        for rnk, k in enumerate(ranked, start=1):
            # Cheap rejections first: the lake must be born no higher than the landmark cell,
            # and the landmark must be below its spill point.
            if rank[doc["bi"][k]] > rank[cell] or rank[cell] >= rank[doc["di"][k]]:
                continue
            lake = lake_before_death(grid, rank, doc["bi"][k], doc["di"][k])
            if cell in lake:
                hit = (rnk, k, len(lake))
                break
        if hit is None:
            out.append(
                f"| [{name}]({url}) | {lat:.4f}, {lon:.4f} | {cell} | none | | | | | | |"
            )
            continue
        rnk, k, size = hit
        b, d, bi = doc["b"][k], doc["d"][k], doc["bi"][k]
        out.append(
            f"| [{name}]({url}) | {lat:.4f}, {lon:.4f} | {cell} | {bi} | {rnk} | {d - b:.1f} | {b:.1f} "
            f"| {d:.1f} | {_fmt_ll(*cell_latlon(win, width, bi))} | {size} |"
        )
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    ap.add_argument(
        "--lakes", action="store_true", help="print the lakes table instead"
    )
    ap.add_argument("-n", type=int, default=10)
    args = ap.parse_args(argv)
    meta = json.loads((args.out_dir / "meta.json").read_text(encoding="utf-8"))
    if args.lakes:
        doc, _ = build_barcode(args.out_dir / "grid.f32", meta["width"], meta["height"])
        grid = read_grid(args.out_dir / "grid.f32", meta["width"], meta["height"])
        print(lakes_markdown(doc, args.n))
        print()
        print(geography_markdown(doc, grid, args.n))
        return 0
    doc, data = write_barcode(args.out_dir, meta["width"], meta["height"])
    print(f"barcode.json: {doc['count']} bars, {len(data)} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
