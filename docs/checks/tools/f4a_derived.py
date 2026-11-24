"""F4a checker: independent §6.4 derived values and hillshade/WebP inspection."""
import math
import sys
from PIL import Image
W, S, E, N = (-115.201667, 31.817500, -107.060833, 42.157500)
a = 6378137.0; f = 1 / 298.257223563; e2 = f * (2 - f)
clat = 36.9875
print("center from bbox:", (S + N) / 2, (W + E) / 2)
print("span:", round(E - W, 6), round(N - S, 6))
def parallel_km(lat, dlon):
    p = math.radians(lat); n = a / math.sqrt(1 - e2 * math.sin(p) ** 2)
    return n * math.cos(p) * math.radians(dlon) / 1000
def meridian_km(l0, l1, steps=100000):
    tot = 0.0; h = (l1 - l0) / steps
    for i in range(steps):
        p = math.radians(l0 + (i + 0.5) * h)
        tot += a * (1 - e2) / (1 - e2 * math.sin(p) ** 2) ** 1.5 * math.radians(h)
    return tot / 1000
print("E-W km at centre/S/N:", round(parallel_km(clat, E - W), 2), round(parallel_km(S, E - W), 2), round(parallel_km(N, E - W), 2))
print("N-S km:", round(meridian_km(S, N), 2), " sphere R=6371:", round(6371 * math.radians(N - S), 1))
print("display aspect:", round((E - W) * math.cos(math.radians(clat)) / (N - S), 5))
im = Image.open(sys.argv[1]); print("webp:", im.format, im.mode, im.size)
