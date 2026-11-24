# F9 checker tool: independent brute-force H0 (spec §6.1), written from the spec only.
# For each prefix of the (h, i)-sorted cell list, components are recomputed from scratch by BFS
# (no union-find). A component's age key is its ≺-minimum cell. When cell i joins k ≥ 2 old
# components, all but the oldest die at h[i] with death cell i (elder rule).
# Also: a level-based cross-check — components of {h <= t} at every distinct level t must equal
# the brute-force lakes alive after the last cell of height t.
import json, sys, random
from collections import deque
import numpy as np


def nbrs(i, W, H, conn):
    x, y = i % W, i // W
    out = []
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (1, -1), (-1, 1), (-1, -1)) if conn == 8 else ()):
        a, b = x + dx, y + dy
        if 0 <= a < W and 0 <= b < H:
            out.append(b * W + a)
    return out


def components(cells, W, H, conn):
    s = set(cells); lab = {}
    for c in cells:
        if c in lab: continue
        lab[c] = c; q = deque([c])
        while q:
            u = q.popleft()
            for v in nbrs(u, W, H, conn):
                if v in s and v not in lab:
                    lab[v] = c; q.append(v)
    groups = {}
    for c, r in lab.items(): groups.setdefault(r, set()).add(c)
    return list(groups.values())


def brute(h, W, H, conn=4):
    h = np.asarray(h, dtype=np.float32).ravel()
    key = lambda i: (float(h[i]), i)
    order = sorted(range(W * H), key=key)
    bars = []  # (birth, death, bcell, dcell)
    added = []
    prev = []  # list of (oldest cell, frozenset)
    for i in order:
        old_ids = []
        for (oc, comp) in prev:
            if any(v in comp for v in nbrs(i, W, H, conn)):
                old_ids.append(oc)
        added.append(i)
        comps = components(added, W, H, conn)
        if not old_ids:
            pass  # birth at i
        else:
            oldest = min(old_ids, key=key)
            for oc in old_ids:
                if oc != oldest:
                    bars.append((float(h[oc]), float(h[i]), oc, i))
        prev = [(min(c, key=key), frozenset(c)) for c in comps]
    for (oc, comp) in prev:
        bars.append((float(h[oc]), float('inf'), oc, -1))
    births = sum(1 for i in range(W * H) if all(key(v) > key(i) for v in nbrs(i, W, H, conn)))
    # level cross-check
    for t in sorted(set(float(v) for v in h)):
        lev = components([i for i in range(W * H) if h[i] <= t], W, H, conn)
        alive = {min(c, key=key) for c in lev}
        exp = {b[2] for b in bars if b[0] <= t and (b[1] > t)}
        assert alive == exp, ('level check', t, alive, exp)
    return bars, births


def random_grid(rng, k):
    W, H = rng.randint(1, 12), rng.randint(1, 12)
    kind = k % 4
    if kind == 0: a = [rng.randint(0, 4) for _ in range(W * H)]  # heavy ties
    elif kind == 1: a = [rng.random() * 100 for _ in range(W * H)]  # tie-free (almost surely)
    elif kind == 2: a = [round(rng.gauss(0, 3)) / 2 for _ in range(W * H)]
    else: a = [rng.choice([0.0, -0.0, 1.0, 1.5, 7.25]) for _ in range(W * H)]
    return W, H, a


if __name__ == '__main__':
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 80
    out = sys.argv[2]
    rng = random.Random(9090)
    cases = []
    for k in range(n):
        W, H, a = random_grid(rng, k)
        for conn in (4, 8):
            bars, births = brute(a, W, H, conn)
            cases.append(dict(W=W, H=H, h=[float(np.float32(v)) for v in a], conn=conn, births=births,
                              bars=[[b, (None if d == float('inf') else d), bi, di] for b, d, bi, di in bars]))
    # golden and checkerboard
    for (W, H, a, conn) in [(7, 1, [10, 1, 8, 3, 6, 5, 10], 4), (2, 2, [0, 1, 1, 0], 4), (2, 2, [0, 1, 1, 0], 8)]:
        bars, births = brute(a, W, H, conn)
        print('special', W, H, a, conn, '->', bars)
        cases.append(dict(W=W, H=H, h=a, conn=conn, births=births,
                          bars=[[b, (None if d == float('inf') else d), bi, di] for b, d, bi, di in bars]))
    json.dump(cases, open(out, 'w'))
    print('cases', len(cases))
