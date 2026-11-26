# 09 — Hero and explorer fields at 16 px on touch devices (stops iOS focus zoom) — NEEDS ANDREW

- **Status**: TODO, blocked on Andrew (it changes the look: control text size on touch devices)
- **Commit**: 1b8f6aa
- **Severity**: MEDIUM (P2)
- **Category**: Touch (mobile-native §4)
- **Owner**: viz-builder (UI CSS only; no canvas, render or engine change)
- **Look or feel**: **LOOK**. On coarse pointers only, the hero "Animation" select, the Settings seed field and the explorer Speed/Pacing selects grow from 14 px to 16 px. Desktop is unchanged.
- **Estimated scope**: 3 files, +5 lines each; 2 tests
- **Accept/Reject (Control, after Andrew)**: ____

## Problem

iOS Safari zooms the page when a field under 16 px gets focus and leaves it zoomed. These fields compute to **14 px** on phones in Chromium and WebKit (F28a `probe2.json`): `select#hero-mode`, `input#hero-seed[type=number]`, `select#ex-speed` and `select#ex-pacing`.

```css
/* src/components/hero/Hero.astro:181–189 — current: the select inherits 14px from the toolbar */
  .hero__toolbar {
    display: grid;
    grid-template-columns: max-content minmax(0, 12rem) max-content;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-size: var(--fs-small);
    color: var(--color-text-muted);
  }
/* src/components/hero/Hero.astro:204–211 — current */
  .hero__toolbar select {
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-control);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
  }
```

```css
/* src/components/hero/HeroSettings.astro:211–221 — current */
  .number-row input {
    width: 9rem;
    min-height: 2.25rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-control);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: var(--fs-small);
  }
```

```css
/* src/components/explorer/Explorer.astro:634–641 — current */
  .ex-controls select {
    min-height: 2.25rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-control);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    font-size: var(--fs-small);
  }
```

The rubric forbids `maximum-scale=1` / `user-scalable=no` (mobile-native Hard Rule 4).

## Target

Add, right after each rule above:

```css
/* src/components/hero/Hero.astro — target */
  /* F28: iOS zooms into fields under 16px on focus; touch devices get 16px. */
  @media (pointer: coarse) {
    .hero__toolbar select {
      font-size: 1rem;
    }
  }
```

```css
/* src/components/hero/HeroSettings.astro — target */
  @media (pointer: coarse) {
    .number-row input {
      font-size: 1rem;
    }
  }
```

```css
/* src/components/explorer/Explorer.astro — target */
  @media (pointer: coarse) {
    .ex-controls select {
      font-size: 1rem;
    }
  }
```

## Repo conventions to follow

Scoped component `<style>`; capability media queries. Exemplar of a pure-CSS, no-shift responsive fix in the same file: `Hero.astro:191–202` (the QA-13 narrow-screen toolbar layout).

## Steps

1. `Hero.astro`: add the media block after `.hero__toolbar select`.
2. `HeroSettings.astro`: add it after `.number-row input`.
3. `Explorer.astro`: add it after `.ex-controls select`.
4. Add the tests.

## Boundaries

- UI CSS only: no change to `src/lib/viz/**`, the canvases, the render code or the frame loop.
- Do NOT change `SelectRow.astro` (site-builder; plan 08).
- Do NOT change the toolbar grid columns or the QA-13 narrow layout.

## Reduced motion

N/A.

## Tests

`e2e/hero.spec.ts`, describe `controls`:

```ts
test('touch: hero fields are at least 16px (no iOS focus zoom) (F28)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  for (const sel of ['#hero-mode', '#hero-seed']) {
    const px = await page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px, sel).toBeGreaterThanOrEqual(16);
  }
  await ctx.close();
});
```

`e2e/explorer.spec.ts`, describe `explorer: F27 focus, touch, keyboard and no-JS`:

```ts
test('touch: explorer selects are at least 16px (no iOS focus zoom) (F28)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/rising-water/');
  for (const sel of ['#ex-speed', '#ex-pacing']) {
    const px = await page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px, sel).toBeGreaterThanOrEqual(16);
  }
  await ctx.close();
});
```

## Risk

- **QA-13:** at 16 px the closed hero select must still show the longest mode name at 375 and 390 px, and at the <350 px layout. Re-run the existing QA-13 test in `e2e/hero.spec.ts`, and take a 320/375/390 screenshot of the toolbar.
- The explorer Speed and Pacing selects sit in `.ex-inline` rows. Check that "Linear (metres)" still fits without wrapping at 375.
- Hero p95 frame time: CSS on form controls only, no effect expected. The hosted-CI gate still applies.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; hero and explorer e2e (checker).
- **Feel check (real iPhone, Safari)**: tap the Animation select, the Seed field (Settings), Speed and Pacing. The page never zooms. Desktop at 1280 is unchanged.
- **Done when**: both tests pass, QA-13 still passes, and Andrew has approved (DECISIONS #90).
