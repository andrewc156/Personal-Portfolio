# Build report — Issue #14 Explorer place labels — attempt 1

The explorer listens for font completion only while place labels are visible. Each show still measures the current text and schedules a follow-up measurement when the font is ready.

Priority-1 placement prefers nearby slots. A bounded search checks intermediate offsets when the greedy layout cannot fit every priority-1 placard with short leaders. If neither nearby search fits them all, the solver compares the placement counts for the standard-only and wider rescue slots. Lower priorities fill the space left by the selected layout.

- Reproducing seed 1100 from CI3 restored the priority-1 count from 12 to 13. Across the 4,000 CI3 seeds the candidate matched or improved the priority-1 count from both baselines.
- A width and font-metric sweep of the published labels kept all 14 priority-1 labels. The longest leader went from 125 to 57 CSS pixels across the sweep.
- Run `npm test -- tests/unit/viz/explorer/label-metrics.test.ts` for the placement regressions, and `npm run e2e -- --project=chromium e2e/explorer.spec.ts -g 'place labels'` after building for the font listener regression.

The wider slots remain available in crowded layouts when they increase the number of priority-1 labels placed. No new dependencies or user decisions were needed.
