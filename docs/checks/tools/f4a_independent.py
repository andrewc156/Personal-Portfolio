"""F4a checker: independent recomputation of the Colorado grid from cached tiles.

Does not import anything from pipeline/. Uses rasterio + numpy directly.
Usage: python -I docs/checks/tools/f4a_independent.py <raw_dir> <grid.f32> <meta.json>
"""

import glob
import json
import os
import struct
import sys

import numpy as np
import rasterio

raw_dir, grid_path, meta_path = sys.argv[1:4]
W_, S_, E_, N_ = (-115.201667, 31.817500, -107.060833, 42.157500)
P = 1200

# 1. Read every tile; locate each pixel centre on the global 1/1200 lattice
#    using the tile's own geotransform (rasterio xy = pixel centre).
tiles = sorted(glob.glob(os.path.join(raw_dir, "Copernicus_DSM_COG_30_*_DEM.tif")))
print("tiles found:", len(tiles))
placed = {}
kmin = mmin = 10**9
kmax = mmax = -(10**9)
infos = []
for t in tiles:
    with rasterio.open(t) as ds:
        x0, y0 = ds.xy(0, 0)  # centre of top-left pixel
        x1, y1 = ds.xy(ds.height - 1, ds.width - 1)
        k0 = x0 * P
        m0 = y0 * P
        assert abs(k0 - round(k0)) < 1e-4 and abs(m0 - round(m0)) < 1e-4, t
        k0, m0 = round(k0), round(m0)
        infos.append((os.path.basename(t), ds.width, ds.height, x0, y0, x1, y1,
                      ds.tags().get("AREA_OR_POINT"), ds.nodata, ds.dtypes[0]))
        placed[t] = (k0, m0, ds.width, ds.height)
        kmin, kmax = min(kmin, k0), max(kmax, k0 + ds.width - 1)
        mmax, mmin = max(mmax, m0), min(mmin, m0 - ds.height + 1)

# naming check: name N{la}_W{lo} -> top-left centre (-lo, la+1), bottom-right (-lo+1-1/1200, la+1/1200)
bad = 0
for name, w, h, x0, y0, x1, y1, aop, nod, dt in infos:
    la = int(name.split("_N")[1][:2])
    lo = int(name.split("_W")[1][:3])
    ok = (w == h == 1200 and abs(x0 + lo) < 1e-9 and abs(y0 - (la + 1)) < 1e-9
          and abs(x1 - (-lo + 1 - 1 / P)) < 1e-9 and abs(y1 - (la + 1 / P)) < 1e-9)
    if not ok:
        bad += 1
        print("NAMING MISMATCH", name, w, h, x0, y0, x1, y1)
print("tiles with SW-corner naming verified:", len(infos) - bad, "/", len(infos))
print("AREA_OR_POINT values:", {i[7] for i in infos}, "nodata values:", {i[8] for i in infos},
      "dtypes:", {i[9] for i in infos})
print("example", infos[[i[0] for i in infos].index(
    "Copernicus_DSM_COG_30_N36_00_W112_00_DEM.tif")])

# 2. Full mosaic over the union of tiles (row 0 = largest m)
Hm, Wm = mmax - mmin + 1, kmax - kmin + 1
mos = np.full((Hm, Wm), np.nan, dtype=np.float32)
for t, (k0, m0, w, h) in placed.items():
    with rasterio.open(t) as ds:
        a = ds.read(1)
    r0, c0 = mmax - m0, k0 - kmin
    assert np.isnan(mos[r0:r0 + h, c0:c0 + w]).all(), "overlap"
    mos[r0:r0 + h, c0:c0 + w] = a
print("union mosaic", Wm, "x", Hm, "NaN:", int(np.isnan(mos).sum()))

# 3. Select pixel centres inside the bbox: lon in [W, E), lat in (S, N] with a
#    tolerance of 0.001 px (the bbox edges sit on centre lines).
lon = (kmin + np.arange(Wm)) / P
lat = (mmax - np.arange(Hm)) / P
tol = 0.001 / P
cols_incl = np.nonzero((lon >= W_ - tol) & (lon <= E_ + tol))[0]
rows_incl = np.nonzero((lat >= S_ - tol) & (lat <= N_ + tol))[0]
print("closed-bbox centres:", len(cols_incl), "x", len(rows_incl))
print("edge centres: W", lon[cols_incl[0]], "E", lon[cols_incl[-1]], "N", lat[rows_incl[0]],
      "S", lat[rows_incl[-1]])
