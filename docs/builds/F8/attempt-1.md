# Build report — F8 Cloudflare Pages setup — attempt 1

Summary: The headers work. `public/_headers` is a template with two markers in its CSP, and the new `scripts/write-headers.mjs` fills them with sha256 hashes of the inline code in `dist/` and writes `dist/_headers`. Locally under `wrangler pages dev`, every page renders with zero CSP violations, the explorer still loads and verifies its data, and an injected script and style are blocked. `docs/deploy.md` covers Git integration, direct upload, custom domains and the Workers alternative, and there is an optional check-only CI workflow. Two things need Control: the `build` script change, and a decision on `'unsafe-hashes'`, which /rising-water/ needs for its `style=""` attributes and one `onsubmit` handler.

Files changed:
- public/_headers (new): the template.
- scripts/write-headers.mjs (new).
- e2e/headers.spec.ts (new): skips unless `HEADERS_BASE_URL` is set.
- docs/deploy.md (new).
- .github/workflows/ci.yml (new).
- docs/builds/F8/attempt-1.md (this report).
- Side effects, nothing committed:
  - dist/_headers was written into the checker's existing default build by running the script.
  - `wrangler pages dev` created .wrangler/ at the repo root (gitignored).

How to verify (after Control applies the `build` change):
```sh
npm run check && npm run lint && npm test
SITE_URL=https://example-check.pages.dev npm run build   # prints "write-headers: … CSP line 1678/2000 chars; 5 rules"
npx wrangler pages dev dist --port 4321                    # checker port; no login
curl -sI http://localhost:4321/ ; curl -sI http://localhost:4321/_astro/<file>.js ; curl -sI http://localhost:4321/data/colorado/grid.f32
curl -sI http://localhost:4321/og/social-card.png ; curl -sI http://localhost:4321/no-such-page/
HEADERS_BASE_URL=http://localhost:4321 npx playwright test e2e/headers.spec.ts
```
- The webServer in playwright.config.ts also wants port 4321. If the checker uses 4321 for wrangler, point the spec at it with a config that has no webServer, or run wrangler on another port such as 8788. I used a temporary config with no webServer.
- Without `HEADERS_BASE_URL`, the spec skips all 8 tests, so `npm run e2e` is unaffected.

## What is in the build
- **Inline code in the default build:**
  - 2 distinct inline scripts: the BaseLayout theme script on all 11 pages, and the garden filter module.
  - 1 inline handler: `onsubmit="return false"` at src/components/explorer/Explorer.astro:143.
  - 8 distinct `<style>` blocks.
  - 15 distinct `style=""` attributes, all on /rising-water/ (Explorer.astro:51, 57, 82, 91).
- **No `data:` URIs** in any HTML, CSS or JS, so `img-src` is just `'self'`.
- **No other inline-code risks:** no `javascript:` URLs, workers, `blob:`, `eval` or `innerHTML`. JS sets styles only through the CSSOM (`el.style.cursor` and `style.setProperty`), which CSP doesn't restrict.

## Self-check results
These were run against the existing dist/ with my script applied, under `npx wrangler pages dev dist --port 4408`. Wrangler reported "Parsed 5 valid header rules". It is stopped now and 4408 is free.

- **curl:**

  | Path | Status | Cache-Control |
  |---|---|---|
  | `/`, `/garden/` | 200 | `public, max-age=0, must-revalidate` (Pages default) |
  | `/garden` | 308 → `/garden/` | |
  | `/_astro/BaseLayout…D9dQdpBk.js` | 200 | `public, max-age=31536000, immutable` |
  | `/data/colorado/grid.f32`, `meta.json` | 200 | `public, max-age=86400, must-revalidate` |
  | `/og/social-card.png`, `/favicon.svg` | 200 | `public, max-age=86400, must-revalidate` |
  | `/no-such-page/` | 404 | `no-store` |

  - The 404 serves the custom "Page not found · Andrew Chincea" page.
  - Every response carried CSP, nosniff, Referrer-Policy, Permissions-Policy, COOP and X-Frame-Options.
  - Cache-Control appeared exactly once on each response; nothing was comma-joined.
  - The served CSP is byte-identical to dist/_headers (checked with `diff`).
- **Throwaway Playwright script** (scratchpad csp-check.mjs, Chromium):
  - All 11 pages plus the 404 had 0 `securitypolicyviolation` events.
  - **Theme:** after the toggle, a reload and another page, the theme was still `dark`, so the inline theme script ran.
  - **Hero:** playing and drawing frames. The settings panel opened and closed. `--shell-header-h` was set (61px).
  - **Garden:** the chip moved the URL to `?type=poster`, set `aria-current=true` and showed "Showing 1 of 2 items".
  - **Explorer:**
    - data: meta.json, barcode.json, grid.f32 and hillshade.webp all returned 200, `data-match=true` (verified through Web Crypto), `state=playing`;
    - `style=""` attributes applied: the map had `aspect-ratio` 0.62888 and the swatches had `--sw-l`;
    - the inline handler ran: dispatching a cancelable submit came back `defaultPrevented=true`.
  - No third-party requests.
  - The only console error was the expected "404 Not Found" resource message on the 404 page.
  - **Negative controls:** an injected inline `<script>` did not run, an injected `style` attribute did not apply, and a cross-origin `fetch` was blocked. Each produced a violation event.
- **e2e/headers.spec.ts against :4408:** 8/8 passed. Unset, 8 skipped.
  - **Sabotage:** I served a copy of dist with the raw template `_headers`, markers unfilled. 6 of 8 failed: the marker check, CSP violations, the theme script and the explorer style attribute. The 2 that don't depend on hashes (cache headers and the negative control) still passed, as they should.
