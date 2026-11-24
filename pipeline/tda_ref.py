"""Reference implementation of 0-dimensional sublevel-set persistence (spec section 6.1).

Independent of the TypeScript engine in src/lib/tda/: same mathematics, written natively here.

Semantics
---------
* Grid ``heights`` has shape (H, W); cell index ``i = y * W + x`` (row-major, row 0 north).
* Total order: ``i < j`` iff ``(h[i], i) < (h[j], j)`` lexicographically.
* 4-connectivity by default, 8 optional.
* Cells are added in that order. A cell with no already-added neighbor starts a component whose
  birth is ``h[i]`` (birth cell ``i``). Otherwise the cell joins the oldest neighboring component
  (smallest birth cell under the order) and every other neighboring component dies at ``h[i]``
  with death cell ``i`` (the elder rule). Several deaths at one cell are listed oldest-first.
* Bars are listed in sweep order; zero-length bars (death == birth) are kept here and flagged.
* Each surviving component gives an essential bar with death = +inf (death cell -1).

Heights are cast to float32 (the dtype of grid.f32) before anything is computed.

CLI::

    python -m pipeline.tda_ref grid.f32 WIDTH HEIGHT [--connectivity 8] [--min-persistence 1]

prints JSON ``{"b": [...], "d": [...], "bi": [...], "di": [...]}`` (``d = null`` when essential).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field

import numpy as np

__all__ = ["Bar", "H0Result", "compute_h0", "sweep_order"]


@dataclass(frozen=True)
class Bar:
    birth: float
    death: float  # math.inf for essential bars
    birth_cell: int
    death_cell: int  # -1 for essential bars
    merged_into: int  # birth cell of the absorbing component; -1 for essential bars

    @property
    def persistence(self) -> float:
        return self.death - self.birth

    @property
    def essential(self) -> bool:
        return math.isinf(self.death)


@dataclass
class H0Result:
    width: int
    height: int
    connectivity: int
    order: np.ndarray  # int64 cell indices sorted by (height, index)
    finite: list[Bar] = field(default_factory=list)  # includes zero-length bars
    essential: list[Bar] = field(default_factory=list)
    births: int = 0

    @property
    def visible(self) -> list[Bar]:
        """Finite bars with death > birth, then the essential bars."""
        return [b for b in self.finite if b.death > b.birth] + self.essential

    @property
    def zero_length(self) -> list[Bar]:
        return [b for b in self.finite if b.death == b.birth]

    def pairs(self) -> list[tuple[int, int]]:
        """(birth_cell, death_cell) of every bar, finite (sweep order) then essential."""
        return [(b.birth_cell, b.death_cell) for b in self.finite + self.essential]


def sweep_order(flat: np.ndarray) -> np.ndarray:
    """Indices sorted by (value, index). lexsort sorts by the last key first."""
    return np.lexsort((np.arange(flat.size), flat))


def compute_h0(heights: np.ndarray, connectivity: int = 4) -> H0Result:
    """H0 persistence of the sublevel-set filtration of a 2-D grid of shape (H, W)."""
    grid = np.asarray(heights)
    if grid.ndim != 2 or grid.size == 0:
        raise ValueError(
            f"heights must be a non-empty 2-D array, got shape {grid.shape}"
        )
    if connectivity not in (4, 8):
        raise ValueError(f"connectivity must be 4 or 8, got {connectivity}")
    grid = grid.astype(np.float32, copy=False)
    if not np.isfinite(grid).all():
        raise ValueError("heights must be finite (no NaN or infinity)")
    nrows, ncols = grid.shape
    flat = grid.ravel()
    n = flat.size
    order = sweep_order(flat)

    rank_arr = np.empty(n, dtype=np.int64)
    rank_arr[order] = np.arange(n)
    rank = rank_arr.tolist()
    values = flat.astype(np.float64).tolist()  # exact float32 values as Python floats

    offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if connectivity == 8:
        offsets += [(-1, -1), (-1, 1), (1, -1), (1, 1)]

    # Union-find with union by size; each root records the birth cell of its component,
    # which is NOT necessarily the root itself.
    parent = list(range(n))
    size = [1] * n
    eldest = list(range(n))

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    result = H0Result(width=ncols, height=nrows, connectivity=connectivity, order=order)
    finite = result.finite
    births = 0
    for i in order.tolist():
        y, x = divmod(i, ncols)
        ri = rank[i]
        comps: dict[int, int] = {}  # root -> birth cell
        for dy, dx in offsets:
            yy, xx = y + dy, x + dx
            if 0 <= yy < nrows and 0 <= xx < ncols:
                j = yy * ncols + xx
                if rank[j] < ri:
                    r = find(j)
                    comps[r] = eldest[r]
        if not comps:
            births += 1
            continue  # cell i is its own singleton component (parent[i] == i)
        ranked = sorted(comps.items(), key=lambda item: rank[item[1]])
        survivor_birth = ranked[0][1]
        for _root, birth_cell in ranked[1:]:
            finite.append(
                Bar(values[birth_cell], values[i], birth_cell, i, survivor_birth)
            )
        # Merge everything (cell i and all neighbor roots) into one set, keep the eldest birth.
        members = [i] + [root for root, _ in ranked]
        big = max(members, key=lambda r: size[r])
        for r in members:
            if r != big:
                parent[r] = big
                size[big] += size[r]
        eldest[big] = survivor_birth

    result.births = births
    roots = {find(i) for i in range(n)}
    ess = sorted((eldest[r] for r in roots), key=lambda c: rank[c])
    result.essential = [Bar(values[c], math.inf, c, -1, -1) for c in ess]
    return result


def _main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument(
        "grid", help="little-endian float32 file, row-major, north row first"
    )
    ap.add_argument("width", type=int)
    ap.add_argument("height", type=int)
    ap.add_argument("--connectivity", type=int, default=4, choices=(4, 8))
    ap.add_argument("--min-persistence", type=float, default=0.0)
    args = ap.parse_args(argv)
    data = np.fromfile(args.grid, dtype="<f4")
    if data.size != args.width * args.height:
        ap.error(
            f"{args.grid} has {data.size} values, expected {args.width * args.height}"
        )
    res = compute_h0(data.reshape(args.height, args.width), args.connectivity)
    bars = [
        b
        for b in res.finite
        if b.persistence >= args.min_persistence and b.death > b.birth
    ]
    bars += res.essential
    out = {
        "b": [b.birth for b in bars],
        "d": [None if b.essential else b.death for b in bars],
        "bi": [b.birth_cell for b in bars],
        "di": [b.death_cell for b in bars],
    }
    json.dump(out, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
