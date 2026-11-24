# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Andrew Chincea — portfolio

Static Astro + TypeScript site with a Python data pipeline, hosted on Cloudflare Pages. Full spec: portfolio-megaprompt.md (authoritative).

## Commands
npm run dev | build | preview | check | lint | test | e2e | lhci | links | data | verify
Single unit test: npx vitest run tests/unit/<path> (or -t "<name>")
Python tests: pipeline/.venv/bin/python -m pytest pipeline -q   (Windows: pipeline\.venv\Scripts\python)
Python lint: pipeline/.venv/bin/ruff check pipeline

## Rules for every agent
- Facts about Andrew come only from spec §3 and src/content. Unknown → draft + "Needs Andrew". Never invent.
- Edit only the files you own for your current task (spec §8.2). Shared files belong to Control.
- Don't copy from the reference sites. No trackers or third-party runtime requests.
- Persistence math follows spec §6.1 exactly: ties broken by (height, index), 4-connectivity, elder rule.
- Never fabricate Colorado data. Never commit raw DEM tiles or secrets.
- Only the checker runs build, preview, e2e, and Lighthouse (port 4321, one at a time). Builders may run `npx astro dev --port 44NN`.
- Never deploy, run `wrangler login`, or create remotes. Control commits after a checker PASS.
- Control pushes to origin main after each commit; never force-push. Only Control pushes.
- Reports: builders → docs/builds/F#/attempt-N.md; checkers → docs/checks/F#/attempt-N.md.
