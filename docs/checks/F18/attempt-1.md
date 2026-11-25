# Check report — F18 Cloudflare-only deployment — attempt 1

Verdict: PASS

Gates: workflow diff and file comparison ✅ · check · lint · unit · pytest · build · e2e · axe · Lighthouse · links · visual · content · TDA · data (all n/a for a workflow deletion)

Acceptance criteria:

- ✅ The worktree and candidate snapshot omit `.github/workflows/deploy-gh-pages.yml`. The workflow diff against accepted main `9f28641` lists only that deletion.
- ✅ `ci.yml` matches `9f28641` byte for byte in both places. The remaining workflow contains no GitHub Pages upload or deployment action.
- ✅ `astro.config.mjs` and `src/lib/url.ts` are unchanged. Existing base-path support remains available.

Notes: The change stops future uploads from this repository workflow. Previously published Pages content and remote project settings were outside this local check.

Artifacts: `docs/checks/F18/attempt-1/workflow.log`.
