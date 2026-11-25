# Build report — F24 Production delivery — attempt 1

**Summary:** Fixed QA-01, QA-02, QA-12 and QA-18 for the Workers Builds deployment.
- **Origin:** a Cloudflare build (`WORKERS_CI`/`CF_PAGES`) now defaults `site` to `https://andrewchincea.com` unless `SITE_URL` is set for the build. `write-headers.mjs` fails such a build if any canonical/og/twitter/robots/sitemap URL is not production `https://`.
- **Worker:** a new `wrangler.jsonc` and Worker (`worker/`) cover:
  - the branded 404 with status 404;
  - one-hop 301s from `http://` and `www.` to the HTTPS apex;
  - every `dist/_headers` rule. The Worker bundles `dist/_headers` itself as a text module, so the headers have one source of truth and need no extra file or `.assetsignore`.
- **CSP:** adds exactly the two Cloudflare Web Analytics origins.
- **Smoke check:** `scripts/check-production.mjs` is a read-only post-deploy check. Against today's production it reproduces all four findings.

## Files changed
- `astro.config.mjs` — `site` = `SITE_URL` → production origin on Cloudflare builds → `http://localhost:4321`.
- `scripts/write-headers.mjs` — public-URL guard (Cloudflare builds or `--require-public-urls`).
- `public/_headers` — analytics CSP allowance; comments updated for the Worker.
- `wrangler.jsonc` (new):
  - `name: personal-portfolio`, `compatibility_date: 2026-11-23`, `main: ./worker/index.ts`;
  - a `Text` rule for `**/_headers`;
  - `assets`: `./dist`, binding `ASSETS`, `run_worker_first: true`, `not_found_handling: "404-page"`, `html_handling: "auto-trailing-slash"`;
  - `keep_vars: true`.
- `worker/index.ts`, `worker/handler.ts`, `worker/headers.ts`, `worker/modules.d.ts` (new).
- `scripts/check-production.mjs` (new).
- `tests/unit/delivery/worker.test.ts`, `write-headers-guard.test.ts`, `check-production.test.ts` (new, 41 tests).
- `e2e/headers.spec.ts`:
  - runs against `wrangler dev`;
  - expects exactly the two analytics origins;
  - checks the branded 404 on 3 paths;
  - checks the 307 trailing slash, HEAD + ETag/304, and that localhost is not redirected.
- `docs/deploy.md` — rewritten for Workers Builds: build vs runtime variables, the Worker, the headers, analytics, the smoke check and Andrew's dashboard steps.
- `e2e/seo.spec.ts` — unchanged. Local and e2e builds still use localhost.

## How to verify
```sh
npx astro check; npm run lint; npm run test          # see Gates
npm run build && ls dist/404.html                    # local build: localhost URLs, guard skipped
WORKERS_CI=1 npm run build                           # must pass; log shows "N public URLs checked"
grep -h canonical dist/index.html | head -1          # https://andrewchincea.com/
node scripts/write-headers.mjs                       # CSP line length is printed (limit 2000)
npm run build                                        # back to a local build for e2e
npx wrangler deploy --dry-run --outdir "$TMPDIR/f24-dryrun"
npx wrangler dev --port 8788
HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts
node scripts/check-production.mjs --base http://localhost:8788 --origin http://localhost:4321 --skip-aliases
npm run e2e                                          # seo.spec still uses the preview origin
# after Andrew's deploy (read-only):
node scripts/check-production.mjs
```

## Gates (run by me)
- **`npx vitest run`:** 37 files, 913 tests pass (the new `tests/unit/delivery`: 3 files, 41 tests).
- **`npx astro check`:** 99 errors, 0 in F24 files.
  - All come from untracked full-repo copies under `docs/checks/F19a/attempt-2/test-results/` and `docs/checks/F19b/attempt-{1,2}/test-results/`.
  - They show up as errors in those copies, plus duplicate-declaration collisions reported in `src/components/hero/hero-client.ts`, `src/components/explorer/explorer-client.ts` and `e2e/hero.spec.ts`.
  - A scratch `tsc -p` limited to `worker/`, `tests/unit/`, `check-production.mjs` and the e2e specs showed no errors in F24 files.
- **`npm run lint`:** fails for every file in the repo (923 "multiple candidate TSConfigRootDirs" parse errors), caused by the same stray copies.
  - With `npx eslint --parser-options tsconfigRootDir:$PWD . --ignore-pattern 'docs/checks/**/test-results/**'`: 0 problems.
  - The Prettier half of `lint` passes.
- **`npx wrangler deploy --dry-run --outdir <scratch>` against the existing (older) `dist/`:** passes and binds `env.ASSETS`.
  - The bundle imports `_headers` as a text module.
  - I loaded the bundled `index.js` in Node with a fake `ASSETS`:
    - `/_astro/*` got the immutable Cache-Control;
    - `www` and `http` returned 301 with path and query;
    - an unknown path returned 404 with the CSP.
  - The scratch output was deleted.
- **`node scripts/check-production.mjs` against production (read-only, GET/HEAD only):** 35 passed, 19 failed. Before deploy this is expected; the failures reproduce all four findings:
  - QA-01: localhost robots, sitemap and metadata;
  - QA-18: no analytics CSP;
  - QA-02: the 404 body lacks the branded text;
  - QA-12: the 3 aliases return 200.
