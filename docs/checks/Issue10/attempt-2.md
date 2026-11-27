# Check report — Issue #10 candidate 1 — attempt 2

Verdict: FAIL. Restating the map projection in CSS resolves the aspect audit. This trial also removed the asynchronous image decoding hint, and it regressed measured mobile performance.

Gates: build ✅ · Lighthouse ❌ on /rising-water/ · other gates n/a for this superseded candidate.

| Candidate 1 | Performance | Best practices | Simulated LCP (ms) | TBT (ms) |
|---|---:|---:|---:|---:|
| Light 1 | 61 | 100 | 5256 | 819 |
| Light 2 | 81 | 100 | 5254 | 0 |
| Light 3 | 81 | 100 | 5255 | 2 |
| Dark 1 | 81 | 100 | 5256 | 0 |
| Dark 2 | 81 | 100 | 5257 | 1 |
| Dark 3 | 81 | 100 | 5268 | 5 |

All six runs passed the image aspect audit, accessibility and SEO scored 100, CLS was 0, and the hillshade remained LCP.

## Blocking fix

1. At the image declaration in `src/components/explorer/Explorer.astro`, the candidate removed `decoding="async"` at the same time as changing the projection. The actual light score dropped below the required 80 in one of three runs, and modeled LCP was about 2.40 s higher than main every run. Reproduce with the production build and the alternating Lighthouse runs from attempt 1. Restore the async hint and isolate the hillshade paint from explorer initialization before checking again.

## Notes

The light outlier's observed LCP was 315 ms, including 276 ms of element render delay. The grid request started and finished before observed LCP in all six candidate runs. These timings establish order without isolating the cause of the delay.

Artifacts: `candidate-{light,dark}-{1,2,3}.json` and `candidate-build.log` in `/tmp/portfolio-issue-10-metrics/`.
