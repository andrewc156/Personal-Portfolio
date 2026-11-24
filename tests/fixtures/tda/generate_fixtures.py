"""Regenerate tests/fixtures/tda/agreement.json (deterministic, seeded).

Run from the repo root:  pipeline/.venv/bin/python tests/fixtures/tda/generate_fixtures.py

Inputs are random grids WITH ties (small-integer and quarter-step values, plateaus, constant
grids, thin strips). Expected outputs come from pipeline/tda_ref.py. Both the Vitest suite
(tests/unit/tda/agreement.test.ts) and pytest (pipeline/tests/test_tda_ref.py) read this file,
so passing both means TypeScript and Python agree exactly.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from pipeline.tda_ref import compute_h0

SEED = 20261124
OUT = Path(__file__).with_name("agreement.json")


def make_grid(rng: np.random.Generator, case: int) -> tuple[np.ndarray, str]:
    kind = ["int", "quarter", "plateau", "walk"][case % 4]
    if case % 25 == 7:
        h, w = 1, int(rng.integers(1, 41))
    elif case % 25 == 13:
        h, w = int(rng.integers(1, 41)), 1
    else:
        h, w = int(rng.integers(1, 31)), int(rng.integers(1, 31))
    if case % 50 == 21:
        return np.full((h, w), float(rng.integers(-3, 4)), dtype=np.float32), "constant"
    if kind == "int":
        g = rng.integers(0, int(rng.integers(2, 10)), size=(h, w)).astype(np.float32)
    elif kind == "quarter":
        g = (np.round(rng.normal(0, 3, size=(h, w)) * 4) / 4).astype(np.float32)
    elif kind == "plateau":
        g = rng.integers(-5, 6, size=(h, w)).astype(np.float32)
        g[rng.random((h, w)) < 0.4] = 0.0  # large flat regions
    else:
        g = np.cumsum(np.cumsum(rng.integers(-1, 2, size=(h, w)), axis=0), axis=1)
        g = g.astype(np.float32)
    return g, kind


def main() -> None:
    rng = np.random.default_rng(SEED)
    cases = []
    for c in range(250):
        conn = 4 if c < 200 else 8
        grid, kind = make_grid(rng, c)
        res = compute_h0(grid, conn)
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
                "finite": [
                    [b.birth_cell, b.death_cell, b.merged_into] for b in res.finite
                ],
                "essential": [b.birth_cell for b in res.essential],
                "zeroLength": len(res.zero_length),
            }
        )
    doc = {
        "description": "H0 sublevel-set persistence fixtures (spec 6.1). finite = "
        "[birthCell, deathCell, mergedInto] in sweep order; heights row-major, row 0 north.",
        "seed": SEED,
        "generator": "tests/fixtures/tda/generate_fixtures.py (expected from pipeline/tda_ref.py)",
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
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(cases)} cases)")


if __name__ == "__main__":
    main()
