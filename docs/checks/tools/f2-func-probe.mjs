// F2 functional probe (checker's own, independent of e2e/site.spec.ts).
import { chromium } from 'playwright';
const B = 'http://localhost:4321';
const b = await chromium.launch();
const out = (...a) => console.log(...a);
const visibleRows = (p) => p.$$eval('[data-work-row]', (rs) => rs.filter((r) => !r.hidden && r.offsetParent !== null).map((r) => r.dataset.id));

// 1. Console errors + third-party requests on every page
{
  const c = await b.newContext(); const p = await c.newPage();
  const errs = [], third = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${p.url()} ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${p.url()} pageerror: ${e.message}`));
  p.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) third.push(r.url()); });
  for (const u of ['/', '/garden/', '/garden/?type=poster&tag=spectral-fractals', '/research/', '/research/water-quality/', '/research/tda-rivernets/', '/research/number-theory/', '/research/spectral-fractals/', '/cv/', '/about/']) {
    await p.goto(B + u, { waitUntil: 'networkidle' });
  }
  out('CONSOLE errors/warnings:', errs); out('THIRD-PARTY requests:', third);
  await c.close();
}
// 2. JS disabled
{
  const c = await b.newContext({ javaScriptEnabled: false }); const p = await c.newPage();
  for (const u of ['/garden/', '/garden/?type=poster', '/garden/?type=talk&tag=water-quality']) {
    await p.goto(B + u);
    out('NOJS', u, 'rows', await visibleRows(p), 'emptyHidden', await p.$eval('[data-garden-empty]', (e) => e.hidden), 'chipHref', await p.$$eval('a[data-filter]', (a) => a.map((x) => x.getAttribute('href')).join(' ')));
  }
  await c.close();
}
// 3. Deep links + combined
{
  const c = await b.newContext(); const p = await c.newPage();
  for (const u of ['/garden/', '/garden/?type=poster', '/garden/?type=project', '/garden/?tag=tda-rivernets', '/garden/?tag=spectral-fractals', '/garden/?type=poster&tag=spectral-fractals', '/garden/?type=project&tag=spectral-fractals', '/garden/?tag=water-quality', '/garden/?type=bogus&tag=nope', '/garden/?type=talk']) {
    await p.goto(B + u);
    out('DEEP', u, 'rows', JSON.stringify(await visibleRows(p)), 'status', JSON.stringify(await p.textContent('[data-garden-status]')), 'empty', await p.isVisible('[data-garden-empty]'), 'current', await p.$$eval('a[data-filter][aria-current]', (a) => a.map((x) => x.dataset.filter + '=' + x.dataset.value).join(',')));
  }
  // 4. Keyboard: tab to chips, Enter, Space?
  await p.goto(B + '/garden/');
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const a = document.activeElement; return a?.dataset?.filter ? `${a.dataset.filter}=${a.dataset.value}` : a?.textContent?.trim().slice(0, 30); });
    seen.push(f);
    if (f === 'type=poster') break;
  }
  out('TAB order to Posters chip:', seen.join(' | '));
  const outline = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
  await p.keyboard.press('Enter');
  out('KB after Enter on Posters: url', p.url(), 'rows', await visibleRows(p), 'focused', await p.evaluate(() => document.activeElement?.dataset?.value), 'outline', outline);
  // tab forward to an area chip
  for (let i = 0; i < 10; i++) { await p.keyboard.press('Tab'); const v = await p.evaluate(() => document.activeElement?.dataset?.value); if (v === 'spectral-fractals') break; }
  await p.keyboard.press('Enter');
  out('KB after Enter on spectral-fractals: url', p.url(), 'rows', await visibleRows(p));
  await p.goBack(); out('BACK url', p.url(), 'rows', await visibleRows(p));
  await p.goBack(); out('BACK2 url', p.url(), 'rows', await visibleRows(p));
  // 5. Related work links from home cards
  await p.goto(B + '/');
  const rel = await p.$$eval('#research a', (as) => as.map((a) => `${a.textContent.replace(/\s+/g, ' ').trim()} -> ${a.getAttribute('href')}`));
  out('HOME research links:', rel);
  for (const slug of ['water-quality', 'tda-rivernets', 'number-theory', 'spectral-fractals']) {
    await p.goto(B + '/');
    await p.locator(`#research a[href="/garden/?tag=${slug}"]`).click();
    await p.waitForURL(/garden/);
    out('RELATED', slug, p.url(), 'rows', JSON.stringify(await visibleRows(p)), 'current', await p.$$eval('a[data-filter][aria-current]', (a) => a.map((x) => x.dataset.filter + '=' + x.dataset.value).join(',')));
  }
  // research index page links too
  await p.goto(B + '/research/');
  out('RESEARCH index links:', await p.$$eval('main a', (as) => as.map((a) => a.getAttribute('href')).join(' ')));
  // 6. Home section order, teaching/contact
  await p.goto(B + '/');
  out('HOME sections:', await p.$$eval('main section[id]', (s) => s.map((x) => x.id).join(' > ')));
  out('HOME #teaching/#contact count:', await p.locator('#teaching').count(), await p.locator('#contact').count());
  out('HOME h1/h2:', await p.$$eval('main h1, main h2', (h) => h.map((x) => x.tagName + ':' + x.textContent.trim()).join(' | ')));
  // 7. Citations
  for (const u of ['/', '/research/spectral-fractals/', '/research/tda-rivernets/', '/cv/']) {
    await p.goto(B + u);
    const cites = await p.$$eval('main .citation, main [class*="citation"]', (cs) => cs.filter(c => c.matches('[class~="citation"]') || true).map((c) => ({ cls: c.className, html: c.innerHTML.replace(/ data-astro-cid-\w+/g, '').replace(/\s+/g, ' ').slice(0, 700) })));
    out('CITES', u, JSON.stringify(cites.slice(0, 4), null, 1));
  }
  // 8. CV PDF
  await p.goto(B + '/cv/');
  out('CV pdf links:', await p.$$eval('a', (as) => as.filter((a) => /pdf/i.test(a.textContent + a.href)).map((a) => a.outerHTML)));
  out('CV headings:', await p.$$eval('main h1,main h2,main h3', (h) => h.map((x) => x.tagName + ':' + x.textContent.trim()).join(' | ')));
  await c.close();
}
await b.close();
