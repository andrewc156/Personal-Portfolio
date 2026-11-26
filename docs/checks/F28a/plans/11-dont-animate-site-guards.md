# 11 — Guard tests: Garden filtering and shell navigation stay instant

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: LOW (P3), a "don't animate" plan
- **Category**: Purpose & frequency (remove-animations gate: high-frequency / functional data / keyboard)
- **Owner**: site-builder
- **Look or feel**: FEEL (tests only; no source change)
- **Estimated scope**: 1 test file (`e2e/site.spec.ts`), 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem (none today; this protects it)

The F28a audit found these correct as **instant**. F28b must not "polish" them with motion:

- **Garden filter chips → rows**: `src/components/content/garden-client.ts:42–64` sets `row.hidden` / `li.hidden` and the empty state directly. A visitor filters several times per visit, and the rows are functional data. Animating the list (fade, height, FLIP) would only delay reading. Gate branch: high-frequency + functional data → no animation.
- **Garden chip state**: the `aria-current` swap is a colour change only (`src/pages/garden/index.astro:248–252`), and the hover colour has its 120 ms transition. Keep it as it is: no scale, no slide of an "active pill".
- **Mobile nav focus scroll** (`src/components/site/Header.astro:70–81`): an instant `scrollLeft` on keyboard focus. Gate branch: keyboard-initiated → never animate.

## Target

No source change. Add a guard test so a future change that adds motion here fails CI.

## Steps

1. Add the test below to `e2e/site.spec.ts` inside `test.describe('garden', …)`.

## Boundaries

Tests only. Don't edit `garden-client.ts`, `garden/index.astro` or `Header.astro` in this plan.

## Reduced motion

N/A (instant in both modes).

## Tests (`e2e/site.spec.ts`, describe `garden`)

```ts
test('filtering is instant: rows change in the same task, nothing animates (F28)', async ({ page }) => {
  await page.goto('/garden/');
  const r = await page.evaluate(() => {
    const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.garden-list > li')).filter((li) => !li.hidden).length;
    const before = rows();
    const chip = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.chip')).find(
      (c) => c.getAttribute('aria-current') !== 'true' && !/all/i.test(c.textContent ?? ''),
    )!;
    chip.click();
    const after = rows(); // same task: no waiting for an animation
    const list = document.querySelector('.garden-list')!;
    const anims = list.getAnimations({ subtree: true }).length;
    return { before, after, anims };
  });
  expect(r.after).not.toBe(r.before);
  expect(r.anims).toBe(0);
});
```

If the selectors don't match the current Garden markup (`.garden-list > li`, `a.chip`), adapt them to the real ones, and say so in the report. Keep the two assertions.

## Risk

None.

## Verification

- **Mechanical**: the site e2e (checker).
- **Done when**: the test passes on the F28b branch.
