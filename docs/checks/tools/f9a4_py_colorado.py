# F9 attempt 4: dump Python reference (pipeline/tda_ref.py) H0 + islands on the Colorado grid
# for comparison with the TypeScript engine. Checker-owned, throwaway.
# Run: pipeline/.venv/bin/python docs/checks/tools/f9a4_py_colorado.py > out.json
import json
import sys

import numpy as np

sys.path.insert(0, ".")
from pipeline.tda_ref import compute_h0, compute_islands  # noqa: E402

h = np.fromfile("public/data/colorado/grid.f32", dtype="<f4").reshape(414, 326)
r = compute_h0(h, 4)
isl = compute_islands(h, 4)
out = {
    "h0": [[b.birth_cell, b.death_cell, b.merged_into] for b in r.finite + r.essential],
    "islands": [[b.peak_cell, b.saddle_cell, b.merged_into] for b in isl.bars],
}
json.dump(out, sys.stdout)
