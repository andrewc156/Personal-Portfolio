# Andrew Chincea — personal site

Source for [andrewchincea.com](https://andrewchincea.com), the academic site of Andrew Chincea, an undergraduate at Kennesaw State University studying mathematics (statistics concentration) and data science and analytics.

The site is static. Its centerpiece is **Rising water**, an interactive explanation of 0-dimensional persistent homology (the sublevel-set filtration), shown as water rising over terrain with a live barcode:

- on the home page, over generated terrain, alongside the other hero animations;
- on [`/rising-water/`](https://andrewchincea.com/rising-water/), over a real elevation model of the Colorado River Basin study area (Copernicus DEM GLO-90).

## Pages

| Path | What it is |
|---|---|
| `/` | Hero animation, mission, recent work, research areas, open science, teaching, contact |
| `/research/` and `/research/<slug>/` | Research areas |
| `/garden/` | Filterable list of all work (papers, posters, talks, projects) |
| `/rising-water/` | Persistent-homology explorer on Colorado River Basin elevation data |
| `/cv/` | CV (printable) |
| `/about/` | About |

## Stack

- [Astro](https://astro.build/) + TypeScript (strict), plain CSS with design tokens
- Canvas visualizations in `src/lib/viz/`; persistence engine in `src/lib/tda/`
- Python data pipeline in `pipeline/` that builds `public/data/colorado/`
- Tests: Vitest (unit), Playwright (e2e, accessibility, layout shift), pytest (pipeline), Lighthouse CI
- Hosting: Cloudflare Workers (static assets plus a small Worker in `worker/` for redirects and headers)

No runtime third-party requests apart from Cloudflare Web Analytics.

## Getting started

Requirements: Node (version in `.nvmrc`), and Python 3 for the data pipeline.

```sh
npm install
npm run dev          # http://localhost:4321
```

The Colorado data in `public/data/colorado/` is committed, so the pipeline is only needed to rebuild it:

```sh
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
npm run data
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Static build to `dist/`, then generates `dist/_headers` (CSP hashes, cache rules) |
| `npm run preview` | Serve the build |
| `npm run check` | `astro check` (types) |
| `npm run lint` | ESLint + Prettier |
| `npm run test` | Unit tests (Vitest) |
| `npm run pytest` | Pipeline tests |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run links` | Link check on the build |
| `npm run lhci` | Lighthouse CI budgets |
| `npm run verify` | All of the above, in order |
| `npm run check:prod` | Read-only smoke check of the live site (URLs, redirects, 404, headers) |
| `npm run data` | Rebuild the Colorado data |

## Repository layout

```
src/
  pages/          routes
  components/     site shell, hero, explorer, content components
  content/        research areas and work items (YAML)
  data/           profile, CV, copy, teaching, open science (YAML)
  lib/tda/        persistent homology (H0/H1, flooding)
  lib/viz/        hero modes and the explorer renderer
pipeline/         Python pipeline for the Colorado elevation data
public/data/      generated data served to the explorer
worker/           Cloudflare Worker: http/www redirects, headers on every response
scripts/          build helpers, link check, production smoke check
tests/ e2e/       unit and end-to-end tests
docs/             decisions, status, data provenance, deploy guide, build and check reports
```

## Deployment

Pushes to `main` deploy through Cloudflare Workers Builds using `wrangler.jsonc`. See [`docs/deploy.md`](docs/deploy.md) for the setup, the headers and CSP, and the post-deploy checks.

## Data and attribution

Elevation data: Copernicus DEM GLO-90. Provenance, processing and verification are in [`docs/data.md`](docs/data.md); the required attribution is in [`public/data/colorado/ATTRIBUTION.md`](public/data/colorado/ATTRIBUTION.md).

## How this repo is worked on

Development follows a builder/checker process: each change is built against [`portfolio-megaprompt.md`](portfolio-megaprompt.md), independently verified, and only committed after a passing check. See [`CLAUDE.md`](CLAUDE.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/STATUS.md`](docs/STATUS.md) and [`docs/HANDOFF.md`](docs/HANDOFF.md).
