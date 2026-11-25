# F9 attempt 4: page JavaScript (gzip) per route — static import graph from each page's module
# scripts, plus everything reachable through dynamic import() (worst case). Inline scripts counted.
# Also data sizes. Checker-owned. Run: python3 docs/checks/tools/f9a4_js_budget.py
import glob
import gzip
import json
import os
import re

DIST = "dist"


def gz(b):
    return len(gzip.compress(b, 9))


def resolve(base, spec):
    if spec.startswith("/"):
        return os.path.normpath(DIST + spec)
    return os.path.normpath(os.path.join(os.path.dirname(base), spec))


static_re = re.compile(rb'(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["\']([^"\']+\.js)["\']')
dyn_re = re.compile(rb'import\(\s*["\']([^"\']+\.js)["\']\s*\)')
vite_dep_re = re.compile(rb'"(?:/_astro/|\./)?([\w.-]+\.js)"')


def graph(entry, follow_dynamic):
    seen, stack = set(), [entry]
    while stack:
        f = stack.pop()
        if f in seen or not os.path.exists(f):
            continue
        seen.add(f)
        src = open(f, "rb").read()
        for m in static_re.finditer(src):
            stack.append(resolve(f, m.group(1).decode()))
        if follow_dynamic:
            for m in dyn_re.finditer(src):
                stack.append(resolve(f, m.group(1).decode()))
            # vite preload dependency lists ("_astro/x.js" strings)
            for m in vite_dep_re.finditer(src):
                p = os.path.join(DIST, "_astro", m.group(1).decode())
                if os.path.exists(p):
                    stack.append(os.path.normpath(p))
    return seen


rows = {}
for html in sorted(glob.glob(f"{DIST}/**/*.html", recursive=True)):
    s = open(html, "rb").read()
    entries = [resolve(html, m.decode()) for m in re.findall(rb'<script[^>]*type="module"[^>]*src="([^"]+)"', s)]
    entries += [resolve(html, m.decode()) for m in re.findall(rb'<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"', s)]
    inline = b"".join(re.findall(rb"<script(?![^>]*src=)[^>]*>(.*?)</script>", s, flags=re.S))
    st, dy = set(), set()
    for e in entries:
        st |= graph(e, False)
        dy |= graph(e, True)
    rows[html] = {
        "entries": [os.path.basename(e) for e in entries],
        "initialGzipKB": round((sum(gz(open(f, "rb").read()) for f in st) + gz(inline)) / 1024, 1),
        "withAllLazyGzipKB": round((sum(gz(open(f, "rb").read()) for f in dy) + gz(inline)) / 1024, 1),
        "files": len(dy),
    }
data = {os.path.basename(f): os.path.getsize(f) for f in glob.glob(f"{DIST}/data/colorado/*")}
allj = {os.path.basename(f): gz(open(f, "rb").read()) for f in glob.glob(f"{DIST}/_astro/*.js")}
print(json.dumps({"pages": rows, "dataBytes": data, "dataTotalBytes": sum(data.values()),
                  "allAstroJsGzipKB": round(sum(allj.values()) / 1024, 1)}, indent=1))
