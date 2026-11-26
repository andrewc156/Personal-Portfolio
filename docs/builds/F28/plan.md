# F28 — Natural UI pass (plan)

**Owner:** Control. **Decision:** DECISIONS #89. **State:** set up, nothing dispatched yet.

## Goal

Make the site feel more natural: transitions with clear purpose that can be interrupted, correct easing and durations, nothing that animates without reason, and touch behaviour that feels native on phones. The design system stays as it is: colours, fonts, accent, layout and copy don't change (DECISIONS #85).

## What we use (from the 2026-11-26 library review)

| Tool | Role in F28 |
|---|---|
| Emil Kowalski's skills, vendored at `docs/design-skills/emil-kowalski/` | The rubric for the audit (F28a), the builders (F28b/c) and the checker. Read its README first: the repo rules override the skills. |
| NumberFlow (`number-flow@0.6.2`, the framework-free web component) | F28d only, and only if F28a finds discrete numeric readouts that benefit. Measured at about 5.2 KB gzip, with `esm-env` as its only dependency. |
| Radix / Base UI / Vaul docs | Behaviour reference only, for the Settings sheet's accessibility and drag feel. No code or dependency. |
| shadcn/ui, Sonner, cmdk, Magic UI, Aceternity, RareUI, 21st.dev, Beautiful UI | Not used. They need React and Tailwind (spec §7 says no UI framework), or they don't fit the site. |

## Known starting points

Found by Control during setup. F28a has to confirm or reject each one; none of them is a finding yet.

1. The Settings drawer and sheet animate in only (`SettingsPanel.astro:58, 111, 116–128`). Close is an instant `display: none`, and keyframes can't be interrupted mid-open.
2. Hover styles aren't gated by `@media (hover: hover)` (`global.css:85, 185, 224`; `WorkRow.astro:92–97`; `ResearchCard.astro:59`; `content.css:35`). Hover can stick after a tap on touch devices.
3. Settings selects and sliders use `--fs-small` (14 px) (`SelectRow.astro:37, 47`; `SliderRow.astro:66`), which makes iOS Safari zoom when a control gets focus.
4. `body { min-height: 100vh }` (`global.css:28`) has no `svh` or `dvh` fallback.
5. There's no `-webkit-tap-highlight-color` policy and no `theme-color` meta (`BaseLayout.astro`).
6. There's only one easing token, `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`, plus 120 ms and 220 ms durations (`tokens.css:76–78`). Enter, exit and on-screen moves may need different curves.
7. Explorer readouts (`Explorer.astro:212–252` `<output>`s; `explorer-client.ts:257`) jump between values. These are the NumberFlow candidates.

## Phases

| Step | Who | Writes only | Output |
|---|---|---|---|
| F28-0 Setup | Control | `docs/design-skills/**`, `docs/builds/F28/plan.md`, DECISIONS, STATUS, HANDOFF | This plan (done) |
| F28a Motion and feel audit | **checker** role, read-only | `docs/checks/F28a/**` | `audit.md` with prioritized findings, plus one self-contained plan per fix in `docs/checks/F28a/plans/NN-<slug>.md`, each tagged with its owner (site-builder or viz-builder) |
| Triage | Control | DECISIONS #90, plans' Accept/Reject line | The accepted plan list. Anything that changes the look rather than the feel goes to "Needs Andrew". |
| F28b Shell and content feel | site-builder | see "Ownership" | Accepted site plans |
| F28c Hero and explorer UI feel | viz-builder (runs in parallel with F28b) | see "Ownership" | Accepted viz plans (non-canvas UI only) |
| F28d NumberFlow readouts (optional) | viz-builder, after F28c | F28c paths + Control's dependency and CSP changes | Animated discrete readouts, or a "not worth it" report |
| F28 check | **fresh** checker (not the F28a one) | `docs/checks/F28b/`, `F28c/`, `F28d/` | One report per feature, using `review-animations/STANDARDS.md` plus the standard gates |
| Commit | Control | — | One `[checked]` commit per feature on an isolated candidate branch → hosted CI → fast-forward main → push. A separate docs commit. |

### F28a brief (checker role, read-only audit)

