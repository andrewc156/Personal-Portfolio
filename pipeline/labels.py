"""Place labels for the explorer from USGS GNIS Domestic Names (spec stretch S4, data part).

Run from the repo root:  python -m pipeline.labels
(also run at the end of ``npm run data`` = ``python -m pipeline.build_colorado``).

Input: the official USGS GNIS Domestic Names state text files (pipe-delimited), fetched over
HTTPS and cached in pipeline/data/raw/gnis/ (gitignored):
  https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_<ST>_Text.zip
Only ``Text/DomesticNames_<ST>.txt`` and the FGDC metadata XML are read, straight from the zip.

Output: public/data/colorado/labels.json. meta.json is not touched.

Nothing about a label's position is typed here: SELECTION lists GNIS feature ids plus the
display name, category and priority chosen for the map. Name, class, state, county and the
primary coordinates (prim_lat_dec, prim_long_dec; NAD 83) are read from the GNIS file, and the
GNIS name must equal ``gnis_name`` below or the build stops.

Grid convention (meta.json cellCenter, src/lib/viz/explorer/geo.ts): a point belongs to the
cell whose native 3-arc-second pixels contain it. Native column k = floor(lon * 1200 + 0.5),
row m = floor(lat * 1200 + 0.5) (pixel centres on lon = k/1200, lat = m/1200); output column
col = k - k0, row = m_north - m; cell x = col // 30, y = row // 30, i = y * width + x.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import sys
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path

from pipeline import colorado_dem as cd

REPO = Path(__file__).resolve().parent.parent
RAW_DIR = REPO / "pipeline" / "data" / "raw"
GNIS_SUBDIR = "gnis"
OUT_DIR = REPO / "public" / "data" / "colorado"
LABELS_FILE = "labels.json"
MAX_LABELS_BYTES = 10 * 1024

GNIS_URL = (
    "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/"
    "DomesticNames_{st}_Text.zip"
)
GNIS_PAGE = "https://www.usgs.gov/us-board-on-geographic-names/domestic-names"
GNIS_FORMAT_DOC = "https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/GNIS_file_format.pdf"
GNIS_RECORD = "https://edits.nationalmap.gov/apps/gaz-domestic/public/search/names/"
# Archived USGS GNIS FAQ (2009 snapshot): primary point of a stream, valley or arroyo is its mouth.
GNIS_FAQ_ARCHIVE = (
    "https://webarchive.library.unt.edu/eot2008/20090506152409/"
    "http://geonames.usgs.gov/domestic/metadata.htm"
)
USGS_CREDIT_PAGE = (
    "https://www.usgs.gov/information-policies-and-instructions/"
    "acknowledging-or-crediting-usgs"
)
PUBLIC_DOMAIN_STATEMENT = (
    "Most U.S. Geological Survey (USGS) information resides in the Public Domain and may be "
    "used without restriction."
)
CREDIT_LINE = (
    "Place names and coordinates: Geographic Names Information System (GNIS) courtesy of the "
    "U.S. Geological Survey"
)
DATUM_SOURCE = (
    "https://www.usgs.gov/faqs/why-are-nad-83-position-values-so-far-nad-27-values-were-old-"
    "coordinates-wrong"
)
DATUM_QUOTE = (
    "All modern maps and GIS data are cast on NAD 83 or WGS 84, which are equivalent datums "
    "at map scales of 1:5,000 and smaller."
)

CATEGORIES = ("peak", "water", "city", "basin", "canyon")
# GNIS records these classes at their downstream end (mouth); see GNIS_FAQ_ARCHIVE.
MOUTH_CLASSES = ("Stream", "Valley", "Arroyo")


@dataclass(frozen=True)
class Pick:
    fid: int
    st: str  # GNIS state file the record is read from
    gnis_name: str  # must equal feature_name in the file
    name: str  # display name on the map
    category: str
    priority: int  # 1 = always shown, 2, 3 = first to drop when labels collide
    why: str  # selection reason (docs only; not exported)


# Selection (docs/data.md "Place labels (stretch S4)"). Ordered by priority, then category.
SELECTION: tuple[Pick, ...] = (
    # priority 1: the frame of the map and the longest-lived lakes
    Pick(45730, "AZ", "Colorado River", "Colorado River", "water", 1,
         "the river; GNIS point is its mouth, near the grid minimum (essential lake)"),
    Pick(1431462, "UT", "Lake Powell", "Lake Powell", "water", 1, "reservoir"),
    Pick(7862, "NV", "Lake Mead", "Lake Mead", "water", 1, "reservoir"),
    Pick(1441459, "UT", "Great Salt Lake", "Great Salt Lake", "water", 1,
         "inside lake #3 before it spills"),
    Pick(1455061, "UT", "Great Salt Lake Desert", "Great Salt Lake Desert", "basin", 1,
         "floor of lake #3"),
    Pick(1597072, "WY", "Great Divide Basin", "Great Divide Basin", "basin", 1,
         "closed basin cut by the north edge (lake rank 47)"),
    Pick(23907, "AZ", "Grand Canyon", "Grand Canyon", "canyon", 1,
         "GNIS point is the canyon's lower end"),
    Pick(188678, "CO", "Uncompahgre Peak", "Uncompahgre Peak", "peak", 1,
         "highest raw elevation in the study area"),
    Pick(1442332, "UT", "Kings Peak", "Kings Peak", "peak", 1, "Uinta Mountains"),
    Pick(30290, "AZ", "Humphreys Peak", "Humphreys Peak", "peak", 1, "San Francisco Peaks"),
    Pick(44784, "AZ", "Phoenix", "Phoenix", "city", 1, "city"),
    Pick(43534, "AZ", "Tucson", "Tucson", "city", 1, "city"),
    Pick(847388, "NV", "Las Vegas", "Las Vegas", "city", 1, "city"),
    Pick(1454997, "UT", "Salt Lake City", "Salt Lake City", "city", 1, "city"),
    # priority 2
    Pick(1428399, "UT", "Green River", "Green River", "water", 2,
         "GNIS point is its mouth, the confluence with the Colorado"),
    Pick(42838, "AZ", "Gila River", "Gila River", "water", 2,
         "GNIS point is its mouth, at the Colorado near Yuma"),
    Pick(1441113, "WY", "Flaming Gorge Reservoir", "Flaming Gorge Reservoir", "water", 2,
         "reservoir on the Green River"),
    Pick(243280, "AZ", "Lake Havasu", "Lake Havasu", "water", 2, "reservoir"),
    Pick(1432342, "UT", "Sevier Lake", "Sevier Lake", "water", 2, "terminal lake, closed basin"),
    Pick(1425872, "UT", "Bonneville Salt Flats", "Bonneville Salt Flats", "basin", 2,
         "inside lake #3; nearest GNIS point to its birth cell"),
    Pick(1428200, "AZ", "Glen Canyon", "Glen Canyon", "canyon", 2,
         "below Glen Canyon Dam; GNIS point is its lower end"),
    Pick(1426406, "UT", "Cataract Canyon", "Cataract Canyon", "canyon", 2,
         "Colorado River above Lake Powell"),
    Pick(186506, "CO", "Black Canyon of the Gunnison", "Black Canyon of the Gunnison",
         "canyon", 2, "deep canyon kept open by the block minimum"),
    Pick(1425581, "UT", "Bingham Canyon", "Bingham Canyon", "canyon", 2,
         "the Bingham Canyon open pit (lake #6) is at its head"),
    Pick(8537, "UT", "Navajo Mountain", "Navajo Mountain", "peak", 2, "above Lake Powell"),
    Pick(1444257, "UT", "Mount Peale", "Mount Peale", "peak", 2, "La Sal Mountains"),
    Pick(861956, "NV", "Wheeler Peak", "Wheeler Peak", "peak", 2, "Snake Range, Great Basin"),
    Pick(29046, "AZ", "Flagstaff", "Flagstaff", "city", 2, "city"),
    Pick(204662, "CO", "Grand Junction", "Grand Junction", "city", 2, "city"),
    Pick(14111, "AZ", "Yuma", "Yuma", "city", 2, "city"),
    # priority 3
    Pick(31050, "AZ", "Little Colorado River", "Little Colorado River", "water", 3,
         "GNIS point is its mouth, at the Colorado"),
    Pick(42942, "AZ", "Theodore Roosevelt Lake", "Roosevelt Lake", "water", 3,
         "reservoir on the Salt River; shorter display name"),
    Pick(186973, "CO", "Blue Mesa Reservoir", "Blue Mesa Reservoir", "water", 3,
         "reservoir on the Gunnison"),
    Pick(1455153, "UT", "Sevier Desert", "Sevier Desert", "basin", 3, "Bonneville basin floor"),
    Pick(5204, "AZ", "Mount Graham", "Mount Graham", "peak", 3, "Pinaleño Mountains"),
    Pick(1430389, "UT", "Moab", "Moab", "city", 3, "town"),
    Pick(9110, "AZ", "Page", "Page", "city", 3, "town at Glen Canyon Dam"),
    Pick(1455098, "UT", "Saint George", "St. George", "city", 3,
         "city; common short form of the GNIS name"),
    Pick(1593588, "WY", "Rock Springs", "Rock Springs", "city", 3, "city"),
)  # fmt: skip


def log(msg: str) -> None:
    print(f"[labels] {msg}", flush=True)


# --- download (cached, with a sidecar) ------------------------------------------------------


def gnis_url(st: str) -> str:
    return GNIS_URL.format(st=st)


def download_gnis(st: str, cache_dir: Path, log=log) -> tuple[Path, dict]:
    """Fetch DomesticNames_<st>_Text.zip into cache_dir (atomic; reused when present).

    A sidecar ``<zip>.json`` records URL, access date, HTTP Last-Modified/ETag, bytes and
    SHA-256 at download time, so a rebuild from the cache is byte-identical.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    url = gnis_url(st)
    path = cache_dir / url.rsplit("/", 1)[1]
    side = path.with_name(path.name + ".json")
    if path.exists() and side.exists():
        rec = json.loads(side.read_text(encoding="utf-8"))
        data = path.read_bytes()
        if (
            len(data) != rec["bytes"]
            or hashlib.sha256(data).hexdigest() != rec["sha256"]
        ):
            raise RuntimeError(
                f"cached {path.name} does not match its sidecar; delete both"
            )
        log(f"cached {path.name} ({rec['bytes']:,} B, accessed {rec['accessDate']})")
        return path, rec

    import time

    import requests

    session = requests.Session()
    session.headers["User-Agent"] = "portfolio-data-pipeline/1.0 (python-requests)"
    resp = None
    for attempt in range(4):
        try:
            resp = session.get(url, timeout=120)
        except requests.RequestException as exc:
            log(f"{url}: {exc}; retrying")
        else:
            if resp.status_code == 200:
                break
            log(f"{url}: HTTP {resp.status_code}; retrying")
        resp = None
        if attempt < 3:
            time.sleep(2**attempt)
    if resp is None:
        raise RuntimeError(
            f"could not download {url}; stopping (no substitute data is used)"
        )
    data = resp.content
    if "Content-Length" in resp.headers and int(resp.headers["Content-Length"]) != len(
        data
    ):
        raise RuntimeError(f"{url}: truncated download")
    # Support Python 3.10, which lacks the datetime.UTC alias.
    access_date = dt.datetime.now(dt.timezone.utc).date()  # noqa: UP017
    rec = {
        "url": url,
        "accessDate": access_date.isoformat(),
        "httpLastModified": resp.headers.get("Last-Modified"),
        "httpEtag": resp.headers.get("ETag"),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    tmp = path.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(path)
    side.write_text(json.dumps(rec, indent=2) + "\n", encoding="utf-8")
    log(f"downloaded {path.name} ({len(data):,} B)")
    return path, rec


# --- reading ---------------------------------------------------------------------------------


def read_gnis_zip(path: Path, st: str) -> tuple[dict[int, dict], dict]:
    """Records keyed by feature_id (all columns as strings) and the FGDC citation fields."""
    with zipfile.ZipFile(path) as zf:
        txt = zf.read(f"Text/DomesticNames_{st}.txt").decode("utf-8-sig")
        xml = zf.read(f"DomesticNames_{st}_Text.xml")
    rows = csv.DictReader(io.StringIO(txt), delimiter="|", quoting=csv.QUOTE_NONE)
    recs: dict[int, dict] = {}
    for row in rows:
        fid = int(row["feature_id"])
        if fid in recs:
            raise RuntimeError(f"{path.name}: duplicate feature_id {fid}")
        recs[fid] = row
    root = ET.fromstring(xml)
    cit = root.find("idinfo/citation/citeinfo")
    if cit is None:
        raise RuntimeError(f"{path.name}: no citation in metadata")
    meta = {
        "title": cit.findtext("title"),
        "pubdate": cit.findtext("pubdate"),
        "originator": cit.findtext("origin"),
        "horizontalDatum": root.findtext(".//horizdn"),
        "useConstraints": root.findtext(".//useconst"),
    }
    if meta["horizontalDatum"] != "North American Datum of 1983":
        raise RuntimeError(f"{path.name}: unexpected datum {meta['horizontalDatum']!r}")
    return recs, meta


# --- grid convention -------------------------------------------------------------------------


def point_cell(win: cd.NativeWindow, lat: float, lon: float) -> tuple[int, int] | None:
    """Cell (x, y) whose native pixels contain (lat, lon); None outside the native raster."""
    col = math.floor(lon * cd.PX_PER_DEG + 0.5) - win.k0
    row = win.m_north - math.floor(lat * cd.PX_PER_DEG + 0.5)
    if not (0 <= col < win.width and 0 <= row < win.height):
        return None
    return col // cd.BLOCK, row // cd.BLOCK


def in_bbox(lat: float, lon: float, bbox=cd.BBOX) -> bool:
    w, s, e, n = bbox
    return w < lon < e and s < lat < n


# --- build -----------------------------------------------------------------------------------


def compute(raw_dir: Path, grid_meta: dict, grid_sha: str, log=log) -> dict:
    win = cd.native_window()
    W, H = grid_meta["width"], grid_meta["height"]
    if (win.width, win.height) != (
        grid_meta["native"]["width"],
        grid_meta["native"]["height"],
    ):
        raise RuntimeError("native window differs from meta.json")
    states = sorted({p.st for p in SELECTION})
    files, records = [], {}
    for st in states:
        path, rec = download_gnis(st, raw_dir / GNIS_SUBDIR, log)
        recs, fmeta = read_gnis_zip(path, st)
        records[st] = recs
        files.append(
            {
                "state": st,
                "url": rec["url"],
                "pubdate": fmeta["pubdate"],
                "accessDate": rec["accessDate"],
                "httpLastModified": rec["httpLastModified"],
                "bytes": rec["bytes"],
                "sha256": rec["sha256"],
            }
        )

    labels, seen_ids, seen_names, seen_cells = [], set(), set(), set()
    for p in SELECTION:
        if p.category not in CATEGORIES or p.priority not in (1, 2, 3):
            raise RuntimeError(f"{p.fid}: bad category/priority")
        r = records[p.st].get(p.fid)
        if r is None:
            raise RuntimeError(f"GNIS {p.fid} not in DomesticNames_{p.st}")
        if r["feature_name"] != p.gnis_name:
            raise RuntimeError(
                f"GNIS {p.fid}: name {r['feature_name']!r} != {p.gnis_name!r}"
            )
        lat, lon = float(r["prim_lat_dec"]), float(r["prim_long_dec"])
        if lat == 0.0 and lon == 0.0:
            raise RuntimeError(f"GNIS {p.fid}: location unknown")
        if not in_bbox(lat, lon):
            raise RuntimeError(
                f"GNIS {p.fid} {p.gnis_name}: ({lat}, {lon}) outside the bbox"
            )
        xy = point_cell(win, lat, lon)
        if xy is None:
            raise RuntimeError(f"GNIS {p.fid}: outside the native raster")
        x, y = xy
        i = y * W + x
        for key, seen in ((p.fid, seen_ids), (p.name, seen_names), (i, seen_cells)):
            if key in seen:
                raise RuntimeError(f"duplicate label {key!r} ({p.name})")
            seen.add(key)
        lab = {"id": p.fid, "name": r["feature_name"]}
        if p.name != r["feature_name"]:
            lab["display"] = p.name
        lab |= {
            "class": r["feature_class"],
            "category": p.category,
            "priority": p.priority,
            "lat": lat,
            "lon": lon,
            "x": x,
            "y": y,
        }
        if r["feature_class"] in MOUTH_CLASSES:
            lab["anchor"] = "mouth"
        labels.append(lab)
        log(
            f"{p.priority} {p.category:6s} {p.name:28s} GNIS {p.fid:>8} ({lat}, {lon}) -> {x},{y}"
        )
    if not (25 <= len(labels) <= 40):
        raise RuntimeError(f"{len(labels)} labels; expected 25-40")

    doc = {
        "description": (
            "Place labels for the explorer map. Coordinates are the GNIS primary feature "
            "location (prim_lat_dec, prim_long_dec), unrounded."
        ),
        "fields": {
            "id": "GNIS feature_id",
            "name": "GNIS feature_name, exactly",
            "display": "map text when it differs from name (else use name)",
            "class": "GNIS feature_class",
            "category": "|".join(CATEGORIES),
            "priority": "1 = always show; 2, 3 = drop first (3 before 2) when labels collide",
            "lat, lon": "degrees, NAD 83, used as WGS 84",
            "x, y": "grid cell whose native 3″ pixels contain the point (cell i = y*width + x)",
            "anchor": "mouth: GNIS places stream and valley records at their downstream end",
        },
        "grid": {
            "file": "grid.f32",
            "sha256": grid_sha,
            "width": W,
            "height": H,
            "cellDeg": grid_meta["cellDeg"],
            "extent": grid_meta["native"]["extent"],
            "pixelDeg": grid_meta["native"]["pixelDeg"],
            "rule": (
                "x = floor((lon - extent[0]) / pixelDeg) // 30, "
                "y = floor((extent[3] - lat) / pixelDeg) // 30"
            ),
        },
        "source": {
            "name": "USGS Geographic Names Information System (GNIS), Domestic Names, "
            "state text files",
            "page": GNIS_PAGE,
            "formatDoc": GNIS_FORMAT_DOC,
            "recordPage": GNIS_RECORD + "<id>",
            "files": files,
            "datum": "NAD 83 (GNIS file format: 'Datum is NAD83'). Used as WGS 84 without a "
            f'shift; USGS: "{DATUM_QUOTE}" ({DATUM_SOURCE})',
            "mouthRule": GNIS_FAQ_ARCHIVE,
        },
        "attribution": {
            "credit": CREDIT_LINE,
            "publicDomain": PUBLIC_DOMAIN_STATEMENT,
            "creditSource": USGS_CREDIT_PAGE,
        },
        "count": len(labels),
        "labels": labels,
    }
    return doc


def encode(doc: dict) -> bytes:
    """Indented JSON with one label per line (small and diff-friendly)."""
    body = {k: v for k, v in doc.items() if k != "labels"}
    head = json.dumps(body, indent=1, ensure_ascii=False)
    rows = ",\n".join(
        "  " + json.dumps(lab, ensure_ascii=False, separators=(",", ":"))
        for lab in doc["labels"]
    )
    return (head[:-2] + ',\n "labels": [\n' + rows + "\n ]\n}\n").encode("utf-8")


def write(out_dir: Path = OUT_DIR, raw_dir: Path = RAW_DIR, log=log) -> dict:
    grid_meta = json.loads((out_dir / "meta.json").read_text(encoding="utf-8"))
    grid_sha = hashlib.sha256((out_dir / "grid.f32").read_bytes()).hexdigest()
    if grid_sha != grid_meta["files"]["grid.f32"]["sha256"]:
        raise RuntimeError("grid.f32 differs from meta.json")
    doc = compute(raw_dir, grid_meta, grid_sha, log)
    data = encode(doc)
    if json.loads(data) != doc:
        raise RuntimeError("labels.json encoding round-trip failed")
    if len(data) > MAX_LABELS_BYTES:
        raise RuntimeError(f"{LABELS_FILE} is {len(data)} B > {MAX_LABELS_BYTES} B")
    (out_dir / LABELS_FILE).write_bytes(data)
    log(f"{LABELS_FILE}: {doc['count']} labels, {len(data):,} B")
    return doc


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--raw-dir", type=Path, default=RAW_DIR, help="cache directory (gnis/ inside)"
    )
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args(argv)
    write(args.out_dir, args.raw_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
