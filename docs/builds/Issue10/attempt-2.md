# Build report — Issue #10 Rising water Lighthouse — attempt 2

The first candidate cleared the image audit, but its Lighthouse performance scores varied. This attempt retains the projection and restores asynchronous hillshade decoding. The explorer waits for the hillshade to decode and for a rendering opportunity before asking for elevation data. A failed decode still lets the explorer load.

## Files changed

- `src/components/explorer/Explorer.astro`
- `src/components/explorer/explorer-client.ts`

## How to verify

- Run `npx prettier --check src/components/explorer/{Explorer.astro,explorer-client.ts}` and `npx eslint src/components/explorer/{Explorer.astro,explorer-client.ts}`.
- After building, audit `/rising-water/` in both mobile Lighthouse themes. Verify the hillshade is painted before the elevation grid request, inspect the aspect audit and review LCP and TBT.
- Run the explorer Playwright suite and confirm startup still works when a browser request for `hillshade.webp` fails.

## Acceptance criteria

- Geographic projection ✅ Retains the intrinsic image layout, horizontal projection and partial edge crop checked in attempt 1.
- Startup scheduling ✅ After the load event, startup waits for `decode()` to settle, passes through two animation frames and uses the existing idle callback to load data. A hidden tab resumes the queued frames when shown.
- Static fallback ✅ The HTML image and its existing alternative text work without JavaScript.
- Formatting and lint ✅ Focused Prettier, focused ESLint and `git diff --check` pass.
- Lighthouse performance and functional startup pending checker runs.

Needs Andrew: none.

Requests to Control: none.

Known limitation: Browser scheduling decides when a rendering opportunity results in a paint. The two animation frames provide an opportunity before grid startup.
