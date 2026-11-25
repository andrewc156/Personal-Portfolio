# Build report — F13b Explorer place labels — attempt 1

## Summary

The explorer now offers a **Place labels** checkbox that starts off. An independent SVG layer places names at the published GNIS coordinates, placing higher-priority records first and leaving out names that cannot fit. About the data links to the Domestic Names dataset and coordinate FAQ, displays the published credit, and includes a text list with coordinates and mouth annotations. The layer has no effect on the elevation grid, water rendering, basin mask, or barcode.

## Files changed

- `src/lib/viz/explorer/labels.ts` checks label/grid compatibility, projects geographic coordinates, and positions label boxes in priority order.
- `src/components/explorer/PlaceLabels.astro` and `place-labels-client.ts` render the map layer and lay it out when enabled or resized.
- `src/components/explorer/Explorer.astro` and `explorer-client.ts` connect the keyboard-accessible toggle, label-layer state, and status.
- `src/components/explorer/AboutData.astro`, `build-data.ts`, and `src/pages/rising-water/index.astro` read the local labels file at build time and publish the credit, sources, and coordinate list.
- `tests/unit/viz/explorer/labels.test.ts` checks grid and point validation, coordinate transforms, names, and priority placement.
- `e2e/explorer.spec.ts` covers keyboard toggling, coexistence with the mask, attribution and the text alternative, and map alignment and collision geometry at the three target widths.

## How to verify

- `npm run check`
- `npm run lint`
- `npx vitest run tests/unit/viz/explorer`
- Checker: run the full gates and `npx playwright test e2e/explorer.spec.ts -g 'explorer: place labels'` under the production preview. Check the opt-in map at 375, 768, and 1280 px in both themes with the mask on and off. Record production transfer and Lighthouse against §7.

## Acceptance criteria (self-check)

- ✅ Default off. Native checkbox activates with Space and the status reports how many labels fit. The full coordinate list remains available below the map.
- ✅ Local GNIS source. When present, `labels.json` is read by Astro and checked against the published grid dimensions, checksum, extent, and cell size. The points use the recorded latitude and longitude, and shortened display names are honoured. No label request or other runtime connection is needed.
- ✅ Source credit and mouth records. About the data displays the exact credit from `labels.json` alongside the source link. The list marks downstream points as mouths, following the [USGS explanation of GNIS coordinates](https://www.usgs.gov/us-board-on-geographic-names/what-geographic-names-information-system-gnis).
- ✅ Deterministic layout. Priority and GNIS ID determine placement order. In the six reviewed Chromium dev screenshots, all priority-1 names fit. At 375 px the layer showed 34 of 39 labels. At 768 and 1280 px it showed 37 of 39. No page overflow. Screenshots are under `docs/builds/F13b/`.
- ✅ The layer does no work on animation frames. Its layout runs on opt-in and resize, separately from the canvas controller. The overlay does not receive pointer events. Checker browser tests cover preserved mask and explorer state.
- ✅ Astro check reported zero diagnostics. Lint passed. All 83 explorer unit tests passed.

## Needs Andrew

None.

## Requests to Control

None.

## Known limitations

- At narrower map sizes some lower-priority names are omitted when their placards would collide. Every record is available in the coordinate list.
- The browser self-check was performed in Chromium on the dev server. Production e2e, axe, Lighthouse and transfer measurements remain for the checker.
