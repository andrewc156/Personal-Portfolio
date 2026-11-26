# 05 — Switch themes without running colour transitions

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: MEDIUM (P2)
- **Category**: Purpose & frequency; Cohesion
- **Owner**: site-builder
- **Look or feel**: FEEL. Both themes look exactly as now; the switch just becomes one clean frame.
- **Estimated scope**: 2 files (`src/components/site/theme.ts`, `src/styles/global.css`), about 15 lines; 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

The theme toggle flips `data-theme` on `<html>`. Most of the page snaps to the new colours, but every element with a colour `transition` (`.btn`, `.icon-btn`, `.chip`, at `global.css:180–182`, `219–221` and `garden/index.astro:223–225`) animates for 120 ms. On the production build one click starts **15 `CSSTransition`s** (background and four border colours on each `.btn`; F28a `probe1.json` `theme-flip-anims`). Frame 0 shows the Settings, Pause and New terrain buttons still light on an already-dark page (`theme-flip-1280.png`).

A theme switch is a state change the user wants done, not something to watch. Only part of the page lagging reads as a glitch.

```ts
// src/components/site/theme.ts:17–25 — current
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* not persisted when storage is unavailable */
  }
  sync();
}
```

```ts
// src/components/site/theme.ts:34–42 — current
export function initThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    // Rendered disabled so it is no dead tab stop without JavaScript (QA-16).
    btn.disabled = false;
    btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  });
  media().addEventListener('change', sync);
  sync();
}
```

## Target

Suspend transitions for the frame in which the theme changes.

```css
/* src/styles/global.css — new, just before the final reduced-motion block */
/* F28: a theme switch lands in one frame; nothing cross-fades on its own schedule. */
:root[data-theme-switching] *,
:root[data-theme-switching] *::before,
:root[data-theme-switching] *::after {
  transition: none !important;
}
```

```ts
// src/components/site/theme.ts — target
/** Apply a colour change with transitions suspended for that frame (F28). */
function withoutTransitions(change: () => void): void {
  const root = document.documentElement;
  root.setAttribute('data-theme-switching', '');
  change();
  // Commit the new colours with transitions off, then restore them two frames later.
  void getComputedStyle(root).backgroundColor;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.removeAttribute('data-theme-switching')),
  );
}

export function setTheme(theme: Theme): void {
  withoutTransitions(() => {
    document.documentElement.dataset.theme = theme;
  });
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* not persisted when storage is unavailable */
  }
  sync();
}

export function initThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    // Rendered disabled so it is no dead tab stop without JavaScript (QA-16).
    btn.disabled = false;
    btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
  });
  // An OS theme change (when following the OS) also lands in one frame.
  media().addEventListener('change', () => withoutTransitions(sync));
  sync();
}
```

The inline no-flash bootstrap in `BaseLayout.astro:36–44` is unchanged.

## Repo conventions to follow

- `<html>` state attributes are the pattern already: `data-theme`, `data-settings-open`, `data-settings-modal`.
- CSP: `element.setAttribute`/CSSOM only; no inline styles. (`!important` in a stylesheet is fine.)

## Steps

1. Add the CSS block to `global.css` immediately above `@media (prefers-reduced-motion: reduce)` at line 242.
2. In `theme.ts`, add `withoutTransitions`, use it in `setTheme`, and wrap the media `change` listener as shown.
3. Add the test.

## Boundaries

- Do NOT change any colour token or the bootstrap script.
- Do NOT remove the hover colour transitions themselves.
- If the code differs from the excerpts, STOP and report.

## Reduced motion

Already instant. This plan adds nothing there.

## Tests (`e2e/shell.spec.ts`, describe `theme`)

```ts
test('switching theme starts no transitions (F28)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const toggle = page.locator('[data-theme-toggle]');
  await expect(toggle).toBeEnabled();
  const n = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!.click();
    return document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length;
  });
  expect(n).toBe(0);
  // Transitions come back afterwards (hover colour fades still work).
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-theme-switching'))).toBe(false);
});
```

The existing theme tests (persist, no-flash, bootstrap order) must still pass.

## Risk

Very low. The attribute lives for two frames. If a user hovers a button inside those two frames, that one hover snaps instead of fading.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; shell e2e.
- **Feel check**: toggle the theme repeatedly on the home page at 1280 and at 375. The whole page, including the toolbar and hero buttons, changes in one frame. In DevTools ▸ Animations, nothing is recorded on toggle.
- **Done when**: the test passes.
