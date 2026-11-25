# Build report — F18 Cloudflare-only deployment — attempt 1

Summary: At Andrew's request, the repository no longer defines a GitHub Actions workflow to upload or deploy GitHub Pages. Cloudflare remains the deployment path for new releases.

Files changed:

- Removed `.github/workflows/deploy-gh-pages.yml`.

How to verify:

- `git diff --check -- .github/workflows`
- `git diff --name-status -- .github/workflows`
- `rg --files --hidden .github/workflows`
- `rg -n -i 'upload-pages-artifact|deploy-pages|pages: write|github-pages' .github/workflows` should find no matches.

Acceptance criteria (self-check):

- ✅ The workflow diff contains only the deployment workflow deletion.
- ✅ `.github/workflows/ci.yml` is the sole remaining workflow. No Pages upload or deploy actions remain.
- ✅ The CI workflow, Astro configuration, and base-path helper have no changes from this task.

Needs Andrew: Nothing for the workflow removal.

Requests to Control: Confirm the workflow diff independently before pushing.

Known limitations: A previously published GitHub Pages site can remain available after the workflow is removed. Publishing settings and deployment history are outside this task.
