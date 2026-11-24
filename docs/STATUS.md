# Status board

| Feature | Owner | State | Attempt | Last report | Notes |
|---|---|---|---|---|---|
| Phase 0 Setup | control | done | 1 | — | Toolchain, scaffold, agents, configs, venv |
| F1 Site shell | site-builder | done | 2 | docs/checks/F1/attempt-2.md | PASS_WITH_NOTES: a few type/size literals outside tokens.css; 375 header not pinned while sheet open (by design); F8 CSP needs hashes for 2 inline scripts |
| F2 Content and pages | site-builder | built, waiting for checker | 1 | docs/builds/F2/attempt-1.md | |
| F3 Persistence engine | tda-engineer | done | 1 | docs/checks/F3/attempt-1.md | PASS_WITH_NOTES: advanceTo allocates a closure per call (doc says only event array); backward advanceTo replays all events from bottom — F5/F6 must handle; browser frame timing to confirm in F5/F6 |
| F4a Colorado DEM → grid | data-engineer | done | 1 | docs/checks/F4a/attempt-1.md | PASS_WITH_NOTES: fix in F4b — half-pixel range "34–46 m", source "2021 release" unsourced, vertical-accuracy claim unsourced |
| F4b Reference barcode | data-engineer | todo | 0 | — | needs F3 PASS |
| F5 Synthetic hero | viz-builder | todo | 0 | — | needs F1 + F3 |
| F6 Colorado explorer | viz-builder | todo | 0 | — | needs F4b + F5 |
| F7 Polish / SEO / perf / a11y | site-builder | todo | 0 | — | |
| F8 Cloudflare Pages setup | site-builder | todo | 0 | — | |
| F9 Final audit | checker | todo | 0 | — | |

States: todo · building · checking · done · blocked
