# F28a — Motion and feel audit (read-only, checker role)

- **Commit audited:** `1b8f6aa` (working tree clean outside `docs/`), production build (`npm run build`) served by `npx astro preview --port 4321`, driven by `docs/checks/tools/f28a-run.sh` + `f28a-probe{1..4}.mjs` (Playwright Chromium and WebKit).
- **Matrix covered:** 375×812 and 390×844 with touch (`hasTouch`, `isMobile`), 768×1024, 1280×800; light and dark; default and `reducedMotion: 'reduce'`; WebKit `iPhone 13` profile for the iOS items. No verdict (audit only).
- **Rubric:** `docs/design-skills/emil-kowalski` (improve-animations/AUDIT.md, mobile-native, remove-animations, emil-design-eng), with the repo overrides in that folder's README.

## Summary

The site has very little motion, and most of it is right. Hover colour changes are short (120 ms) and touch only colour. The Garden filter, the explorer readouts and the hover/elevation tooltip change instantly, which is correct for things used many times a visit. Reduced motion is handled everywhere: the hero holds its 45 % frame, the explorer and anchor scrolls don't smooth-scroll, and the drawer/sheet open with no movement.

What's wrong is concentrated in three places:

1. **The Settings drawer and sheet** (the only real UI transition) is a one-way keyframe. It animates in, closes instantly with `display: none`, and restarts from opacity 0 when reopened mid-animation (measured: opacity 0.80 → close → reopen → 0). On the phone sheet it is mostly a fade: a 24 px rise with opacity, so for ~100 ms the page shows through the sheet (double exposure, see `sheet-open-375-*.png`).
2. **Touch:** no `:hover` rule is gated by `(hover: hover) and (pointer: fine)`. A tapped `.btn` (New terrain, Play) or `.icon-btn` (gear, theme) keeps its hover fill after the tap. Reproduced in both Chromium and WebKit touch emulation (`touch-*.png`, `reduced-sheet-375-*.png`). No control has `:active` press feedback, and the default tap-highlight flash is on (Chromium `rgba(51,181,229,.4)`, WebKit `rgba(0,0,0,.4)`). Eight form controls are under 16 px and will zoom iOS Safari on focus.
3. **Theme toggle:** flipping the theme makes every `.btn` transition its colours over 120 ms while the rest of the page snaps. For one or two frames the buttons stay light on a dark page (`theme-flip-1280.png`).

Findings: **10 with plans** (P1: 2, P2: 5, P3: 3) plus 1 observation, and 2 "don't animate" guard plans. By owner: site-builder 10 plans (01–08, 10, 11), viz-builder 2 plans (09 fix, 12 guard). Control: no file of Control's needs to change for any plan. Control only acts if F28d goes ahead (dependency and CSP hash). Three plans change the **look** and need Andrew: 08, 09 and 10.

## Findings

