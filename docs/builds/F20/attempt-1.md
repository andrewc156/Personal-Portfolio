# Build report — F20 Hero Settings cog — attempt 1

Summary: Added the header’s cog to the labeled hero Settings button. The decorative icon inherits the button color and uses the existing inline-flex alignment and gap; the label, focus, and settings behavior are unchanged.

Files changed: `src/components/hero/Hero.astro`, `docs/builds/F20/attempt-1.md`.

How to verify: `node_modules/.bin/prettier --check src/components/hero/Hero.astro`, `node_modules/.bin/eslint src/components/hero/Hero.astro`, and `git diff --check -- src/components/hero/Hero.astro` (all passed).

Acceptance criteria (self-check):
- ✅ A source assertion confirmed the cog matches the Header SVG geometry and uses `currentColor`, `aria-hidden="true"`, and `focusable="false"`.
- ✅ A source assertion confirmed the SVG insertion is the only change in `Hero.astro`; the existing label, focusable button, panel wiring, and dependencies are unchanged.

Needs Andrew: None. Requests to Control: None. Known limitations: No browser, production build, preview, or e2e checks run.
