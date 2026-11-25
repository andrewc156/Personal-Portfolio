# F23 production QA — 10 Delivery, SEO and performance

**Target:** `https://andrewchincea.com` · **Observed:** November 25, 2026, 21:34–21:39 UTC · **Source reference:** `20d59f9` · **Browser session:** `f23qa10`

## Result

All nine sampled public documents returned `200` over HTTPS, and the home page served the F23 Collatz default (`30` in response HTML and live DOM). This corroborates the F23 behavior, not the exact deployed SHA. **The localhost SEO issue is still live**: all nine canonical URLs, social metadata, and the entire sitemap discovery chain use `http://localhost:4321`. Sampled first-party scripts, styles, fonts and explorer assets loaded; no user-facing startup JS failure or broad performance regression was established.

| ID | Severity | Category | Reproduced defect |
|---|---|---|---|
| 10-01 | High | SEO / social discovery | Production canonicals, social URLs and sitemap tree point to localhost |
| 10-02 | Medium | Delivery / redirects | HTTP apex and HTTPS `www` serve the home page instead of redirecting to HTTPS apex |
| 10-03 | Medium | Delivery / UX | Unknown paths return an empty `404`; intended recovery page is not served |
| 10-04 | Low | Console / telemetry | Cloudflare Insights script is present but blocked by the page's CSP |

**Total:** 4 · 0 Critical, 1 High, 2 Medium, 1 Low.

## Reproducible defects

### 10-01 — Public metadata and sitemap advertise localhost · High

- **Repro:** Fetch the source HTML of `https://andrewchincea.com/` or any sampled route; inspect `link[rel=canonical]`, `og:url`, `og:image`, and `twitter:image`. Fetch `/robots.txt`, `/sitemap-index.xml`, and `/sitemap-0.xml` directly on the apex. Do not follow localhost links.
- **Expected:** Each route advertises its own production HTTPS URL; crawlers discover the production sitemap index and its production child URLs; social cards advertise the reachable production image.
- **Actual:** All four URL fields are wrong on **9/9** HTML routes. For example, home advertises `http://localhost:4321/` and `http://localhost:4321/og/social-card.png`. Robots allows crawling but advertises a localhost sitemap index; the index advertises a localhost child; all nine entries in that child are localhost URLs. Title, description, card type, image alt text and declared dimensions are present on home, and the PNG itself returns `200 image/png` at `/og/social-card.png` with actual dimensions **1200×630**. The live PNG bytes match `public/og/social-card.png` at `20d59f9`. This is a discovery/reference failure, not a missing image. No claim about actual index coverage or third-party card caches.
- **Evidence:** [Response source tags and headers](evidence/http.json), [robots](evidence/robots.txt), [sitemap index](evidence/sitemap-index.xml), [child sitemap](evidence/sitemap-0.xml), [live PNG](evidence/social-card.png).
- **Scope of conclusion:** `20d59f9:astro.config.mjs` has a localhost fallback for `SITE_URL`; Andrew reports the build variable pre-existed. The live output is wrong; this sample does not identify the setting's value, scope, build context or deployed artifact provenance. Verify the published build output and public responses after remediation rather than assuming the variable was missing.

### 10-02 — Host and scheme are not normalized · Medium

- **Repro:** `curl -sS -D - -o /dev/null http://andrewchincea.com/` and repeat for `https://www.andrewchincea.com/`. Do not enable redirects. The HTTP result was also repeated with `--noproxy '*'` (`proxy_used=0`).
- **Expected:** Requests at both aliases redirect to `https://andrewchincea.com/`; `20d59f9:docs/deploy.md` explicitly describes `www` → apex.
- **Actual:** Both return `200` without `Location`, and their decoded home bodies match HTTPS apex in the GET matrix. Raw HTTP receives page content instead of upgrading; HTTPS `www` is a duplicate serving origin. Browser HTTPS-first behavior was not used as proof of a server redirect. On apex, path normalization does work in both examples: `/rising-water` → `307 /rising-water/` and `/about/index.html` → `307 /about/`; target paths return `200`.
- **Evidence:** [GET status, `Location` and response hashes](evidence/http.json).

### 10-03 — Unknown URL skips the site's custom 404 · Medium

- **Repro:** Open `https://andrewchincea.com/not-a-page-f23qa10` in Chrome or fetch it with `curl -sS -i`; repeat with a trailing slash.
- **Expected:** HTTP `404` with the not-found page and home link from `20d59f9:src/pages/404.astro`.
- **Actual:** Both unknown URLs return `404` with zero body bytes. Chrome shows its own error page, without the site's recovery link. The custom page is independently reachable at `/404` as `200`; `/404.html` and `/404/` redirect there, but this does not make it the response for unknown paths.
- **Evidence:** [Initial GET](evidence/http.json), [slash variant and direct error-page route](evidence/not-found.json), [browser status and text](evidence/not-found-browser.json), [screenshot](screenshots/unknown-route.png).

### 10-04 — Delivered analytics script is blocked · Low

