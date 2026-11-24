"""F4b checker: independent geography recomputation for the top lakes (no pipeline imports).

Usage: python -I f4b_geo.py <grid.f32> <my_pairs.json>
"""
import json
import math
import struct
import sys
from collections import deque

W, H = 326, 414
NW, NH = 9769, 12408
EW, EN = -115.2020833333, 42.1579166667  # native pixel-edge footprint W, N


def centre(i):
    x, y = i % W, i // W
    c0, r0 = 30 * x, 30 * y
    nc, nr = min(30, NW - c0), min(30, NH - r0)
    return EN - (r0 + nr / 2) / 1200, EW + (c0 + nc / 2) / 1200


def cell_of(lat, lon):
    col = math.floor((lon - EW) * 1200)
    row = math.floor((EN - lat) * 1200)
    return (row // 30) * W + col // 30


def km(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    d = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(d))


def lake_before_spill(h, bi, di):
    key = (h[di], di)
    seen = {bi}
    q = deque([bi])
    while q:
        u = q.popleft()
        x, y = u % W, u // W
        for v, ok in ((u - W, y > 0), (u + W, y < H - 1), (u - 1, x > 0), (u + 1, x < W - 1)):
            if ok and v not in seen and (h[v], v) < key:
                seen.add(v)
                q.append(v)
    return seen


# Landmark coordinates as I looked them up myself (see report for sources).
LANDMARKS = {
    "Great Salt Lake Desert": (40.70, -113.60),
    "Great Salt Lake": (41.167, -112.533),
    "Bingham Canyon Mine": (40.523, -112.151),
    "Ray Mine": (33.1494, -110.9872),
    "Sierrita mine": (31.8739, -111.1339),
    "Great Divide Basin": (42.0003, -107.9839),
    "Wamsutter WY": (41.6681, -107.9792),
    # primary sources (USGS GNIS via carto.nationalmap.gov geonames service; USGS MRDS)
    "GNIS 1455061 Great Salt Lake Desert": (40.65299, -113.52723),
    "GNIS 1425872 Bonneville Salt Flats": (40.79966, -113.80002),
    "GNIS 1597072 Great Divide Basin (pt 1)": (42.00024, -107.98398),
    "GNIS 1597072 Great Divide Basin (pt 2)": (42.00024, -108.00093),
    "GNIS 1609172 Wamsutter": (41.67302, -107.97926),
    "MRDS 10069296 Bingham Open Pit Mine": (40.52077, -112.1458),
    "MRDS 10210616 Ray Mine": (33.18315, -110.99236),
    "MRDS 10137918 Sierrita": (31.87152, -111.14879),
}

if __name__ == "__main__":
    h = list(struct.unpack("<%df" % (W * H), open(sys.argv[1], "rb").read()))
    bars = [tuple(b) for b in json.load(open(sys.argv[2]))["all"] if b[1] is not None]
    ranked = sorted([b for b in bars if b[1] - b[0] >= 1], key=lambda b: -(b[1] - b[0]))
    lm_cells = {k: cell_of(*v) for k, v in LANDMARKS.items()}
    print("landmark cells:", lm_cells)
    for r, (b, d, bi, di, mi) in enumerate(ranked[:10], 1):
        x, y = bi % W, bi // W
        edge = [s for s, c in (("west", x == 0), ("east", x == W - 1), ("north", y == 0), ("south", y == H - 1)) if c]
        lake = lake_before_spill(h, bi, di)
        bc, dc = centre(bi), centre(di)
        near = sorted((km(bc, v), k) for k, v in LANDMARKS.items())[0]
        inside = [k for k, c in lm_cells.items() if c in lake]
        print(f"#{r} P={d-b:.1f} b={b:.1f} bi={bi} ({bc[0]:.4f},{bc[1]:.4f}) d={d:.1f} di={di} ({dc[0]:.4f},{dc[1]:.4f}) "
              f"edge={edge or 'no'} nearest={near[1]} {near[0]:.1f} km inside={inside} cells={len(lake)}")
    for k, c in lm_cells.items():
        best = None
        for r, (b, d, bi, di, mi) in enumerate(ranked, 1):
            if c in lake_before_spill(h, bi, di):
                best = (r, round(d - b, 1), bi, round(b, 1), round(d, 1))
                break
        print(f"landmark {k}: cell {c} h={h[c]:.1f} -> longest-lived containing lake {best}")
