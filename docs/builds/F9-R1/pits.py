"""F9-R1 one-off check: native (3") pit floor inside each lake's cells vs. its USGS MRDS point.

Read-only; needs the cached raw tiles. Run: pipeline/.venv/bin/python docs/builds/F9-R1/pits.py
"""
import json, sys
from pathlib import Path
import numpy as np
import rasterio
REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))
from pipeline import barcode as bc, colorado_dem as cd

OUT = REPO / "public" / "data" / "colorado"
RAW = REPO / "pipeline" / "data" / "raw"
meta = json.loads((OUT / "meta.json").read_text())
W, H = meta["width"], meta["height"]
doc, _ = bc.build_barcode(OUT / "grid.f32", W, H)
grid = bc.read_grid(OUT / "grid.f32", W, H)
order = np.lexsort((np.arange(grid.size), grid.ravel()))
rank = np.empty(grid.size, dtype=np.int64); rank[order] = np.arange(grid.size)
win = cd.native_window()
ranked = bc.top_lakes(doc, 20)
MRDS = {5: ("Ray Mine 10210616", 33.18315, -110.99236), 6: ("Bingham 10069296", 40.52077, -112.1458),
        7: ("Sierrita 10137918", 31.87152, -111.14879), 11: ("Mission Mine 10111429", 31.99234, -111.0643),
        14: ("Chino Mine 10087992", 32.794, -108.06644), 18: ("Bagdad 10162326", 34.58474, -113.20857)}

def native_px(m, k):
    # tile containing centre lat m/1200, lon k/1200: rows (la*1200, (la+1)*1200], cols [-lo*1200, -lo*1200+1200)
    la = -(-m // cd.TILE_PX) - 1
    lo = -(k // cd.TILE_PX)
    i = (la + 1) * cd.TILE_PX - m
    j = k + lo * cd.TILE_PX
    return la, lo, i, j

cache = {}
def tile(la, lo):
    if (la, lo) not in cache:
        with rasterio.open(RAW / f"{cd.tile_name(la, lo)}.tif") as ds:
            cache[(la, lo)] = ds.read(1)
    return cache[(la, lo)]

for r in sorted(MRDS):
    k = ranked[r - 1]
    bi, di = doc["bi"][k], doc["di"][k]
    lake = bc.lake_before_death(grid, rank, bi, di)
    best = None
    for c in lake:
        y, x = divmod(c, W)
        for yy in range(y * cd.BLOCK, min(y * cd.BLOCK + cd.BLOCK, win.height)):
            for xx in range(x * cd.BLOCK, min(x * cd.BLOCK + cd.BLOCK, win.width)):
                m, kk = win.m_north - yy, win.k0 + xx
                la, lo, i, j = native_px(m, kk)
                v = float(tile(la, lo)[i, j])
                if best is None or v < best[0]:
                    best = (v, m / 1200, kk / 1200, c)
    name, lat, lon = MRDS[r]
    mc = bc.latlon_cell(win, W, H, lat, lon)
    d = bc.km_between((best[1], best[2]), (lat, lon))
    print(f"#{r} lake cells {sorted(lake)} birth {doc['b'][k]:.1f}; native min {best[0]:.1f} m at "
          f"{best[1]:.5f}, {best[2]:.5f} (cell {best[3]}); {name} cell {mc} in lake: {mc in lake}; "
          f"native min -> MRDS {d:.2f} km; birth-cell centre -> MRDS "
          f"{bc.km_between(bc.cell_latlon(win, W, bi), (lat, lon)):.2f} km")
