"""Tests for pipeline/tda_ref.py (spec section 10/F3)."""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pytest

from pipeline.tda_ref import _main, compute_h0

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "tda"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# --- golden and checkerboard (criteria 2, 3) -----------------------------------------------


@pytest.mark.parametrize("case", load("golden.json")["cases"], ids=lambda c: c["name"])
def test_golden_fixtures(case: dict) -> None:
    grid = np.array(case["heights"], dtype=np.float32).reshape(case["H"], case["W"])
    res = compute_h0(grid, case["connectivity"])
    got = [
        [b.birth, b.death, b.birth_cell, b.death_cell]
        for b in res.visible
        if not b.essential
    ]
    assert got == case["finite"]
    assert [[b.birth, b.birth_cell] for b in res.essential] == case["essential"]
    assert res.zero_length == []


def test_golden_explicit() -> None:
    res = compute_h0(np.array([[10, 1, 8, 3, 6, 5, 10]], dtype=np.float32))
    assert [(b.birth, b.death, b.birth_cell, b.death_cell) for b in res.finite] == [
        (5.0, 6.0, 5, 4),
        (3.0, 8.0, 3, 2),
    ]
    assert len(res.essential) == 1
    ess = res.essential[0]
    assert (ess.birth, ess.birth_cell, ess.death) == (1.0, 1, math.inf)


def test_checkerboard_connectivity() -> None:
    grid = np.array([[0, 1], [1, 0]], dtype=np.float32)
    four = compute_h0(grid, 4)
    assert [(b.birth, b.death) for b in four.visible] == [(0.0, 1.0), (0.0, math.inf)]
    eight = compute_h0(grid, 8)
    assert eight.finite == []
    assert [(b.birth, b.death) for b in eight.essential] == [(0.0, math.inf)]


def test_rejects_bad_input() -> None:
    with pytest.raises(ValueError):
        compute_h0(np.array([[0.0, np.nan]]))
    with pytest.raises(ValueError):
        compute_h0(np.array([[0.0, np.inf]]))
    with pytest.raises(ValueError):
        compute_h0(np.zeros(5))
    with pytest.raises(ValueError):
        compute_h0(np.zeros((2, 2)), connectivity=6)


# --- shared fixtures with the TypeScript engine (criterion 5) ------------------------------

AGREEMENT = load("agreement.json")["cases"]


def test_fixture_set_is_large_enough() -> None:
    with_ties = [
        c
        for c in AGREEMENT
        if c["connectivity"] == 4 and len(set(c["heights"])) < len(c["heights"])
    ]
    assert len(with_ties) >= 200 - 10  # a handful of 1x1 / tiny grids cannot have ties
    assert len([c for c in AGREEMENT if c["connectivity"] == 4]) == 200


@pytest.mark.parametrize(
    "case", AGREEMENT, ids=lambda c: f"case{c['id']}-c{c['connectivity']}"
)
def test_fixture_agreement(case: dict) -> None:
    grid = np.array(case["heights"], dtype=np.float32).reshape(case["H"], case["W"])
    res = compute_h0(grid, case["connectivity"])
    assert [[b.birth_cell, b.death_cell, b.merged_into] for b in res.finite] == case[
        "finite"
    ]
    assert [b.birth_cell for b in res.essential] == case["essential"]
    assert res.births == case["births"]
    assert len(res.zero_length) == case["zeroLength"]
    flat = grid.ravel()
    for b in res.finite:
        assert b.birth == flat[b.birth_cell] and b.death == flat[b.death_cell]


# --- invariants ----------------------------------------------------------------------------


def test_invariant_under_increasing_transform() -> None:
    rng = np.random.default_rng(7)
    for _ in range(50):
        h, w = rng.integers(1, 25, size=2)
        grid = rng.integers(0, 6, size=(h, w)).astype(np.float32)
        values = np.unique(grid)
        new_values = (
            np.cumsum(rng.integers(1, 1000, size=values.size)).astype(np.float32) - 3000
        )
        mapped = new_values[np.searchsorted(values, grid)]
        assert compute_h0(grid).pairs() == compute_h0(mapped).pairs()


def test_large_grid_shape_and_dtype() -> None:
    grid = np.random.default_rng(3).random((414, 326)).astype(np.float32)
    res = compute_h0(grid)
    assert res.births == len(res.finite) + len(res.essential)
    assert len(res.essential) == 1
    assert res.essential[0].birth_cell == int(np.argmin(grid))


