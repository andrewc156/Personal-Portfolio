# Check report — F8 Cloudflare Pages setup — attempt 1
Verdict: PASS_WITH_NOTES

Gates: check ✅ (0/0/0) · lint ✅ · unit ✅ (441) · pytest ✅ (292) · ruff ✅ · build ✅ (default, SITE_URL, GitHub base) · e2e ✅ (111 passed + 8 skipped, run twice, both green) · axe ✅ (inside e2e) · lighthouse n/a (not in F8's gate list; nothing page-facing changed) · links n/a · visual ✅ (5 screenshots under wrangler, all opened) · content n/a · tda n/a · data n/a · hosting ✅ (wrangler pages dev + curl + headers spec 8/8 + own CSP probe 35/35 OK)

## Acceptance criteria
1. ✅ `public/_headers`. Served by `npx wrangler pages dev dist --port 8788` (wrangler 4.167.0, no login; it logged "Parsed 5 valid header rules"). Results from curl -sI:
   - `/`, `/garden/`, `/rising-water/`, `/robots.txt`, `/sitemap-index.xml`: 200, `Cache-Control: public, max-age=0, must-revalidate`. HTML does **not** get the immutable rule.
   - `/_astro/BaseLayout…D9dQdpBk.js`, `/_astro/BaseLayout.JZmxvifE.css` and a `.woff2`: 200, `public, max-age=31536000, immutable`.
   - `/data/colorado/grid.f32` and `meta.json`, `/og/social-card.png`, `/favicon.svg`: 200, `public, max-age=86400, must-revalidate`.
   - `/no-such-page/`: **404**, body byte-identical to `dist/404.html` ("Page not found · Andrew Chincea"). `/garden` returns 308 to `/garden/`.
   - Every response had Cache-Control exactly once (nothing comma-joined) and all 5 security headers: nosniff, `strict-origin-when-cross-origin`, Permissions-Policy, COOP same-origin and XFO DENY. The served CSP was string-equal to the CSP line in `dist/_headers` on all 14 paths.
   - **CSP content:** `default-src 'self'`; script-src and style-src are `'self'` + `'unsafe-hashes'` + hashes only; img, font and connect are `'self'`; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. There is no `'unsafe-inline'`, `'unsafe-eval'`, `*`, `data:`, `blob:` or any http(s) origin.
   - **Independent hash check:** my own extractor (`docs/checks/tools/f8/csp_hashes.py`) uses Python's stdlib `html.parser`, not the builder's regex. It found 12 inline executable scripts (2 distinct), 11 `<style>` (8 distinct), 15 `style=""` and 1 `on*`. The set equals the hashes in `dist/_headers`: missing = [] and extra = [] for both directives. `'unsafe-hashes'` is present only because attributes exist. It matched again after the SITE_URL and GitHub base builds.
   - **`'unsafe-hashes'` scope (#62):** all 15 style attributes and the one handler are in `dist/rising-water/index.html` only. They come from Explorer.astro:52, 58, 83, 92 (`style=`) and :144 (`onsubmit="return false"`). No other page has any.
   - **Theme script:** allowed by its hash (my probe showed the theme persisting dark/dark/dark across a reload and another page). The `'unsafe-hashes'` trade-off is documented in docs/deploy.md:47-49.
   - **Limits:** the CSP line is 1,678 of 2,000 chars and there are 5 of 100 rules. Cloudflare's limits, confirmed at https://developers.cloudflare.com/pages/configuration/headers/: "up to 100 header rules", "2,000 character limit" per line, and duplicate headers "joined with a comma separator". The template correctly avoids setting Cache-Control on `/*`.
   - **write-headers.mjs:**
     - Deterministic: three runs gave identical `cmp` output, sha1 f54cf661…, and the same hash after every rebuild.
     - Fails loudly, exit 1, in temp copies: missing marker ("found 0"), duplicated marker ("found 2"), dist with no HTML, nonexistent dist, and a line over 2,000 chars (40 injected style attrs gave "line 16 is 3838 chars"). In each case no output file was written.
     - Because `build` is `astro build && node scripts/write-headers.mjs`, any of these failures fails the whole build, so Cloudflare would not deploy a raw template.
   - `HEADERS_BASE_URL=http://localhost:8788 npx playwright test -c docs/checks/tools/f8/pw-nowebserver.config.ts`: **8/8 passed**.
   - **Own probe** (`docs/checks/tools/f8/csp_probe.mjs`, output in `docs/checks/F8/attempt-1/csp_probe.txt`), Chromium against wrangler:
     - All 11 pages, including the 404, rendered with **0** `securitypolicyviolation` events, and IBM Plex fonts loaded.
     - Hero animates (frames 32→123). The settings slider changes its output (1.5×→1.7×) and the panel closes on Escape. The theme toggle persists.
     - Garden type filter (the inline module script) shows "poster" 1/2 with aria-current=true.
     - Explorer reports "600 of 600 bars identical" with `data-match=true`, and Web Crypto is available (secure context). The style-attr aspect-ratio (0.62888) and the `--sw-l` swatch are applied. A bar click selects "Lake 15 · birth cell 120103". The hashed onsubmit runs (defaultPrevented=true).
     - **Negative controls, all blocked**, with 7 violation events across script-src-elem, style-src-elem, style-src-attr, script-src-attr, connect-src, img-src and script-src: injected inline `<script>`, injected `<style>`, injected `style=""`, injected `onclick`, cross-origin `fetch` (to http://127.0.0.1:8788, a different origin) and cross-origin `<img>`. `eval` threw.
     - No other-origin requests apart from the deliberate controls. The only console errors are the 404 resource message and the controls' own CSP messages.
2. ✅ docs/deploy.md:80-118.
   - **(a) Git integration:** Workers & Pages → Create application → Pages → Import an existing Git repository ("Connect to Git"); framework preset Astro; build `npm run build`; output `dist`; `SITE_URL` env var; Node from `.nvmrc`; every push to main deploys and branches/PRs get previews.
   - **(b) Direct upload:** `npx wrangler login` (marked "Andrew runs this"), then `wrangler pages project create <project> --production-branch main`, then `SITE_URL=… npm run build`, then `npx wrangler pages deploy dist --project-name <project> --branch main`.
   - Checked against the Astro guide (https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/: same menu path, `npm run build`/`dist`, rebuild "on every new pushed commit", previews for PRs), direct upload (https://developers.cloudflare.com/pages/get-started/direct-upload/: "cannot switch to Git integration later", `--branch` previews), Wrangler commands (https://developers.cloudflare.com/workers/wrangler/commands/pages/: `--production-branch`, `--project-name`, `--branch` all exist) and the build image (https://developers.cloudflare.com/pages/configuration/build-image/: v3 default Node 22.23.4/npm 10.9.9, `.nvmrc`/`NODE_VERSION`, "Any version").
   - Nothing in it deploys without Andrew. See note 1 (stale `.nvmrc` sentence).
3. ✅ docs/deploy.md:120-146. It covers: Custom domains → Set up a domain; apex as a zone on the same account, with nameservers on Cloudflare (Registrar does this); subdomain CNAME to `<project>.pages.dev`; the 522 warning; www added as a domain plus a 301 redirect rule (Wildcard `https://www.*` → `https://${1}`, preserve query string); update SITE_URL and rebuild. All match https://developers.cloudflare.com/pages/configuration/custom-domains/ and https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/ field for field.
   - **Workers note:** the `wrangler.jsonc` snippet with `"assets": { "directory": "./dist", "not_found_handling": "404-page" }` is at deploy.md:148-163 and is not built (no wrangler.jsonc in the repo). It matches https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/, and `_headers` support with the same limits matches https://developers.cloudflare.com/workers/static-assets/headers/.
   - Limits table checked against https://developers.cloudflare.com/pages/platform/limits/: 25 MiB, 20,000 files, 500 builds, 20 min, 100 domains. dist has 38 files and the largest is grid.f32 at 540 KB.
4. ✅ .github/workflows/ci.yml.
   - The YAML parses (`yaml` package).
   - Triggers are pull_request and push to main. `permissions: contents: read`. It has no secrets and no deploy step.
   - **Action versions:** actions/checkout@v7 (latest v7.0.1), setup-node@v7 (v7.1.0), setup-python@v7 (v7.1.0), upload-artifact@v7 (v7.0.2). Every v7 tag exists and runs on `node24`. Every input used (`node-version-file`, `cache`, `python-version`, `cache-dependency-path`, `name`, `path`, `retention-days`) is in each action.yml at v7 (checked with `gh api`).
   - **Would plausibly pass on ubuntu:**
     - Node comes from `.nvmrc` 26.13.0, which ships npm 11.
     - The lockfile has the linux optional binaries (`@esbuild/linux-x64`, `@cloudflare/workerd-linux-64`), and the only install-script packages (esbuild 0.28.2, workerd 1.20261123.1, fsevents 2.3.3) exactly match `allowScripts`.
     - Playwright Chromium is installed `--with-deps`, which Lighthouse also uses via `playwright-core`.
     - The `pipeline/.venv` venv matches `npm run pytest`.
     - The headers spec runs under `wrangler pages dev` (no login) after verify.
   - Not run on GitHub (nothing pushed).
5. ✅ Nothing was pushed or deployed by me or (per git status) by the builder. No wrangler.jsonc was created and no login was done. Results by build:
   - **`SITE_URL=https://example-check.pages.dev npm run build`:** all 10 canonicals, `og:url`, sitemap-index `<loc>`, all 10 sitemap-0 `<loc>` and the robots.txt `Sitemap:` line use `https://example-check.pages.dev`. There is no `localhost` in any html/xml/txt. `dist/_headers` is byte-identical to the default build (the CSP has no origin) and matches my hash set.
   - **`BASE_PATH=/Personal-Portfolio/ SITE_URL=https://andrewc156.github.io npm run build`:** exit 0, header script ran, hashes still match, canonical `https://andrewc156.github.io/Personal-Portfolio/`.
   - **Final `env -u BASE_PATH -u SITE_URL npm run build`:** canonical `http://localhost:4321/`, `_headers` sha1 f54cf661….

## Notes (non-blocking)
1. **Stale `.nvmrc` text: docs/deploy.md:98-100.**
   - It says "This repo's `.nvmrc` says `26`" and "a major-only `26` is unverified … add `NODE_VERSION` = `26.13.0`".
   - Since #61, `.nvmrc` is `26.13.0`: `cat .nvmrc` prints `26.13.0`.
   - It should say `.nvmrc` pins `26.13.0`, keep "check the first build log shows Node 26.13.0 / build system v3", and drop or soften the major-only caveat.
   - The steps still work as written, so this is not blocking. It is a one-line doc fix worth making before the F8 commit.
2. **Builder report line numbers are off by one.** It cites Explorer.astro:51/57/82/91/143; the current file has them at :52/58/83/92/144. #62's F9 follow-up (addEventListener + CSSOM/CSS) remains the way to drop `'unsafe-hashes'`.
3. **CSP headroom is 322 chars**, about 5 more hashes. A future page with its own inline `<style>` can trip the 2,000-char limit; the build will then fail loudly, which is correct. The builder's suggested remedies are `inlineStylesheets: 'never'` or per-path CSP rules.
4. **`'unsafe-hashes'` support** per MDN browser-compat-data: Chrome 69, Firefox 109, Safari 15.4 (iOS mirrors). That covers the §7 last-two-versions target. Only Chromium is installed locally, so Firefox and WebKit were not exercised.
5. **ci.yml extras:**
   - It also runs on push to main (the spec says "on pull requests"). This is harmless and still check-only.
   - With `bash -e`, a failing headers spec exits before `kill %1`. The runner reaps the process, so this is fine.
6. **GitHub Pages:** after F8 ships, the test host will serve `dist/_headers` as a plain static file at `/Personal-Portfolio/_headers`. GitHub ignores it as config (#59), and its content is just the public CSP, so this is harmless.
7. **Local wrangler quirk:** `GET /_headers` returns 502 under `wrangler pages dev` (it tries `dist/_headers/index.html`). It doesn't leak the file, it's local-only, and it's not an F8 defect.
8. **`.wrangler/`** existed before this check (the builder created it during self-checks). It is gitignored and I left it in place.

## Artifacts
- docs/checks/F8/attempt-1/csp_probe.txt: own probe output.
- Screenshots (all opened; pages styled, hero drawing, explorer verified, lake card selected, custom 404):
  - docs/checks/F8/attempt-1/wrangler-home-1280.png
  - docs/checks/F8/attempt-1/wrangler-garden_-1280.png
  - docs/checks/F8/attempt-1/wrangler-rising_water_-1280.png
  - docs/checks/F8/attempt-1/wrangler-rising-water-selected-1280.png
  - docs/checks/F8/attempt-1/wrangler-no_such_page_f8c_-1280.png
- Tools:
  - docs/checks/tools/f8/csp_hashes.py: independent hash extractor; usage `python -I csp_hashes.py dist dist/_headers`.
  - docs/checks/tools/f8/csp_probe.mjs: browser probe and negative controls.
  - docs/checks/tools/f8/pw-nowebserver.config.ts: runs e2e/headers.spec.ts with no webServer.
- Final state: dist/ is the default build (canonical http://localhost:4321/, `_headers` sha1 f54cf661…). Wrangler and preview are stopped, and ports 4321 and 8788 are free.
