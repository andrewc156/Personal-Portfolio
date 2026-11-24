# Status board

| Feature | Owner | State | Attempt | Last report | Notes |
|---|---|---|---|---|---|
| Phase 0 Setup | control | done | 1 | — | Toolchain, scaffold, agents, configs, venv |
| F1 Site shell | site-builder | done | 2 | docs/checks/F1/attempt-2.md | PASS_WITH_NOTES: a few type/size literals outside tokens.css; 375 header not pinned while sheet open (by design); F8 CSP needs hashes for 2 inline scripts |
| F2 Content and pages | site-builder | done | 2 | docs/checks/F2/attempt-2.md | PASS_WITH_NOTES: anchor test only proves scroll for below-fold sections (F7); /garden/ meta description lists drafted types (F7); no unit tests for format.ts/thumb.ts |
| F3 Persistence engine | tda-engineer | done | 1 | docs/checks/F3/attempt-1.md | PASS_WITH_NOTES: advanceTo allocates a closure per call (doc says only event array); backward advanceTo replays all events from bottom — F5/F6 must handle; browser frame timing to confirm in F5/F6 |
| F4a Colorado DEM → grid | data-engineer | done | 1 | docs/checks/F4a/attempt-1.md | PASS_WITH_NOTES: fix in F4b — half-pixel range "34–46 m", source "2021 release" unsourced, vertical-accuracy claim unsourced |
| F4b Reference barcode | data-engineer | done | 1 | docs/checks/F4b/attempt-1.md | PASS_WITH_NOTES: switch LANDMARKS to USGS GNIS/MRDS coords (Ray Mine confirmed); unify "≈ 40 m" wording in data.md Limitations |
| F5 Synthetic hero | viz-builder | done | 2 | docs/checks/F5/attempt-2.md | PASS_WITH_NOTES: pass diamond can cover pit ring when adjacent; "17 / m" wrap (use NBSP); destroy() leaves timers; hidden tab only emulated |
| F6 Colorado explorer | viz-builder | done | 2 | docs/checks/F6/attempt-2.md | PASS_WITH_NOTES: first-run Lighthouse cold-start outlier (58; 14/15 runs = 97) — consider Worker for computeH0; e2e covers only hash-path corruption; map hint shown in error state |
| F7 Polish / SEO / perf / a11y | site-builder | done | 1 | docs/checks/F7/attempt-1.md | PASS_WITH_NOTES: footer wraps at 375 (clean); social card bakes in draft name/tagline — rerun scripts/og-image.mjs after confirming; home description is just the tagline |
| F8 Cloudflare Pages setup | site-builder | todo | 0 | — | |
| F9 Final audit | checker | todo | 0 | — | |

States: todo · building · checking · done · blocked