- **Not run (checker only):** `npm run build`, `wrangler dev`, e2e, Lighthouse. No dev server was started.

## Acceptance criteria (self-check)
- ✅ **QA-01 origin fallback:** `site` = `SITE_URL` (trimmed, no trailing slash), else `https://andrewchincea.com` if `WORKERS_CI`/`CF_PAGES`, else `http://localhost:4321`. Evidence: `astro.config.mjs`.
- ✅ **QA-01 build guard:** fails Cloudflare builds on a localhost or non-https canonical, og:url, og:image, twitter:image, robots `Sitemap:` or sitemap `<loc>`. Evidence: `write-headers-guard.test.ts` (WORKERS_CI and CF_PAGES fail, local passes, production URLs pass). On the current `dist`, `--require-public-urls` exits 1 and lists 51 URLs.
- ✅ **QA-02:** `not_found_handling: "404-page"`, and `dist/404.html` exists (older dist; the 404 route is in `src/pages/404.astro`). Unit tests check that the 404 status, body and headers are kept. ⏳ Live 404 behaviour under `wrangler dev` is for the checker to confirm (`e2e/headers.spec.ts`).
- ✅ **QA-02 trailing slashes:** `html_handling: "auto-trailing-slash"` matches the live `/rising-water` → 307.
- ✅ **QA-12 redirects:** the Worker uses `run_worker_first: true` and sends 301s to `https://andrewchincea.com` + path + query for `http://` apex and `http(s)://www`. Port and fragment are dropped. Localhost, `*.workers.dev`, other subdomains and lookalike domains pass through, and no redirect target redirects again. Evidence: `worker.test.ts`, 14 redirect cases plus a loop test.
- ✅ **QA-12 headers in the Worker:**
  - Rules come from the bundled `dist/_headers`, with Cloudflare semantics (all matches, comma-joined duplicates, `!` detach).
  - Headers are set, not appended, so Cache-Control is never joined.
  - The checks above cover 200s, the 404, the 307, the 304 and HEAD.
  - Redirects carry the security headers but no Cache-Control.
  - The Worker fails at startup if the file has a marker or no CSP.
- ✅ **QA-12 HEAD and conditional requests:** the original `Request` is forwarded unchanged, and `new Response(res.body, res)` keeps the 304 and the null body. Evidence: unit tests and the HEAD/304 checks in `check-production`.
- ✅ **QA-18 CSP:** `script-src` adds exactly `https://static.cloudflareinsights.com` and `connect-src` adds exactly `https://cloudflareinsights.com`.
  - Line length: about 1,746 of 2,000 projected from F23's 1,678 + 68. On the old dist it measured 959. The script still enforces the 2,000 limit.
  - A grep found no site copy claiming no analytics or tracking.
- ✅ **Smoke check:** `scripts/check-production.mjs` has no dependencies and is read-only. Its options are `--origin`, `--base` and `--skip-aliases`, it tolerates a two-hop "Always Use HTTPS" chain, and it is tested against the real handler.
- ✅ **docs/deploy.md** is updated, including the unverifiable items.

## Needs Andrew
- **`www`:** confirm `www.andrewchincea.com` is attached to the Worker `personal-portfolio` (Settings → Domains & Routes). Without it, `www` can't be redirected.
- **Zone redirect rules:** remove any zone Redirect Rule for `www`, if one exists.
- **`SITE_URL`:** no action needed. A runtime `SITE_URL` has no effect. If he wants it set, it belongs under **Build** variables, as `https://andrewchincea.com`.
- **After deploying:** check the build log for `public URLs checked`, then run `node scripts/check-production.mjs`.

## Requests to Control
1. **`package.json` script:** add `"check:prod": "node scripts/check-production.mjs"`.
2. **Repair `npm run check` / `npm run lint`:** delete the untracked repo copies under `docs/checks/F19a/attempt-2/test-results/` and `docs/checks/F19b/attempt-*/test-results/`, or add `docs/checks/**/test-results` to `tsconfig.json` `exclude` and the eslint `ignores`.
3. **Update shared docs for DECISIONS #88:** CLAUDE.md and spec §7 still say "hosted on Cloudflare Pages" and "No trackers or third-party runtime requests".
4. **Optional:** the GitHub CI workflow could run `WORKERS_CI=1 npm run build` once, to exercise the guard with production URLs before Cloudflare does.

## Known limitations
- **Two runtime behaviours could not be confirmed** from the repo:
  - whether Cloudflare's automatic Web Analytics injection keeps working when a Worker serves HTML;
  - whether `env.ASSETS.fetch` responses also get `_headers` applied. Harmless either way, because headers are `set`.
- **Not verified in workerd** (the checker will do it): the redirects under `wrangler dev` and the 404 page. Whether `wrangler dev` honours a spoofed `Host` header is unverified; the unit tests are the evidence for the redirect logic.
- **Request quota:** `run_worker_first: true` turns every asset request into a Worker invocation, which counts against the Free plan's daily request quota.
- **Supported `_headers` syntax:** the Worker's parser supports only path patterns with `*` and throws on anything else (absolute URLs, `:placeholders`). If the template ever uses that syntax, the deploy fails.
