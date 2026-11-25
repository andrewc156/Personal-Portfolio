# Build report — F8 Cloudflare Pages troubleshooting — attempt 2

Summary: The deployment guide now explains the November 25, 2026 build log. Cloudflare completed the static build, then the Workers deploy command configured the Astro adapter and reran the build in the Worker prerenderer. That second build could not resolve the explorer metadata using its filesystem path. The guide points to the Pages Git integration settings and the existing static-assets alternative.

Files changed:
- `docs/deploy.md` documents the failure, the correct Pages setup and the deploy-command clue. It also removes the assumed npm version.
- `docs/builds/F8/attempt-2.md` records this documentation follow-up.

How to verify:
- `git diff --check -- docs/deploy.md docs/builds/F8/attempt-2.md`
- `npm run check && npm run lint && npm test` on the accepted main snapshot with the guide change.

Acceptance criteria (self-check):
- ✅ The incident timeline matches the supplied log. `git ls-files --stage -- public/data/colorado/meta.json` confirms the source metadata is tracked.
- ✅ The guide gives the Pages project path, `main`, `npm run build`, `dist` and `SITE_URL`. Cloudflare publishes the build output automatically. [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- ✅ The explanation of Wrangler's reconfiguration agrees with the official Workers Astro guide. [Wrangler automatic configuration for Astro](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/#deploy-an-existing-astro-project-on-workers)
- ✅ Astro check showed zero diagnostics. Lint passed and all 793 unit tests passed in the isolated accepted main snapshot.

Needs Andrew: Use the Pages setup in the guide for the intended deployment.

Requests to Control: Review the documentation change with the deployment log.

Known limitations: The incident diagnosis uses the supplied Cloudflare log. A Pages dashboard deployment is outside this documentation follow-up.
