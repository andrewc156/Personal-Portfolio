# 06 — Reduced motion: turn transitions off instead of shrinking them to 0.01 ms

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: LOW (P3)
- **Category**: Performance / Accessibility
- **Owner**: site-builder
- **Look or feel**: FEEL (invisible; removes needless work)
- **Depends on**: apply after plan 02, so the drawer's discrete `display` transition is also covered
- **Estimated scope**: 1 file, 1 line; 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

```css
/* src/styles/global.css:242–251 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`transition-property` defaults to `all`, so forcing a non-zero `transition-duration` on every element turns *every* property change into a live 0.01 ms transition. Under reduced motion, opening Settings starts transitions on the focused title's `border-radius`, four `outline-*` properties and `opacity` (F28a `probe1.json`, `reduced-open-1280` / `reduced-open-375`). A theme flip under reduced motion starts one per changed property per element. It's invisible but it's work for nothing: thousands of animation objects and `transitionrun`/`transitionend` events on a theme flip. In effect it's a site-wide `transition: all`.

Nothing in `src/` listens for `transitionend` or `animationend` (`grep -rn "transitionend\|animationend" src` is empty). The e2e helpers wait on `getAnimations()`, which an empty list satisfies.

## Target

```css
/* src/styles/global.css — target */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

The keyframe lines stay as they are (they keep any end state that a keyframe defines).

## Repo conventions to follow

The reduced-motion reset stays the last block in `global.css`. `tokens.css:129–134` keeps zeroing the duration tokens.

## Steps

1. Replace `transition-duration: 0.01ms !important;` with `transition: none !important;`.
2. Add the test.

## Boundaries

- Do NOT remove the block or change the animation lines.
- Do NOT touch hero or explorer files.

## Reduced motion

This *is* the reduced-motion behaviour: nothing transitions, nothing moves. The repo rule "at most a short opacity change" is satisfied with zero.

## Tests (`e2e/shell.spec.ts`, describe `layout and accessibility`, next to `respects prefers-reduced-motion`)

```ts
test('reduced motion: opening Settings and switching theme start no transitions (F28)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
  const n = await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!.click();
    document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!.click();
    return document.getAnimations().filter((a) => a.constructor.name === 'CSSTransition').length;
  });
  expect(n).toBe(0);
  await ctx.close();
});
```

## Risk

Very low. Any future code that waits for `transitionend` would hang under reduced motion; the comment above the block should say so:
`/* No transitions at all under reduced motion: never wait for transitionend. */`

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; shell, hero and explorer e2e (they emulate reduced motion in several places).
- **Feel check**: with `prefers-reduced-motion` on, open/close Settings, toggle the theme, hover buttons. Everything is instant and nothing moves. In DevTools ▸ Animations, nothing is recorded.
- **Done when**: the test passes.
