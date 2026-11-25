# Build report — F14 Homepage animation toolbar — attempt 1

## Summary

The homepage has an Animation dropdown and a labeled Settings button on one row above the canvas. The dropdown has moved out of the settings panel and uses the existing five modes, deep links, and form reset. Both the toolbar button and header gear open the same panel, and closing it returns focus to the button that opened it.

## Files changed

- `src/components/hero/Hero.astro` adds the toolbar with native controls and 44 px minimum touch targets.
- `src/components/hero/HeroSettings.astro` links the relocated select to the existing form and keeps the mode-specific settings note.
- `src/components/hero/hero-client.ts` connects the relocated select to the existing mode controller and resets to Rising water.
- `src/components/site/settings.ts` synchronizes both triggers and restores focus to the opener.
- `src/components/site/SettingsPanel.astro` updates the panel behavior comment.
- `e2e/hero.spec.ts` updates existing mode checks and adds a mobile toolbar regression.

## How to verify

Run `npm run check`, `npm run lint`, and `npx vitest run tests/unit/viz`. The checker can run `npx playwright test e2e/hero.spec.ts e2e/shell.spec.ts` after the production build and use Lighthouse to confirm the CLS budget.

## Acceptance criteria (self-check)

- ✅ The dropdown and Settings button fit side by side above the animation at 320, 375, 768, and 1280 px with no page overflow. Dev captures are under `docs/builds/F14/toolbar-*.png`.
- ✅ The dev page loaded Dye spill from a direct link, switched to Fractal pond through the on-page select, and reset to Rising water using the panel.
- ✅ Keyboard opening focuses the panel title. Escape returns focus to the toolbar button, and the panel close button returns focus to the header gear when the gear opened it.
- ✅ With JavaScript disabled, the native toolbar controls are disabled and the static terrain is visible.
- ✅ Astro check reported zero diagnostics, lint passed, and all 221 visualization unit tests passed.

## Needs Andrew

None.

## Requests to Control

None.

## Known limitations

Production Playwright, Lighthouse, and quantitative CLS are reserved for the checker. The isolated Astro dev server on port 4414 was stopped after the screenshots.
