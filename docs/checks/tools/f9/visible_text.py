# Extract visible text (and aria-labels, alt, title, meta description) from dist HTML files.
import sys, re, html, pathlib
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.skip=0; s.out=[]; s.attrs=[]
    def handle_starttag(s,t,a):
        if t in('script','style','template'): s.skip+=1
        d=dict(a)
        for k in('aria-label','alt','title','placeholder'):
            if d.get(k): s.attrs.append(f'[{t} {k}] {d[k]}')
        if t=='meta' and d.get('name') in('description',) : s.attrs.append(f'[meta description] {d.get("content")}')
        if t=='meta' and d.get('property') in('og:title','og:description'): s.attrs.append(f'[{d["property"]}] {d.get("content")}')
    def handle_endtag(s,t):
        if t in('script','style','template'): s.skip-=1
        if t in('p','li','h1','h2','h3','h4','dt','dd','tr','figcaption','caption','div','section','button','a','th','td','summary','label','option'): s.out.append('\n')
    def handle_data(s,d):
        if not s.skip: s.out.append(d)
root=pathlib.Path(sys.argv[1])
for f in sorted(root.rglob('*.html')):
    p=P(); p.feed(f.read_text())
    txt=re.sub(r'[ \t]+',' ',''.join(p.out)); txt=re.sub(r'\n\s*\n+','\n',txt)
    print(f'########## {f.relative_to(root)}'); print(txt.strip()); print('--- attrs'); print('\n'.join(p.attrs))