- **Script behaviour:**
  - **Deterministic:** two runs, and a run after Prettier reformatted the script, all gave sha1 f54cf661… for dist/_headers.
  - **Exits 1** with a clear message on an empty dist, a missing marker, or a line over 2,000 characters (each tested).
  - **Headroom:** the CSP line is 1,678/2,000 characters, and the file has 5 rules (limit 100).
- **Gates:** `npm run check` 0 errors, 0 warnings, 0 hints. `npm run lint` clean. `npm test` 439/439.

## Acceptance criteria (self-check)
1. ✅ public/_headers sets `/_astro/*` immutable for a year, `/data/*` for a day with must-revalidate, and the security headers.
   - The CSP allows only `'self'` plus hashes, with `object-src 'none'`, `frame-ancestors 'none'` and `upgrade-insecure-requests`.
   - The theme script is allowed by its hash.
   - The style attributes and the handler are allowed by hash under `'unsafe-hashes'`. The trade-off is documented in docs/deploy.md.
   - Verified with wrangler and curl, and in the browser (evidence above).
2. ✅ docs/deploy.md has (a) Git integration and (b) direct upload. Each has exact steps, including that `SITE_URL` must be set in the shell for direct upload.
3. ✅ docs/deploy.md has custom-domain steps:
   - apex as a zone on the same account;
   - subdomain by CNAME to `<project>.pages.dev`, with the warning not to add the CNAME before associating the domain (522);
   - www → apex with a 301 redirect rule;
   - update `SITE_URL` and rebuild;
   - HSTS (no preload) as a step for after the domain is live.
4. ✅ .github/workflows/ci.yml:
   - runs on pull_request and on push to main, with `permissions: contents: read` and no secrets or deploy step;
   - steps: `npm ci`, Playwright Chromium, a Python 3.13 venv at pipeline/.venv, `npm run verify`, then the headers spec under `wrangler pages dev`;
   - YAML parses, and the v7 action inputs were checked against each action.yml.
   - Not run on GitHub: nothing has been pushed.
5. ✅ for push/deploy; ⏳ for the SITE_URL build, which is the checker's.
   - Nothing was pushed or deployed, no remote was created, and nothing connected to a Cloudflare account.
   - The CSP contains no origin, so `SITE_URL` doesn't change the headers. Hashes are recomputed after every build either way.
   - The checker must confirm canonicals and the sitemap with `SITE_URL` set, after the build change.

## Needs Andrew
- At deploy time:
  - **Domain:** his domain, or OK to use `*.pages.dev` for now.
  - **Deploy method:** Git integration (recommended) or direct upload. He can't switch from direct upload later.
  - **Explicit OK** to deploy.
  - He runs any `wrangler login`, and the Cloudflare dashboard steps, himself.
- The social card must be regenerated once the name and tagline are confirmed (already in QUESTIONS.md and in the deploy.md checklist).

## Requests to Control
1. **package.json `build`:** `"build": "astro build && node scripts/write-headers.mjs"`. Without it, dist/_headers is the raw template, and the inline theme and garden scripts are blocked in production.
2. **`.nvmrc`, optional:** Cloudflare's v3 image reads `.nvmrc` and supports any Node version, but its examples only show full versions. Whether `26` alone is parsed is unverified. Either pin `.nvmrc` to `26.13.0` (DECISIONS #2), or rely on the fallback in deploy.md: set `NODE_VERSION=26.13.0` if the first build log shows the wrong Node. Without Node 26 the image's default is Node 22.23.4 with npm 10.9.9. That still meets `engines`, but it ignores `allowScripts`.
3. **DECISIONS entry:** CSP uses `'unsafe-hashes'` with exact hashes, only because of Explorer.astro's `style=""` attributes and `onsubmit="return false"`. The script adds the keyword only when such attributes exist.
4. **F9 fix round, viz-builder (Explorer.astro and explorer-client.ts, not mine):**
   - Replace `onsubmit="return false"` (Explorer.astro:143) with `form.addEventListener('submit', e => e.preventDefault())`. That drops `'unsafe-hashes'` from script-src automatically.
   - Optionally, set the 15 `style=""` values from the client through `el.style.setProperty` (the CSSOM is allowed), or as classes or CSS. That drops it from style-src too and frees about 830 characters of CSP.
   - Caveat: aspect-ratio set by JS could cost CLS before hydration, so keep the map's aspect-ratio in markup or CSS.
5. **CSP headroom:** 322 characters is about 5 more hashes. New pages with their own inline `<style>` will eat it. When the script fails on the 2,000-character limit, the cheapest fix is `build: { inlineStylesheets: 'never' }` in astro.config.mjs, which removes all 8 `<style>` hashes (about 430 characters) at the cost of one extra CSS request, so re-check Lighthouse. Per-path CSP rules are the other option.
6. **Checker:** e2e/headers.spec.ts is opt-in (see "How to verify"). CI already runs it after `npm run verify`.

## Known limitations
- Only Chromium is installed locally, so CSP behaviour wasn't run in Firefox or WebKit.
  - `'unsafe-hashes'` is CSP Level 3. To my knowledge it is in current Chrome, Firefox and Safari, which covers the §7 last-two-versions target.
  - In a browser without it, only the hashed attributes would be blocked: the map's aspect-ratio, the swatch colours and the no-op form handler. The range-only form has no implicit submission anyway.
- `upgrade-insecure-requests` is harmless on http://localhost under wrangler (verified) and on HTTPS Pages.
- `Permissions-Policy` lists only features Chromium recognises (no "unrecognized feature" console warnings were seen). Firefox ignores the header.
- Untested Cloudflare details:
  - The CI workflow has not run on GitHub.
  - The dashboard labels in deploy.md come from Cloudflare's docs as of today and may move.
  - Whether Pages reads a major-only `.nvmrc` is unverified (see request 2).
