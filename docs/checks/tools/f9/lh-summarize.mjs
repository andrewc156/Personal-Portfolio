// Summarize LHCI lhr-*.json: per URL, discard first run (warm-up), median of the rest.
import fs from 'node:fs';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f));
const runs = files.map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')))
  .sort((a, b) => new Date(a.fetchTime) - new Date(b.fetchTime));
const by = new Map();
for (const r of runs) {
  const p = new URL(r.finalDisplayedUrl || r.finalUrl).pathname;
  if (!by.has(p)) by.set(p, []);
  by.get(p).push({ perf: Math.round(r.categories.performance.score * 100), a11y: Math.round(r.categories.accessibility.score * 100),
    bp: Math.round(r.categories['best-practices'].score * 100), seo: Math.round(r.categories.seo.score * 100),
    cls: r.audits['cumulative-layout-shift'].numericValue, lcp: Math.round(r.audits['largest-contentful-paint'].numericValue),
    tbt: Math.round(r.audits['total-blocking-time'].numericValue),
    fails: Object.values(r.categories).flatMap((c) => c.id === 'performance' ? [] : c.auditRefs.filter((a) => a.weight > 0 && r.audits[a.id].score !== null && r.audits[a.id].score < 1).map((a) => a.id)),
    thirdParty: (r.audits['network-requests']?.details?.items || []).filter((i) => !/^https?:\/\/localhost/.test(i.url) && !i.url.startsWith('data:')).map((i) => i.url),
    ogLoaded: (r.audits['network-requests']?.details?.items || []).some((i) => i.url.includes('social-card')) });
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (const [p, rs] of by) {
  const j = rs.slice(1);
  const m = (k) => med(j.map((x) => x[k]));
  console.log(`${p.padEnd(30)} n=${rs.length} warmup=${rs[0].perf}/${rs[0].a11y}/${rs[0].bp}/${rs[0].seo} judged perf=[${j.map((x) => x.perf)}] med perf=${m('perf')} a11y=${m('a11y')} bp=${m('bp')} seo=${m('seo')} cls=${m('cls').toFixed(4)} maxCLS=${Math.max(...rs.map((x) => x.cls)).toFixed(4)} lcp=${m('lcp')} tbt=${m('tbt')} fails=${[...new Set(rs.flatMap((x) => x.fails))].join(',') || '-'} 3p=${rs.flatMap((x) => x.thirdParty).length} og=${rs.some((x) => x.ogLoaded)}`);
}