def test_cli(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = tmp_path / "g.f32"
    np.array([10, 1, 8, 3, 6, 5, 10], dtype="<f4").tofile(path)
    assert _main([str(path), "7", "1", "--min-persistence", "2"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out == {"b": [3.0, 1.0], "d": [8.0, None], "bi": [3, 1], "di": [2, -1]}


# --- independent comparisons on tie-free grids (criterion 6) -------------------------------


def tie_free_grids(count: int, seed: int) -> list[np.ndarray]:
    rng = np.random.default_rng(seed)
    grids = []
    while len(grids) < count:
        h, w = rng.integers(1, 41, size=2)
        g = (rng.random((h, w)) * 1000 - 500).astype(np.float32)
        if np.unique(g).size == g.size:
            grids.append(g)
    return grids


def finite_multiset(res) -> list[tuple[float, float]]:
    return sorted((b.birth, b.death) for b in res.finite if b.death > b.birth)


def assert_multisets_close(
    a: list[tuple[float, float]], b: list[tuple[float, float]]
) -> None:
    assert len(a) == len(b)
    for (b1, d1), (b2, d2) in zip(sorted(a), sorted(b), strict=True):
        assert abs(b1 - b2) <= 1e-9 and abs(d1 - d2) <= 1e-9


def brute_force_h0(grid: np.ndarray, connectivity: int) -> list[tuple[float, float]]:
    """Graph filtration (vertices, then edges weighted max(h_u, h_v)), elder rule, by Kruskal.

    A different algorithm from tda_ref: it processes edges, not cells, and labels components by
    explicit relabelling instead of union-find.
    """
    h, w = grid.shape
    vals = grid.astype(np.float64).ravel()
    steps = [(0, 1), (1, 0)] + ([(1, 1), (1, -1)] if connectivity == 8 else [])
    edges = []
    for y in range(h):
        for x in range(w):
            for dy, dx in steps:
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w:
                    u, v = y * w + x, yy * w + xx
                    edges.append((max(vals[u], vals[v]), u, v))
    edges.sort()
    label = list(range(vals.size))
    members = {i: [i] for i in range(vals.size)}
    bars = []
    for weight, u, v in edges:
        a, b = label[u], label[v]
        if a == b:
            continue
        young, old = (
            (a, b) if vals[a] > vals[b] else (b, a)
        )  # labels are component minima
        if weight > vals[young]:
            bars.append((vals[young], weight))
        for m in members.pop(young):
            label[m] = old
            members[old].append(m)
    return bars


@pytest.mark.parametrize("connectivity", [4, 8])
def test_brute_force_agreement(connectivity: int) -> None:
    for grid in tie_free_grids(100, seed=11 + connectivity):
        assert_multisets_close(
            finite_multiset(compute_h0(grid, connectivity)),
            brute_force_h0(grid, connectivity),
        )


def gudhi_h0(gudhi, grid: np.ndarray, construction: str) -> list[tuple[float, float]]:
    cc = gudhi.CubicalComplex(**{construction: grid.astype(np.float64)})
    cc.compute_persistence(min_persistence=0)
    return [
        (float(b), float(d))
        for b, d in cc.persistence_intervals_in_dimension(0)
        if d > b
    ]


def test_gudhi_construction_connectivity() -> None:
    """Checkerboard: vertex-valued cubical complexes are 4-connected, pixel-valued are 8."""
    gudhi = pytest.importorskip("gudhi")
    board = np.array([[0, 1], [1, 0]], dtype=np.float64)
    finite_vertices = [
        i for i in gudhi_h0(gudhi, board, "vertices") if math.isfinite(i[1])
    ]
    finite_pixels = [i for i in gudhi_h0(gudhi, board, "top_dimensional_cells")]
    finite_pixels = [i for i in finite_pixels if math.isfinite(i[1])]
    assert finite_vertices == [(0.0, 1.0)]  # matches 4-connectivity
    assert finite_pixels == []  # matches 8-connectivity


def test_gudhi_agreement_4_connectivity() -> None:
    gudhi = pytest.importorskip("gudhi")
    for grid in tie_free_grids(100, seed=2026):
        ref = [i for i in gudhi_h0(gudhi, grid, "vertices") if math.isfinite(i[1])]
        assert_multisets_close(finite_multiset(compute_h0(grid, 4)), ref)
        essential = [
            i for i in gudhi_h0(gudhi, grid, "vertices") if not math.isfinite(i[1])
        ]
        assert Counter(b for b, _ in essential) == Counter(
            b.birth for b in compute_h0(grid, 4).essential
        )


def test_gudhi_agreement_8_connectivity() -> None:
    gudhi = pytest.importorskip("gudhi")
    for grid in tie_free_grids(100, seed=2027):
        ref = [
            i
            for i in gudhi_h0(gudhi, grid, "top_dimensional_cells")
            if math.isfinite(i[1])
        ]
        assert_multisets_close(finite_multiset(compute_h0(grid, 8)), ref)
