# Check report — F24 Production delivery (QA-01, QA-02, QA-12, QA-18) — attempt 1
Verdict: PASS_WITH_NOTES

Candidate: uncommitted working tree on `main` @ `20d59f9` with F24+F25+F26+F27 and Control's shared-file edits (package.json `check:prod`, tsconfig/eslint ignores for `docs/checks/**/test-results`, global.css `:root.js .hero__btn:disabled`). The shared gates below were run once for all four features (serially, port 4321).

Gates: check ✅ (169 files, 0 errors/warnings/hints) · lint ✅ (ESLint + Prettier, whole repo) · unit ✅ (37 files, 913 tests; `tests/unit/delivery` included) · pytest ✅ (606 passed) · ruff ✅ · build ✅ (local, `WORKERS_CI=1`, and two guard-failure builds) · e2e ⚠️ 212 passed / 6 failed / 10 skipped. The skips are `headers.spec`, which needs `HEADERS_BASE_URL`; run separately against `wrangler dev`, 10/10 passed. All 6 failures are hero timing tests that need hosted CI; see F26 · axe ✅ (see F25) · lighthouse ✅ (`/` 100/100/100/100, `/404.html` 100/100/100/100, `/rising-water/` 96/100/96/100, `/garden/` 100/100/100/100, all CLS 0.000. The `/rising-water/` best-practices 96 is the old `image-aspect-ratio` result, which also appears in the earlier 07:38 run) · links ✅ (30 internal links, 0 broken) · visual n/a · content ✅ · tda n/a · data n/a

Control's shared edits: `check:prod` runs `scripts/check-production.mjs` ✅. The tsconfig `exclude` and ESLint `ignores` entries for `docs/checks/**/test-results` fixed both repo-wide failures the builders reported (check 0 errors, lint clean).

## Per-finding table

| QA finding | Repro (from docs/qa/f23-production) | Result | Evidence |
|---|---|---|---|
| QA-01 localhost metadata | View source on `/` or a research page; open `/robots.txt` and `/sitemap-index.xml` | ✅ Fixed in build output. `WORKERS_CI=1 npm run build`: canonical, og:url, og:image and twitter:image on `/` and `/rising-water/` are all `https://andrewchincea.com/…`. robots has `Sitemap: https://andrewchincea.com/sitemap-index.xml`. The index and `sitemap-0.xml` `<loc>`s are on the apex. `grep localhost dist` found nothing. The guard log says `49 public URLs checked: all https, none localhost`. **Guard negative cases:** `SITE_URL=http://localhost:4321 WORKERS_CI=1 npm run build` exits 1 with 51 problems listed; `SITE_URL=http://andrewchincea.com CF_PAGES=1` exits 1 (49, non-https). A plain local build still uses localhost and skips the guard. | `F24/attempt-1/build-workers-ci.log`, `build-guard-localhost.log`, `build-guard-http.log`, `build-local-final.log` |
| QA-02 empty 404 | Request an unknown path | ✅ Under `wrangler dev --port 8788`: `/definitely-not-here` and `/nested/missing/page.html` return **404** with the branded body (7.2 KB, `<title>Page not found · Andrew Chincea</title>`) and the full CSP and security headers. HEAD also returns 404 with headers. `check-production` against wrangler + a production build finds both NOT_FOUND markers. | `wrangler-curl.txt`, `wrangler-curl-prodbuild.txt`, `check-production-wrangler-prodbuild.log` |
| QA-12 http/www not normalised | Request `http://andrewchincea.com/` and `https://www.andrewchincea.com/` | ✅ Logic verified; live needs deploy. **Real Worker bundle in Node** (esbuild, dist/_headers inlined as the Text rule does), 13/13: http apex → 301 `https://andrewchincea.com/garden/?type=paper&x=%20y`; https/http www (with port, uppercase) → one-hop 301, path and query kept; https apex, `localhost`, `*.workers.dev` and `andrewchincea.com.evil.com` are not redirected; POST on www → 301; redirects carry the CSP and security headers but no Cache-Control. **`wrangler dev` with a Host header:** `Host: www.andrewchincea.com` → 301 `https://andrewchincea.com/cv/?a=1`. `Host: andrewchincea.com` shows `Location: http://andrewchincea.com/…` only because wrangler's dev ProxyWorker rewrites any header URL whose host equals the request host to the local origin (`node_modules/wrangler/wrangler-dist/ProxyWorker.js:25-39,156`). It is a dev artefact; the Worker itself emits https (Node run above). | `worker-node.txt`, `wrangler-curl-prodbuild.txt`; tool `docs/checks/tools/f24-27-worker-node.mjs` |
| QA-18 analytics blocked by CSP | Load a page with console capture | ✅ The CSP on `/` names exactly two third-party origins, once each: `script-src … https://static.cloudflareinsights.com` and `connect-src 'self' https://cloudflareinsights.com`. default/style/img/font-src have no hosts, and there is no unsafe-inline/eval. The CSP line is 959/2000 chars. `check-production`'s `cspProblems` asserts the same. Beacon injection can only be confirmed after deploy. | `wrangler-curl-prodbuild.txt` (last block), `check-production-wrangler-prodbuild.log` |

