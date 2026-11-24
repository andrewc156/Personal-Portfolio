# Extract research-thumbnail <svg> markup per page from a dist dir; prints hashes and external-ref checks.
import sys, re, hashlib, pathlib
d = pathlib.Path(sys.argv[1])
for f in sorted(d.rglob('*.html')):
    h = f.read_text()
    svgs = re.findall(r'<svg[^>]*class="[^"]*thumb[^"]*"[\s\S]*?</svg>', h)
    if not svgs: continue
    for i, s in enumerate(svgs):
        ext = re.findall(r'<image|<img|href=|url\((?!#)|xlink', s)
        print(f.relative_to(d), i, hashlib.sha256(s.encode()).hexdigest()[:16], len(s), 'ext=', ext)
print('img tags in dist html:', sum(len(re.findall(r'<img\b', p.read_text())) for p in d.rglob('*.html')))
