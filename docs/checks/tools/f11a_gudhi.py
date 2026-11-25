"""F11a checker: GUDHI H1 of the sublevel (water) filtration vs the TS engine dump
(tie-free float grids only). vertices= -> water 4; top_dimensional_cells= -> water 8."""
import json
import sys

import gudhi
import numpy as np

cases = json.load(open(sys.argv[1]))
n = bad = 0
for c in cases:
    h = np.array(c["heights"], dtype=np.float64)
    if len(set(h.tolist())) != h.size or c["W"] < 3 or c["H"] < 3:
        continue
    g = h.reshape(c["H"], c["W"])
    cc = gudhi.CubicalComplex(vertices=g) if c["connectivity"] == 4 else gudhi.CubicalComplex(top_dimensional_cells=g)
    cc.compute_persistence()
    gi = sorted((float(a), float(b)) for a, b in cc.persistence_intervals_in_dimension(1) if b > a)
    ts = sorted((float(b[0]), float(b[1])) for b in c["bars"] if b[1] > b[0])
    n += 1
    if len(gi) != len(ts) or any(abs(x[0] - y[0]) > 1e-6 or abs(x[1] - y[1]) > 1e-6 for x, y in zip(gi, ts)):
        bad += 1
        print("MISMATCH", c["W"], c["H"], c["connectivity"], gi, ts)
print(f"gudhi {gudhi.__version__}: tie-free grids compared={n} mismatches={bad}")
