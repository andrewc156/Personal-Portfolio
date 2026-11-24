"""F4b checker: independent H0 (union-find from scratch) + BFS brute force.

No imports from pipeline/ or src/. Spec §6.1: order (h, i), 4-connectivity, elder rule.
Usage:
  python -I docs/checks/tools/f4b_h0.py selftest
  python -I docs/checks/tools/f4b_h0.py colorado <grid.f32> <barcode.json> <out_pairs.json>
"""
import json
import random
import struct
import sys
from collections import deque


def nbrs4(i, W, H):
    x, y = i % W, i // W
    if y > 0:
        yield i - W
    if y < H - 1:
        yield i + W
    if x > 0:
        yield i - 1
    if x < W - 1:
        yield i + 1


def h0_unionfind(h, W, H):
    n = W * H
    order = sorted(range(n), key=lambda i: (h[i], i))
    parent = [-1] * n  # -1 = not yet added
    birth = [0] * n  # birth cell of root

    def find(a):
        r = a
        while parent[r] != r:
            r = parent[r]
        while parent[a] != r:
            parent[a], a = r, parent[a]
        return r

    bars = []  # (b, d, bi, di, mi)
    for c in order:
        roots = set()
        for j in nbrs4(c, W, H):
            if parent[j] != -1:
                roots.add(find(j))
        parent[c] = c
        if not roots:
            birth[c] = c
            continue
        rs = sorted(roots, key=lambda r: (h[birth[r]], birth[r]))
        old = rs[0]
        for r in rs[1:]:
            bars.append((h[birth[r]], h[c], birth[r], c, birth[old]))
            parent[r] = old
        parent[c] = old
    ess = [birth[r] for r in range(n) if parent[r] == r]
    for e in sorted(ess, key=lambda b: (h[b], b)):
        bars.append((h[e], None, e, -1, -1))
    return bars


def h0_bfs(h, W, H):
    """O(n^2) brute force: BFS-label the added set before each insertion; a
    component's identity/age is its ≺-minimum cell."""
    n = W * H
    order = sorted(range(n), key=lambda i: (h[i], i))
    rank = {c: k for k, c in enumerate(order)}
    added = [False] * n
    bars = []
    for c in order:
        # label components of added set
        comp_min = [-1] * n
        for s in range(n):
            if added[s] and comp_min[s] == -1:
                q = deque([s])
                comp_min[s] = -2
                members = []
                while q:
                    u = q.popleft()
                    members.append(u)
                    for v in nbrs4(u, W, H):
                        if added[v] and comp_min[v] == -1:
                            comp_min[v] = -2
                            q.append(v)
                m = min(members, key=lambda u: rank[u])
                for u in members:
                    comp_min[u] = m
        ids = {comp_min[j] for j in nbrs4(c, W, H) if added[j]}
        added[c] = True
        if len(ids) > 1:
            rs = sorted(ids, key=lambda b: rank[b])
            for b in rs[1:]:
                bars.append((h[b], h[c], b, c, rs[0]))
    # essential: components of full grid
    seen = [False] * n
    ess = []
    for s in range(n):
        if not seen[s]:
            q = deque([s])
            seen[s] = True
            mem = []
            while q:
                u = q.popleft()
                mem.append(u)
                for v in nbrs4(u, W, H):
                    if not seen[v]:
                        seen[v] = True
                        q.append(v)
            ess.append(min(mem, key=lambda u: rank[u]))
    for e in sorted(ess, key=lambda b: rank[b]):
        bars.append((h[e], None, e, -1, -1))
    return bars


def selftest():
    # golden 1x7
    g = h0_unionfind([10, 1, 8, 3, 6, 5, 10], 7, 1)
    print("golden:", g)
    assert sorted(g, key=str) == sorted([(5, 6, 5, 4, 3), (3, 8, 3, 2, 1), (1, None, 1, -1, -1)], key=str)
    cb = h0_unionfind([0, 1, 1, 0], 2, 2)
    print("checkerboard:", cb)
    assert cb == [(0, 1, 3, 1, 0), (0, None, 0, -1, -1)]
    rnd = random.Random(20261124)
    n_ok = 0
    for t in range(300):
        W, H = rnd.randint(1, 9), rnd.randint(1, 9)
        if t % 2:
            h = [float(rnd.randint(0, 4)) for _ in range(W * H)]  # heavy ties
        else:
            h = [rnd.random() for _ in range(W * H)]
        a, b = h0_unionfind(h, W, H), h0_bfs(h, W, H)
        assert a == b, (W, H, h, a, b)
        n_ok += 1
    print(f"union-find == BFS brute force (pairs, mergedInto and order) on {n_ok} random grids (half with ties)")


def colorado(grid_path, bc_path, out_path):
    W, H = 326, 414
    raw = open(grid_path, "rb").read()
    assert len(raw) == W * H * 4
    h = list(struct.unpack("<%df" % (W * H), raw))  # float32 -> exact doubles
    bars = h0_unionfind(h, W, H)
    births = len(bars)
    finite = [x for x in bars if x[1] is not None]
    pos = [x for x in finite if x[1] - x[0] > 0]
    zero = [x for x in finite if x[1] == x[0]]
    keep = [x for x in finite if x[1] - x[0] >= 1.0] + [x for x in bars if x[1] is None]
    gmin = min(range(W * H), key=lambda i: (h[i], i))
    print(f"births {births} finite {len(finite)} positive {len(pos)} zero {len(zero)} kept {len(keep)} "
          f"essential {[x for x in bars if x[1] is None]} argmin {gmin} h={h[gmin]}")
    bc = json.load(open(bc_path))
    cols = list(zip(bc["b"], bc["d"], bc["bi"], bc["di"], bc["mi"]))
    print("barcode.json count", bc["count"], "len", len(cols))
    same_order = cols == keep
    same_set = sorted(cols, key=str) == sorted(keep, key=str)
    print("identical incl. order:", same_order, " identical as multiset:", same_set)
    hv = all(b == h[bi] and (d is None or d == h[di]) for b, d, bi, di, mi in cols)
    print("b/d equal grid heights at bi/di (exact):", hv)
    print("min persistence in file:", min(d - b for b, d, *_ in cols if d is not None))
    near = sorted(x[1] - x[0] for x in finite if 0.9 <= x[1] - x[0] < 1.1)
    print("persistences in [0.9,1.1):", near)
    json.dump({"all": bars}, open(out_path, "w"))
    top = sorted([x for x in finite], key=lambda x: -(x[1] - x[0]))[:10]
    for k, x in enumerate(top, 1):
        print(k, round(x[1] - x[0], 1), round(x[0], 1), x[2], round(x[1], 1), x[3], x[4])


if __name__ == "__main__":
    if sys.argv[1] == "selftest":
        selftest()
    else:
        colorado(*sys.argv[2:5])
