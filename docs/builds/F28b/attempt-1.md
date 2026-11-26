# Build report — F28b Shell and content feel — attempt 1

Summary: Implemented F28a plans 01, 03, 02, 04, 05, 06, 07, 11, 08 and 10 in that order (DECISIONS #90, #91). The Settings drawer and sheet now slide in from their edge and out again with interruptible `transform` transitions (`@starting-style` plus `transition-behavior: allow-discrete`), with no keyframes and no opacity. Every `:hover` is gated by `(hover: hover) and (pointer: fine)`. Buttons and chips get a 0.97 press scale, with no tap flash. A theme switch lands in one frame. Under reduced motion, transitions are off entirely. `body` uses `100svh`, Settings selects are 16 px on coarse pointers only, and the phone sheet dims the page with `--color-scrim`. No JS behaviour changed except `theme.ts`. `settings.ts` is untouched, so F25 modal semantics are unchanged. No dependencies, no inline styles or scripts.

## Per-plan status

| Plan | Status | Notes |
|---|---|---|
| 01 motion tokens | done | 5 tokens after `--ease`; 3 `0ms` lines in the reduced-motion block. |
| 03 gate hover | done | All 10 hover rule groups wrapped, verbatim inside. Nav split so `aria-current` stays unconditional. `grep ":hover" src` → only gated hits. |
| 02 interruptible drawer/sheet | done, test deviated | CSS exactly as planned; both `@keyframes settings-in-*` removed (`grep settings-in- src` is empty). **Test deviation, see below.** Step 7 (inspect `dist/` CSS) couldn't be done because builders can't build. I checked the dev-served CSS instead: `@starting-style { .settings[data-astro-cid-psic4rm5] … }`, `.settings[data-astro-cid-psic4rm5][hidden]` and the nested ones in the media block all kept the scope attribute. |
| 04 press feedback / tap highlight | done (trivial deviation) | `.link-btn { touch-action: manipulation }` merged into the existing base rule instead of a second `.link-btn` rule (same cascade). |
| 05 theme switch | done | `withoutTransitions()` in `theme.ts`; `:root[data-theme-switching] *` rule placed just above the reduced-motion block. |
| 06 reduced-motion reset | done | `transition: none !important`, with the comment the plan asked for. |
| 07 svh | done | `min-height: 100vh; min-height: 100svh;`. |
| 11 Garden guard | done (selector adapted) | `.garden-list > li` and `a.chip` match the markup. The chip pick also requires `getClientRects().length > 0`, because hidden "unlisted type" chips also match `a.chip`. Both assertions kept. |
| 08 select 16 px on touch | done | `@media (pointer: coarse) { select { font-size: 1rem } }` in `SelectRow.astro`. Desktop stays at 14 px. |
| 10 sheet scrim | done | `:global(body)::after` plus `:global(:root[data-settings-modal]) :global(body)::after` compiles to `body:after` and `:root[data-settings-modal] body:after` (unscoped, as intended). Opacity only; `pointer-events: none`. |

**Plan 02 test deviation (evidence).** As written, the plan's test samples the offset one rAF after each interrupting click and allows a 15 % jump. I probed it on `astro dev` and it is timing-flaky in headless Chromium for two reasons:

- Frame gaps are irregular. In one probe the frames landed at t = 60 → 138 ms, and in another the reopen landed after the close had already finished.
- `--ease-drawer` starts steeply (initial slope about 2.25). One 14–17 ms frame of the shortened exit moved the panel 84 px, which is 22 % of the 384 px travel. A correct retarget therefore already fails the 15 % bound.

The panel itself does not jump. Per-frame logs show 23 → 107 → 230 px in Chromium after closing at 23 px, and 57 → 145 → 271 px in WebKit after closing at 57 px.

The replacement test is deterministic. It finds the panel's `transform` `CSSTransition`, pauses it and seeks it (100 ms into the open, 60 ms into the close), then reads the offset synchronously right after each interrupting click. A retarget gives the same value; a keyframe restart would jump to the off-screen start. On dev it gave identical numbers in Chromium and WebKit:

- 1280 px: midOpen 34.35 = afterClose 34.35; midClose 340.02 = afterReopen 340.02; settles at 0.
- 375 px: 50.07 = 50.07; 495.68 = 495.68.

It also asserts that a full close from rest uses a 200 ms transition, against 260 ms for `--dur-drawer-in`, so exit is faster than enter.

## Files changed
- src/styles/tokens.css (01)
- src/styles/global.css (03, 04, 05, 06, 07)
- src/components/site/Header.astro (03)
- src/components/site/SettingsPanel.astro (02, 10; `<style>` only)
- src/components/site/SelectRow.astro (08)
- src/components/site/theme.ts (05)
- src/components/content/content.css (03, 04)
- src/components/content/WorkRow.astro (03, 04)
- src/components/content/ResearchCard.astro (03)
- src/pages/garden/index.astro (03, 04; `<style>` only)
- e2e/shell.spec.ts, e2e/site.spec.ts (tests)
- docs/builds/F28b/attempt-1.md (this report)

Not touched: `settings.ts`, `BaseLayout.astro`, and everything in hero, explorer, lib, config and package files. The modified hero/explorer files in `git status` belong to the parallel F28c builder.

## Tests added (written, not run: e2e is the checker's)
`e2e/shell.spec.ts`, 13 cases:
- **theme:** `switching theme starts no transitions (F28)`
- **settings panel:**
  - `enter/exit are interruptible transitions, no jumps (1280px, F28)` and the same at 375px (new `sampleInterrupt` helper)
  - `reduced motion: the panel never moves (F28)`
  - `touch: Settings selects are at least 16px (no iOS focus zoom) (F28)` (first asserts that `(pointer: coarse)` matches under `hasTouch`/`isMobile`)
  - `desktop: Settings selects keep the small control size (F28)` (extra: all four selects are `14px` at 1280)
  - `modal sheet dims the page; the wide drawer does not (F28)` (uses `expect.poll` for the scrim opacity)
- **layout and accessibility:**
  - `motion tokens exist (F28)`
  - `every :hover rule is gated … (F28)`
  - `a tapped button keeps no hover fill on touch (F28)`
  - `press feedback: no tap flash, buttons scale on press, not under reduced motion (F28)` (reads `getPropertyValue('-webkit-tap-highlight-color')`, because the TS DOM lib has no `webkitTapHighlightColor` and `astro check` failed on it)
  - `reduced motion: opening Settings and switching theme start no transitions (F28)`
  - `body min-height uses small-viewport units (F28)`

`e2e/site.spec.ts`, 1 case:
- **garden:** `filtering is instant: rows change in the same task, nothing animates (F28)`

Self-check: on `astro dev --port 4402`, a throwaway Playwright probe (scratch dir, not the e2e suite) ran the logic of every new test in Chromium and WebKit. All matched the expected values:
- Tokens resolve as planned.
- Tap highlight is `rgba(0, 0, 0, 0)`.
- Press gives `matrix(0.97, 0, 0, 0.97, 0, 0)`.
- No ungated `:hover` on `/`, `/garden/`, `/research/` or `/rising-water/`.
- Garden filter goes 9 → 1 rows with 0 animations.
- Touch: coarse and hover:none match; selects are 16px; no sticky fill after a tap.
- Desktop selects are 14px.
- Scrim opacity is 0 → 1 → 0 after a backdrop tap, with role=dialog and aria-modal=true.
- Theme flip creates 0 transitions and the attribute is cleared afterwards.
- Reduced motion: transform is `none` on every frame and there are 0 transitions.
- `body` has `100svh`.

I also viewed screenshots of the 375 px sheet in light and dark: the page is dimmed, the sheet is opaque and sits flush at the bottom. Firefox couldn't launch locally (Playwright profile error), so it wasn't probed. The dev server was killed afterwards and port 4402 is free.

## Check results (real output)
- `npm run check`: `Result (169 files): - 0 errors - 0 warnings - 0 hints` (the first run had 1 error, the `webkitTapHighlightColor` typing; fixed).
- `npm run lint`: eslint clean; `All matched files use Prettier code style!`
- `npm test`: `Test Files 37 passed (37)`, `Tests 913 passed (913)`.
- Prettier was run on every touched file.

## How to verify
`npm run check && npm run lint && npm test && npm run build && npx playwright test e2e/shell.spec.ts e2e/site.spec.ts e2e/hero.spec.ts e2e/cls.spec.ts`

Then confirm the `dist/_astro/*.css` scoping from plan 02 step 7: `@starting-style` rules carry `[data-astro-cid-…]`, and `body:after` is unscoped.

## Acceptance criteria (self-check)
1. ✅ Every accepted F28b plan is implemented. The deviations (02's test, 11's selector, 04's rule merge) are explained above.
2. ✅ Interruptible both ways. On dev, the offset is continuous across both interruptions in Chromium and WebKit. `settings.ts` is unchanged, so F25 focus, inert, Esc, Tab wrap and backdrop close are untouched; the checker runs the existing shell tests.
3. ✅ Reduced motion: no transform in any state, 0 `CSSTransition`s on open or theme flip, and no press scale (probe).
4. ⚠️ Touch, emulation only: no sticky hover fill after a tap, selects at 16px, and `svh` in place. Real iPhone still needed.
5. ✅ Only `transform` (panel, press) and `opacity` (scrim) are animated. The colour hover transitions were already there and are only gated now.
6. ✅ No dependencies, no inline style attributes, no new inline `<script>`/`<style>`. `theme.ts` only uses `setAttribute`.
7. ⏳ For the checker: `npm run verify`, CLS and Lighthouse.
8. ✅ Copy, colours, fonts and layout are unchanged, apart from 08 (16 px selects on coarse pointers) and 10 (scrim), which DECISIONS #91 approved.

## Needs Andrew
None.

## Requests to Control
None.

## Known limitations / risks (checker: please look)
- **Exit window, keyboard and AT:** for the 200 ms exit the panel is `[hidden]` but still rendered (`display` is held by `allow-discrete`). Pointer events are off and focus has already returned to the opener. A Tab pressed within that 200 ms could, in principle, reach a control in the leaving panel, and AT may still see it for those frames. I made no JS change, because plan 02 forbids touching `settings.ts`. If the checker can reproduce it, the fix is `visibility: hidden` on `[hidden]` with a discrete `visibility` transition, or `inert` set in JS.
- **Header unpin:** at ≥40.0625rem on a scrolled page, the header unpins the moment `data-settings-open` is removed, while the drawer is still sliding out (the plan predicted this). Check the feel.
- **Theme toggle during motion:** toggling the theme while the drawer is moving cancels its transition through `data-theme-switching`, so the drawer snaps to its end state. This is intentional, and rare.
- **Hover-gate test scope:** the test scans the CSS on `/` and `/rising-water/`, which includes hero and explorer styles. If F28c adds an ungated `:hover`, this test fails. That is the intended guard.
- **Older browsers:** without `@starting-style` or `allow-discrete` (Safari < 17.5, Firefox < 129), the shorthand containing `allow-discrete` is dropped, so the panel shows and hides instantly. It never gets stuck. Not verified locally (Firefox wouldn't launch; WebKit here is modern).
- **Scrim scope:** the scrim CSS lives in `SettingsPanel.astro`, so `body::after` exists only on pages that render the panel, which are the only pages that can set `data-settings-modal`.
- **Real WebKit/iPhone to verify:**
  - the sheet rises from the bottom with no page showing through it;
  - spamming the gear reverses smoothly;
  - no sticky hover after tapping New terrain, Play, the gear or a Garden chip;
  - press scale with no grey flash, and long-press doesn't select a button label;
  - tapping a Settings select doesn't zoom;
  - on `/about/` and the 404 page with the toolbar showing, there is no extra scroll;
  - the scrim reads well in dark mode;
  - the sheet's last row against the home indicator (`viewport-fit=cover` is deferred, A-11).
