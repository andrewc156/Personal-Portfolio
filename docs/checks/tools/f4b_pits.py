"""F4b checker: locate native-resolution pit floors of the 'mine' lakes in the raw tiles (read-only)."""
import math, sys
import numpy as np, rasterio
RAW = sys.argv[1]
EW, EN = -115.2020833333, 42.1579166667
def km(a, b):
    p1, p2 = map(math.radians, (a[0], b[0])); dl = math.radians(b[1]-a[1])
    return 2*6371.0088*math.asin(math.sqrt(math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
CASES = {  # birth cell, MRDS point (USGS), Wikipedia point used by builder
 "Ray (lake 117202)": (117202, (33.18315, -110.99236), (33.1494, -110.9872)),
 "Bingham (lake 21312)": (21312, (40.52077, -112.1458), (40.523, -112.151)),
 "Sierrita (lake 134148)": (134148, (31.87152, -111.14879), (31.8739, -111.1339)),
}
for name, (cell, mrds, wiki) in CASES.items():
    x, y = cell % 326, cell // 326
    w, n = EW + 30*x/1200, EN - 30*y/1200   # block NW edge
    la, lo = math.floor(n - 1e-9), math.floor(w)
    # mosaic the 2 x 2 tiles around the block (NW tile + east and south neighbours)
    a = np.full((2400, 2400), np.nan, np.float32)
    for dy, tla in enumerate((la, la - 1)):
        for dx, tlo in enumerate((lo, lo + 1)):
            t = f"{RAW}/Copernicus_DSM_COG_30_N{tla:02d}_00_W{-tlo:03d}_00_DEM.tif"
            if not __import__("os").path.exists(t):
                continue
            with rasterio.open(t) as ds:
                a[1200*dy:1200*dy+1200, 1200*dx:1200*dx+1200] = ds.read(1)
                if dx == 0 and dy == 0:
                    tr = ds.transform
    # pixel centres: lon = tr.c + (c+0.5)*tr.a
    c0 = round((w - tr.c) / tr.a); r0 = round((tr.f - n) / -tr.e)
    blk = a[r0:r0+30, c0:c0+30]
    rr, cc = np.unravel_index(np.argmin(blk), blk.shape)
    plat = tr.f + (r0+rr+0.5)*tr.e; plon = tr.c + (c0+cc+0.5)*tr.a
    # surroundings: 5 km box
    win = np.nan_to_num(a, nan=1e9)[max(r0-60,0):r0+90, max(c0-60,0):c0+90]
    print(f"{name}: block min {blk.min():.1f} m at ({plat:.5f},{plon:.5f}); "
          f"dist to USGS MRDS {km((plat,plon),mrds):.2f} km, to Wikipedia {km((plat,plon),wiki):.2f} km; "
          f"MRDS->Wikipedia {km(mrds,wiki):.2f} km; ~12x12 km window min/max {win.min():.0f}/{np.nanmax(a[max(r0-60,0):r0+90, max(c0-60,0):c0+90]):.0f} m; "
          f"pixels <= min+100 m in block: {(blk <= blk.min()+100).sum()}")
