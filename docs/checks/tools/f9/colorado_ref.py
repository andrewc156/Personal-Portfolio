# F9: my own union-find H0 on grid.f32 (no imports from pipeline/ or src/), compared with barcode.json
# and with pipeline.tda_ref. Prints a summary; writes my pairs to argv[1].
import json, sys, struct, hashlib
import numpy as np
W, H = 326, 414
raw = open('public/data/colorado/grid.f32', 'rb').read()
h = np.frombuffer(raw, dtype='<f4'); assert h.size == W * H
order = np.lexsort((np.arange(W * H), h.astype(np.float64)))
parent = np.full(W * H, -1, dtype=np.int64)
def find(a):
    r = a
    while parent[r] != r: r = parent[r]
    while parent[a] != r: parent[a], a = r, parent[a]
    return r
rank = np.empty(W * H, dtype=np.int64); rank[order] = np.arange(W * H)
bars = []
for i in order.tolist():
    x, y = i % W, i // W
    roots = set()
    for j in ((i - W) if y > 0 else -1, (i + W) if y < H - 1 else -1, (i - 1) if x > 0 else -1, (i + 1) if x < W - 1 else -1):
        if j >= 0 and parent[j] >= 0: roots.add(find(j))
    if not roots: parent[i] = i; continue
    old = min(roots, key=lambda r: rank[r])  # root == birth cell (we always attach to oldest)
    parent[i] = old
    for r in roots:
        if r != old:
            bars.append((r, i, old)); parent[r] = old
ess = {find(i) for i in range(W * H)}
mine = [(bi, di, mi) for (bi, di, mi) in bars if float(h[di]) - float(h[bi]) >= 1.0]
bj = json.load(open('public/data/colorado/barcode.json'))
fin = [(bj['bi'][k], bj['di'][k], bj['mi'][k]) for k in range(len(bj['bi'])) if bj['d'][k] is not None]
print('my finite>=1m', len(mine), 'barcode.json finite', len(fin), 'essential mine', ess, 'json', [bj['bi'][k] for k in range(len(bj['bi'])) if bj['d'][k] is None])
print('sets equal (bi,di,mi):', sorted(mine) == sorted(fin), ' same order:', mine == fin)
vals = all(bj['b'][k] == float(h[bj['bi'][k]]) and (bj['d'][k] is None or bj['d'][k] == float(h[bj['di'][k]])) for k in range(len(bj['bi'])))
print('b,d exactly equal float32 grid heights:', vals)
print('births', W*H - sum(1 for _ in []), 'total bars incl zero', len(bars), 'zero-length', sum(1 for b in bars if h[b[1]] == h[b[0]]))
print('grid sha', hashlib.sha256(raw).hexdigest(), 'json grid sha', bj['grid']['sha256'])
sys.path.insert(0, '.')
from pipeline.tda_ref import compute_h0
r = compute_h0(h.reshape(H, W), connectivity=4)
py = [(b.birth_cell, b.death_cell, b.merged_into) for b in r.finite if float(b.death) - float(b.birth) >= 1.0]
print('tda_ref == mine:', py == mine, 'births', r.births)
json.dump([list(map(int, m)) for m in mine], open(sys.argv[1], 'w'))
