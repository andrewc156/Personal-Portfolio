# Deploying andrewchincea.com (Cloudflare Workers Builds)

Production is a Cloudflare **Worker with static assets**, built and deployed by **Workers Builds** from the GitHub repo `andrewc156/Personal-Portfolio` (branch `main`):

| Setting | Value |
|---|---|
| Worker name | `personal-portfolio` (also `name` in `wrangler.jsonc`) |
| Custom domain | `andrewchincea.com`; `www.andrewchincea.com` must also reach this Worker (see [dashboard steps](#what-andrew-still-has-to-do-in-the-dashboard)) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --assets ./dist --compatibility-date 2026-11-23` |

The site is still fully static. The Worker (`worker/`) is about 60 lines: it redirects the non-canonical host and scheme and attaches the response headers. Every page and asset, and the 404 page, comes from `dist/` through the asset binding.

Nothing in this repo deploys by itself, and no agent deploys. A push to `main` triggers Workers Builds, and the Cloudflare dashboard belongs to Andrew.

## Files involved

| File | Role |
|---|---|
| `astro.config.mjs` | Chooses `site`, the origin of every absolute URL ([below](#site_url-build-variables-vs-runtime-variables)). |
| `scripts/write-headers.mjs` | Second half of `npm run build`. Writes `dist/_headers` (CSP hashes). On Cloudflare's build machines it also fails the build if any public URL is not a production `https://` URL. |
| `public/_headers` | Template and **single source of truth** for every response header. |
| `wrangler.jsonc` | Worker config: `main`, the asset binding, `run_worker_first`, the 404 page, trailing-slash handling. |
| `worker/index.ts`, `worker/handler.ts`, `worker/headers.ts` | The Worker. |
| `scripts/check-production.mjs` | Read-only post-deploy smoke check. |

## `SITE_URL`: build variables vs runtime variables

Canonical links, `og:url`, `og:image`, `twitter:image`, `robots.txt` and the sitemaps are absolute URLs. They are fixed when `astro build` runs. `astro.config.mjs` picks the origin in this order:

1. `SITE_URL`, if it is set **in the build's environment**.
2. Otherwise `https://andrewchincea.com`, when the build runs on Cloudflare. Workers Builds sets `WORKERS_CI=1`; Pages sets `CF_PAGES=1`.
3. Otherwise `http://localhost:4321`, the preview origin. Local checks and the e2e suite rely on this.

Workers Builds keeps two separate lists of variables:
- **Build variables** (Worker → **Settings → Build → Variables and secrets**) exist while `npm run build` runs. Only these can affect the URLs.
- **Runtime variables** (Worker → **Settings → Variables and Secrets**) are bindings for the running Worker. They never reach `astro build`.

At F23 the production pages advertised `http://localhost:4321` (QA-01), even though `SITE_URL` "was set". That is consistent with `SITE_URL` being a runtime variable. It could not be confirmed from the repo, because no agent can see the dashboard.

Either way, step 2 now covers it, so **no variable is needed**. If `SITE_URL` is set as a build variable, it wins, so it must be exactly `https://andrewchincea.com`, with no trailing slash.

**Guard:** in a Cloudflare build (`WORKERS_CI` or `CF_PAGES` set), `scripts/write-headers.mjs` exits 1 unless every one of these is an `https://` URL that isn't localhost:
- every canonical, `og:url`, `og:image` and `twitter:image` in `dist/**/*.html`;
- the `Sitemap:` line in `dist/robots.txt`;
- every `<loc>` in `dist/sitemap*.xml`.

A wrong origin therefore fails the build, and the previous deployment stays live. To run the guard locally, use `node scripts/write-headers.mjs --require-public-urls`. On a local build it fails, which is correct.

The Worker reads no variables. `wrangler.jsonc` sets `"keep_vars": true`, so deploys no longer delete runtime variables set in the dashboard, which is what `wrangler deploy` does by default.

## What the build does

`npm run build` = `astro build && node scripts/write-headers.mjs`.

1. **`astro build`** writes the pages to `dist/`, including `dist/404.html` from `src/pages/404.astro`, and copies `public/` there.
2. **`scripts/write-headers.mjs`** runs the public-URL guard (Cloudflare builds only). It then fills the two markers in the `public/_headers` template and writes the result to `dist/_headers`. The markers become the sha256 hashes of every inline `<script>`, `<style>`, `style=""` and `on…=""` in `dist/**/*.html`. You never edit hashes by hand.
   - It exits 1 if a marker is missing, `dist/` has no HTML, or the file breaks Cloudflare's `_headers` limits (100 rules, 2,000 characters per line).
   - The CSP line is about 959 of 2,000 characters after the analytics allowance (checked in F24). The script prints the exact length on every build.
3. **The deploy command** bundles `worker/index.ts`.
   - A `Text` module rule in `wrangler.jsonc` makes it import `dist/_headers` as a string. It then uploads `dist/` as the Worker's assets.
   - `--assets ./dist` only overrides `assets.directory`. Wrangler still reads `binding`, `run_worker_first`, `not_found_handling` and `html_handling` from `wrangler.jsonc` (`resolveAssetOptions` in wrangler 4.167).

Python is not needed on Cloudflare. The Colorado data in `public/data/colorado/` is committed and only copied.

## The Worker

`wrangler.jsonc` sets `assets.run_worker_first: true`, so the Worker sees every request first:

| Request | Response |
|---|---|
| `http://andrewchincea.com/…` | `301` to `https://andrewchincea.com/…`, path and query preserved |
| `https://www.andrewchincea.com/…`, `http://www.andrewchincea.com/…` | `301` to `https://andrewchincea.com/…`, path and query preserved (one hop) |
| `https://andrewchincea.com/…` | passed unchanged to `env.ASSETS.fetch(request)` |
| any other host (`*.workers.dev`, preview URLs, `localhost`) | passed through, never redirected |

- **Pass-through keeps the asset server's behaviour.** The original request goes to the binding unchanged, so HEAD, `If-None-Match`/`If-Modified-Since` (`304`) and `Range` work as before.
- **404 page:** `not_found_handling: "404-page"` serves `dist/404.html` with status **404** (QA-02). That is the branded page ("This page has gone under water.", "Go to the home page"), not an empty body.
- **Trailing slashes:** `html_handling: "auto-trailing-slash"` keeps `/rising-water` → `307 /rising-water/`, the same as before.
- **Headers:** Cloudflare does **not** apply `_headers` to responses that pass through Worker code ([static-assets headers](https://developers.cloudflare.com/workers/static-assets/headers/)). So the Worker applies the rules from the bundled `dist/_headers` itself, with Cloudflare's semantics:
  - every matching rule applies, in file order;
  - `! Name` detaches a header;
  - each header is **set**, never appended, so the asset server's default `Cache-Control` is replaced, never joined;
  - redirects get the security headers but no per-path `Cache-Control`.
- **Fails closed:** if `dist/_headers` still contains a template marker or has no `/*` CSP, the Worker throws at startup. The deploy then fails instead of serving without a CSP. Unsupported `_headers` syntax (absolute-URL or `:placeholder` patterns) also throws.
- **`dist/_headers` is still deployed.** Cloudflare parses it as configuration and never serves it, so it is harmless. It stays authoritative for any non-Worker serving, such as a Pages project or `wrangler pages dev`. There is no separate rules file and no `.assetsignore` to maintain.

## Response headers (`public/_headers`)

| Path | Cache-Control | Why |
|---|---|---|
| `/_astro/*` | `public, max-age=31536000, immutable` | Vite puts a content hash in every file name. |
| `/data/*` | `public, max-age=86400, must-revalidate` | Fixed names; they change only when the pipeline is rerun. No `stale-while-revalidate`, because the explorer checks meta.json, barcode.json and grid.f32 against each other. |
| `/og/*`, `/favicon.svg` | `public, max-age=86400, must-revalidate` | Fixed names that change rarely. |
| HTML, `robots.txt`, sitemaps | Cloudflare default `public, max-age=0, must-revalidate` | Always revalidated, so a deploy shows at once. |

On `/*`, every response also gets these headers:
- `Content-Security-Policy`:
  - `default-src 'self'`;
  - `script-src 'self' https://static.cloudflareinsights.com` plus the build's hashes;
  - `style-src 'self'` plus hashes;
  - `img-src 'self'` and `font-src 'self'`;
  - `connect-src 'self' https://cloudflareinsights.com`;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`;
  - `upgrade-insecure-requests`.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- a deny-all `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Frame-Options: DENY`

**Cache-Control is never set on `/*`**, because two matching rules that set the same header are joined with a comma.

**Cloudflare Web Analytics (DECISIONS #88):** Andrew chose to keep it.
- The CSP allows exactly the beacon script origin `https://static.cloudflareinsights.com` in `script-src`, and exactly its reporting origin `https://cloudflareinsights.com` in `connect-src`. Nothing is broader.
- These are the only third-party origins.
- Before this change, the CSP blocked the injected beacon (F23 QA-18).
- A grep found no site copy that claims the site has no analytics or tracking.

**About `'unsafe-hashes'`:** `/rising-water/` has `style=""` attributes and one `onsubmit="return false"`. Only those exact hashed strings are allowed. The keyword is added only when the build contains such attributes.

## Check locally (no login, no deploy)

```sh
WORKERS_CI=1 npm run build                                     # production-like build (apex URLs)
npx wrangler deploy --dry-run --outdir "$TMPDIR/f24-dryrun"   # validates wrangler.jsonc, bundles the Worker
npx wrangler dev --port 8788                                   # Worker + dist/, as deployed
curl -sI http://localhost:8788/ | grep -iE 'content-security|cache-control|x-content|referrer|permissions|etag'
curl -sI http://localhost:8788/no-such-page/                   # 404, branded page
curl -sI http://localhost:8788/rising-water                    # 307 -> /rising-water/
HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts
node scripts/check-production.mjs --base http://localhost:8788 --origin https://andrewchincea.com --skip-aliases
npm run build                                                  # rebuild with localhost URLs before e2e
```

- **Use the `WORKERS_CI=1` build for the smoke check.** The script rejects every localhost URL by design, so `--origin http://localhost:4321` against a plain local build always fails.
- **Redirects** are covered by unit tests (`tests/unit/delivery/worker.test.ts`). `wrangler dev` does honour a spoofed `Host` header (`curl -sI -H 'Host: www.andrewchincea.com' http://localhost:8788/` → 301), but its local proxy rewrites same-host `Location` values to `http://`. That is a wrangler dev artifact, not a Worker bug; production returns `https://`.
- **`astro preview` serves neither the Worker nor `_headers`.** That is why `e2e/headers.spec.ts` skips unless `HEADERS_BASE_URL` is set.

## After every production deploy

```sh
node scripts/check-production.mjs            # read-only; default origin https://andrewchincea.com
```

It sends only GET and HEAD requests, never follows redirects, and exits 1 on any failure. It checks:
- `robots.txt` → `Sitemap: https://andrewchincea.com/sitemap-index.xml`;
- the sitemap index and the child sitemaps list only apex URLs;
- every sitemap page returns `200` HTML with:
  - canonical and `og:url` equal to its URL;
  - `og:image` and `twitter:image` on the apex;
- security headers, including the exact analytics CSP allowance;
- per-path `Cache-Control`, HEAD, and a `304` for a matching `If-None-Match`;
- an unknown path returns `404` with the branded body;
- `http://`, `https://www.` and `http://www.` answer `301` to `https://andrewchincea.com`, path and query preserved. Two `301` hops are accepted, in case a zone-level "Always Use HTTPS" answers first.

Run against production before F24 was deployed (November 25, 2026), it reported 19 failures, reproducing QA-01, QA-02, QA-12 and QA-18.

## What Andrew still has to do in the dashboard

None of this could be verified from the repo; agents have no dashboard access.

1. **`www.andrewchincea.com` must reach this Worker**, or the `www` redirect can't run.
   - It served the site at F23, so it is probably already attached.
   - Check under Worker `personal-portfolio` → **Settings → Domains & Routes**. If it isn't listed, add it as a **Custom domain**.
2. **Remove any zone redirect rule for `www`** (**Rules → Redirect Rules**), if one was ever added. The Worker handles this now, and two rules could disagree. F23 saw no redirect, so there is probably none.
3. **`SITE_URL`: nothing to do.**
   - Optionally, delete the runtime `SITE_URL`; it has no effect.
   - To set it explicitly instead, add it under **Settings → Build → Variables and secrets** as `https://andrewchincea.com`.
4. **Keep the deploy command as is.** Plain `npx wrangler deploy` would now behave the same, since `wrangler.jsonc` names the assets directory and the compatibility date.
5. **Web Analytics: nothing to change.** After the deploy, the beacon should load without a CSP error. Check the browser console on `/`.
6. **After the first deploy with F24**, look for a `write-headers: N public URLs checked` line in the build log, then run `node scripts/check-production.mjs`.

Optional:
- **"Always Use HTTPS"** (zone → **SSL/TLS → Edge Certificates**) is not needed, because the Worker already redirects HTTP. If you turn it on, Cloudflare answers `http://` itself, and the smoke check accepts that.
- **HSTS** (`Strict-Transport-Security: max-age=31536000`, no `preload`), once HTTPS is settled. Add it under `/*` in `public/_headers` (the Worker applies it) or in the zone's HSTS setting, not both.

## Before every production deploy

- [ ] `npm run verify` passes.
- [ ] `docs/QUESTIONS.md` is answered; confirmed copy has `confirmed: true`.
- [ ] If the name or tagline changed, regenerate the social card:
  1. `npx astro dev --port 4407`
  2. `node scripts/og-image.mjs --base http://localhost:4407`
  3. Commit `public/og/social-card.png`.

## Alternatives (not used)

- **Cloudflare Pages:** `dist/_headers` would apply directly. The Worker would not run, so normalizing `www` and `http` would need a zone Redirect Rule. `CF_PAGES` already selects the production origin.
- **Direct upload:**
  1. Andrew runs `npx wrangler login`.
  2. Build with `WORKERS_CI=1 npm run build` or `SITE_URL=https://andrewchincea.com npm run build`.
  3. Run `npx wrangler deploy`.

## Limits worth knowing (Workers static assets, Free plan)

- 25 MiB per asset. The biggest file here is `grid.f32` at about 0.5 MB.
- 20,000 assets per Worker version. `dist/` has about 50 files.
- `run_worker_first: true` makes every request a Worker invocation, assets included. The Free plan's daily request allowance ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) now applies to every asset request, so check usage if traffic grows.

## Cloudflare docs used
- Static-assets headers (`_headers` is not applied to Worker responses): https://developers.cloudflare.com/workers/static-assets/headers/
- Static assets, binding and `run_worker_first`: https://developers.cloudflare.com/workers/static-assets/binding/
- Routing, `not_found_handling`, `html_handling`: https://developers.cloudflare.com/workers/static-assets/routing/
- Workers Builds configuration and build variables: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Wrangler configuration (`keep_vars`, `rules`): https://developers.cloudflare.com/workers/wrangler/configuration/
- Custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
