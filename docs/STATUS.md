# Status board

| Feature | Owner | State | Attempt | Last report | Notes |
|---|---|---|---|---|---|
| Phase 0 Setup | control | done | 1 | — | Toolchain, scaffold, agents, configs, venv |
| F1 Site shell | site-builder | done | 2 | docs/checks/F1/attempt-2.md | PASS_WITH_NOTES: a few type/size literals outside tokens.css; 375 header not pinned while sheet open (by design); F8 CSP needs hashes for 2 inline scripts |
| F2 Content and pages | site-builder | done | 2 | docs/checks/F2/attempt-2.md | PASS_WITH_NOTES: anchor test only proves scroll for below-fold sections (F7); /garden/ meta description lists drafted types (F7); no unit tests for format.ts/thumb.ts |
| F3 Persistence engine | tda-engineer | done | 1 | docs/checks/F3/attempt-1.md | PASS_WITH_NOTES: advanceTo allocates a closure per call (doc says only event array); backward advanceTo replays all events from bottom — F5/F6 must handle; browser frame timing to confirm in F5/F6 |
| F4a Colorado DEM → grid | data-engineer | done | 1 | docs/checks/F4a/attempt-1.md | PASS_WITH_NOTES: fix in F4b — half-pixel range "34–46 m", source "2021 release" unsourced, vertical-accuracy claim unsourced |
| F4b Reference barcode | data-engineer | done | 1 | docs/checks/F4b/attempt-1.md | PASS_WITH_NOTES: switch LANDMARKS to USGS GNIS/MRDS coords (Ray Mine confirmed); unify "≈ 40 m" wording in data.md Limitations |
| F5 Synthetic hero | viz-builder | building | 1 | — | |
| F6 Colorado explorer | viz-builder | todo | 0 | — | needs F4b + F5 |
| F7 Polish / SEO / perf / a11y | site-builder | todo | 0 | — | |
| F8 Cloudflare Pages setup | site-builder | todo | 0 | — | |
| F9 Final audit | checker | todo | 0 | — | |

States: todo · building · checking · done · blocked
