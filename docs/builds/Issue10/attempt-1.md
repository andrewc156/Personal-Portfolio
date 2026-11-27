# Build report — Issue #10 Rising water Lighthouse — attempt 1

The hillshade now lays out at its intrinsic aspect ratio. A horizontal transform applies the map's equirectangular projection and preserves the crop at the partial east and south edges. The eagerly preloaded image uses the browser's default decoding strategy so the browser can coordinate decode with the first paint.

## Files changed

- `src/components/explorer/Explorer.astro`

## How to verify

- Run `npx prettier --check src/components/explorer/Explorer.astro` and `git diff --check`.
- After a production build, run the explorer Playwright suite and mobile Lighthouse on `/rising-water/` in light and dark. Check `image-aspect-ratio`, LCP and total blocking time.

## Acceptance criteria

- Intrinsic aspect and geographic projection ✅ A dev browser probe in Chromium and WebKit at 375, 768 and 1280 px in both themes measured the projected hillshade within 0.024 CSS pixels of the previous target geometry. The untransformed layout box preserves the natural aspect ratio to within integer rounding, and the canvas exactly matches the map box.
- Static fallback and appearance ✅ With JavaScript disabled in both engines, the image loaded with its alternative text, the parent clipped the partial edges, and the dark filter activated only in dark mode.
- Lighthouse performance and best practices pending checker runs.

Needs Andrew: none.

Requests to Control: none.

Known limitation: The historical reports identified the hillshade as LCP in both themes. Light showed 135 ms observed LCP and 5.26 s simulated, compared with 82 ms observed and 2.85 s simulated in dark. Total blocking time was zero in both. These single historical samples do not establish a persistent theme-specific difference.
