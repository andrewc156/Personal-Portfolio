import gzip
from html.parser import HTMLParser
from pathlib import Path

class Home(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.preloads = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"):
            self.scripts.append(a["src"])
        if tag == "link" and a.get("rel") == "modulepreload":
            self.preloads.append(a["href"])

html = Path("dist/index.html").read_text()
parser = Home()
parser.feed(html)
paths = sorted(set(parser.scripts + parser.preloads))
total = 0
for url in paths:
    size = len(gzip.compress(Path("dist", url.lstrip("/")).read_bytes(), mtime=0))
    total += size
    print(url, size, "B gzip")
print(f"Homepage HTML scripts and JS preloads total {total:,} B gzip.")
print("Lazy extra-mode chunk is not in homepage HTML:", not any("modes." in url for url in paths))
assert total <= 120_000
