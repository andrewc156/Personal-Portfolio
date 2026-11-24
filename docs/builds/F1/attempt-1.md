# Build report — F1 Site shell and design system — attempt 1

Summary: Built the site shell: one token file (light warm off-white and dark near-black themes, deep-water-blue accent, AA-checked), self-hosted IBM Plex via @fontsource, BaseLayout with a no-flash inline theme script, skip link, header (wordmark, §4.3 nav, theme toggle, gear only when the `settings` slot is filled), footer driven by `src/data/profile.yaml`, and a non-modal settings panel shell (right drawer ≥ 641px, bottom sheet below that). The panel comes with reusable rows (group, slider with live mono readout, select, checkbox, button row). `index.astro` composes the hero and home stubs in §4.3 order with anchors from one shared constant. There's a friendly 404 with a static inline-SVG terrain, and `e2e/shell.spec.ts` covers every acceptance item.

Files changed:
- src/styles/tokens.css (all color/type/spacing/motion tokens), src/styles/global.css (fonts, base, .btn/.icon-btn, .section, reduced motion)
- src/layouts/BaseLayout.astro
- src/components/site/: Header.astro, Footer.astro, ThemeToggle.astro, SettingsPanel.astro, SettingsGroup.astro, SliderRow.astro, SelectRow.astro, CheckboxRow.astro, ButtonRow.astro, TerrainArt.astro, nav.ts (NAV_ITEMS, SECTION_IDS), profile.ts (typed profile loader), settings.ts (panel behaviour plus exported helpers), theme.ts, shell-client.ts
- src/components/hero/Hero.astro, src/components/hero/HeroSettings.astro (stubs)
- src/components/home/{Mission,RecentWork,ResearchGrid,OpenScience,Teaching,Contact}.astro (stubs; Teaching and Contact render nothing)
- src/pages/index.astro (replaced the template), src/pages/404.astro
- src/data/profile.yaml (new)
- public/favicon.svg (replaced the Astro logo with an original mark)
- e2e/shell.spec.ts
- docs/builds/F1/attempt-1.md, docs/builds/F1/screens/*.png (18 dev-server screenshots: home, home with settings open, and 404 at 375/768/1280 in light and dark)

How to verify:
- `npm run check && npm run lint && npm test` (all exit 0 here; 0 unit tests in my area)
- `npm run build && npx playwright test e2e/shell.spec.ts` (checker only)
- `npm run lhci` (checker only; URLs `/` and `/404.html`)
- Self-check done on `npx astro dev --port 4401` with an ad-hoc Playwright script (not the e2e suite). Results: axe showed 0 violations of any impact on `/`, on `/` with settings open, and on 404, in both themes at all 3 widths. Horizontal overflow was 0 everywhere. Skip link → `#main` focused. Toggle persisted across reload. Panel state persisted. Esc returned focus to the gear. Slider readout and Reset worked. No-flash check: with `theme=dark` stored and the OS set to light, `data-theme` was already `dark` when `<body>` was inserted. No third-party requests.

Acceptance criteria (self-check):
1. ✅ Tokens live in src/styles/tokens.css only. Light is the default. Dark applies via `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` or `[data-theme='dark']`. The toggle stores `theme` in localStorage (try/catch). The inline head script applies it before the body is parsed (verified as above). Contrast: text 15.7/14.8:1, muted 6.5/7.3:1, accent 7.9/8.5:1, control outlines 3.4/4.3:1 (light/dark on bg).
2. ✅ Header has the wordmark, nav (Mission · Research · Work · Open science · Rising water · CV) and the gear (`aria-label="Art settings"`), the gear only when `Astro.slots.has('settings')`. Below 52rem (832px) the nav moves to its own wrapping row, and all 6 links are visible at 375px. The skip link is the first tab stop and focuses `main#main`. A global `:focus-visible` outline uses the accent.
3. ✅ The panel is `<aside id="settings-panel">` toggled via `hidden`. The gear has `aria-controls` and `aria-expanded`. Esc (from anywhere while open) and the close button close it and focus the gear. Opening moves focus to the panel heading. State is stored as `settings-open` = '1'/'0' (try/catch) and restored without stealing focus. Drawer is right-hand, full height, 22rem wide. Bottom sheet below 40rem, max 65dvh. Screenshots: docs/builds/F1/screens/home-1280-light-settings.png, home-375-dark-settings.png.
4. ✅ @fontsource latin subsets (Plex Sans 400/400-italic/600, Plex Mono 400) are imported in global.css and bundled by Vite. No external URLs in src. The e2e test asserts zero foreign-origin requests on `/`, `/404.html` and an unknown route.
5. ✅ index.astro composes Hero → Mission(#mission) → RecentWork(#work) → ResearchGrid(#research) → OpenScience(#open-science) → Teaching(#teaching) → Contact(#contact) and passes `<HeroSettings slot="settings" />`. Ids come from `SECTION_IDS` in nav.ts and are passed as the `id` prop, so the nav and anchors can't drift apart. Nav clicks scroll smoothly, or instantly under reduced motion. src/pages/404.astro has a message, a home link and a static `role="img"` SVG with no canvas or JS.
6. ✅ (dev) / pending checker: axe on the dev server shows 0 violations in all states. Layout is clean at 375/768/1280 in both themes (screenshots in docs/builds/F1/screens/). Lighthouse was not run (checker only).

Inline theme script (exact source between the tags, for F8's CSP hash; hash the bytes from `dist/` since Astro's HTML compression may change the surrounding whitespace):
```
      try {
        const t = localStorage.getItem('theme');
        if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
      } catch {
        /* storage blocked: follow the OS theme */
      }
