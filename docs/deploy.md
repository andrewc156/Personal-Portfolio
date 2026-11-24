# Deploying to Cloudflare Pages

This site is fully static: `npm run build` writes everything to `dist/`, and Cloudflare Pages serves it with no adapter and no Functions.

Nothing in this repo deploys by itself. Every step that talks to a Cloudflare account is one **Andrew runs himself**, after deciding:
- which domain to use, or whether to use the `*.pages.dev` URL for now;
- Git integration or direct upload.

Pick one of the two methods below. Cloudflare says a Direct Upload project "cannot switch to Git integration later" ([direct upload docs](https://developers.cloudflare.com/pages/get-started/direct-upload/)). To change methods you'd create a new project.

## What the build does

`npm run build` = `astro build && node scripts/write-headers.mjs`.

1. **`astro build`** writes the pages to `dist/`. It also copies `public/` there, including the template `public/_headers`, the Colorado data and the social card.
2. **`scripts/write-headers.mjs`** overwrites `dist/_headers` with the template's two markers filled in. It finds every inline `<script>`, `<style>`, `style=""` and `on…=""` in `dist/**/*.html` and puts their sha256 hashes into the Content-Security-Policy. You never edit hashes by hand.
   - It exits 1 if a marker is missing, `dist/` has no HTML, or the file would break Cloudflare's `_headers` limits. Those limits are 100 rules and 2,000 characters per line ([headers docs](https://developers.cloudflare.com/pages/configuration/headers/)).
   - The CSP line is currently 1,678 characters.
3. **`SITE_URL`** sets the absolute URLs: canonical links, `og:url`/`og:image`, `sitemap-index.xml`/`sitemap-0.xml` and the `Sitemap:` line in `robots.txt`.
   - Unset, it falls back to `http://localhost:4321`, which is right for local checks and wrong for production.
   - **Always build for production with `SITE_URL` set.**

**Python is not needed on Cloudflare.**
- The Colorado data in `public/data/colorado/` is committed, and the build only copies it.
- The pipeline (`npm run data`) runs only on a developer machine.
- The build command never calls Python. (The only `requirements.txt` is under `pipeline/`, not at the repo root.)

### Headers that `public/_headers` sets

| Path | Cache-Control | Why |
|---|---|---|
| `/_astro/*` | `public, max-age=31536000, immutable` | Vite puts a content hash in every file name, so a changed file is a new URL. |
| `/data/*` | `public, max-age=86400, must-revalidate` | Fixed names. They change only when the pipeline is rerun and the site redeployed. After a day the browser revalidates with the ETag, and an unchanged file costs a 304. There is deliberately no `stale-while-revalidate`: the explorer checks meta.json, barcode.json and grid.f32 against each other, and a stale file served next to a fresh one would trip that check. |
| `/og/*`, `/favicon.svg` | `public, max-age=86400, must-revalidate` | Fixed names that change rarely. |
| HTML, `robots.txt`, sitemaps | Pages default `public, max-age=0, must-revalidate` | Always revalidated, so a new deploy shows up at once. |

On `/*`, every response also gets:
- `Content-Security-Policy`: `default-src 'self'`; scripts and styles from `'self'` plus the build's hashes; `img-src`/`font-src`/`connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` that denies camera, microphone, geolocation, payment, USB, sensors and so on;
- `Cross-Origin-Opener-Policy: same-origin`;
- `X-Frame-Options: DENY`, for older browsers.

**Cache-Control is never set on `/*`.** Pages joins a header that two rules both set with a comma, which would corrupt `Cache-Control`.

**About `'unsafe-hashes'`:** `/rising-water/` has `style=""` attributes and one `onsubmit="return false"`. CSP only allows those through `'unsafe-hashes'` plus the hash of each exact attribute value.
- This is not `'unsafe-inline'`. Only those exact strings run or apply, and anything injected is still blocked.
- The script adds `'unsafe-hashes'` to a directive only when the build actually contains such attributes.

### Check the headers locally (no login)

```sh
npm run build
npx wrangler pages dev dist --port 8788
curl -sI http://localhost:8788/ | grep -iE 'content-security|cache-control|x-content|referrer|permissions'
curl -sI http://localhost:8788/no-such-page/                # 404 status, custom page
HEADERS_BASE_URL=http://localhost:8788 npx playwright test e2e/headers.spec.ts
```

`astro preview` ignores `_headers`, which is why `e2e/headers.spec.ts` skips unless `HEADERS_BASE_URL` is set.

## Before every production deploy

- [ ] `npm run verify` passes (check, lint, unit, pytest, build, e2e, links, Lighthouse).
- [ ] `docs/QUESTIONS.md` is answered. That covers the display name, tagline, hero question, contact links and the domain. Confirmed copy also needs `confirmed: true`.
- [ ] If the name or tagline changed, regenerate the social card:
  1. Start a dev server with `npx astro dev --port 4407`.
  2. Run `node scripts/og-image.mjs --base http://localhost:4407`. Details are in docs/builds/F7/attempt-1.md.
  3. Commit the new `public/og/social-card.png`.

  The card bakes in the name and tagline from `src/data/profile.yaml`, and nothing checks it automatically.
- [ ] `SITE_URL` is set for the build:
  - in the Cloudflare project for Git integration;
  - in your shell for direct upload.

  Use the full origin with `https://` and no trailing slash, e.g. `https://<project>.pages.dev`.
- [ ] After the deploy, open `<site>/sitemap-index.xml` and view-source on `/`. The canonical link and `og:url` must show the production origin, not `localhost`.

## (a) Git integration (recommended)

The repo is already on GitHub at `github.com/andrewc156/Personal-Portfolio`, branch `main`. With Git integration, every push to `main` deploys production. Every other branch, and every pull request from it, gets its own preview URL.

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Workers & Pages**.
2. Select **Create application**, then the **Pages** tab, then **Import an existing Git repository** (shown as "Connect to Git" in some versions of the dashboard).
3. Authorise the Cloudflare Pages GitHub app for `andrewc156/Personal-Portfolio`, select the repo, then **Begin setup**.
4. **Set up builds and deployments:**
   - **Project name:** this becomes `<project>.pages.dev`, so choose it with that in mind.
   - **Production branch:** `main`
   - **Framework preset:** Astro (if offered; it only pre-fills the next two fields)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** leave empty (repo root).
5. **Environment variables (advanced) → Add variable:**
   - `SITE_URL` = `https://<project>.pages.dev`. You know the project name from step 4, so you can set it before the first build.
   - Add it for **Production**. Adding it for **Preview** too is fine: previews then point their canonical URLs at production, which is what you want.
6. Select **Save and Deploy**. Then open `https://<project>.pages.dev` and run the "after the deploy" check above.
7. **Node version.** Cloudflare's v3 build image reads `.nvmrc` (or `NODE_VERSION`) and supports any Node version ([build image docs](https://developers.cloudflare.com/pages/configuration/build-image/)). This repo's `.nvmrc` pins `26.13.0` (the version it is developed on), and npm 11 comes with Node 26.
   - In the first build log, check that Node 26.13.0 is the version installed, and that the project's build system version (under **Settings → Build**) is v3. Otherwise you get Node 22 and npm 10. (Dashboard labels move around. If one isn't where this says, look for the nearest match.)
   - If the log shows the wrong version or a Node install error, add the environment variable `NODE_VERSION` = `26.13.0` and retry the deployment.
   - The builds themselves need nothing else: no Python, no secrets, no API keys.

Later changes, such as setting `SITE_URL` to the custom domain, are under the project's **Settings → Variables and Secrets** (older dashboards: **Settings → Environment variables**). A changed variable only applies to new builds, so go to **Deployments** and retry the latest one.

## (b) Direct upload with Wrangler

Use this if you'd rather not connect GitHub. Each deploy is a build on your machine that you upload yourself. Wrangler is already a devDependency.

```sh
npx wrangler login                                   # Andrew runs this; opens a browser
npx wrangler pages project create <project> --production-branch main   # once
SITE_URL=https://<project>.pages.dev npm run build
npx wrangler pages deploy dist --project-name <project> --branch main
```

- **`SITE_URL` must be set in your shell for the build.** Cloudflare's dashboard variables don't affect a build you run locally. On Windows PowerShell: `$env:SITE_URL="https://<project>.pages.dev"; npm run build`.
- **Previews:** `--branch <name>` with any name other than `main` makes a preview deployment.
- **`_headers` is still honoured:** `dist/_headers` is uploaded with the site.

## Custom domain

Do this once the site works on `<project>.pages.dev`. Steps follow [Cloudflare's custom-domain docs](https://developers.cloudflare.com/pages/configuration/custom-domains/).

1. **Add the domain in Pages first:** **Workers & Pages** → the project → **Custom domains** → **Set up a domain**, enter it, **Continue**.
   - Don't create the DNS record by hand before this step. Cloudflare warns that a CNAME added without first associating the domain in Pages fails to resolve, with a 522 error.
2. **Apex domain** (`example.com`): it must be a zone on the **same Cloudflare account** as the Pages project, meaning its nameservers point to Cloudflare.
   - Buying the domain through Cloudflare Registrar does this automatically.
   - For a domain bought elsewhere, add it as a site in Cloudflare and change the nameservers at the registrar to the two Cloudflare gives you.
   - Once the zone is active, Pages creates the DNS record itself.
3. **Subdomain at another DNS provider** (`andrew.example.org`): add a `CNAME` record at that provider pointing to `<project>.pages.dev`. The zone doesn't need to be on Cloudflare.
4. **`www` → apex:** add `www.example.com` as a second custom domain too, so it has a certificate and resolves. Then redirect it with a rule on the zone: **Rules → Redirect Rules → Create rule** (the dashboard may offer a ready-made www-to-root template), with:
   - match type **Wildcard pattern**;
   - request URL `https://www.*`;
   - target URL `https://${1}`;
   - status **301**;
   - **Preserve query string** on.

   These are the settings from [Cloudflare's www-to-root example](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/).
5. **Update `SITE_URL`** to the domain (`https://example.com`, no trailing slash) and rebuild:
   - Git integration: change the variable, then retry the latest deployment.
   - Direct upload: rebuild with the new `SITE_URL` and deploy again.

   Then re-run the "after the deploy" check. Canonicals, `og:url` and the sitemap must all show the domain.
6. **Optional, after the domain is live on HTTPS:**
   - **HSTS:** send `Strict-Transport-Security: max-age=31536000` (no `preload`). Either add the line under `/*` in `public/_headers`, or turn it on under the zone's **SSL/TLS → Edge Certificates → HSTS**, but not both, because Pages would join the two values. Only consider `preload` once you're sure every subdomain is HTTPS-only for good.
   - **Retire the old URL:** Cloudflare's docs describe redirecting the production `*.pages.dev` URL to the custom domain, so there's a single canonical host.

## Alternative: Workers static assets (not built)

If you ever prefer to host this on Cloudflare **Workers** with static assets instead of Pages:
- the only change would be a `wrangler.jsonc` at the repo root:

  ```jsonc
  {
    "name": "<project>",
    "compatibility_date": "<deploy date, YYYY-MM-DD>",
    "assets": { "directory": "./dist", "not_found_handling": "404-page" }
  }
  ```
- the deploy command becomes `npx wrangler deploy`;
- the same `dist/_headers` file is supported there, with the same 100-rule and 2,000-character limits ([Workers static-assets headers](https://developers.cloudflare.com/workers/static-assets/headers/); [static assets](https://developers.cloudflare.com/workers/static-assets/)).

This repo doesn't include that file. Pages is the chosen host.

## Limits worth knowing (Free plan)

From [Pages limits](https://developers.cloudflare.com/pages/platform/limits/):
- 25 MiB per file. The biggest file here is `grid.f32` at about 0.5 MB.
- 20,000 files per site. `dist/` has 38.
- 500 builds a month, with a 20-minute build timeout.
- 100 custom domains per project.

## Cloudflare docs used
- `_headers` syntax, ordering and limits: https://developers.cloudflare.com/pages/configuration/headers/
- Build image, Node and Python versions: https://developers.cloudflare.com/pages/configuration/build-image/
- Astro on Pages, Git integration steps: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- Direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Wrangler `pages` commands: https://developers.cloudflare.com/workers/wrangler/commands/pages/
- Custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- www → root redirect: https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/
- Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Workers static assets: https://developers.cloudflare.com/workers/static-assets/ and https://developers.cloudflare.com/workers/static-assets/headers/
