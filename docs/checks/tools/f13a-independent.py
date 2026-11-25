"""Check published F13a files against original archives without importing the generator."""
import csv
import hashlib
import io
import json
import struct
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path("public/data/colorado")
CACHE = Path("pipeline/data/raw")
labels = json.loads((ROOT / "labels.json").read_text(), parse_float=Decimal)
meta = json.loads((ROOT / "meta.json").read_text(), parse_float=Decimal)
basin = json.loads((ROOT / "basin-mask.json").read_text(), parse_float=Decimal)
study = tuple(map(Decimal, ("-115.201667", "31.817500", "-107.060833", "42.157500")))
assert tuple(meta["bbox"]) == study
assert (meta["width"], meta["height"], meta["cells"]) == (326, 414, 134964)
assert meta["native"]["width"] == 9769 and meta["native"]["height"] == 12408
assert len(labels["labels"]) == labels["count"] == 39
assert (ROOT / "labels.json").stat().st_size <= 10240
grid = (ROOT / "grid.f32").read_bytes()
assert labels["grid"]["sha256"] == hashlib.sha256(grid).hexdigest() == meta["files"]["grid.f32"]["sha256"]
assert tuple(labels["grid"]["extent"]) == tuple(meta["native"]["extent"])
assert (labels["grid"]["width"], labels["grid"]["height"]) == (326, 414)
assert labels["grid"]["cellDeg"] == Decimal("0.025") and labels["grid"]["pixelDeg"] == meta["native"]["pixelDeg"]
for filename, props in meta["files"].items():
    data = (ROOT / filename).read_bytes()
    assert len(data) == props["bytes"], filename
    if "sha256" in props:
        assert hashlib.sha256(data).hexdigest() == props["sha256"], filename
positions = struct.unpack("<134964f", grid)
index = positions.index(min(positions))
assert index == meta["min"]["cell"] and round(positions[index], 3) == float(meta["min"]["value"])
print(f"grid bbox {study}, 326 × 414, minimum cell {index}, height {positions[index]:.3f} m, all meta.json listed file sizes/hashes match")

records = defaultdict(list)
wanted = {str(row["id"]) for row in labels["labels"]}
for source in labels["source"]["files"]:
    name = source["url"].rsplit("/", 1)[-1]
    path = CACHE / "gnis" / name
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == source["sha256"] and len(data) == source["bytes"]
    sidecar = json.loads(path.with_name(name + ".json").read_text())
    assert all(source[k] == sidecar[k] for k in ("url", "accessDate", "httpLastModified", "bytes", "sha256"))
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        text_name, = [p for p in archive.namelist() if p.lower().endswith(".txt")]
        xml_name, = [p for p in archive.namelist() if p.lower().endswith(".xml")]
        doc = ElementTree.fromstring(archive.read(xml_name))
        assert doc.findtext(".//pubdate") == source["pubdate"]
        assert doc.findtext(".//horizdn") == "North American Datum of 1983"
        assert "Acknowledgment of the U.S. Geological Survey" in doc.findtext(".//useconst")
        for row in csv.DictReader(io.StringIO(archive.read(text_name).decode("utf-8-sig")), delimiter="|"):
            if row["feature_id"] in wanted:
                records[row["feature_id"]].append(row)
    print(f"GNIS {source['state']}: archive length, SHA, sidecar, publication, datum, and credit request match")

seen = defaultdict(set)
west, south, east, north = study
nw_x, _, _, nw_y = labels["grid"]["extent"]
classes = Counter()
for item in labels["labels"]:
    rows = records[str(item["id"])]
    assert rows
    actual = [(r["feature_name"], r["feature_class"], Decimal(r["prim_lat_dec"]), Decimal(r["prim_long_dec"])) for r in rows]
    assert item["name"], item
    assert set(actual) == {(item["name"], item["class"], item["lat"], item["lon"])}
    assert west <= item["lon"] <= east and south <= item["lat"] <= north
    # A 30 by 30 native block spans exactly 1/40° in each direction, except for the short edges.
    cell = (int((item["lon"] - nw_x) * 40), int((nw_y - item["lat"]) * 40))
    assert cell == (item["x"], item["y"]), (item["name"], cell)
    assert 0 <= cell[0] < 326 and 0 <= cell[1] < 414
    assert (item.get("anchor") == "mouth") == (item["class"] in ("Stream", "Valley", "Arroyo"))
    for k, v in [("id", item["id"]), ("cell", cell), ("label", item.get("display", item["name"]))]:
        assert v not in seen[k], (k, v)
        seen[k].add(v)
    classes[item["category"]] += 1
print("39/39 exact archive records and cell positions; categories", dict(classes))
peak = next(row for row in labels["labels"] if row["name"] == "Uncompahgre Peak")
raw_max = meta["native"]["rawMax"]
assert (peak["x"], peak["y"]) == (raw_max["col"] // 30, raw_max["row"] // 30)
river = next(row for row in labels["labels"] if row["name"] == "Colorado River")
assert river["lat"] == Decimal("31.9") and river["lon"] == Decimal("-114.9508333") and river["anchor"] == "mouth"
print(f"Uncompahgre Peak matches raw-max grid cell {(peak['x'], peak['y'])}; Colorado River primary location {river['lat'], river['lon']}")

base = Path("docs/checks/F13a/attempt-1/baseline")
old = json.loads((base / "basin-mask.json").read_text(), parse_float=Decimal)
old_meta = json.loads((base / "meta.json").read_text(), parse_float=Decimal)
assert [k for k in basin if basin[k] != old[k]] == ["coverage"]
assert [k for k in meta if meta[k] != old_meta[k]] == ["files"]
assert [k for k in meta["files"] if meta["files"][k] != old_meta["files"][k]] == ["basin-mask.json"]
assert meta["files"]["basin-mask.bin"]["sha256"] == old_meta["files"]["basin-mask.bin"]["sha256"]
for item in basin["coverage"]:
    assert not any(v in item for v in ("S3 brief", "docs/data.md", "meta.min", "stats."))
assert "1039" in basin["coverage"][0] and "150301080302" in basin["coverage"][0]
bits = (ROOT / "basin-mask.bin").read_bytes()
plane_bytes = basin["format"]["planeBytes"]
assert len(bits) == 2 * plane_bytes
upper, lower = (int.from_bytes(p, "little") for p in (bits[:plane_bytes], bits[plane_bytes:]))
assert lower & ~upper == 0 and upper >> meta["cells"] == 0
assert upper.bit_count() == basin["stats"]["basinCells"] == 97311
assert lower.bit_count() == 55355 and bool(upper & (1 << index))
print("Basin bitplanes unchanged semantically: 97,311 mask cells, 55,355 in HU2 15; grid minimum inside; baseline JSON changes only coverage and metadata digest")
