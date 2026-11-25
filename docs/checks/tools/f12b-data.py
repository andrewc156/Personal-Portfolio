"""Independent F12b data checks, without explorer or pipeline imports."""
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

root = Path("public/data/colorado")
meta = json.loads((root / "meta.json").read_text())
extra = json.loads((root / "basin-mask.json").read_text())
raw = (root / "basin-mask.bin").read_bytes()
assert meta["bbox"] == extra["grid"]["bbox"] == [-115.201667, 31.8175, -107.060833, 42.1575]
assert (meta["width"], meta["height"]) == (326, 414)
assert (extra["grid"]["width"], extra["grid"]["height"]) == (326, 414)
assert extra["grid"]["extent"] == meta["native"]["extent"]
assert meta["rowOrder"] == extra["grid"]["rowOrder"]
assert meta["cellDeg"] == extra["grid"]["cellDeg"]
assert extra["grid"]["sha256"] == meta["files"]["grid.f32"]["sha256"]
for name in ("basin-mask.bin", "basin-mask.json", "grid.f32", "barcode.json"):
    body = (root / name).read_bytes()
    assert len(body) == meta["files"][name]["bytes"]
    assert hashlib.sha256(body).hexdigest() == meta["files"][name]["sha256"]
    assert body == (Path("dist/data/colorado") / name).read_bytes()

cells = meta["width"] * meta["height"]
length = (cells + 7) // 8
assert len(raw) == 2 * length < 50_000
inside = int.from_bytes(raw[:length], "little")
region15 = int.from_bytes(raw[length:], "little")
assert inside.bit_length() <= cells and region15 & inside == region15
assert inside.bit_count() == meta["basinMask"]["basinCells"] == extra["stats"]["basinCells"]
assert region15.bit_count() == extra["stats"]["regions"]["15"]["cells"]
assert (inside ^ region15).bit_count() == extra["stats"]["regions"]["14"]["cells"]
assert (inside >> meta["min"]["cell"]) & 1
assert meta["basinMask"]["credit"] == extra["attribution"]["credit"]
print("mask bitplanes:", inside.bit_count(), region15.bit_count(), (inside ^ region15).bit_count())
print("mask bytes:", len(raw), "gzip:", len(gzip.compress(raw)), "metadata:", (root / "basin-mask.json").stat().st_size)

w, h = meta["width"], meta["height"]
west, south, east, north = meta["native"]["extent"]
cell_deg = meta["cellDeg"]
positions = json.loads(Path("docs/checks/tools/f12a_points.json").read_text())
counts = Counter()
for name, (lat, lon, expected) in positions.items():
    if not (west <= lon <= east and south <= lat <= north):
        continue
    x = int((lon - west) / cell_deg)
    y = int((north - lat) / cell_deg)
    cell = y * w + x
    value = "15" if (region15 >> cell) & 1 else "14" if (inside >> cell) & 1 else "out"
    assert value == expected, (name, value, expected)
    counts[value] += 1
    print(name, cell, value)
print("coordinate checks:", dict(counts))

for region in extra["source"]["regions"]:
    path = Path("pipeline/data/raw/wbd") / region["url"].rsplit("/", 1)[-1]
    assert path.stat().st_size == region["bytes"]
    with path.open("rb") as stream:
        assert hashlib.file_digest(stream, "sha256").hexdigest() == region["sha256"]
    with ZipFile(path) as archive:
        xml = next(n for n in archive.namelist() if n == path.stem + ".xml")
        text = archive.read(xml).decode("utf-8").lower()
        assert "acknowledgment of the originating agencies" in text
        if region["huc2"] == "15":
            for term in ("harmonized hydrologic units", "inegi", "1:24,000"):
                assert term in text, term
        print("Official staged region", region["huc2"], "archive bytes/digest and credit request match")
