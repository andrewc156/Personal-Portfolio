# Check report — Issue #10 baseline — attempt 1

Verdict: PASS_WITH_NOTES for the measured budgets on main. The hillshade aspect audit reproduced in every run.

Gates: build ✅ · Lighthouse ✅ on /rising-water/ · geometry baseline captured in Chromium and WebKit · other gates n/a for the baseline investigation.

## Lighthouse mobile

Baseline is `87b84f1`, using the production build, the LHCI static-server middleware on port 4321, Lighthouse 13.6.0, and Playwright Chromium 1255 on macOS. Ran three reports per color scheme, alternating light and dark. Dark used `--blink-settings=preferredColorScheme=0`.

| Baseline | Performance | Accessibility | Best practices | SEO | Simulated LCP (ms) | TBT (ms) | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Light 1 | 96 | 100 | 96 | 100 | 2855 | 0 | 0 |
| Light 2 | 96 | 100 | 96 | 100 | 2854 | 0 | 0 |
| Light 3 | 96 | 100 | 96 | 100 | 2853 | 0 | 0 |
| Dark 1 | 96 | 100 | 96 | 100 | 2854 | 0 | 0 |
| Dark 2 | 96 | 100 | 96 | 100 | 2855 | 3 | 0 |
| Dark 3 | 96 | 100 | 96 | 100 | 2853 | 1 | 0 |

- Lighthouse identified the hillshade as LCP. It flagged the image's 977 × 1241 intrinsic size against the approximately 377 × 600 CSS box. The map intentionally adjusts the longitude scale and clips the last partial raster blocks to align its overlays.
- The historical light and dark reports both used the same 179,881-byte transferred resource. Their simulated LCP was 5258 ms light and 2852 ms dark, with TBT 0 ms in both. The unthrottled trace breakdown was 5.6 / 10.6 / 8.3 / 110.9 ms in light and 4.2 / 14.4 / 6.3 / 56.6 ms in dark (TTFB / resource delay / resource duration / element render delay). The historical light run's measured render delay was higher, and the simulator amplified the LCP gap. The new baseline did not reproduce a consistent light-theme slowdown or establish a theme-specific cause.
- The current baseline's observed hillshade paint was 55–84 ms light and 58–75 ms dark. The grid request began before that observed paint in all six runs, with a lead of about 3–14 ms. It finished 2–8 ms after the observed paint in all six runs. The archived light grid request finished before observed LCP, and the archived dark request finished after it.

Artifacts: six baseline Lighthouse JSON reports, build log, and geometry measurements in `/tmp/portfolio-issue-10-metrics/`.
