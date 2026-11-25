# F9 attempt 4: independent data audit (checker-owned, throwaway).
# - meta bbox/dims, min/max from grid.f32
# - basin-mask.bin decode and stats; sample cells vs USGS WBD HU-2 web service (point query)
# - labels.json vs GNIS DomesticNames state files (downloaded to a scratch dir): id, name, lat, lon, x, y
# Run: pipeline/.venv/bin/python docs/checks/tools/f9a4_data_audit.py <scratch_dir>
import io
import json
import math
import os
import random
import sys
import urllib.parse
import urllib.request
import zipfile

import numpy as np

SCR = sys.argv[1]
os.makedirs(SCR, exist_ok=True)
D = "public/data/colorado"
meta = json.load(open(f"{D}/meta.json"))
W, H = meta["width"], meta["height"]
h = np.fromfile(f"{D}/grid.f32", dtype="<f4")
res = {}
res["bboxExact"] = meta["bbox"] == [-115.201667, 31.8175, -107.060833, 42.1575]
res["dims"] = [W, H, h.size == W * H == 134964]
mi, ma = int(h.argmin()), int(h.argmax())
res["min"] = [float(h[mi]), mi, mi % W, mi // W, meta["min"]["cell"] == mi]
res["max"] = [float(h[ma]), ma, ma % W, ma // W, meta["max"]["cell"] == ma]
ext = meta["native"]["extent"]
cell = 0.025


def cell_center(i):
    x, y = i % W, i // W
    return ext[3] - (y + 0.5) * cell, ext[0] + (x + 0.5) * cell


res["minLatLon"] = cell_center(mi)

# basin mask
bm = json.load(open(f"{D}/basin-mask.json"))
raw = np.fromfile(f"{D}/basin-mask.bin", dtype=np.uint8)
pb = bm["format"]["planeBytes"]
bits0 = np.unpackbits(raw[:pb], bitorder="little")[: W * H]
bits1 = np.unpackbits(raw[pb : 2 * pb], bitorder="little")[: W * H]
res["mask"] = {
    "bytes": int(raw.size),
    "basinCells": int(bits0.sum()),
    "statsBasinCells": bm["stats"]["basinCells"],
    "plane1OutsideZero": int((bits1 & (1 - bits0)).sum()) == 0,
    "minCellInBasin": int(bits0[mi]),
    "padding0": int(np.unpackbits(raw[:pb], bitorder="little")[W * H :].sum()) == 0,
}

# Sample cells vs USGS WBD HU-2 service (point-in-polygon at the cell centre). Interior cells only
# (skip cells whose 8 neighbours disagree, i.e. boundary cells where the half-pixel rule decides).
URL = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/1/query"
rng = random.Random(20261125)
interior = [
    i
    for i in range(W * H)
    if 0 < i % W < W - 1
    and 0 < i // W < H - 1
    and len({int(bits0[j]) for j in (i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1, i)}) == 1
]
sample = rng.sample(interior, 40)
agree, rows = 0, []
for i in sample:
    lat, lon = cell_center(i)
    q = urllib.parse.urlencode(
        {
            "geometry": f"{lon},{lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "huc2",
            "returnGeometry": "false",
            "f": "json",
        }
    )
    try:
        with urllib.request.urlopen(f"{URL}?{q}", timeout=60) as r:
            js = json.load(r)
        hucs = [f["attributes"]["huc2"] for f in js.get("features", [])]
    except Exception as e:  # noqa: BLE001
        hucs = [f"ERR {e}"]
    service_in = any(x in ("14", "15") for x in hucs)
    ok = service_in == bool(bits0[i])
    if ok and service_in:
        ok = ("15" in hucs) == bool(bits1[i])
    agree += ok
    rows.append([i, round(lat, 4), round(lon, 4), int(bits0[i]), int(bits1[i]), hucs, ok])
res["wbdSample"] = {"n": len(sample), "agree": agree, "disagree": [r for r in rows if not r[-1]]}

# GNIS labels
lab = json.load(open(f"{D}/labels.json"))
places = lab["labels"]
gn = {}
for f in lab["source"]["files"]:
    p = os.path.join(SCR, os.path.basename(f["url"]))
    if not os.path.exists(p):
        urllib.request.urlretrieve(f["url"], p)
    z = zipfile.ZipFile(p)
    for name in z.namelist():
        if not name.lower().endswith(".txt"):
            continue
        txt = io.TextIOWrapper(z.open(name), encoding="utf-8-sig")
        header = txt.readline().rstrip("\r\n").split("|")
        for line in txt:
            parts = line.rstrip("\r\n").split("|")
            rec = dict(zip(header, parts))
            gn[int(rec["feature_id"])] = rec
bad = []
gx = lab["grid"]["extent"]
for p in places:
    r = gn.get(p["id"])
    if r is None:
        bad.append([p["name"], "id not found"])
        continue
    issues = []
    if r["feature_name"] != p["name"]:
        issues.append(f"name {r['feature_name']!r}")
    if r["feature_class"] != p["class"]:
        issues.append(f"class {r['feature_class']!r}")
    if p.get("anchor") == "mouth":
        lat, lon = float(r.get("source_lat_dec") or "nan"), float(r.get("source_long_dec") or "nan")
        lat, lon = float(r["prim_lat_dec"]), float(r["prim_long_dec"])
    else:
        lat, lon = float(r["prim_lat_dec"]), float(r["prim_long_dec"])
    if abs(lat - p["lat"]) > 1e-7 or abs(lon - p["lon"]) > 1e-7:
        issues.append(f"coord {lat},{lon} vs {p['lat']},{p['lon']}")
    x = math.floor((p["lon"] - gx[0]) / (1 / 1200)) // 30
    y = math.floor((gx[3] - p["lat"]) / (1 / 1200)) // 30
    if (x, y) != (p["x"], p["y"]):
        issues.append(f"xy {(x, y)} vs {(p['x'], p['y'])}")
    if issues:
        bad.append([p["name"], issues])
res["gnis"] = {"labels": len(places), "recordsLoaded": len(gn), "mismatches": bad,
               "mouthCount": sum(1 for p in places if p.get("anchor") == "mouth")}
up = [p for p in places if p["name"] in ("Uncompahgre Peak", "Kings Peak", "Humphreys Peak")]
res["peaks"] = [[p["name"], p["lat"], p["lon"]] for p in up]
print(json.dumps(res, indent=1, default=str))