cols = cols_incl[:-1]  # drop east edge column
rows = rows_incl[:-1]  # drop south edge row
nat = mos[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
h, w = nat.shape
print("half-open native:", w, "x", h)
print("footprint (W,S,E,N):", lon[cols[0]] - 0.5 / P, lat[rows[-1]] - 0.5 / P,
      lon[cols[-1]] + 0.5 / P, lat[rows[0]] + 0.5 / P)
print("native NaN:", int(np.isnan(nat).sum()), " <= -1000:", int((nat <= -1000).sum()))

# 4. Raw extremes (plain argmin/argmax, first occurrence)
fl = nat.ravel()
imn, imx = int(np.argmin(fl)), int(np.argmax(fl))
for tag, i in (("raw min", imn), ("raw max", imx)):
    y, x = divmod(i, w)
    print(f"{tag}: {fl[i]:.3f} m at row {y} col {x} lat {lat[rows[0] + y]:.6f} lon {lon[cols[0] + x]:.6f}")
print("ties at max:", int((fl == fl[imx]).sum()), " ties at min:", int((fl == fl[imn]).sum()))
z = nat == 0
neg = nat < 0
print("pixels == 0:", int(z.sum()), " < 0:", int(neg.sum()))
ys, xs = np.nonzero(z | neg)
print("  zero/neg lat range", lat[rows[0] + ys.max()], lat[rows[0] + ys.min()],
      "lon range", lon[cols[0] + xs.min()], lon[cols[0] + xs.max()])

# 5. Block minima by explicit loops
B = 30
GH, GW = -(-h // B), -(-w // B)
mine = np.empty((GH, GW), dtype=np.float32)
for by in range(GH):
    for bx in range(GW):
        mine[by, bx] = nat[by * B:(by + 1) * B, bx * B:(bx + 1) * B].min()
print("my grid:", GW, "x", GH, "last col px", w - (GW - 1) * B, "last row px", h - (GH - 1) * B)

# 6. Compare with grid.f32 read by struct (explicit little-endian)
raw = open(grid_path, "rb").read()
print("grid.f32 bytes:", len(raw), "expected", GW * GH * 4)
vals = np.array(struct.unpack(f"<{GW * GH}f", raw), dtype=np.float32)
theirs = vals.reshape(GH, GW)  # i = y*W + x
print("full-grid exact equality:", bool(np.array_equal(theirs, mine)),
      " max abs diff:", float(np.abs(theirs - mine).max()))
be = np.frombuffer(raw, dtype=">f4").reshape(GH, GW)
print("big-endian interpretation equal? ", bool(np.array_equal(be, mine)))
print("transposed/flipped equal? flipud:", bool(np.array_equal(theirs[::-1], mine)))
samples = [(0, 0), (0, GW - 1), (GH - 1, 0), (GH - 1, GW - 1), (100, 200), (207, 163),
           (GH - 1, 150), (200, GW - 1), (408, 17), (172, 311)]
for (y, x) in samples:
    i = y * GW + x
    v = struct.unpack_from("<f", raw, 4 * i)[0]
    blk = nat[y * B:(y + 1) * B, x * B:(x + 1) * B]
    print(f"  block y={y:3d} x={x:3d} shape={blk.shape} mine={blk.min():.3f} file[i={i}]={v:.3f}")
gi, ga = int(np.argmin(mine)), int(np.argmax(mine))
for tag, i in (("grid min", gi), ("grid max", ga)):
    y, x = divmod(i, GW)
    ya, yb = y * B, min(y * B + B, h)
    xa, xb = x * B, min(x * B + B, w)
    clat = lat[rows[0] + ya] - (yb - ya - 1) / 2 / P
    clon = lon[cols[0] + xa] + (xb - xa - 1) / 2 / P
    print(f"{tag}: {mine.ravel()[i]:.3f} at cell {i} (x {x}, y {y}) centre {clat:.6f}, {clon:.6f}")
print("grid ties at max:", int((mine == mine.ravel()[ga]).sum()), "at min:",
      int((mine == mine.ravel()[gi]).sum()))

# 7. meta checks
meta = json.load(open(meta_path))
print("meta.bbox == spec:", meta["bbox"] == [W_, S_, E_, N_], meta["bbox"])
print("meta width/height/cells:", meta["width"], meta["height"], meta["cells"])
import hashlib  # noqa: E402
print("sha256 matches meta:", hashlib.sha256(raw).hexdigest() == meta["files"]["grid.f32"]["sha256"])
