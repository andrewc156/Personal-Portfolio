# Per-page JS: inline <script> bodies + referenced local .js files, gzip size.
import sys, re, gzip, pathlib
d = pathlib.Path(sys.argv[1])
for f in sorted(d.rglob('*.html')):
    h = f.read_text()
    inline = ''.join(re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', h))
    srcs = re.findall(r'<script\b[^>]*src="([^"]+)"', h)
    ext = b''.join((d / s.lstrip('/')).read_bytes() for s in srcs if not s.startswith('http'))
    data = inline.encode() + ext
    print(f"{str(f.relative_to(d)):40s} inline={len(inline):6d}B srcs={srcs} total_gzip={len(gzip.compress(data))/1024:.2f}KB")
print('js files:', [ (str(p.relative_to(d)), p.stat().st_size) for p in d.rglob('*.js')])