| ID | P | Surface | file:line | What's wrong (evidence) | Rule violated (skill) | Owner | LOOK / FEEL | Plan |
|---|---|---|---|---|---|---|---|---|
| A-01 | P1 | Settings drawer (wide) and sheet (≤40rem) | `src/components/site/SettingsPanel.astro:58, 61–63, 111, 116–128`; `settings.ts:109` | Enter is a `@keyframes` (220 ms, 24 px plus opacity); exit is instant `display:none`; reopening mid-open restarts at opacity 0 (`probe1.json` `drawer-interrupt-*`: 0.796 → 0). On the sheet the 24 px rise is mostly a fade: the page shows through for ~100 ms (`sheet-open-375-*.png`, 50–100 ms frames). | AUDIT §4 Interruptibility ("keyframes restart from zero… must use transitions"); §8 Missed opportunities (spatial: the sheet should come from the bottom edge); emil-design-eng "Use CSS transitions over keyframes"; asymmetric enter/exit. | site-builder | FEEL | 02 (needs 01) |
| A-02 | P1 | Every hover style: buttons, icon buttons, chips, link buttons, rows, nav, wordmark, links | `src/styles/global.css:85, 185, 224`; `src/components/site/Header.astro:119, 147`; `src/components/content/content.css:35`; `src/components/content/WorkRow.astro:92, 97`; `src/components/content/ResearchCard.astro:59`; `src/pages/garden/index.astro:228` | None is gated. After a tap, `.btn` keeps `background: rgb(220,232,240)` and an accent border, and the gear keeps its sunken fill (`probe2.json` `*-btn-tap-sticky`; `touch-webkit.png`, `touch-chromium.png`, `reduced-sheet-375-*.png`). | mobile-native §1 "Hover state stuck after tap"; AUDIT §6. | site-builder | FEEL | 03 |
| A-03 | P2 | Press feedback and tap flash (all `.btn`, `.icon-btn`, `.chip`, `.link-btn`) | `src/styles/global.css:166–183, 208–222` (no `:active` anywhere in `src/`); `src/layouts/BaseLayout.astro` (no tap-highlight policy) | Tap feedback is the browser's grey/blue flash. There is no `:active` state, `touch-action` is `auto` on buttons, and button labels are selectable on long-press (WebKit `user-select: text`). | mobile-native §2, §5, §8; emil-design-eng "Buttons must feel responsive" (`scale(0.97)`, 160 ms ease-out); AUDIT §3. | site-builder | FEEL | 04 (needs 01, 03) |
| A-04 | P2 | Theme toggle | `src/components/site/theme.ts:17–25`; transitions at `global.css:180–182, 219–221`, `garden/index.astro:223–225` | 15 `CSSTransition`s (background/border colours, 120 ms) start on the toggle while the page snaps. Frame 0 shows light buttons on a dark page (`theme-flip-1280.png`). | AUDIT §1 (no purpose: a theme switch is a state change, not something to watch); §7 cohesion (part of the page lags). | site-builder | FEEL | 05 |
| A-05 | P2 | Settings selects (Pacing, View, Palette, Color by) | `src/components/site/SelectRow.astro:47` | Computed 14 px on touch devices in both engines (`probe2.json` `*-zoom-/`). iOS Safari zooms on focus and doesn't zoom back out. | mobile-native §4 (16 px minimum; never `maximum-scale`). | site-builder | **LOOK** (control text 14 → 16 px on coarse pointers only) → Andrew | 08 |
| A-06 | P2 | Hero toolbar "Animation" select, Settings seed input, explorer Speed/Pacing selects | `src/components/hero/Hero.astro:187, 204–211`; `src/components/hero/HeroSettings.astro:220`; `src/components/explorer/Explorer.astro:640` | All 14 px (`probe2.json`): `select#hero-mode`, `input#hero-seed[number]`, `select#ex-speed`, `select#ex-pacing`. | mobile-native §4. | viz-builder | **LOOK** (same as A-05) → Andrew | 09 |
| A-07 | P2 | Modal sheet backdrop | `src/components/site/SettingsPanel.astro:101–114`; `--color-scrim` defined at `src/styles/tokens.css:24, 96, 120` but never used | The sheet is modal (inert page, tap outside closes it), but nothing dims the page, so the page looks live while it can't be used. In dark mode the sheet edge barely separates from the page (`sheet-open-375-dark.png`). A tap on the un-dimmed page closes the sheet, which reads as an accidental dismiss. | AUDIT §8 (state change with no visual explanation); mobile-native "bottom sheet". Behaviour reference: Radix/Vaul overlay (behaviour only). | site-builder | **LOOK** (adds a dim layer using the existing token) → Andrew | 10 |
| A-08 | P3 | Motion tokens | `src/styles/tokens.css:75–78` | One curve (`--ease`, a mild ease-out). Plans 02 and 04 need a strong ease-out and a drawer curve. Nothing on the site moves on screen, so no ease-in-out is needed. | AUDIT §2 (custom strong curves as tokens), §7 (tokens, not hand-typed curves). | site-builder | FEEL | 01 |
| A-09 | P3 | Reduced-motion reset | `src/styles/global.css:242–251` | `transition-duration: 0.01ms !important` on `*` turns the initial `transition-property: all` into live 0.01 ms transitions on every property change. Opening Settings under reduce creates border-radius/outline/opacity transitions on the title (`probe1.json` `reduced-open-*`), and a theme flip creates one per element. Invisible, but it does work for nothing, and transition events fire site-wide. | AUDIT §5 (`transition: all` is always a finding, which this is in effect); remove-animations "only subtract". | site-builder | FEEL | 06 |
| A-10 | P3 | Viewport height | `src/styles/global.css:28` | `body { min-height: 100vh }`. On iOS `vh` is the large viewport, so short pages (404, About) are taller than the visible area by the toolbar height and scroll a little at load. Not reproducible in emulation (`innerHeight == min-height` in both engines). Needs a real phone. | mobile-native §3 (`svh` for page shells that shouldn't shift). | site-builder | FEEL | 07 |
| A-11 | obs | Sheet safe area | `SettingsPanel.astro:112`; `src/layouts/BaseLayout.astro:35` | `padding-bottom: env(safe-area-inset-bottom, 0)` is always 0 because the viewport meta lacks `viewport-fit=cover`. Adding `cover` changes the layout under the notch on every page (header, landscape), so it is a layout change. **No plan.** Check on a real iPhone first; if the sheet's last row sits under the home indicator, raise it with Andrew. | mobile-native §7. | (site-builder, if Andrew asks) | LOOK | — |

Severity mapping to the skill: P1 = HIGH (non-interruptible dynamic UI on the only real transition; sticky hover on every tap), P2 = MEDIUM, P3 = LOW/polish.

### Missed opportunities (additive, at most 4)

- The **sheet's spatial origin**: it should come up from the bottom edge (`translateY(100%)`) rather than fade in place. This is folded into plan 02.
- **Drag-to-dismiss on the sheet** (Vaul-style, velocity > ~0.11 px/ms dismisses): not planned. It needs a visible handle (LOOK), pointer-capture code, and changes to the F25 modal e2e. Raise with Andrew only if he wants a more app-like sheet.
- Nothing else found. The site's personality (a quiet academic portfolio) argues against adding motion elsewhere.

## Don't animate / remove

Checked and **correct as instant**. Keep them that way; plans 11 and 12 add guard tests.

| Surface | Why it stays instant | Branch (remove-animations gate) |
|---|---|---|
| Garden filter chips → rows show/hide (`garden-client.ts:42–64`) | Used many times per visit; functional list | High-frequency + functional data |
| Explorer readouts during **play** (`controller.ts:1115` throttles them to one update per 150 ms) and **scrub** (one update per `input` event), and the slider `<output>`s (level, min persistence, top bars) | Values the user is reading while they change continuously | Functional data, continuous |
| Explorer hover/elevation readout `[data-ex-hover]`, place labels, lakes-table values on the m/ft toggle | Pointer-rate updates; the unit toggle converts the same quantity, so animating digits would fake a change | Functional data |
| Hero readout `[data-hero-readout]` (about 5 text changes/s while playing, `probe2.json`) | Per-frame-derived text | Functional data |
| Hero/explorer Play⇄Pause label swap | Width is already stable (hero 72 px, explorer 80 px in both states), so there is nothing to smooth | — |
| Mobile nav focus scroll (`Header.astro:70–81`, instant `scrollLeft`) | Keyboard-initiated | Keyboard |
| Hero first frame (F19b), hero reduced-motion static frame at 45 % (F26, verified: `reduced-hero-state: "paused"`) | Settled decisions | — |

**Considered and kept:**

- `scroll-behavior: smooth` (`global.css:20–24`). A nav jump to Open science at 1280 takes ~950 ms (`smooth-scroll-nav-open-science`), which is long. But the home page is one long document where the scroll explains where you went. It's occasional, already off under reduced motion (e2e `shell.spec.ts:801`), and `focus-restore.ts:90–98` is tuned to it. Removing it would trade orientation for speed on a marketing-style page, which the skills allow. Keep.
- The 120 ms colour transitions on `.btn`, `.icon-btn` and `.chip` hover. They're colour only and short, within the remove-animations "Reduced" row already. Keep, but gate them (A-02).
- Lake-table button → smooth `scrollIntoView` to the map (`explorer-client.ts:325–330`). It's occasional, explains the jump, and honours reduced motion. Keep.

## Verdicts on Control's 7 known starting points

1. **Confirmed.** The enter is a keyframe at `SettingsPanel.astro:58/111/116–128` and close is instant (`drawer-close-*`: no animations, `display:none` on the same frame; `tablet-768-drawer-open-close.png`). Reopening mid-open restarts from opacity 0. The sheet also double-exposes the page while fading. → A-01, plan 02.
2. **Confirmed.** All ten cited `:hover` rules are ungated (plus `Header.astro:119` and `:147`). Sticky hover reproduced on `.btn` and `.icon-btn` in Chromium and WebKit touch emulation. Emulation is intermittent (WebKit stuck in one run, Chromium in another), so confirm on a real phone. → A-02, plan 03.
3. **Confirmed, with a correction and wider scope.** `SelectRow.astro:47` (the `<select>`) is the culprit. `SelectRow.astro:37` and `SliderRow.astro:66` are row-label containers: range inputs don't trigger iOS zoom and compute at 17 px anyway, so those two lines are **rejected**. Extra offenders on the viz side: the hero toolbar select, the seed `<input type=number>` and both explorer selects. → A-05 (site, plan 08) and A-06 (viz, plan 09). Both change the look (Andrew).
4. **Confirmed, low impact.** Not reproducible in emulation; affects only short pages on iOS. → A-10, plan 07 (P3).
5. **Split.** Tap highlight: **confirmed** (default flash in both engines) → A-03, plan 04, which must ship with `:active` feedback. `theme-color`: **confirmed absent but rejected as a fix.** Safari already tints its chrome from the page background, and a static `theme-color` per OS scheme would contradict the manual theme toggle unless JS rewrites it. It's a colour change of browser chrome (LOOK). Leave it unless Andrew asks.
6. **Partially confirmed.** One curve is enough for the colour hovers. The drawer and press feedback need a strong ease-out and a drawer curve. Nothing on the site moves on screen, so there is **no** ease-in-out token. Don't change `--ease`. → A-08, plan 01.
7. **Mostly rejected as a NumberFlow case.** The readouts do jump, but almost every change is continuous (see the recommendation below). Only bar/table lake selection and keyboard jumps are discrete.

## NumberFlow (F28d) recommendation

**Recommendation: don't do F28d. Report it as "not worth it".** If Control still wants a trial, keep it this narrow:

- **What changes in discrete steps** (measured in `probe2.json`):
  - Selecting a lake from a bar or the lakes table: one update to all four `<dd>`s, e.g. level 1,595.5 m → 3,697.8 m, percentile 44.5 → 100.0, lakes 14 → 1, area 45.2 % → 100.0 %.
  - Explorer keyboard jumps (Home/End and similar): the same path.
  These are the **only** candidates, and only `[data-ro-lakes]`, `[data-ro-pct]`, `[data-ro-area]` and `[data-ro-level]` (`Explorer.astro:133–152`), and only on those events.
- **Must NOT use it:**
  - The same four `<dd>`s during play (they update every 150 ms, `controller.ts:1115`) and during scrub (every `input` event).
  - `[data-ex-level-out]`: 30 updates for 30 scrub inputs.
  - `[data-ex-minp-out]` and `[data-ex-topn-out]`: slider drags, one update per input event.
  - `[data-ro-level-alt]` and any value on the m/ft units toggle: same quantity, different unit, so animating it would show a change that didn't happen.
  - `[data-ex-hover]`, the hero readout (about 5 changes/s), and the lakes table.
- **Why "not worth it":** the discrete moments are rare (a lake selection) and already explained by the map and barcode jumping with them. The same elements are written by the play/scrub path, so the builder would need two write paths per readout. The cost is ~5.2 KB gzip, a `style-src` hash and a `role="img"` change on four readouts that today are plain text inside a `<dl>`, which is a VoiceOver regression risk. Readout jitter is already solved by `font-variant-numeric: tabular-nums` (`Explorer.astro:557`).

## Plans

| # | File | P | Owner | Look? | Depends on |
|---|---|---|---|---|---|
| 01 | `plans/01-motion-tokens.md` | P3 | site | FEEL | — |
| 02 | `plans/02-settings-interruptible-transitions.md` | P1 | site | FEEL | 01 |
| 03 | `plans/03-gate-hover-for-touch.md` | P1 | site | FEEL | — |
| 04 | `plans/04-press-feedback-and-tap-highlight.md` | P2 | site | FEEL | 01, 03 |
| 05 | `plans/05-theme-switch-without-transitions.md` | P2 | site | FEEL | — |
| 06 | `plans/06-reduced-motion-reset-no-transitions.md` | P3 | site | FEEL | after 02 |
| 07 | `plans/07-body-min-height-svh.md` | P3 | site | FEEL | — |
| 08 | `plans/08-settings-select-16px-touch.md` | P2 | site | **LOOK → Andrew** | — |
| 09 | `plans/09-viz-inputs-16px-touch.md` | P2 | viz | **LOOK → Andrew** | — |
| 10 | `plans/10-sheet-scrim.md` | P2 | site | **LOOK → Andrew** | 01, 02 |
| 11 | `plans/11-dont-animate-site-guards.md` | P3 | site | FEEL (tests only) | — |
| 12 | `plans/12-dont-animate-viz-guards.md` | P3 | viz | FEEL (tests only) | — |

Suggested F28b order: 01 → 03 → 02 → 04 → 05 → 06 → 07 → 11, then 08 and 10 if Andrew approves. F28c: 12, then 09 if Andrew approves. `plans/README.md` has the same table.

## Evidence index (`docs/checks/F28a/evidence/`; PNGs are gitignored)

| File | What it shows |
|---|---|
| `drawer-open-1280-light.png`, `drawer-open-1280-dark.png` | Drawer enter at 0/50/100/200/300 ms (animations paused and seeked). A 24 px slide plus fade; the art shows through at 50–100 ms. |
| `sheet-open-375-light.png`, `sheet-open-375-dark.png` | Sheet enter at 375 px with touch: mostly a fade, the page double-exposes through the sheet, no scrim, and the dark edge is weak. |
| `tablet-768-drawer-open-close.png` | 768 px light/dark: drawer open, then the very next frame after close (gone instantly, no exit). |
| `theme-flip-1280.png` | Theme toggle at 0/40/80/120 ms: buttons still light at 0 ms on a dark page. |
| `touch-chromium.png`, `touch-webkit.png` | After tapping New terrain: sticky hover fill (WebKit run). After tapping the gear: sticky gear fill, no scrim, no focus ring on the sheet title (correct). |
| `reduced-sheet-375-chromium.png`, `reduced-sheet-375-webkit.png` | Reduced motion: the sheet is in place with no movement, the hero is held at 45 %, and the gear fill is sticky. |
| `probe1.json` … `probe4.json` | Raw numbers quoted above (animations list, interruption samples, font sizes, media queries, readout mutation counts, widths). |
| `probe5.json` | Sanity run of the plans' test snippets against today's build. Plan 03's stylesheet scan finds the 7 ungated rule groups served on `/`; the plan 11 Garden guard passes (9 → 1 rows, 0 animations); the plan 12 explorer guard passes (6 readouts changed synchronously, 0 animations, no custom elements); plan 07's check fails as expected. |

Tools: `docs/checks/tools/f28a-run.sh` (starts preview on 4321, runs one probe, always kills the server), `f28a-lib.mjs`, `f28a-probe1.mjs` (drawer/sheet/theme/reduced/smooth scroll), `f28a-probe2.mjs` (touch, input zoom, WebKit, explorer cadence), `f28a-probe3.mjs` (768, close frame, reduced first frame), `f28a-probe4.mjs` (reduced-motion sheet, both engines), `f28a-probe5.mjs` (sanity run of plan tests).

**Limits:** sticky hover, tap delay, the toolbar's effect on `vh`, safe areas and input zoom are real-hardware behaviours. Emulation shows the cause (computed styles, ungated rules) and sometimes the symptom, but each plan's feel check asks for a real iPhone. Desktop Safari 27.2 was not driven; the WebKit engine checks above stand in for it.
