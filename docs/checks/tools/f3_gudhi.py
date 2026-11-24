"""F3 checker: GUDHI cubical H0 on 100 tie-free random grids (+ checkerboard), dumped for comparison.
Usage: pipeline/.venv/bin/python docs/checks/tools/f3_gudhi.py OUT.json"""
import json
import math
import sys

import gudhi
import numpy as np


def h0(grid, construction):
    cc = gudhi.CubicalComplex(**{construction: grid.astype(np.float64)})
    cc.compute_persistence(homology_coeff_field=2, min_persistence=-1)
    return [[float(b), (None if math.isinf(d) else float(d))] for b, d in cc.persistence_intervals_in_dimension(0)]


rng = np.random.default_rng(424242)
board = np.array([[0, 1], [1, 0]], dtype=np.float32)
print("gudhi", gudhi.__version__)
print("checkerboard vertices=", h0(board, "vertices"))
print("checkerboard top_dimensional_cells=", h0(board, "top_dimensional_cells"))
cases = []
for c in range(100):
    H, W = int(rng.integers(1, 41)), int(rng.integers(1, 41))
    while True:
        g = (rng.random((H, W)) * 2000 - 1000).astype(np.float32)
        if np.unique(g).size == g.size:
            break
    cases.append({"W": W, "H": H, "h": g.ravel().astype(float).tolist(),
                  "v": h0(g, "vertices"), "t": h0(g, "top_dimensional_cells")})
json.dump(cases, open(sys.argv[1], "w"))
