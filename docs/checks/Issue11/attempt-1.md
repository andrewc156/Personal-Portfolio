# Check report — Issue #11 Settings drawer exit — attempt 1

**Verdict** PASS

## Gates

- ✅ `npm run check` returned zero errors, warnings, or hints across 172 files.
- ✅ `npm run lint` passed ESLint and Prettier.
- ✅ `npm test` passed all 913 tests.
- ✅ `npm run build` generated 10 pages and the production CSP headers.
- ✅ `npx playwright test e2e/shell.spec.ts e2e/settings-drawer.spec.ts e2e/settings-focus.spec.ts e2e/select-controls.spec.ts` passed all 81 tests against production preview on port 4321. The suite included five drawer tests per browser and zero serious or critical axe findings in light and dark.
- ✅ Reviewed six closing-state screenshots at 375 × 812, 768 × 1024, and 1280 × 800 in both themes.
- n/a for this focused check — Python, Lighthouse, links, content, TDA, and data.

## Acceptance criteria

- ✅ The scrolled header stays pinned through the wide drawer exit. An independent probe measured a header top of 0 px at a page scroll of 600 px while the panel was still rendered. After the display transition finished, both Chromium and WebKit measured the header at −600 px and the panel at `display: none`.
- ✅ Reopening mid-exit retains the pin. Theme changes end the exit and release the pin, and reduced motion releases it immediately. Chromium and WebKit both passed these cases.
- ✅ The drawer and sheet restore focus on close and keep Tab outside the visible exit. The WebKit probe restored the old focus exposure by removing inert during a live exit. Both Tab and programmatic focus then reached the leaving panel.
- ✅ The interruption tests verify the opening and closing transform durations at desktop and mobile sizes. An independent Chromium probe changed the opening transform to 240 ms while the root timing token stayed at 260 ms. The measured duration tracked the actual transition.
- ✅ Wide header controls align above the visible drawer in both themes. The narrow sheet slides below its stationary header.

## Local artifacts

- `docs/checks/Issue11/attempt-1/`
- `docs/checks/tools/issue11-independent.mjs`
