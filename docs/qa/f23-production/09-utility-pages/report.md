# Production QA 09 — Utility pages

**Target:** `https://andrewchincea.com/`  
**Tested:** November 25, 2026 (EST), anonymous Chromium 156, browser session `f23qa09`  
**Scope:** Rendered CV and download/print availability, contact and footer destinations, Open Science code links, favicon and share metadata, genuine 404 recovery.

## Executive summary

**2 confirmed issues: 0 Critical, 0 High, 2 Medium, 0 Low.** Normal CV, footer, and public GitHub destinations worked. Unknown paths returned the correct status but no site recovery; the share and canonical metadata points to localhost. The LinkedIn authwall is an external verification limit, not a confirmed broken link.

| ID | Severity | Category | Issue |
|---|---|---|---|
| 09-01 | Medium | UX / Functional | Real 404 responses omit the site's recovery page |
| 09-02 | Medium | Content / Functional | Production canonical and social URLs point to localhost |

## Confirmed issues

### 09-01 — Real 404 responses omit the site's recovery page

- **Severity/category:** Medium · UX / Functional
- **Repro:** Open `https://andrewchincea.com/qa-missing-cf8867e87875/` directly. Repeat with `https://andrewchincea.com/qa-missing-4b377f2ddce8/no-such-file.html`. Compare with `https://andrewchincea.com/404`.
- **Expected:** A genuinely unknown path returns HTTP 404 **and** renders the branded error content with a working home link.
- **Actual:** Both missing URLs produced Chromium's generic HTTP 404 screen with only Reload, no site navigation. The initial missing URL independently returned HTTP 404 with a zero-byte body. The branded template renders at `/404` (HTTP 200; `/404.html` redirects there) and its **Go to the home page** link successfully returns to `/` (HTTP 200). This confirms the recovery control exists and works when the template actually renders; it does not show up on a genuine miss.
- **Evidence:** [true missing route](screenshots/404.png), [direct branded template](screenshots/direct-404-template.png), [browser status and recovery record](404-recovery.json), [HTTP probes](http-checks.json), [direct template click result](navigation.json).

### 09-02 — Production canonical and social URLs point to localhost

- **Severity/category:** Medium · Content / Functional
- **Repro:** Open `/cv/` on production and inspect `link[rel=canonical]`, `meta[property="og:url"]`, `meta[property="og:image"]`, and `meta[name="twitter:image"]` in the document head. Repeat on `/` and `/about/`.
- **Expected:** Canonical and share URLs use the page's public HTTPS production origin, and image metadata uses a publicly reachable image URL.
- **Actual:** All three sampled pages emit `http://localhost:4321` for these fields. On `/cv/`, canonical and `og:url` are `http://localhost:4321/cv/`; both image fields use `http://localhost:4321/og/social-card.png`. The actual public `https://andrewchincea.com/og/social-card.png` returned HTTP 200 and `image/png`. A remote crawler cannot fetch this site's asset from the emitted localhost address; no live social preview or indexing behavior was tested.
- **Evidence:** [raw CV meta elements](cv-dom.json), [three-page DOM check](navigation.json), [public asset response](http-checks.json).

## Verification and limits

| Check | Outcome |
|---|---|
| CV rendering | Clicked **CV** from the homepage header: `/cv/` returned HTTP 200. Verified the name and contact links, Education, Research interests, Publications and preprints, Research experience, Presentations, Projects, Technical skills, and Work experience in the rendered page. The research and project destinations sampled (three research routes, Rising water, OwlPath) rendered HTTP 200 in Chromium; some returned 403 to a non-browser HTTP client, not to a normal Chromium page visit. [CV UI](screenshots/cv-top.png) · [DOM](cv-dom.json) · [destination checks](cv-link-checks.json). |
| CV download / print | No site-provided download, PDF, or print control was present in the rendered CV. As a fallback check, Chromium produced a readable, selectable five-page US Letter PDF. It retained the site navigation and footer; the publications heading ended page 1 and its entry began page 2. This is browser-generated evidence, not a downloadable site asset or a physical print test. [PDF](cv-browser-print.pdf) · [verification](cv-print-verification.txt) · [page 1](screenshots/cv-print-page-1.png) · [page 5](screenshots/cv-print-page-5.png). |
| Footer | Footer displayed copyright, **About** and **Source**. Clicking About rendered `/about/` (HTTP 200); clicking Source opened the intended public GitHub repository (HTTP 200). [Footer](screenshots/cv-footer.png) · [navigation](navigation.json) · [source click](open-science-scroll.json). |
| Open Science | Header link changed the URL to `/#open-science` and the target section exists. The default-motion harness did not visibly scroll, including on direct/reload; a minimal native smooth-scroll control also failed in the harness, while its instant control worked. With reduced motion, a real header click reached a visible Open Science heading. Default-motion scrolling needs a headed-browser spot-check; no site defect assigned from this harness. The repository opened by click; both `main/pipeline` and `main/src/lib/tda` returned HTTP 200 with matching GitHub titles. [Section](screenshots/open-science.png) · [reduced motion](screenshots/open-science-reduced-motion.png) · [controls](open-science-scroll.json) · [code destinations](http-checks.json). |
| Contact | Homepage and CV agree: `mailto:achincea@students.kennesaw.edu` matches the displayed address; no mail client was launched. `https://github.com/andrewc156` rendered a public profile titled **andrewc156 (Andrew Chincea)**. `https://www.linkedin.com/in/andrewchincea` uses HTTPS and the same slug as the visible link; LinkedIn redirected the anonymous Chromium session to its own signup wall with that exact profile as the return target (HTTP client separately got 999). Profile content was not verified; this is not evidence of a dead link. [Home links](home-dom.json) · [CV links](cv-dom.json) · [external results](http-checks.json) · [authwall](navigation.json). |
| Favicon / sharing | Declared `/favicon.svg` returned HTTP 200 with SVG content and MIME type `image/svg+xml`. No explicit share control was found on the CV; share metadata was checked instead (09-02). |

Read-only coverage: no messages, forms, email, logins, social posts, or external writes. No physical print, multi-browser/mobile sweep, or post-login LinkedIn verification. No site changes or commit.

## Suggestions (separate from findings)

1. Serve the branded error document as the body for missing paths without replacing HTTP 404 with a redirect or 200. Smoke-test both nested and top-level unknown URLs plus the home link after deployment.
2. Configure the production site origin as `https://andrewchincea.com`; add a post-deploy assertion for canonical and social metadata on representative pages and for the share image response.
3. Consider a clearly labeled print/download action if offline CV use is a priority. A print stylesheet can hide navigation/footer and keep each heading with its first entry. If the December 2026 poster was still pending on November 25, consider labeling it **scheduled** or **upcoming**; event status was not independently verified.
4. Spot-check the default-motion Open Science jump in a headed browser; the headless control could not validate it.
