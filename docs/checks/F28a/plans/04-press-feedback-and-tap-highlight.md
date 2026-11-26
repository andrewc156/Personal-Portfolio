# 04 — Native press feedback: no tap flash, `:active` scale on buttons and chips

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: MEDIUM (P2)
- **Category**: Physicality (press feedback) and touch (mobile-native §2, §5, §8)
- **Owner**: site-builder
- **Look or feel**: FEEL. Only the pressed state changes: a 3 % scale while a finger or mouse button is down, and existing hover colours reused for pressed link rows.
- **Depends on**: plan 01 (`--ease-out`, `--dur-press`), plan 03 (hover gated; otherwise touch users still get the sticky hover on top)
- **Estimated scope**: 3 files (`src/styles/global.css`, `src/pages/garden/index.astro`, `src/components/content/content.css`, plus one rule in `src/components/content/WorkRow.astro`); 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

- There is **no `:active` style anywhere in `src/`** (`grep -rn ":active" src` is empty). The only tap feedback on a phone is the browser's tap-highlight flash: computed `-webkit-tap-highlight-color` is `rgba(51,181,229,0.4)` in Chromium and `rgba(0,0,0,0.4)` in WebKit (F28a `probe2.json` `*-meta`).
- `touch-action` on `.btn` is `auto`, and WebKit reports `user-select: text` on `.btn`, so a long-press selects the label.

```css
/* src/styles/global.css:15 — current */
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

```css
/* src/styles/global.css:166–183 — current (excerpt) */
.btn {
  display: inline-flex;
  …
  cursor: pointer;
  transition:
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}
```

```css
/* src/styles/global.css:208–222 — current (excerpt) */
.icon-btn {
  …
  cursor: pointer;
  transition:
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}
```

```css
/* src/pages/garden/index.astro:212–226 — current (excerpt) */
  .chip {
    display: inline-flex;
    …
    text-decoration: none;
    transition:
      background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease);
  }
```

## Target

```css
/* src/styles/global.css — html rule, target */
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  /* F28: no grey/blue tap flash; controls give their own :active feedback. */
  -webkit-tap-highlight-color: transparent;
}
```

```css
/* src/styles/global.css — .btn and .icon-btn, target: add to each base rule */
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  transition:
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    transform var(--dur-press) var(--ease-out);
```

```css
/* src/styles/global.css — new, directly after the .icon-btn hover block */
/* F28: press feedback. Scale only when motion is welcome. */
@media (prefers-reduced-motion: no-preference) {
  .btn:active:not(:disabled),
  .icon-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
}
```

```css
/* src/pages/garden/index.astro — .chip, target: add to the base rule */
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
    transition:
      background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease),
      transform var(--dur-press) var(--ease-out);
```

```css
/* src/pages/garden/index.astro — new, after the .chip rules */
  @media (prefers-reduced-motion: no-preference) {
    .chip:active {
      transform: scale(0.97);
    }
  }
```

Link-shaped controls get pressed colours, not motion, reusing their existing hover colours:

```css
/* src/components/content/content.css — new, after .link-btn */
.link-btn {
  touch-action: manipulation;
}

.link-btn:active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
```

```css
/* src/components/content/WorkRow.astro — new, after the hover block */
  a.work-row__inner:active {
    background: var(--color-surface-sunken);
  }
```

Values come from the rubric: `scale(0.97)`, `160ms`, `cubic-bezier(0.23, 1, 0.32, 1)`.

## Repo conventions to follow

- Tokens from `src/styles/tokens.css` (plan 01): `--dur-press`, `--ease-out`.
- Reduced-motion gating with a media query, as in `global.css:20–24` (`@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }`).

## Steps

1. `global.css` html rule: add `-webkit-tap-highlight-color: transparent;`.
2. `.btn` and `.icon-btn`: add `touch-action`, both `user-select` lines and the `transform` transition.
3. `global.css`: add the reduced-motion-gated `:active` block.
4. `garden/index.astro`: same for `.chip`.
5. `content.css`: add the `.link-btn` touch-action and `:active` colours.
6. `WorkRow.astro`: add the `:active` background.
7. Add the test.

## Boundaries

- Do NOT gate `:active` behind `(hover: hover)`: press feedback is for every input type.
- Do NOT scale links, rows or cards; only `.btn`, `.icon-btn` and `.chip`.
- Do NOT put `user-select: none` on anything that is content (rows, cards, body).
- Do NOT touch hero or explorer files; their buttons use the global `.btn`.
- If an excerpt doesn't match, STOP and report.

## Reduced motion

No scale (the `:active` transform only exists under `no-preference`). The pressed colours on `.link-btn` and work rows remain; they're colour, not movement.

## Tests (`e2e/shell.spec.ts`, describe `layout and accessibility`)

```ts
test('press feedback: no tap flash, buttons scale on press, not under reduced motion (F28)', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion });
    const page = await ctx.newPage();
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
    const btn = page.locator('.hero__btn[data-hero-new]');
    await expect(btn).toBeEnabled();
    const box = (await btn.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    const t = await btn.evaluate((b) => getComputedStyle(b).transform);
    await page.mouse.up();
    if (reducedMotion === 'reduce') expect(t).toBe('none');
    else expect(t).toMatch(/^matrix\(0\.97, 0, 0, 0\.97,/);
    await ctx.close();
  }
});
```

## Risk

- `transform` on an `:active` button briefly creates a stacking context. No button here has positioned children that depend on it.
- With the tap highlight gone, any custom control without `:active` gives no tap feedback. The hero and explorer canvases already react themselves, and plain text links navigate. Spot-check the lakes-table buttons and the explorer m/ft and view buttons: they are `.btn`, so they're covered.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; the checker runs shell e2e.
- **Feel check**:
  - On a real phone, press and hold Play, New terrain, the gear and a Garden chip. Each shrinks slightly the instant the finger lands and springs back on release. There's no grey/blue flash.
  - Long-press a button: its label isn't selected.
  - In DevTools at 10 % speed: the press scales 1 → 0.97 over 160 ms with a fast start.
  - Under `prefers-reduced-motion`: no scale; links and rows still show their pressed colour.
- **Done when**: the test passes and `grep -rn ":active" src` shows the new rules only.
