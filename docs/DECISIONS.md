# Decisions log

Decisions Control made without asking Andrew (spec §1.5, §9.6). Newest last.

## Phase 0
1. **Git remote and pushing (Andrew's explicit override).** Repo was already on `main` with `origin` = github.com/andrewc156/Personal-Portfolio (public). Control pushes `origin main` after every commit, never force-pushes. Still no deploy, `wrangler login`, other remotes, or Cloudflare connection.
2. **Toolchain.** Node 26.13.0 / npm 11.20.0, Python 3.13.9, git 2.47.0. `.nvmrc` = `26` (current Node LTS line).
3. **Astro 7.4.13**, minimal template, `astro/tsconfigs/strict`. Scaffolded in a scratch folder and copied in with no overwrites (create-astro refuses non-empty dirs). Template README not copied.
4. **npm 11 install-script gating.** Approved install scripts for `esbuild`, `workerd`, `fsevents` (recorded in `package.json` `allowScripts`); Vite and wrangler need them.
5. **`site` fallback.** `astro.config.mjs` uses `SITE_URL`, falling back to `http://localhost:4321` so local builds produce well-formed canonical/sitemap URLs. Cloudflare must set `SITE_URL`.
6. **`trailingSlash: 'always'`, `build.format: 'directory'`** to match the `/garden/`-style routes in spec §5 and Cloudflare Pages' directory serving. Astro emits `404.html` at the root, which Pages serves for unknown routes.
7. **Extra devDependencies:** `typescript-eslint` and `@typescript-eslint/parser` (needed for ESLint flat config over TS/Astro).
8. **Extra npm scripts:** `pytest` (used by `verify`) and `format` (prettier --write). `lint` = ESLint + `prettier --check` on src/tests/e2e/scripts.
9. **Lighthouse CI** uses Playwright's Chromium (`chromePath` from playwright-core) unless `CHROME_PATH` is set. URLs default to `/` and `/404.html`; override with `LHCI_URLS=/,/garden/,…`. Performance is a warn-level assertion at 0.9 because `/rising-water/` has a lower budget (≥ 80); the checker compares per page against §7.
10. **linkinator** skips every non-localhost URL, so it checks internal links only. External links are reviewed separately as warnings.
11. **Vitest** `passWithNoTests` so `npm test` is green before F3 adds tests. Note: `pytest pipeline` exits 5 ("no tests collected") until F3/F4a add tests; checkers should record it as n/a until then.
12. **Python deps installed fine:** numpy 2.5.5, rasterio 1.5.2, gudhi 3.13.0, ruff 0.17.6. No GUDHI fallback needed.
13. **Gitignore additions** beyond §9.1: `.claude/scheduled_tasks.lock`, `.claude/settings.local.json`, Python caches, `.DS_Store`.
14. **Agents.** `.claude/agents/*.md` copied verbatim from spec §8.3. This session spawns `general-purpose` agents with the role body pasted in (new agents folder loads only next session).
