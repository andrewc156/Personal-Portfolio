# Build report — Issue #17 shared select styles — attempt 1

## Summary

The shared `.select-field` style gives native selects a consistent control box and a CSS-drawn chevron. Settings panel selects use it with their existing 9rem minimum width. The hero gear and header icons share the same 20px sizing rule via `.btn__icon` and `.icon-btn svg`.

## Files changed

- `src/styles/global.css`
- `src/components/site/SelectRow.astro`

## Verification

- ✅ `npm run check` reported zero diagnostics in 171 files.
- ✅ `npm run lint` passed.
- ✅ `npm run test` passed all 913 tests.
- ✅ Source review confirms a 36px default minimum height, theme-token border and text colors, the existing global focus ring and a 16px coarse-pointer font size.
- ✅ The chevron uses CSS gradients, and forced-colors mode restores the browser chevron. Select elements keep their labels and native options.
- ❌ The 44px hero geometry and select behavior in WebKit await the independent browser check.

## Needs Andrew

None.

## Requests to Control

Adjust the existing QA-13 text-width assertions to measure the space available after padding. The previous assertion reserves an additional 20px for a native chevron. The new 28px right padding already reserves the CSS chevron space.

## Known limitations

Browser, production build and Lighthouse checks are assigned to the checker.
