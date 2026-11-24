"""Summarise LHCI runs: perf/a11y/BP/SEO, LCP, TBT, CLS, longest main-thread task, LCP element."""
import glob
import json
import sys
d = sys.argv[1]
for run in sorted(glob.glob(f'{d}/lh/run*'), key=lambda p: int(p.rsplit('run', 1)[1])):
    for f in sorted(glob.glob(f'{run}/lhr-*.json')):
        j = json.load(open(f))
        a = j['audits']
        c = j['categories']
        lt = a.get('long-tasks', {}).get('details', {}).get('items', [])
        longest = max(lt, key=lambda x: x['duration']) if lt else None
        lcpel = a.get('largest-contentful-paint-element', {}).get('details', {}).get('items', [{}])
        try:
            node = lcpel[0]['items'][0]['node']['snippet'][:60]
        except Exception:
            node = '?'
        print(f"{run.rsplit('/',1)[1]:6} {j['finalUrl'].split('/',3)[3] or '/':16} perf {round(c['performance']['score']*100):3} a11y {round(c['accessibility']['score']*100):3} BP {round(c['best-practices']['score']*100):3} SEO {round(c['seo']['score']*100):3} "
              f"LCP {a['largest-contentful-paint']['numericValue']:7.0f} TBT {a['total-blocking-time']['numericValue']:6.0f} CLS {a['cumulative-layout-shift']['numericValue']:.4f} "
              f"longest {('%.0f ms %s' % (longest['duration'], longest['url'].rsplit('/',1)[-1][:40])) if longest else 'none'} | LCP el {node}")
