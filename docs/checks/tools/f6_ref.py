"""F6 checker: independent reference for the Colorado explorer.

Uses only my own code (f4b_h0.h0_unionfind, validated against BFS in the F4b check) and
numpy/scipy-free BFS. No import from pipeline/ or src/.

Outputs JSON with:
  bars: all finite positive bars + essential, sweep order (b, d, bi, di, mi)
  ranked: finite positive bars sorted by persistence desc (stable on sweep order)
  lakes: for the top 25 + some mid ranks: card numbers and basin cells at nextDown(d) (= {h < d})
Usage: python -I f6_ref.py <repo> <out.json>
"""
import json
import math
import struct
import sys
from collections import deque

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from f4b_h0 import h0_unionfind  # noqa: E402

repo, out = sys.argv[1], sys.argv[2]
meta = json.load(open(f'{repo}/public/data/colorado/meta.json'))
raw = open(f'{repo}/public/data/colorado/grid.f32', 'rb').read()
W, H = meta['width'], meta['height']
n = W * H
h = list(struct.unpack(f'<{n}f', raw))

bars = h0_unionfind(h, W, H)
finite = [b for b in bars if b[1] is not None and b[1] > b[0]]
ess = [b for b in bars if b[1] is None]
ranked = sorted(finite, key=lambda b: -(b[1] - b[0]))  # stable

# geometry (meta.cellCenter convention, partial edge blocks)
west, south, east, north = meta['native']['extent']
px = 1 / 1200
NW, NH = meta['native']['width'], meta['native']['height']


def center(i):
    y, x = divmod(i, W)
    c0, c1 = min(30 * x, NW), min(30 * x + 30, NW)
    r0, r1 = min(30 * y, NH), min(30 * y + 30, NH)
    return north - (r0 + r1) / 2 * px, west + (c0 + c1) / 2 * px


def nb(i):
    y, x = divmod(i, W)
    if y > 0:
        yield i - W
    if y < H - 1:
        yield i + W
    if x > 0:
        yield i - 1
    if x < W - 1:
        yield i + 1


def comp_below(seed, d):
    """component of seed in {h < d} (= {h <= largest double below d} for float32 h)"""
    if not h[seed] < d:
        return []
    seen = {seed}
    q = deque([seed])
    while q:
        u = q.popleft()
        for v in nb(u):
            if v not in seen and h[v] < d:
                seen.add(v)
                q.append(v)
    return sorted(seen)


rank_of = {b[2]: k + 1 for k, b in enumerate(ranked)}
rank_of[ess[0][2]] = 0
pick = list(range(25)) + [30, 46, 99, 199, 400, 598, 1000]
lakes = []
for k in pick:
    if k >= len(ranked):
        continue
    b, d, bi, di, mi = ranked[k]
    basin = comp_below(bi, d)
    lakes.append({
        'rank': k + 1, 'b': b, 'd': d, 'bi': bi, 'di': di, 'mi': mi, 'miRank': rank_of.get(mi),
        'p': d - b, 'born': center(bi), 'died': center(di), 'basin': basin,
        # ≺-based basin for comparison: cells with (h,i) < (h[di],di)
        'basinPrec': len([1]) and None,
    })

# areas for % flooded (cos(lat) × native pixel extents)
areas = []
for y in range(H):
    r0, r1 = min(30 * y, NH), min(30 * y + 30, NH)
    lat = north - (r0 + r1) / 2 * px
    for x in range(W):
        c0, c1 = min(30 * x, NW), min(30 * x + 30, NW)
        areas.append((c1 - c0) * (r1 - r0) * math.cos(math.radians(lat)))

json.dump({
    'W': W, 'H': H,
    'bars': [list(b) for b in bars if b[1] is None or b[1] > b[0]],
    'ranked': [list(b) for b in ranked[:40]],
    'nFinitePositive': len(finite),
    'essential': list(ess[0]),
    'lakes': lakes,
    'areas': areas,
}, open(out, 'w'))
print('finite positive', len(finite), 'zero', len([b for b in bars if b[1] is not None and b[1] == b[0]]),
      'ess', len(ess), 'top3', ranked[:3])
