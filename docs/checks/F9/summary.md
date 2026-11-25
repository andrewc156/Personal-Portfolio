# Portfolio final audit — F9 attempt 5

**Not signed off.** Commit `680aeac5bfac239100f691f0412d88bc482441c3` passed exact hosted CI (`45645398484`), and the audit did not find an F19 site regression in the browsers tested. The required last-two-version Chrome, Firefox and Safari/iOS checks are incomplete. Firefox would not start even on a blank page; the WebKit iPhone check was emulated, not a real iOS Safari test.

- **Checks passed:** typecheck, lint, 827 unit tests, 598 Python tests (8 cache-dependent skips), 182 Chromium tests, 8 Wrangler security/headers tests, and 27 internal links. Hosted Chromium passed all five hero timing thresholds; this Mac's Chromium missed 22 ms even on a blank page.
- **Site checks:** 60 views across ten pages, three sizes and two themes; zero axe violations, unintended horizontal overflow or third-party requests. No-JS, keyboard and reduced-motion checks succeeded in the tested browsers. Nine pages scored 100 across all Lighthouse categories; Rising water scored 96/100/96/100. Layout shift was zero.
- **Data:** the TypeScript engine and Python reference agreed, including all 600 published bars. The Colorado data matched the expected bounds, USGS sample and label checks, and Copernicus attribution.

**Next actions:** Control should finish the real-browser matrix on this build. Andrew should set `SITE_URL=https://andrewchincea.com` in Cloudflare Workers and rebuild when ready: the live canonical, sitemap index and robots pointer still say localhost. The exact configured build already produces the right URLs. The F19 copy and hero-caption decisions remain optional approvals.

[Full report](attempt-5.md) · evidence: `~/.hermes/cache/scratch/f9-attempt5.YiWN0rKJ/evidence/`
