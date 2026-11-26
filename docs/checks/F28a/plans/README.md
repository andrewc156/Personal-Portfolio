# F28a plans

Written by the F28a audit (checker role, read-only) at commit `1b8f6aa`. See `../audit.md` for the evidence behind each one. Control fills in each plan's Accept/Reject line during triage (DECISIONS #90). Plans marked **Needs Andrew** change the look and wait for his OK.

| # | Plan | Severity | Owner | Look? | Status | Depends on |
|---|---|---|---|---|---|---|
| 01 | [Motion tokens](01-motion-tokens.md) | P3 | site-builder | feel | TODO | — |
| 02 | [Settings drawer/sheet: interruptible enter and exit](02-settings-interruptible-transitions.md) | **P1** | site-builder | feel | TODO | 01 |
| 03 | [Gate every :hover for touch](03-gate-hover-for-touch.md) | **P1** | site-builder | feel | TODO | — |
| 04 | [Press feedback, no tap flash](04-press-feedback-and-tap-highlight.md) | P2 | site-builder | feel | TODO | 01, 03 |
| 05 | [Theme switch without transitions](05-theme-switch-without-transitions.md) | P2 | site-builder | feel | TODO | — |
| 06 | [Reduced motion: transitions off, not 0.01 ms](06-reduced-motion-reset-no-transitions.md) | P3 | site-builder | feel | TODO | after 02 |
| 07 | [body min-height in svh](07-body-min-height-svh.md) | P3 | site-builder | feel | TODO | — |
| 08 | [Settings selects 16 px on touch](08-settings-select-16px-touch.md) | P2 | site-builder | **LOOK, Needs Andrew** | blocked | — |
| 09 | [Hero/explorer fields 16 px on touch](09-viz-inputs-16px-touch.md) | P2 | viz-builder | **LOOK, Needs Andrew** | blocked | — |
| 10 | [Scrim behind the modal sheet](10-sheet-scrim.md) | P2 | site-builder | **LOOK, Needs Andrew** | blocked | 01, 02 |
| 11 | [Don't animate: Garden filter and nav (guard test)](11-dont-animate-site-guards.md) | P3 | site-builder | tests only | TODO | — |
| 12 | [Don't animate: explorer/hero readouts (guard test)](12-dont-animate-viz-guards.md) | P3 | viz-builder | tests only | TODO | — |

## Execution order

- **F28b (site-builder):** 01 → 03 → 02 → 04 → 05 → 06 → 07 → 11. Then 08 and 10 only if Andrew approves; 10 goes after 02 (same file).
- **F28c (viz-builder, in parallel):** 12, then 09 only if Andrew approves.
- **F28d (NumberFlow):** the audit recommends not running it (see `../audit.md`, "NumberFlow (F28d) recommendation"). If it runs anyway, plan 12's guard must stay green.

No plan spans both owners. No plan needs a Control-owned file (`package.json`, `scripts/write-headers.mjs`, `e2e/cls.spec.ts`, `e2e/headers.spec.ts`).
