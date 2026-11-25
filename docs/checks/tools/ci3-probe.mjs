// CI3 checker probe (independent of docs/builds/CI3/place-label-probe.mjs).
// For each viewport × font variant × scheme × basin mask, enables place labels, then checks the
// RENDERED SVG geometry itself: P1 coverage, in-bounds, placard overlap, marker under another
// placard, leader crossing another placard (exact segment/rect clip), leader lengths, stale widths.
// Also records the platform font actually used (CDP) and any non-localhost requests.
// Usage: preview on :4321, DEJAVU=/path/DejaVuSans-Bold.ttf node docs/checks/tools/ci3-probe.mjs [out.json]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const dj = readFileSync(process.env.DEJAVU).toString('base64');
const forced = (fam) => `.ex-place-labels text, [data-ex-place-layer] text{font-family:${fam} !important}`;
const variants = [
  { name: 'Plex (site default)', css: '' },
  {
    name: 'DejaVu Sans Bold',
    css: `@font-face{font-family:'CKDejaVu';font-weight:600;src:url(data:font/ttf;base64,${dj}) format('truetype')}${forced("'CKDejaVu'")}`,
  },
  { name: 'Verdana', css: forced('Verdana') },
  { name: 'Arial', css: forced('Arial') },
  { name: 'Plex blocked → fallback stack', css: '', blockPlex: true },
];
const widths = (process.env.WIDTHS ?? '320,375,768,1280').split(',').map(Number);
const out = [];
const widthDump = {};
const browser = await chromium.launch();
for (const width of widths)
  for (const v of variants)
    for (const colorScheme of ['light', 'dark'])
      for (const mask of [true, false]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        const page = await ctx.newPage();
        const foreign = [];
        page.on('request', (r) => {
          const u = new URL(r.url());
          if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http'))
            foreign.push(r.url());
        });
        if (v.blockPlex) await page.route(/ibm-plex-sans.*\.woff2?$/, (r) => r.abort());
        await page.goto(`${BASE}/rising-water/`);
        await page.locator('[data-explorer]').waitFor();
        if (v.css) await page.addStyleTag({ content: v.css });
        await page.evaluate(() => document.fonts.ready);
        const maskBox = page.getByRole('checkbox', { name: 'Basin mask' });
        if (mask) await maskBox.check();
        else await maskBox.uncheck();
        const labels = page.getByRole('checkbox', { name: 'Place labels' });
        await labels.check();
        await page.waitForTimeout(400);
        // Toggle so the forced face (added via a style tag, no loadingdone) is measured.
        if (v.css) {
          await labels.uncheck();
          await labels.check();
          await page.waitForTimeout(250);
        }
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
        const { nodeId } = await cdp.send('DOM.querySelector', {
          nodeId: root.nodeId,
          selector: '[data-place-placards] text',
        });
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        const r = await page.evaluate(() => {
          const svg = document.querySelector('[data-ex-place-layer]');
          const { width: W, height: H } = svg.getBoundingClientRect();
          const groups = [...svg.querySelectorAll('[data-place-placards] [data-place-id]')];
          const placed = groups.filter((g) => g.hasAttribute('data-placed'));
          const rects = placed.map((g) => {
            const rc = g.querySelector('rect');
            const id = g.dataset.placeId;
            const m = svg.querySelector(`[data-place-marker="${id}"]`);
            const c = m.querySelector('circle');
            const l = m.querySelector('line');
            return {
              id,
              name: g.textContent.trim(),
              p: g.dataset.priority,
              x: +rc.getAttribute('x'),
              y: +rc.getAttribute('y'),
              w: +rc.getAttribute('width'),
              h: +rc.getAttribute('height'),
              cx: +c.getAttribute('cx'),
              cy: +c.getAttribute('cy'),
              r: +c.getAttribute('r') || 2.5,
              lx1: +l.getAttribute('x1'),
              ly1: +l.getAttribute('y1'),
              lx2: +l.getAttribute('x2'),
              ly2: +l.getAttribute('y2'),
              tw: g.querySelector('text').getComputedTextLength(),
              markerShown: m.hasAttribute('data-placed') && getComputedStyle(m).display !== 'none',
            };
          });
          // Liang–Barsky segment vs rect (rect strictly interior hit, no stroke expansion).
          const segHits = (a, b) => {
            let t0 = 0,
              t1 = 1;
            const dx = a.lx2 - a.lx1,
              dy = a.ly2 - a.ly1;
            for (const [p, q] of [
              [-dx, a.lx1 - b.x],
              [dx, b.x + b.w - a.lx1],
              [-dy, a.ly1 - b.y],
              [dy, b.y + b.h - a.ly1],
            ]) {
              if (p === 0) {
                if (q <= 0) return false;
              } else {
                const t = q / p;
                if (p < 0) t0 = Math.max(t0, t);
                else t1 = Math.min(t1, t);
                if (t0 >= t1) return false;
              }
            }
            return true;
          };
          const issues = [];
          for (const a of rects) {
            if (a.x < 0 || a.y < 0 || a.x + a.w > W + 0.01 || a.y + a.h > H + 0.01)
              issues.push(`oob ${a.name}`);
            if (Math.abs(a.w - (Math.ceil(a.tw) + 8)) > 0.01) issues.push(`stale ${a.name}`);
            // Leader must end on own placard.
            const onOwn =
              a.lx2 >= a.x - 0.01 && a.lx2 <= a.x + a.w + 0.01 && a.ly2 >= a.y - 0.01 && a.ly2 <= a.y + a.h + 0.01;
            if (!onOwn) issues.push(`leader-not-on-own ${a.name}`);
            for (const b of rects) {
              if (a === b) continue;
              if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
                issues.push(`overlap ${a.name}/${b.name}`);
              const rr = a.r + 0.75;
              if (a.cx + rr > b.x && a.cx - rr < b.x + b.w && a.cy + rr > b.y && a.cy - rr < b.y + b.h)
                issues.push(`marker ${a.name} under ${b.name}`);
              if (segHits(a, b)) issues.push(`leader ${a.name} crosses ${b.name}`);
            }
          }
          const p1 = groups.filter((g) => g.dataset.priority === '1');
          const lens = rects.map((a) => ({ name: a.name, p: a.p, len: Math.hypot(a.lx2 - a.lx1, a.ly2 - a.ly1) }));
          lens.sort((a, b) => b.len - a.len);
          const lv = rects.find((a) => a.name === 'Las Vegas');
          return {
            layer: `${W.toFixed(1)}x${H.toFixed(1)}`,
            placed: placed.length,
            total: groups.length,
            p1Placed: p1.filter((g) => g.hasAttribute('data-placed')).length,
            p1: p1.length,
            p1Missing: p1.filter((g) => !g.hasAttribute('data-placed')).map((g) => g.textContent.trim()),
            issues,
            maxLeader: lens.slice(0, 3).map((l) => `${l.name}(p${l.p}) ${l.len.toFixed(1)}`),
            lasVegas: lv ? { x: lv.x, y: lv.y, w: lv.w, leader: Math.hypot(lv.lx2 - lv.lx1, lv.ly2 - lv.ly1).toFixed(1) } : null,
            status: document.querySelector('[data-ex-place-status]')?.textContent,
            textWidths: Object.fromEntries(groups.map((g) => [g.dataset.placeId, +g.querySelector('text').getComputedTextLength().toFixed(2)])),
          };
        });
        widthDump[v.name] ??= r.textWidths;
        delete r.textWidths;
        out.push({ width, font: v.name, colorScheme, mask, platformFont: fonts.map((f) => f.familyName).join('+'), foreign: foreign.length, ...r });
        await ctx.close();
      }
await browser.close();
writeFileSync(process.argv[2] ?? 'docs/checks/CI3/probe.json', JSON.stringify(out, null, 1));
writeFileSync('docs/checks/CI3/widths.json', JSON.stringify(widthDump, null, 1));
for (const o of out)
  console.log(
    [o.width, o.font.padEnd(30), o.colorScheme, o.mask ? 'mask' : 'nomask', o.platformFont, `${o.placed}/${o.total}`, `P1 ${o.p1Placed}/${o.p1}`, o.p1Missing.join(','), `issues=${o.issues.length}`, `foreign=${o.foreign}`, o.maxLeader[0]].join(' | '),
  );
