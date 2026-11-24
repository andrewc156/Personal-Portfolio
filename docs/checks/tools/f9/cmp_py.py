import json, sys, math
sys.path.insert(0, '.')
import numpy as np
from pipeline.tda_ref import compute_h0
cases = json.load(open(sys.argv[1])); bad = 0
for k, c in enumerate(cases):
    g = np.array(c['h'], dtype=np.float32).reshape(c['H'], c['W'])
    r = compute_h0(g, connectivity=c['conn'])
    got = sorted((b.birth_cell, b.death_cell, float(b.birth), None if math.isinf(b.death) else float(b.death)) for b in list(r.finite) + list(r.essential))
    exp = sorted((b[2], b[3], float(np.float32(b[0])), None if b[1] is None else float(np.float32(b[1]))) for b in c['bars'])
    if got != exp or r.births != c['births']:
        bad += 1
        if bad < 4: print('MISMATCH', k, got, exp)
print(f'Python tda_ref vs brute: {len(cases)} cases, {bad} mismatches')
