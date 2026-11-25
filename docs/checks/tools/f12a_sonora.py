"""F12a: trace tohuc for HU-12s in HU-4 1508 using own dBASE reader."""
import struct, sys
from collections import Counter
from pathlib import Path
def dbf(p):
    d = Path(p).read_bytes(); n = struct.unpack("<I", d[4:8])[0]; hl, rl = struct.unpack("<HH", d[8:12])
    f = []; o = 32
    while d[o] != 0x0D:
        f.append((d[o:o+11].split(b"\0")[0].decode(), d[o+16])); o += 32
    out = []
    for k in range(n):
        r = d[hl+k*rl+1: hl+(k+1)*rl]; pos = 0; rec = {}
        for nm, ln in f: rec[nm] = r[pos:pos+ln].decode("latin-1").strip(); pos += ln
        out.append(rec)
    return out
w = Path(sys.argv[1])
recs = dbf(w/"14/Shape/WBDHU12.dbf") + dbf(w/"15/Shape/WBDHU12.dbf")
to = {r["huc12"]: r["tohuc"] for r in recs}
son = [h for h in to if h.startswith("1508")]
term = Counter(); left = set()
for h in son:
    c = h; seen = set()
    while c in to and c not in seen:
        seen.add(c); left |= {c[:4]}; c = to[c]
    term[c] += 1
print("1508 HU12s", len(son), "terminals", dict(term), "hu4s on paths", sorted(left))
