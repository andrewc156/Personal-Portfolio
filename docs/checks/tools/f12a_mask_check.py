"""F12a checker tool: independent decode of basin-mask.bin + own shapefile reader + own
even-odd point-in-polygon (scanline) against WBD HU-2 polygons. No pipeline imports.

usage: python -I f12a_mask_check.py <repo> <wbd_extract_dir>
  <wbd_extract_dir>/{14,15}/Shape/WBDHU2.shp
"""

import json
import struct
import sys
from pathlib import Path

import numpy as np

repo = Path(sys.argv[1])
wbd = Path(sys.argv[2])
meta = json.loads((repo / "public/data/colorado/meta.json").read_text())
mm = json.loads((repo / "public/data/colorado/basin-mask.json").read_text())
raw = (repo / "public/data/colorado/basin-mask.bin").read_bytes()

W, H = meta["width"], meta["height"]
N = W * H
pb = (N + 7) // 8
print("W H N planeBytes", W, H, N, pb, "file", len(raw), "expect", 2 * pb)
assert len(raw) == 2 * pb
arr = np.frombuffer(raw, dtype=np.uint8)


def plane(k):
    b = arr[k * pb:(k + 1) * pb]
    i = np.arange(N)
    return ((b[i >> 3] >> (i & 7)) & 1).astype(bool).reshape(H, W)


P0, P1 = plane(0), plane(1)
# padding bits
pad = N % 8
if pad:
    for k in (0, 1):
        last = arr[(k + 1) * pb - 1]
        assert last >> pad == 0, "padding bits not zero"
print("basin cells", int(P0.sum()), "meta", mm["stats"]["basinCells"], meta["basinMask"]["basinCells"])
print("p1 outside p0:", int((P1 & ~P0).sum()))
print("bbox meta", meta["bbox"], "mask.json", mm["grid"]["bbox"])
for k in ("width", "height", "cellDeg", "rowOrder"):
    assert meta[k] == mm["grid"][k], k
assert meta["bbox"] == mm["grid"]["bbox"]
assert meta["native"]["extent"] == mm["grid"]["extent"]


# ---- own shapefile polygon reader ----
def read_polys(shp):
    d = Path(shp).read_bytes()
    pos = 100
    rings = []
    while pos < len(d):
        _, clen = struct.unpack(">ii", d[pos:pos + 8])
        rec = d[pos + 8:pos + 8 + clen * 2]
        pos += 8 + clen * 2
        st = struct.unpack("<i", rec[:4])[0]
        if st == 0:
            continue
        assert st in (5, 15, 25), st
        nparts, npts = struct.unpack("<ii", rec[36:44])
        parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
        off = 44 + 4 * nparts
        pts = np.frombuffer(rec[off:off + 16 * npts], dtype="<f8").reshape(npts, 2)
        for a, b in zip(parts[:-1], parts[1:]):
            rings.append(pts[a:b].copy())
    return rings


R = {h: read_polys(wbd / h / "Shape/WBDHU2.shp") for h in ("14", "15")}
for h, rs in R.items():
    print("HU2", h, "rings", len(rs), "verts", sum(len(r) for r in rs))


def edges(rings):
    a = np.concatenate([r[:-1] for r in rings])
    b = np.concatenate([r[1:] for r in rings])
    return a, b


E = {h: edges(rs) for h, rs in R.items()}


def pip(h, lon, lat):
    """even-odd for arbitrary points (vectorised over edges, loop over points)."""
    a, b = E[h]
    out = np.zeros(len(lon), bool)
    for k in range(len(lon)):
        x, y = lon[k], lat[k]
        c = (a[:, 1] > y) != (b[:, 1] > y)
        if not c.any():
            continue
        ax, ay, bx, by = a[c, 0], a[c, 1], b[c, 0], b[c, 1]
        xi = ax + (y - ay) * (bx - ax) / (by - ay)
        out[k] = (np.count_nonzero(xi > x) % 2) == 1
    return out


def scan(h, lons, lats):
    """even-odd on a full lattice: rows lats, cols lons."""
    a, b = E[h]
    out = np.zeros((len(lats), len(lons)), bool)
    for j, y in enumerate(lats):
        c = (a[:, 1] > y) != (b[:, 1] > y)
        ax, ay, bx, by = a[c, 0], a[c, 1], b[c, 0], b[c, 1]
        xi = np.sort(ax + (y - ay) * (bx - ax) / (by - ay))
        cnt = len(xi) - np.searchsorted(xi, lons, side="right")
        out[j] = cnt % 2 == 1
    return out


def segdist(h, lon, lat):
    a, b = E[h]
    d = np.empty(len(lon))
    ab = b - a
    L2 = (ab ** 2).sum(1)
    L2[L2 == 0] = 1e-30
    for k in range(len(lon)):
        p = np.array([lon[k], lat[k]])
        t = np.clip(((p - a) * ab).sum(1) / L2, 0, 1)
        q = a + t[:, None] * ab
        d[k] = np.sqrt(((q - p) ** 2).sum(1)).min()
    return d