## Worker under `wrangler dev` (local, no login)
- `npx wrangler dev --port 8788` started with no login prompt: "Parsed 5 valid header rules", binding `env.ASSETS` local.
- `/_astro/*.js` returns exactly **one** `Cache-Control: public, max-age=31536000, immutable`, not duplicated. Its 304 keeps the immutable value.
- `/rising-water?x=1` → **307** `Location: /rising-water/?x=1`.
- HEAD `/` returns 200 + ETag. `If-None-Match` → **304**, empty body, with CSP, X-Frame-Options and Cache-Control.
- POST `/` → 405 from the asset server. `/_headers` → 404 (not served).
- **Header parity:** my own `_headers` interpreter compared expected and actual headers over 12 paths × GET/HEAD, including 404s: **0 mismatches**.
- `HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts` → **10/10 passed**.
- `node scripts/check-production.mjs --base http://localhost:8788 --origin https://andrewchincea.com --skip-aliases`, on a `WORKERS_CI=1` build → **175 passed, 0 failed**.
- The builder's suggested form `--origin http://localhost:4321` fails 5 checks **by design**, because the script rejects any localhost URL (`scripts/check-production.mjs:30,141,196`). See note 1.
- `npx wrangler deploy --assets ./dist --compatibility-date 2026-11-23 --dry-run --outdir $TMPDIR/…`: exits 0, reads 53 assets, bundles `_headers` as a text module, binds `env.ASSETS`. The scratch output was deleted.
- `keep_vars` is a valid key in wrangler 4.167.0 (`node_modules/wrangler/config-schema.json:1886`), and the dry run raised no unknown-key warning.

## Live production, read-only (`node scripts/check-production.mjs`)
**35 passed, 19 failed**, as expected before the redeploy. The failures reproduce:
- QA-01: robots, sitemap, canonical, og and twitter all on localhost;
- QA-18: no analytics origins in the CSP (on `/`, HEAD `/` and the 404);
- QA-02: the 404 body lacks both markers;
- QA-12: all three aliases answer 200 with no Location.

Evidence: `check-production-live.log`.

## Worker code review
- **Redirect loops:** none. The target is always `https://andrewchincea.com`, and `canonicalRedirect` returns null for https+apex (`worker/handler.ts:31-38`). There is at most one hop.
- **Method handling:** every method on alias hosts gets a 301; everything else is forwarded unchanged. Using 308 for non-GET would keep POST bodies, but the site has no forms that post cross-host, so this doesn't matter.
- **Headers:** `set`, not `append` (`handler.ts:46`), so an asset-server `Cache-Control` is replaced, never joined. This is idempotent if Cloudflare also applies `_headers` to `ASSETS.fetch` responses (wrangler dev does: "Parsed 5 valid header rules").
- **Semantics vs Cloudflare `_headers`:** all matching rules apply, duplicates are comma-joined and `!` detaches. The splat regex escapes everything else. This matches the documented behaviour, and my independent parser agrees on the real file.
- **Startup throws** (`worker/headers.ts:39-45,87-96`): marker left in, no `/*` CSP, absolute-URL or `:placeholder` patterns, or a header line before any pattern. The current template triggers none of them (dry run and dev both start). A future template using those syntaxes would fail the deploy loudly, which is the stated intent.
- **`index.ts` imports `../dist/_headers`:** a deploy without a prior `npm run build` fails at bundle time. This is acceptable because the Workers Builds build command always runs first.

## Notes (non-blocking)
1. **docs/deploy.md:132 and the build report's "How to verify"** give `--origin http://localhost:4321` for the local smoke check. That combination can never pass (5 failures by design). deploy.md:134 does mention the `WORKERS_CI=1` + `--origin https://andrewchincea.com` variant, and that variant passes 175/175. Recommend making it the primary command.
2. **docs/deploy.md:59** says the CSP line is about 1,746 characters (from 1,678 at F23). Measured: **959/2000**. The stale figure is harmless.
3. **docs/deploy.md:136** says it is unverified whether `wrangler dev` honours a spoofed Host. It does honour it (www → 301), but its proxy rewrites same-host `Location` values to `http://`. Worth one sentence so nobody mistakes that for a Worker bug.
4. **A missing `/_astro/*` file returns 404 with `max-age=31536000, immutable`.** This is the same as today's production (`curl https://andrewchincea.com/_astro/missing.js` → 404 + immutable) and follows from `_headers` semantics. It is not a regression. If a deploy race ever matters, the Worker could skip the per-path Cache-Control on non-2xx/304 responses.
5. **Not verifiable without a deploy:** that Cloudflare's automatic Web Analytics injection still happens on Worker-served HTML; www attachment to the Worker; zone redirect rules. These are listed under Needs Andrew in the build report.
6. **CLAUDE.md and spec §7** still say "Cloudflare Pages" and "No trackers or third-party runtime requests". Control should reconcile them with DECISIONS #88 (builder request 3).
7. **`WORKERS_CI=0`** would still count as a Cloudflare build (`Boolean('0')`). Cloudflare only ever sets 1, so this is cosmetic.

Artifacts: `docs/checks/F24/attempt-1/` (gate logs `gate-*.log`, `build-*.log`, `e2e-full.log`, `lhci-scores.txt`, `wrangler-*.log/txt`, `header-parity.txt`, `worker-node.txt`, `check-production-*.log`, `headers-spec-8788.log`, `probes-*.json`). Tools: `docs/checks/tools/f24-27-worker-curl.sh`, `f24-27-header-parity.mjs`, `f24-27-worker-node.mjs`.
