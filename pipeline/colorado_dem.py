"""Copernicus DEM GLO-90 -> Colorado River Basin study-area grid (spec §6.4, §6.5).

Pure processing helpers shared by ``pipeline.build_colorado`` and the tests.
Nothing here touches the network except ``download_tiles``.

Pixel convention (verified from a real tile, see docs/data.md):
the AWS COG tiles are PixelIsPoint. Tile ``N{la}_W{lo}`` has 1200 x 1200 pixels
whose centres are at lon = -lo + j/1200 (j = 0..1199) and
lat = la + 1 - i/1200 (i = 0..1199). The name is the south-west integer corner;
the south row (lat = la) and east column (lon = -lo + 1) belong to the
neighbouring tiles. So every GLO-90 pixel centre below 50° lies on the global
lattice lon = k/1200, lat = m/1200, and we address the mosaic by (m, k).
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

# --- study area (spec §6.4, use exactly) -----------------------------------
BBOX = (-115.201667, 31.817500, -107.060833, 42.157500)  # W, S, E, N
CENTER = (36.987500, -111.131250)  # lat, lon
PX_PER_DEG = 1200  # 3 arc-seconds
PIXEL_DEG = 1.0 / PX_PER_DEG
BLOCK = 30  # TDA grid: 30 x 30 native pixels -> 0.025°
HILLSHADE_BLOCK = 10  # 30 arc-seconds
LAT_RANGE = range(31, 43)  # tile names N31..N42
LON_RANGE = range(108, 117)  # tile names W108..W116
TILE_PX = 1200

BUCKET_URL = "https://copernicus-dem-90m.s3.amazonaws.com"
TILE_LIST_URL = f"{BUCKET_URL}/tileList.txt"

# Only tiles that could plausibly be all-ocean (northern Gulf of California,
# south-west corner) may be absent. Any other missing tile is an error.
PLAUSIBLE_OCEAN_TILES = {(31, 113), (31, 114), (31, 115), (31, 116)}

# Values at or below this are treated as nodata (Copernicus uses -32767 in
# some products); the lowest real land on Earth is about -430 m.
NODATA_THRESHOLD = -1000.0

WGS84_A = 6378137.0
WGS84_F = 1 / 298.257223563
WGS84_E2 = WGS84_F * (2 - WGS84_F)


def tile_name(lat: int, lon_w: int) -> str:
    return f"Copernicus_DSM_COG_30_N{lat:02d}_00_W{lon_w:03d}_00_DEM"


def tile_url(lat: int, lon_w: int) -> str:
    name = tile_name(lat, lon_w)
    return f"{BUCKET_URL}/{name}/{name}.tif"


@dataclass(frozen=True)
class NativeWindow:
    """The native-pixel window of the bbox on the global 3″ lattice.

    Columns k in [k0, k1) (centre lon = k/1200), rows m in (m_south, m_north]
    (centre lat = m/1200), output row y = m_north - m (row 0 north).
    This half-open rule is the same one the tiles use (west column and north
    row included, east column and south row excluded).
    """

    k0: int
    k1: int
    m_north: int
    m_south: int
    residuals_px: dict

    @property
    def width(self) -> int:
        return self.k1 - self.k0

    @property
    def height(self) -> int:
        return self.m_north - self.m_south

    def footprint(self) -> tuple[float, float, float, float]:
        """Pixel-edge extent (W, S, E, N) of the clipped native raster."""
        half = 0.5 * PIXEL_DEG
        return (
            self.k0 * PIXEL_DEG - half,
            (self.m_south + 1) * PIXEL_DEG - half,
            (self.k1 - 1) * PIXEL_DEG + half,
            self.m_north * PIXEL_DEG + half,
        )

    def pixel_lonlat(self, y: int, x: int) -> tuple[float, float]:
        """Centre (lat, lon) of native output pixel (y, x)."""
        return ((self.m_north - y) * PIXEL_DEG, (self.k0 + x) * PIXEL_DEG)


def native_window(bbox=BBOX) -> NativeWindow:
    w, s, e, n = bbox
    raw = {
        "west": w * PX_PER_DEG,
        "south": s * PX_PER_DEG,
        "east": e * PX_PER_DEG,
        "north": n * PX_PER_DEG,
    }
    snapped = {key: round(v) for key, v in raw.items()}
    residuals = {key: raw[key] - snapped[key] for key in raw}
    return NativeWindow(
        k0=snapped["west"],
        k1=snapped["east"],
        m_north=snapped["north"],
        m_south=snapped["south"],
        residuals_px=residuals,
    )


def tiles_for_window(win: NativeWindow) -> list[tuple[int, int]]:
    """(lat, lon_w) tile names whose pixels intersect the window, N to S, W to E."""
    lats = sorted({(m - 1) // TILE_PX for m in (win.m_south + 1, win.m_north)})
    lats = list(range(lats[0], lats[-1] + 1))
    lons_e = sorted({math.floor(k / TILE_PX) for k in (win.k0, win.k1 - 1)})
    lons_e = list(range(lons_e[0], lons_e[-1] + 1))
    return [(la, -lo) for la in reversed(lats) for lo in lons_e]


# --- download --------------------------------------------------------------


def _get(session, url: str, *, retries: int = 4, timeout: float = 60.0):
    import requests

    last_exc = None
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=timeout)
        except requests.RequestException as exc:  # network error: retry
            last_exc = exc
        else:
            if resp.status_code in (200, 404, 403):
                return resp
            last_exc = RuntimeError(f"HTTP {resp.status_code} for {url}")
        time.sleep(2**attempt)
    raise RuntimeError(f"failed to fetch {url} after {retries} attempts: {last_exc}")


def fetch_tile_list(raw_dir: Path, session, log) -> set[str]:
    path = raw_dir / "tileList.txt"
    if not path.exists():
        resp = _get(session, TILE_LIST_URL)
        if resp.status_code != 200:
            raise RuntimeError(f"tileList.txt: HTTP {resp.status_code}")
        tmp = path.with_suffix(".part")
        tmp.write_bytes(resp.content)
        tmp.replace(path)
        log(f"downloaded {TILE_LIST_URL}")
    return set(path.read_text().split())


def download_tiles(
    tiles, raw_dir: Path, log
) -> tuple[list[tuple[int, int]], list[dict]]:
    """Fetch missing tiles sequentially into raw_dir. Resumable (atomic rename).

    Returns (present tiles, missing-tile records). Raises on any missing tile
    that is not plausibly all-ocean.
    """
    import requests

    raw_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = "portfolio-dem-pipeline/1.0 (python-requests)"
    listed: set[str] | None = None
    present, missing = [], []
    for la, lo in tiles:
        name = tile_name(la, lo)
        path = raw_dir / f"{name}.tif"
        if path.exists() and path.stat().st_size > 0:
            present.append((la, lo))
            continue
        if listed is None:
            listed = fetch_tile_list(raw_dir, session, log)
        url = tile_url(la, lo)
        resp = _get(session, url)
        if resp.status_code == 200:
            tmp = path.with_suffix(".part")
            tmp.write_bytes(resp.content)
            tmp.replace(path)
            log(f"downloaded {name} ({len(resp.content) / 1e6:.1f} MB)")
            present.append((la, lo))
            continue
        in_list = name in listed
        ocean = (la, lo) in PLAUSIBLE_OCEAN_TILES and not in_list
        rec = {
            "tile": name,
            "lat": la,
            "lonW": lo,
            "http": resp.status_code,
            "inTileList": in_list,
            "reason": "all-ocean (absent from bucket tileList.txt; registry: ocean areas have no tiles, height 0)"
            if ocean
            else "ERROR: land tile missing",
        }
        log(
            f"missing {name}: HTTP {resp.status_code}, in tileList={in_list} -> {rec['reason']}"
        )
        if not ocean:
            raise RuntimeError(
                f"land tile {name} unavailable (HTTP {resp.status_code}); stopping"
            )
        missing.append(rec)
    return present, missing


# --- mosaic ----------------------------------------------------------------


def check_tile(ds, la: int, lo: int) -> None:
    """Assert a tile has the expected size, CRS, spacing and corner."""
    name = tile_name(la, lo)
    t = ds.transform
    errs = []
    if (ds.width, ds.height) != (TILE_PX, TILE_PX):
        errs.append(f"size {ds.width}x{ds.height}")
    # Tiles carry a WGS 84 GEOGCS without an EPSG authority code; check the
    # definition instead (equivalent to EPSG:4326 for a lon/lat raster).
    crs = ds.crs.to_dict() if ds.crs is not None else {}
    if crs.get("proj") != "longlat" or crs.get("datum") != "WGS84":
        errs.append(f"crs {ds.crs}")
    if ds.dtypes[0] != "float32":
        errs.append(f"dtype {ds.dtypes[0]}")
    if abs(t.a - PIXEL_DEG) > 1e-12 or abs(t.e + PIXEL_DEG) > 1e-12 or t.b or t.d:
        errs.append(f"pixel size {t.a},{t.e}")
    half = 0.5 * PIXEL_DEG
    if abs(t.c - (-lo - half)) > 1e-9 or abs(t.f - (la + 1 + half)) > 1e-9:
        errs.append(f"origin {t.c},{t.f} (expected {-lo - half},{la + 1 + half})")
    if ds.tags().get("AREA_OR_POINT") != "Point":
        errs.append(f"AREA_OR_POINT={ds.tags().get('AREA_OR_POINT')}")
    if errs:
        raise RuntimeError(f"{name}: unexpected georeferencing: {'; '.join(errs)}")


def build_mosaic(raw_dir: Path, win: NativeWindow, ocean_tiles=()) -> np.ndarray:
    """Clip the cached tiles to the native window. Ocean tiles -> 0 m."""
    import rasterio

    out = np.full((win.height, win.width), np.nan, dtype=np.float32)
    ocean = set(ocean_tiles)
    for la, lo in tiles_for_window(win):
        # tile pixel (i, j): m = (la+1)*1200 - i, k = -lo*1200 + j
        m_top, k_left = (la + 1) * TILE_PX, -lo * TILE_PX
        i0 = max(0, m_top - win.m_north)
        i1 = min(TILE_PX, m_top - win.m_south)
        j0 = max(0, win.k0 - k_left)
        j1 = min(TILE_PX, win.k1 - k_left)
        y0 = win.m_north - (m_top - i0)
        x0 = k_left + j0 - win.k0
        sl = (slice(y0, y0 + i1 - i0), slice(x0, x0 + j1 - j0))
        if (la, lo) in ocean:
            out[sl] = 0.0
            continue
        path = raw_dir / f"{tile_name(la, lo)}.tif"
        with rasterio.open(path) as ds:
            check_tile(ds, la, lo)
            data = ds.read(1)
            if ds.nodata is not None:
                bad = data == ds.nodata
                if bad.any():
                    raise RuntimeError(f"{path.name}: {int(bad.sum())} nodata pixels")
        out[sl] = data[i0:i1, j0:j1]
    bad = ~np.isfinite(out) | (out <= NODATA_THRESHOLD)
    if bad.any():
        ys, xs = np.nonzero(bad)
        raise RuntimeError(
            f"{int(bad.sum())} nodata/unfilled native pixels in the mosaic, first at "
            f"row {ys[0]}, col {xs[0]} (lat/lon {win.pixel_lonlat(int(ys[0]), int(xs[0]))}); "
            "not ocean, refusing to fill"
        )
    return out


# --- downsampling ----------------------------------------------------------


def block_min(a: np.ndarray, b: int) -> np.ndarray:
    """Minimum over b x b blocks, partial edge blocks use only real pixels."""
    h, w = a.shape
    H, W = -(-h // b), -(-w // b)
    p = np.full((H * b, W * b), np.inf, dtype=a.dtype)
    p[:h, :w] = a
    return p.reshape(H, b, W, b).min(axis=(1, 3))


def block_mean(a: np.ndarray, b: int) -> np.ndarray:
    """Mean over b x b blocks, partial edge blocks average only real pixels."""
    h, w = a.shape
    H, W = -(-h // b), -(-w // b)
    s = np.zeros((H * b, W * b), dtype=np.float64)
    c = np.zeros_like(s)
    s[:h, :w] = a
    c[:h, :w] = 1.0
    s = s.reshape(H, b, W, b).sum(axis=(1, 3))
    c = c.reshape(H, b, W, b).sum(axis=(1, 3))
    return (s / c).astype(np.float32)


def block_centers_lat(win: NativeWindow, b: int) -> np.ndarray:
    """Centre latitude of each block row (accounting for a partial last block)."""
    H = -(-win.height // b)
    y0 = np.arange(H) * b
    y1 = np.minimum(y0 + b, win.height)
    yc = (y0 + y1 - 1) / 2.0
    return (win.m_north - yc) * PIXEL_DEG


def block_center_lonlat(
    win: NativeWindow, b: int, y: int, x: int
) -> tuple[float, float]:
    """Centre (lat, lon) of block (y, x), partial edge blocks included."""
    ya, yb = y * b, min(y * b + b, win.height)
    xa, xb = x * b, min(x * b + b, win.width)
    lat = (win.m_north - (ya + yb - 1) / 2.0) * PIXEL_DEG
    lon = (win.k0 + (xa + xb - 1) / 2.0) * PIXEL_DEG
    return lat, lon


# --- hillshade -------------------------------------------------------------


def meters_per_degree_lat(lat_deg):
    phi = np.radians(lat_deg)
    m = WGS84_A * (1 - WGS84_E2) / (1 - WGS84_E2 * np.sin(phi) ** 2) ** 1.5
    return m * math.pi / 180.0


def meters_per_degree_lon(lat_deg):
    phi = np.radians(lat_deg)
    n = WGS84_A / np.sqrt(1 - WGS84_E2 * np.sin(phi) ** 2)
    return n * np.cos(phi) * math.pi / 180.0


def hillshade(
    z: np.ndarray,
    row_lat: np.ndarray,
    cell_deg: float,
    *,
    azimuth=315.0,
    altitude=45.0,
    zfactor=1.0,
):
    """Horn-gradient hillshade in [0, 1]. Row 0 north; E–W spacing scaled by cos(lat) per row."""
    zp = np.pad(z.astype(np.float64) * zfactor, 1, mode="edge")
    a, b_, c = zp[:-2, :-2], zp[:-2, 1:-1], zp[:-2, 2:]
    d, f = zp[1:-1, :-2], zp[1:-1, 2:]
    g, h, i = zp[2:, :-2], zp[2:, 1:-1], zp[2:, 2:]
    dx = (meters_per_degree_lon(row_lat) * cell_deg)[:, None]
    dy = (meters_per_degree_lat(row_lat) * cell_deg)[:, None]
    dz_east = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx)
    dz_north = ((a + 2 * b_ + c) - (g + 2 * h + i)) / (8 * dy)
    az, alt = math.radians(azimuth), math.radians(altitude)
    light = (math.cos(alt) * math.sin(az), math.cos(alt) * math.cos(az), math.sin(alt))
    norm = np.sqrt(dz_east**2 + dz_north**2 + 1.0)
    shade = (-dz_east * light[0] - dz_north * light[1] + light[2]) / norm
    return np.clip(shade, 0.0, 1.0)


# --- derived geometry -------------------------------------------------------


def meridian_arc_km(lat0: float, lat1: float, n: int = 2000) -> float:
    lats = np.linspace(lat0, lat1, n + 1)
    vals = meters_per_degree_lat(lats)
    return float(np.trapezoid(vals, lats)) / 1000.0


def derived_values(bbox=BBOX, center=CENTER) -> dict:
    w, s, e, n = bbox
    span_lon, span_lat = e - w, n - s
    clat = center[0]
    return {
        "spanDeg": {"lon": round(span_lon, 6), "lat": round(span_lat, 6)},
        "spanKm": {
            "eastWestAtCenterLat": round(
                float(meters_per_degree_lon(clat)) * span_lon / 1000.0, 1
            ),
            "eastWestAtSouthEdge": round(
                float(meters_per_degree_lon(s)) * span_lon / 1000.0, 1
            ),
            "eastWestAtNorthEdge": round(
                float(meters_per_degree_lon(n)) * span_lon / 1000.0, 1
            ),
            "northSouth": round(meridian_arc_km(s, n), 1),
            "ellipsoid": "WGS84",
        },
        "displayAspect": round(span_lon * math.cos(math.radians(clat)) / span_lat, 4),
        "displayAspectNote": "width/height of the equirectangular map scaled by cos(center latitude)",
    }


def compute_grid(
    raw_dir: Path, ocean_tiles=()
) -> tuple[np.ndarray, np.ndarray, NativeWindow]:
    """Native mosaic and its 30x30 block-minimum TDA grid (float32)."""
    win = native_window()
    native = build_mosaic(raw_dir, win, ocean_tiles)
    grid = block_min(native, BLOCK).astype("<f4")
    return native, grid, win
