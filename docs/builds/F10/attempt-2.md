# Build report — F10 Extra hero modes — attempt 2

Summary: Reviewed the interrupted F10 implementation and preserved its four mode integrations. The shared mode controller now waits for both page visibility and intersection before scheduling dirty redraws, and an already queued frame cannot render after either condition becomes false. The Random rivers lattice now targets 5 CSS px in both dimensions. The Collatz canvas label describes the drawing without reporting the full tree count while it is still growing.

## Files changed in attempt 2

- `src/lib/viz/hero/modes/shell.ts` gates scheduling and rendering while retaining dirty state for the next visible frame.
- `src/lib/viz/hero/modes/rivers.ts` sets the downstream spacing to 5 CSS px and keeps the 40,000-node cap.
- `src/lib/viz/hero/modes/collatz.ts` removes the full tree count from the canvas label. The readout still shows the live count.
- `docs/builds/F10/attempt-2.md` records the retry. The attempt-1 report lists the rest of the feature files.

## How to verify

- Builder checks: `npm run check`, `npm run lint`, `npx vitest run tests/unit/viz/modes`.
- Checker after `npm run build`: `npx playwright test e2e/hero.spec.ts -g "extra modes pause off-screen" --repeat-each 3`. Use the existing F10 sizing and performance probe against preview and rerun the acceptance criteria from attempt 1.

## Acceptance criteria (self-check)

- ✅ Both dirty-only and animation frames use the visibility gate. Intersection and visibility callbacks schedule the deferred redraw when the hero returns. The existing off-screen regression assertion is unchanged. Runtime verification belongs to the checker.
- ✅ Rivers targets a 5 × 5 CSS px lattice by construction. Measured spacing and frame time belong to the checker.
- ✅ Collatz retains the live count in the readout and keeps a stable canvas label during growth.
- ✅ Astro check found zero errors, warnings, or hints across 138 files. Lint passed. All 39 mode unit tests passed across five files.

## Needs Andrew

None.

## Requests to Control

Assign a fresh F10 attempt-2 checker. Ask it to measure the revised rivers mode and remeasure CLS on direct mode links against the existing budget.

## Known limitations

The direct-mode CLS note from attempt 1 remains open. It was within budget at the audited viewport. This retry keeps the existing strip layout, so the checker should verify it stays within budget.
