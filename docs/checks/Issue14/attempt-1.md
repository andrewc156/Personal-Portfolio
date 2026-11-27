# Explorer place labels, issue #14 — check attempt 1

**Verdict:** PASS_WITH_NOTES

Astro check passed across 170 files with zero diagnostics. Lint and all 915 unit tests passed. Python had 598 passes and eight skips, and Ruff passed. The static build and all 55 Chromium explorer tests passed, including axe checks. Linkinator found no broken links across 30 checked URLs. Mobile Lighthouse on `/rising-water/` scored 96 performance, 100 accessibility, 96 best practices and 100 SEO, with CLS 0.

## Acceptance criteria

- The font listener is absent at startup and while place labels are hidden. It is registered once when labels appear and removed on each hide. The independent Playwright probe exercised three hide/show cycles in Chromium and WebKit at a 320 px viewport. A delayed same-origin face triggered a native relayout in Chromium, with all 14 priority-1 labels retained and no stale widths. WebKit relaid out on a dispatched `loadingdone` event, also preserving all 14 labels and clearing stale widths. A dispatched event while hidden caused no measurements in either browser.
- The synthetic seed 1100 recovers the 13 priority-1 placements from before CI3, up from 12 on the issue baseline. Across 4,000 deterministic synthetic layouts, none lost a priority-1 label relative to either baseline, 40 gained placements against the issue baseline, and reversing inputs gave identical results. The comparison used the pre-CI3 revision `5c54ee2^` and issue baseline `4a385f7`.
- All 8,800 layouts in the published-data sweep preserved all 14 priority-1 labels and passed independent bounds, placard separation, marker visibility and leader intersection checks. The sweep covered five measured font width tables, scales 0.9–1.3 and map layer widths from 286 px (320 px viewport) to 1300 px. The maximum leader shrank from 125 px to 57 px. Only 11 cases had a leader over 50 px, down from 191.
- Visual inspection covered all eight map screenshots at 320, 375, 768 and 1280 px in light and dark themes with the basin mask enabled. No label overlap or clipping was visible. The e2e tests also verified the GNIS credit and place list, the keyboard toggle, and map state preservation.

## Notes

- Playwright WebKit loaded the delayed face but emitted zero native `loadingdone` events in the independent probe. With labels shown, the application uses the same callback and event registration as the baseline. The WebKit probe confirmed listener registration, removal and relayout on event delivery. Native late swap was confirmed in Chromium.
- Explorer tests ran locally. The full site browser suite is handled by hosted CI. Content, data, hosting and TDA implementations were outside the source diff.

Local diagnostics are in `docs/checks/Issue14/attempt-1/`. Probe sources are in `docs/checks/tools/issue14-layout.mjs`, `docs/checks/tools/issue14-fonts.mjs` and `docs/checks/tools/issue14-shots.mjs`.
