"""F12a: does WBD HU-2 15 (and the mask) extend into Mexico inside the bbox?
Border approximated from published monument coordinates (straight segments):
Pacific (-117.124,32.534) -> Colorado R. at (-114.719,32.718) -> down river to (-114.813,32.4945)
-> Nogales line to (-111.075,31.3322). Margin 0.05 deg south of the line."""
import json, struct, sys
from pathlib import Path
import numpy as np
repo, wbd = Path(sys.argv[1]), Path(sys.argv[2])
meta = json.loads((repo / "public/data/colorado/meta.json").read_text())
raw = np.frombuffer((repo / "public/data/colorado/basin-mask.bin").read_bytes(), np.uint8)
W, H = meta["width"], meta["height"]; N = W * H; pb = (N + 7) // 8
i = np.arange(N); P0 = ((raw[:pb][i >> 3] >> (i & 7)) & 1).astype(bool).reshape(H, W)
ext = meta["native"]["extent"]; cd = meta["cellDeg"]
lons = ext[0] + (np.arange(W) + .5) * cd; lats = ext[3] - (np.arange(H) + .5) * cd
bx = np.array([-117.124, -114.719, -114.813, -111.075]); by = np.array([32.534, 32.718, 32.4945, 31.3322])
def border_lat(lon):
    if lon <= -114.813:  # west of river: Pacific->Colorado segment (river part is narrow)
        return np.interp(lon, [-117.124, -114.719], [32.534, 32.718])
    return np.interp(lon, [-114.813, -111.075], [32.4945, 31.3322])
LA, LO = np.meshgrid(lats, lons, indexing="ij")
bl = np.vectorize(border_lat)(LO)
mex = LA < bl - 0.05
print("cells clearly in Mexico:", int(mex.sum()), "of which in mask:", int((mex & P0).sum()))
print("southernmost mask row lat:", lats[np.where(P0.any(1))[0].max()])
# HU-12 dbf states == 'MX' count (own dBASE reader)
def dbf(p):
    d = Path(p).read_bytes(); n = struct.unpack("<I", d[4:8])[0]; hl, rl = struct.unpack("<HH", d[8:12])
    f = []; o = 32
    while d[o] != 0x0D:
        nm = d[o:o+11].split(b"\0")[0].decode(); ln = d[o+16]; f.append((nm, ln)); o += 32
    recs = []
    for k in range(n):
        r = d[hl + k*rl + 1: hl + (k+1)*rl]; pos = 0; rec = {}
        for nm, ln in f: rec[nm] = r[pos:pos+ln].decode("latin-1").strip(); pos += ln
        recs.append(rec)
    return recs
for h in ("14", "15"):
    r = dbf(wbd / h / "Shape/WBDHU12.dbf")
    print(h, "HU12 units", len(r), "states==MX:", sum(1 for x in r if x["states"] == "MX"),
          "contains MX:", sum(1 for x in r if "MX" in x["states"].split(",")))
    print(h, "HU2", [(x["huc2"], x["name"], x["states"]) for x in dbf(wbd / h / "Shape/WBDHU2.dbf")])
    print(h, "HU4", [(x["huc4"], x["name"], x["states"]) for x in dbf(wbd / h / "Shape/WBDHU4.dbf")])