- Read CLAUDE.md, `.claude/agents/checker.md`, spec §4 and §7, DECISIONS #85, #87, #88 and #89, `docs/design-skills/emil-kowalski/README.md`, then these skills in order: `improve-animations` (with AUDIT.md and PLAN-TEMPLATE.md), `mobile-native`, `remove-animations`, `emil-design-eng`.
- Survey every motion and interaction surface: header and mobile nav, theme toggle, the Settings drawer (wide) and sheet (narrow, modal since F25), Garden filter chips and rows, research cards, focus rings, smooth scrolling and anchor jumps, the hero toolbar, play/pause/scrub, the explorer controls, slider outputs, the lakes table, the tooltip and readout, and the 404 page.
- Evidence: a production build on port 4321 (one gate at a time; leave nothing listening). Check at 375 and 390 with touch emulation (`hasTouch`, `isMobile`), and at 768 and 1280. Check light and dark themes, and default and reduced motion. Record a Playwright video or frame strip of every transition you judge. Look at every screenshot. Desktop Safari 27.2 is available for a real-WebKit look.
- Each plan follows PLAN-TEMPLATE.md and spells out the exact files, current code excerpt, target values (curve, duration, properties), reduced-motion behaviour, the test to add or update, and the risk. Include "don't animate" plans too.
- Respect settled decisions: the F25 modal sheet semantics, the F26 hero reduced-motion behaviour (static frame at 45%), and the F19b hero first frame. Canvas rendering, TDA maths and the frame-time gates are out of scope.
- Don't edit anything outside `docs/checks/F28a/`. There is no verdict. Start the report with the PARTIAL line and remove it when done.

### Ownership (disjoint, so F28b and F28c can run together)

- **F28b site-builder:** `src/styles/**`, `src/layouts/BaseLayout.astro`, `src/components/site/**`, `src/components/content/**`, `src/components/home/**`, `src/pages/{index,404}.astro`, `src/pages/{garden,research,cv,about}/**`, `e2e/shell.spec.ts`, `e2e/site.spec.ts`, `tests/unit/content/**`.
- **F28c and F28d viz-builder:** `src/components/hero/**`, `src/components/explorer/**`, `src/pages/rising-water/**`, `src/lib/viz/**` (UI glue only, no render or engine changes), `e2e/hero.spec.ts`, `e2e/explorer.spec.ts`, `tests/unit/viz/**`.
- **Control only:** `package.json` and the lockfile (the NumberFlow dependency), `scripts/write-headers.mjs` (CSP), `e2e/cls.spec.ts`, `e2e/headers.spec.ts`. Shared token changes that F28c needs go through F28b, or come to Control as a request.

### F28d constraints (NumberFlow)

- Use it only for values that change in discrete steps: lake counts, top-N, and minimum persistence when it's committed. Never use it on a value that updates every frame, like the water level during play or while scrubbing. Show those instantly, or animate once on release.
- CSP: NumberFlow appends a constant `<style>` to its shadow root (`lite.mjs:95–96`), and the site's `style-src` has no `'unsafe-inline'`. Control adds a build-time sha256 of that exact text to `write-headers.mjs`, and `e2e/headers.spec.ts` must show no CSP violations.
- Accessibility: the element sets `role="img"` with an aria-label through ElementInternals. Keep the `<output for=…>` association and the existing `aria-live` summaries. Run axe clean in both themes and check screen-reader text once with VoiceOver in Safari.
- Without JS the readouts keep their server-rendered text. Under reduced motion they change instantly (NumberFlow's default `respectMotionPreference`; verify it).
- Budget: page JS stays ≤ 120 KB gzip (the last local `dist` loads about 23 KB of static-import JS on /rising-water/; the checker re-measures, including dynamic chunks). Lighthouse and CLS budgets don't change.
- If any of these fails, or the effect doesn't read as better, the builder reports "not worth it" and Control drops F28d. Nothing gets forced in.

## Acceptance criteria (F28b, F28c, F28d)

1. Every accepted plan is implemented as written, or the report explains why not with evidence.
2. The enter and exit of the Settings drawer/sheet can be interrupted: reopening mid-close and closing mid-open never jump. F25 focus, inert and Esc behaviour stays as it is (the existing shell e2e tests pass).
3. With reduced motion there is no movement anywhere. At most a short opacity change is left (e2e with emulated `prefers-reduced-motion`).
4. Touch, checked with emulation and on real Safari where possible: no sticky hover after a tap, no input zoom on Settings controls, and no layout jump from the viewport height.
5. Only compositor-friendly properties are animated (transform, opacity). No layout thrash. Hero p95 frame time ≤ 22 ms on hosted CI, unchanged.
6. No new dependencies except NumberFlow in F28d. No third-party requests. The CSP keeps hashes only.
7. `npm run verify` is green, CLS stays within budget, and Lighthouse budgets are unchanged in both themes.
8. Copy, colours, fonts and layout don't change unless DECISIONS #90 records Andrew's approval.

## Next actions

1. Dispatch the F28a audit (checker role, read-only).
2. Triage the plans into DECISIONS #90, then dispatch F28b and F28c in parallel.
3. Decide on F28d from the audit. If it goes ahead, add the dependency and the CSP hash, then dispatch.
