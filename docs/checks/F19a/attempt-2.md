# Check report — F19a Copy voice — attempt 2

Verdict: PASS

Gates: check ✅ (149 files; 0 errors, warnings, or hints) · lint ✅ · unit ✅ (811) · pytest ✅ (606 with existing raw tile cache) and ruff ✅ · production build ✅ (10 pages) · e2e ✅ (31/31 owned site tests) · axe ✅ (zero serious/critical in both themes) · Lighthouse ✅ (eight affected routes; 100/100/100/100, CLS 0 on each) · links ✅ (27 scanned, zero broken) · visual ✅ (48 captures) · content ✅ · TDA/data n/a.

## Acceptance criteria

- ✅ #85 / Garden scope: Production Garden says “Here's some of my work,” its metadata says “Selected work,” and About links to “selected work.” The nine-item list and sorting are unchanged; CV-only work still appears on the CV. The browser assertion now checks the corrected lede. `e2e.log`, `scope.log`.
- ✅ §3 / #39: The RiverNets poster and MAA talk use “we” without naming Yunus Kaya or Michael Liu in editorial prose. Author arrays match baseline; their names still render in citation bylines across home, CV and topic pages. The number-theory research entry names its confirmed advisor on the research page as allowed by #68 and credits him on the named coauthored manuscript. `scope.log`, `sheets/research-number-theory.png`.
- ✅ #85–86: Mission is three sentences. Mission, About, Research, Open science and Contact use first person and preserve the underlying facts. About and Contact express interest in PhD programs and in mathematics and data science REUs, not applications; no PhD field, school or date was added. All four copy records remain `confirmed: false`. Contact still requires at least one existing link. `scope.log` and code review.
- ✅ F2 publishing: Parsed all 12 edited content records; titles, dates, statuses, authors, links, tags and draft/confirmed flags match HEAD. Capped fields stayed within 160 characters. Ten production pages had no visible forbidden wording or draft badges. Dev draft rendering and production filtering are unchanged; see attempt 1 for baseline handling.
- ✅ F2 behavior: The isolated `e2e/site.spec.ts` passed keyboard/no-JS Garden, deep links, thumbnail determinism, Research links, citations and CV/PDF checks. Home Research cards have distinct “Related work” accessible names and retain their tag links.
- ✅ §4 / §7: Reviewed 48 captures at 375×812, 768×1024 and 1280×800 in both themes. No page overflow, text clipping, console errors, failed requests or third-party requests; the shared 375px nav intentionally scrolls inside its own container. `/`, `/about/`, `/garden/`, `/cv/`, `/research/` and all three topic pages meet mobile Lighthouse budgets; route JS was 1.7–18.2 KB gzip (limit 120 KB). `lighthouse-scores.txt`, `js-budget.json`.

## Notes (non-blocking)

- Checked clean base `509f38bc1345fcf80974e4f0e21a6ca77d025b24` plus exactly the 20 copy-owned working paths, without the F19b fixes. F19b's hosted timing and inherited viz race are separate. No Firefox/Safari/iOS rerun for this copy slice; this is not a full-site re-audit.
- The copy stays unconfirmed pending Andrew's approval. Do not stage the incidental builder `.Rhistory` or generated evidence.

## Artifacts

- `docs/checks/F19a/attempt-2/`: 48 original PNGs, `sheets/`, `pages.json`.
- `docs/checks/F19a/attempt-2/test-results/`: `scope.log`, `e2e.log`, `visual.log`, `lighthouse-scores.txt`, `js-budget.json` and gate logs (cached pytest in `pytest-cached.log`).
