"""Regenerate tests/fixtures/tda/islands.json (deterministic, seeded).

Run from the repo root:  pipeline/.venv/bin/python tests/fixtures/tda/generate_islands_fixtures.py

Inputs are random grids WITH ties (small integers, plateaus, random walks, bumpy terrain with
rings, thin strips, constant grids). Expected outputs come from pipeline/tda_ref.py
(compute_islands). The Vitest suite (tests/unit/tda/islands.test.ts) and pytest
(pipeline/tests/test_tda_ref.py) both read this file, so passing both means TypeScript and
Python agree exactly on (peakCell, saddleCell, mergedInto), zero-length bars included.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from pipeline.tda_ref import compute_islands

SEED = 20261125
OUT = Path(__file__).with_name("islands.json")


def make_grid(rng: np.random.Generator, case: int) -> tuple[np.ndarray, str]:
    kind = ["int", "plateau", "walk", "bumps", "quarter"][case % 5]
    if case % 25 == 7:
        h, w = 1, int(rng.integers(1, 41))
    elif case % 25 == 13:
        h, w = int(rng.integers(1, 41)), 1
    elif case % 25 == 19:
        h, w = int(rng.integers(2, 4)), int(rng.integers(2, 4))
    else:
        h, w = int(rng.integers(3, 31)), int(rng.integers(3, 31))
    if case % 50 == 21:
        return np.full((h, w), float(rng.integers(-3, 4)), dtype=np.float32), "constant"
    if kind == "int":
        g = rng.integers(0, int(rng.integers(2, 10)), size=(h, w)).astype(np.float32)
    elif kind == "plateau":
        g = rng.integers(-5, 6, size=(h, w)).astype(np.float32)
        g[rng.random((h, w)) < 0.4] = 0.0
    elif kind == "walk":
        g = np.cumsum(np.cumsum(rng.integers(-1, 2, size=(h, w)), axis=0), axis=1)
        g = g.astype(np.float32)
    elif kind == "bumps":
        yy, xx = np.mgrid[0:h, 0:w]
        g = np.zeros((h, w))
        for _ in range(int(rng.integers(1, 6))):
            cy, cx = rng.random() * h, rng.random() * w
            r = 1 + rng.random() * max(h, w) / 2
            d = np.hypot(yy - cy, xx - cx)
            g += rng.choice([-1, 1]) * np.round(4 * np.cos(np.clip(d / r, 0, 3)))
        g = g.astype(np.float32)
    else:
        g = (np.round(rng.normal(0, 3, size=(h, w)) * 4) / 4).astype(np.float32)
    return g, kind


def main() -> None:
    rng = np.random.default_rng(SEED)
    cases = []
    for c in range(250):
        conn = 4 if c < 200 else 8
        grid, kind = make_grid(rng, c)
        res = compute_islands(grid, conn)
        h, w = grid.shape
        cases.append(
            {
                "id": c,
                "kind": kind,
                "W": w,
                "H": h,
                "connectivity": conn,
                "heights": [
                    int(v) if v.is_integer() else v for v in grid.ravel().tolist()
                ],
                "births": res.births,
                "bars": [[b.peak_cell, b.saddle_cell, b.merged_into] for b in res.bars],
                "zeroLength": len(res.zero_length),
            }
        )
    doc = {
        "description": "Islands (H1) fixtures (spec stretch S2). bars = [peakCell, "
        "saddleCell, mergedInto] for every bar incl. zero-length, in reverse-sweep order; "
        "connectivity is the water's; heights row-major, row 0 north.",
        "seed": SEED,
        "generator": "tests/fixtures/tda/generate_islands_fixtures.py "
        "(expected from pipeline/tda_ref.py)",
        "cases": cases,
    }
    with OUT.open("w") as f:
        f.write("{\n")
        for key in ("description", "seed", "generator"):
            f.write(f"  {json.dumps(key)}: {json.dumps(doc[key])},\n")
        f.write('  "cases": [\n')
        f.write(
            ",\n".join("    " + json.dumps(c, separators=(",", ":")) for c in cases)
        )
        f.write("\n  ]\n}\n")
    total = sum(len(c["bars"]) for c in cases)
    zero = sum(c["zeroLength"] for c in cases)
    print(
        f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(cases)} cases, {total} bars, {zero} zero-length)"
    )


if __name__ == "__main__":
    main()
