# F9 attempt 4: medians of Lighthouse runs per route, first run per route discarded. Checker-owned.
import collections, glob, json, statistics
runs = collections.defaultdict(list)
for f in sorted(glob.glob('.lighthouseci/lhr-*.json')):
    j = json.load(open(f))
    runs[j['requestedUrl'].split('localhost', 1)[1].split(':', 1)[-1]].append((j['fetchTime'], j))
out = {}
for url, rs in runs.items():
    rs = [j for _, j in sorted(rs, key=lambda t: t[0])][1:]
    med = lambda k: statistics.median(r['categories'][k]['score'] * 100 for r in rs)
    cls = max(r['audits']['cumulative-layout-shift']['numericValue'] for r in rs)
    out[url] = dict(n=len(rs), perf=med('performance'), a11y=med('accessibility'), bp=med('best-practices'),
                    seo=med('seo'), clsMax=round(cls, 4), perfAll=[r['categories']['performance']['score'] * 100 for r in rs],
                    failedBP=sorted({a for r in rs for a, v in r['audits'].items() if v.get('score') == 0 and a in [x['id'] for x in r['categories']['best-practices']['auditRefs']]}))
for k, v in out.items(): print(k, v)
json.dump(out, open('docs/checks/F9/attempt-4/lighthouse-summary.json', 'w'), indent=1)
