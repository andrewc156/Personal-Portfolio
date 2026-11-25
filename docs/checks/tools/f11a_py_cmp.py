"""F11a checker: compare pipeline.tda_ref.compute_islands to the TS engine dump from
f11a_islands_oracle.mjs (ordered list incl. zero-length bars, births)."""
import json
import sys

import numpy as np

from pipeline.tda_ref import compute_islands

cases = json.load(open(sys.argv[1]))
bad = 0
for c in cases:
    g = np.array(c["heights"], dtype=np.float32).reshape(c["H"], c["W"])
    r = compute_islands(g, connectivity=c["connectivity"])
    py = [[b.birth, b.death, b.peak_cell, b.saddle_cell, b.merged_into] for b in r.bars]
    ts = sorted(c["bars"], key=lambda b: (b[3], b[2]))
    pys = sorted(py, key=lambda b: (b[3], b[2]))
    if ts != pys or r.births != c["births"]:
        bad += 1
        if bad < 5:
            print("MISMATCH", c["W"], c["H"], c["connectivity"], ts, pys)
print(f"cases={len(cases)} mismatches={bad}")
sys.exit(1 if bad else 0)