```

Notes for F2/F5 (building blocks):
- Settings rows: `SettingsGroup` (fieldset + small-caps legend), `SliderRow` (id, label, min, max, step, value, decimals, unit; `<output for>` readout updates live on `input`), `SelectRow`, `CheckboxRow`, `ButtonRow` (slot for `<button class="btn">`; use `aria-pressed` for Play/Pause). From `src/components/site/settings.ts`: after setting a slider's value from code, call `syncSliderOutput(input)`. Other exports: `setSettingsOpen(open, moveFocus)`, `isSettingsOpen()` and the `settings:toggle` CustomEvent (`detail.open`), which bubbles from the panel. A `<form>` reset re-syncs the readouts.
- Home components receive `id` and must put it on their root `<section>` (Teaching and Contact render nothing when empty). Use the `.section` and `.section-title` classes for consistent rhythm.
- Profile access: `import { profile, displayName } from '../site/profile'`.

Needs Andrew:
- Display name "Andrew Chincea" (`display_name.confirmed: false`).
- Tagline and hero question are draft copy (`confirmed: false`; alternatives are already in QUESTIONS.md).
- Footer "Source" link: `site.source_url` is empty, so the link is hidden. Is github.com/andrewc156/Personal-Portfolio the repo to link?
- Footer Claude Code credit: `site.show_claude_code_credit: true` by default. Keep it?
- Email, GitHub, LinkedIn, ORCID, photo, CV PDF, graduation term, domain: left empty in profile.yaml.

Requests to Control:
1. Add `yaml` as an explicit dependency: `npm i yaml@^2.9.1`. `src/components/site/profile.ts` imports `parse` from `yaml`. It resolves today only because it's hoisted (it's a dependency of astro/vite), and that shouldn't be relied on. Alternative: F2 could move profile loading into a content collection with the `file()` loader, after which profile.ts can read from it.
2. `public/favicon.ico` is still the Astro template icon. Delete it (it's no longer linked), or Andrew can supply one. Browsers may still request `/favicon.ico`; it is same-origin.

Known limitations:
- Nav links `/rising-water/` and `/cv/` point to pages that F6 and F2 haven't built yet. linkinator will report them as broken until then.
- Astro may inline the small bundled `shell-client` module script into the HTML (assetsInlineLimit). If it does, F8's `script-src 'self'` CSP needs a hash for it too, or a config change so it stays external. Check `dist/index.html`.
- The theme toggle switches between explicit light and dark. There is no "back to system" option; clearing the stored value restores OS-following.
- The hero and HeroSettings stubs are inert (static SVG frame; Scale, Palette and Reset only update their own controls) until F5 replaces them.
- The e2e suite was written and type-checked (astro check, tsc, eslint) but not run, per the rules.
