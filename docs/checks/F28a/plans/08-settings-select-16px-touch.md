# 08 — Settings selects at 16 px on touch devices (stops iOS focus zoom) — NEEDS ANDREW

- **Status**: TODO, blocked on Andrew (it changes the look: control text size on touch devices)
- **Commit**: 1b8f6aa
- **Severity**: MEDIUM (P2)
- **Category**: Touch (mobile-native §4)
- **Owner**: site-builder
- **Look or feel**: **LOOK**. On coarse pointers only, the text inside the four Settings `<select>`s grows from 14 px to 16 px. Desktop is unchanged.
- **Estimated scope**: 1 file, +5 lines; 1 test
- **Accept/Reject (Control, after Andrew)**: ____

## Problem

iOS Safari zooms the page when focus lands on a form field whose font size is under 16 px, and it doesn't zoom back out. The Settings panel's selects (Pacing, View, Palette, Color by, all rendered by `SelectRow.astro`) compute to **14 px** on phones in both Chromium and WebKit (F28a `probe2.json` `chromium-zoom-/`, `webkit-zoom-/`).

```css
/* src/components/site/SelectRow.astro:40–49 — current */
  select {
    min-width: 9rem;
    min-height: 2.25rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-control);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    font-size: var(--fs-small);
    cursor: pointer;
  }
```

Two lines from Control's starting points were checked and **are not offenders**: `SelectRow.astro:37` (the row label) and `SliderRow.astro:66` (the slider label). Range inputs don't trigger the zoom and compute at 17 px anyway.

The rubric forbids the common "fix" of `maximum-scale=1` / `user-scalable=no` (mobile-native Hard Rule 4).

## Target

```css
/* src/components/site/SelectRow.astro — target: add after the select rule */
  /* F28: iOS zooms into fields under 16px on focus; touch devices get 16px. */
  @media (pointer: coarse) {
    select {
      font-size: 1rem;
    }
  }
```

`1rem` is 16 px at the default root size (the site doesn't change the root size).

## Repo conventions to follow

Scoped `<style>` in the component. Capability media queries (not widths) for touch, as plan 03 does with `(hover: hover) and (pointer: fine)`.

## Steps

1. Add the media block after the `select` rule in `SelectRow.astro`.
2. Add the test.

## Boundaries

- Do NOT touch the viewport meta.
- Do NOT change `--fs-small` or desktop sizes.
- Do NOT touch `HeroSettings.astro`, `Hero.astro` or `Explorer.astro` (viz-builder; that's plan 09).

## Reduced motion

N/A.

## Tests (`e2e/shell.spec.ts`, describe `settings panel`)

```ts
test('touch: Settings selects are at least 16px (no iOS focus zoom) (F28)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  const sizes = await page.$$eval('#settings-panel .select-row select', (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
  await ctx.close();
});
```

## Risk

- On a 375 px phone a 16 px select is a little wider. `min-width: 9rem` and the row's `justify-content: space-between` absorb it. Check that the longest option (in Palette or Color by) still fits without wrapping the label.
- Lighthouse and CLS are unaffected (the panel is closed at load).

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; shell e2e.
- **Feel check (real iPhone, Safari)**: open Settings, tap each select. The page must not zoom. Desktop at 1280 looks identical to before.
- **Done when**: the test passes and Andrew has approved the size change (DECISIONS #90).
