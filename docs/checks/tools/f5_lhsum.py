import json,sys
for f in sys.argv[1:]:
    r=json.load(open(f))
    c=r['categories'];a=r['audits']
    print(f.split('/')[-3:], r['finalDisplayedUrl'] if 'finalDisplayedUrl' in r else r.get('finalUrl'),
      'perf',round(c['performance']['score']*100),'a11y',round(c['accessibility']['score']*100),
      'bp',round(c['best-practices']['score']*100),'seo',round(c['seo']['score']*100),
      'CLS',round(a['cumulative-layout-shift']['numericValue'],4),'TBT',round(a['total-blocking-time']['numericValue']),
      'LCP',round(a['largest-contentful-paint']['numericValue']),'FCP',round(a['first-contentful-paint']['numericValue']))
    fails=[k for k,v in a.items() if v.get('score') is not None and v['score']<1 and v.get('scoreDisplayMode') in ('binary',) ]
    print('  binary fails:',fails)
