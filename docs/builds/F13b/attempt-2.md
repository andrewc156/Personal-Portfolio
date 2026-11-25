# Build report — F13b Explorer place labels — attempt 2

## Summary

Place markers and leaders now live in an SVG layer beneath every placard. Placement also rejects placards and anchors that would intersect another place’s marker or leader. This keeps the labels legible and their geographic associations clear while retaining all 14 priority-1 labels across the tested sizes.

## Files changed in attempt 2

- `src/components/explorer/PlaceLabels.astro` paints the marker and leader layer before the placard layer.
- `src/components/explorer/place-labels-client.ts` associates matching marker and placard elements by GNIS ID and uses the calculated leader attachment point.
- `src/lib/viz/explorer/labels.ts` uses the actual painted marker footprint, reserves high-priority and already placed markers, and rejects leader intersections with other placards and markers during placement.
- `e2e/explorer.spec.ts` checks SVG paint order, projected anchor coordinates, leader endpoints, and clear placard geometry with both overlays active at three widths in both themes.
- `tests/unit/viz/explorer/labels.test.ts` covers omission when a lower-priority marker would land beneath an unrelated placard.

## How to verify

- `npm run check`
- `npm run lint`
- `npx vitest run tests/unit/viz/explorer`
- Checker: use port 4321 to rerun the full production gates and `npx playwright test e2e/explorer.spec.ts -g 'explorer: place labels'`. Review all six map configurations with both overlays enabled. The placard selector is `g[data-place-id][data-placed]`. Its marker and leader are under the earlier SVG layer in the matching `g[data-place-marker="<GNIS ID>"]` group.

## Acceptance criteria

- ✅ Markers and leaders paint beneath all label text. The geometry rejects both a new leader crossing an earlier placard and a new placard covering an earlier leader.
- ✅ Accurate associations. Marker positions still use the GNIS coordinates. Each leader joins its exact marker to the nearest point on its own placard edge.
- ✅ Reviewed the corrected maps in Chromium dev at 375 × 812, 768 × 1024, and 1280 × 800 in both themes, with the basin mask on. All 14 priority-1 labels fit in each view. In total, 26 labels fit at 375 px, 36 at 768 px, and 32 at 1280 px. Screenshots are `docs/builds/F13b/retry-*.png`.
- ✅ Astro check reported zero diagnostics in 143 files, lint passed, and all 84 targeted explorer unit tests passed.
- ✅ The layer still recomputes only on opt-in or resize. The change leaves the data, TDA, and mask drawing paths alone.

## Needs Andrew

None.

## Requests to Control

None.

## Known limitations

- Crowded lower-priority labels can be omitted so that visible placards and leaders stay readable. The full text list remains available under About the data.
- The builder reviewed the dev server captures. Production browser and visual gates remain for the checker.
