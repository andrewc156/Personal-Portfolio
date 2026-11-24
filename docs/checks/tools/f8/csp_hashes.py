"""F8 checker: independent CSP hash extraction (stdlib html.parser, not the builder's regex).

Usage: python -I csp_hashes.py <dist_dir> <headers_file>
Prints the computed sets and diffs them against the CSP in <headers_file>.
Exit 0 if script-src and style-src hash sets match exactly.
"""
import base64
import hashlib
import pathlib
import sys
from html.parser import HTMLParser

JS_TYPES = {"", "module", "text/javascript", "application/javascript"}


def h(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.cur = None  # (tag, is_exec_script)
        self.buf = []
        self.scripts, self.styles, self.style_attrs, self.handlers = set(), set(), set(), set()
        self.js_urls = []
        self.raw = {"script": 0, "style": 0, "styleattr": 0, "handler": 0}

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            value = value or ""
            if name == "style":
                self.style_attrs.add(h(value))
                self.raw["styleattr"] += 1
            elif name.startswith("on"):
                self.handlers.add(h(value))
                self.raw["handler"] += 1
            elif name in ("href", "src", "action", "formaction") and value.strip().lower().startswith("javascript:"):
                self.js_urls.append(value)
        if tag in ("script", "style"):
            d = dict(attrs)
            exec_script = tag == "script" and "src" not in d and (d.get("type") or "").strip().lower() in JS_TYPES
            self.cur = (tag, exec_script)
            self.buf = []

    def handle_data(self, data):
        if self.cur:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if self.cur and tag == self.cur[0]:
            body = "".join(self.buf)
            if tag == "style":
                self.styles.add(h(body))
                self.raw["style"] += 1
            elif self.cur[1]:
                self.scripts.add(h(body))
                self.raw["script"] += 1
            self.cur = None


def main():
    dist = pathlib.Path(sys.argv[1])
    headers = pathlib.Path(sys.argv[2]).read_text()
    p = P()
    files = sorted(dist.rglob("*.html"))
    for f in files:
        p.feed(f.read_text("utf-8"))
        p.close()
        p.reset()
        p.cur = None
    csp = next(l for l in headers.splitlines() if l.strip().startswith("Content-Security-Policy:"))
    dirs = {}
    for part in csp.split(":", 1)[1].split(";"):
        toks = part.split()
        if toks:
            dirs[toks[0]] = toks[1:]
    print(f"files={len(files)} occurrences={p.raw} js_urls={p.js_urls}")
    ok = True
    for name, el, attr in (("script-src", p.scripts, p.handlers), ("style-src", p.styles, p.style_attrs)):
        got = dirs.get(name, [])
        hashes = {t for t in got if t.startswith("'sha256-")}
        want = el | attr
        others = [t for t in got if not t.startswith("'sha256-")]
        need_uh = len(attr) > 0
        print(f"{name}: element={len(el)} attr={len(attr)} header_hashes={len(hashes)} other_tokens={others}")
        print(f"  missing={sorted(want - hashes)}")
        print(f"  extra={sorted(hashes - want)}")
        print(f"  unsafe-hashes present={(chr(39)+'unsafe-hashes'+chr(39)) in others} needed={need_uh}")
        if want != hashes or (("'unsafe-hashes'" in others) != need_uh):
            ok = False
    print("CSP line length", len(csp))
    print("MATCH" if ok else "MISMATCH")
    sys.exit(0 if ok else 1)


main()