ext = meta["native"]["extent"]
cd = meta["cellDeg"]
px = meta["native"]["pixelDeg"]
nw, nh = meta["native"]["width"], meta["native"]["height"]
# cell centres from native block centres (handles short last col/row)
xs0 = np.arange(W) * 30
xs1 = np.minimum(xs0 + 30, nw)
ys0 = np.arange(H) * 30
ys1 = np.minimum(ys0 + 30, nh)
lons = ext[0] + (xs0 + xs1) / 2 * px
lats = ext[3] - (ys0 + ys1) / 2 * px
print("first/last lon", lons[0], lons[-1], "first/last lat", lats[0], lats[-1])

C14 = scan("14", lons, lats)
C15 = scan("15", lons, lats)
U = C14 | C15
print("centre-rule union cells", int(U.sum()), "overlap14/15", int((C14 & C15).sum()))
dis = U != P0
print("full-grid disagreement (centre rule vs mask)", int(dis.sum()))


def shifted(M, dy, dx):
    out = np.zeros_like(M)
    ys = slice(max(dy, 0), H + min(dy, 0))
    yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs_ = slice(max(dx, 0), W + min(dx, 0))
    xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[yd, xd] = M[ys, xs_]
    return out


# compare U with mask shifted; only interior region (exclude 1-cell frame)
inner = np.zeros((H, W), bool)
inner[1:-1, 1:-1] = True
for dy, dx in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1)]:
    S = shifted(P0, dy, dx)
    print(f"shift dy={dy:+d} dx={dx:+d}: disagreements {int(((S != U) & inner).sum())}")

# boundary-ness: does the cell's 3x3 neighbourhood in U contain both values?
mx = np.zeros_like(U)
mn = np.ones_like(U)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        s = shifted(U, dy, dx)
        mx |= s
        mn &= s
edge = mx != mn
print("disagreements in non-edge cells (3x3 uniform in my centre test):",
      int((dis & ~edge).sum()), "of", int((~edge).sum()))

# random sample >= 500, distance-filtered (> 0.03 deg from either HU2 boundary)
rng = np.random.default_rng(20261124)
cand = rng.choice(N, 1500, replace=False)
yy, xx = cand // W, cand % W
lo, la = lons[xx], lats[yy]
d = np.minimum(segdist("14", lo, la), segdist("15", lo, la))
keep = d > 0.03
yy, xx, lo, la = yy[keep], xx[keep], lo[keep], la[keep]
in14 = pip("14", lo, la)
in15 = pip("15", lo, la)
truth = in14 | in15
m0 = P0[yy, xx]
m1 = P1[yy, xx]
print(f"random sample away from boundary: n={len(yy)}, inside={int(truth.sum())}, "
      f"plane0 disagreements={int((truth != m0).sum())}, "
      f"plane1 disagreements={int((in15 != (m1 & m0)).sum())}")
for s, (dy, dx) in {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}.items():
    y2 = np.clip(yy + dy, 0, H - 1)
    x2 = np.clip(xx + dx, 0, W - 1)
    # mask value read one cell off vs truth at this centre; plus truth vs full-grid shifted
pass
# plane 1 full grid
dis1 = (C15 & ~C14) != (P1 & P0)
print("plane1 full-grid disagreement vs centre-rule 15", int(dis1.sum()),
      "non-edge", int((dis1 & ~edge).sum()))
L15 = C15 & ~C14
mx15 = np.zeros_like(L15); mn15 = np.ones_like(L15)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        s_ = shifted(L15, dy, dx); mx15 |= s_; mn15 &= s_
edge15 = (mx15 != mn15) | edge
print("plane1 disagreements in cells with uniform 3x3 in both union and region-15 tests:",
      int((dis1 & ~edge15).sum()))
# Mexico: cells south of the US-Mexico line inside the mask (rough: below 31.33N anywhere,
# or below 32.49N west of -114.8 is Mexico/California edge, so use lat<31.33 only)
south = lats < 31.332
print("rows with lat < 31.332 (all in Mexico):", int(south.sum()),
      "basin cells there:", int(P0[south].sum()), "of", int(south.sum() * W))
np.save(Path(sys.argv[0]).with_suffix(".U.npy"), U) if len(sys.argv) > 3 else None


def cell_of(lat, lon):
    x = int((lon - ext[0]) // cd)
    y = int((ext[3] - lat) // cd)
    return x, y


pts = json.loads(Path(sys.argv[0]).with_name("f12a_points.json").read_text())
for name, (lat, lon, want) in pts.items():
    ina = bool(pip("14", np.array([lon]), np.array([lat]))[0])
    inb = bool(pip("15", np.array([lon]), np.array([lat]))[0])
    x, y = cell_of(lat, lon)
    if 0 <= x < W and 0 <= y < H:
        v0, v1 = bool(P0[y, x]), bool(P1[y, x])
        reg = ("15" if v1 else "14") if v0 else "out"
        nb = P0[max(y - 2, 0):y + 3, max(x - 2, 0):x + 3]
        nbs = f"5x5 uniform={bool(nb.all() or not nb.any())}"
    else:
        reg, nbs = "off-grid", ""
    poly = "15" if inb else ("14" if ina else "out")
    ok = "OK" if reg == want or (reg == "off-grid" and poly == want) else "MISMATCH"
    print(f"{name:18s} lat {lat:.5f} lon {lon:.5f} cell({x},{y}) mask={reg:8s} "
          f"poly={poly:4s} want={want:4s} {nbs} {ok}")