- **Repro:** Open `/` or `/rising-water/` and check Chrome Console/Network after initial load; repeat normally with cache enabled.
- **Expected:** If Insights is intended, its script loads under the intended policy. If it is not intended, the response does not include the beacon.
- **Actual:** The delivered HTML includes a script at `static.cloudflareinsights.com`; Chrome reports it violates the page's `script-src` and records `Network.loadingFailed` with `blockedReason: csp`. This repeated on both pages and on home reload. No uncaught first-party exception was observed. The failure is specific to this beacon; analytics requirements and other collection paths were not tested. Do not relax CSP solely to silence the error; reconcile with the intended analytics configuration.
- **Evidence:** [Script tag and policy headers](evidence/http.json), [home CDP](evidence/home-normal-cdp.json), [repeat CDP](evidence/home-normal-repeat-cdp.json), [Rising water CDP](evidence/water-normal-cdp.json).

## Delivery, asset and cache checks

- **Document coverage:** `/`, `/about/`, `/cv/`, `/garden/`, `/research/`, `/research/number-theory/`, `/research/spectral-fractals/`, `/research/water-quality/`, `/rising-water/`. All nine HTML pages returned `200`; robots and both XML endpoints returned `200` with appropriate types. No `noindex` directive appeared in the sampled documents' response headers or HTML metadata.
- **Assets:** Home and Rising water loaded the expected first-party CSS, WOFF2 fonts and JS modules with `200` in the cache-disabled samples. Favicon and social PNG loaded by direct GET. Explorer initial `hillshade.webp`, `meta.json`, `barcode.json` and `grid.f32` returned `200`; hillshade decoded and rendered, the explorer showed populated canvases and water status. Toggling Basin mask (browser UI state only) fetched `basin-mask.bin` and `basin-mask.json` with `200` and revealed the “Pit in basin” column. See [home](screenshots/home-desktop.png), [explorer](screenshots/rising-water-desktop.png), [startup evidence](evidence/water-render.json) and [basin assets](evidence/water-basin-assets.json).
- **Cache:** Observed `public, max-age=0, must-revalidate` on HTML, robots and sitemap; `max-age=31536000, immutable` on sampled content-hashed `/_astro` assets; `max-age=86400, must-revalidate` on Colorado data, PNG and favicon. Three ETag conditional GETs (home, sitemap index, social PNG) returned `304` with no body. The measured normal repeat reused subresources, while the browser's document still reported network transfer. Cloudflare reported `HIT` for many responses at the tested edge. No stale-version mismatch was established; validator behavior and observed policies do not prove cache purge/deployment consistency across edges or after expiry.

## Browser performance samples

Chrome Headless 156, `756 × 413` CSS px, DPR 1, no CPU/network throttle applied, no interaction during timing. Foreground tab. One cache-disabled navigation per page (browser cache bypass, **not** cold CDN/DNS/TLS), one cache-enabled home reload and one cache-enabled revisit to the explorer in the same session. Native Navigation/Resource Timing and buffered Paint/LCP/Layout Shift/Long Task observers were sampled roughly 5–7 seconds after navigation; CDP captures show request status and browser logs. Initial hidden-tab runs are preserved separately but excluded from the table.

| Page / sample | TTFB / DCL / load end (ms) | FCP / LCP candidate (ms) | Same-origin document + resources: transfer bytes | External first-party JS: encoded / decoded bytes |
|---|---:|---:|---:|---:|
| Home, cache disabled | 70 / 197 / 204 | 316 / 316 | 124,990 | 20,151 / 49,640 |
| Home, normal reload | 51 / 82 / 83 | 128 / 128 | 9,840 | 20,151 / 49,640 (cached) |
| Rising water, cache disabled | 25 / 105 / 135 | 332 / 332 | 845,742 | 21,700 / 56,650 |
| Rising water, cache-enabled revisit | 53 / 64 / 72 | 108 / 108 | 16,405 | 21,700 / 56,650 (cached) |

TTFB here is `responseStart` from navigation start; DCL is `domContentLoadedEventEnd`. Transfer uses browser `transferSize` (header allowance plus encoded body, zero for reported local-cache delivery), covering same-origin timing entries including post-load fetches. JS sizes sum external same-origin `.js` resource entries, not inline HTML scripts or JS execution cost. No layout-shift or long-task entries were observed in these windows. The LCP candidate was a paragraph in each sample; it does not measure completion of canvas/data rendering. In the cache-disabled explorer run, `grid.f32` (539,856 encoded bytes) and `hillshade.webp` (179,574) dominated payload. Timing evidence: [home cache-disabled](evidence/home-visible.json), [home repeat](evidence/home-normal-repeat.json), [explorer cache-disabled](evidence/water-visible.json), [explorer revisit](evidence/water-normal.json).

## Options and limitations

- **Performance option, not a defect:** On a representative phone and slow network, measure when the explorer is first usable, not just text LCP. If there is a user-visible delay, look first at the grid and hillshade delivery; the observed JS transfer was comparatively small. Instrument the canvas/explorer-ready milestone before deciding whether to compress, stream or defer anything.
- **Follow-up validation:** After fixing metadata, run an artifact/live check for the expected HTTPS apex on all absolute metadata and sitemap entries, then use a real preview/indexing tool if desired. This run did not exercise external preview bots, Search Console, or crawler-side cache invalidation.
- Single host/browser/location/time window and a small number of normal requests. No field CWV, Lighthouse score, throttled mobile test, INP claim, release baseline comparison, multi-edge cache validation or analytics dashboard access. Page delivery only; no exhaustive external link or secondary interaction crawl. No security testing, load testing, deployment/config changes or commit.
