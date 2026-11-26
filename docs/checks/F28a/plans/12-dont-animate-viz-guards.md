# 12 — Guard tests: explorer and hero readouts stay plain, instant text

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: LOW (P3), a "don't animate" plan
- **Category**: Purpose & frequency (remove-animations gate: functional data)
- **Owner**: viz-builder
- **Look or feel**: FEEL (tests only; no source change)
- **Estimated scope**: 1 test file (`e2e/explorer.spec.ts`), 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem (none today; this protects it, and bounds F28d)

The F28a audit found every readout correctly **instant** (F28a `probe2.json`):

| Element | Update rate measured | Must stay instant because |
|---|---|---|
| `[data-ro-level]`, `[data-ro-level-alt]`, `[data-ro-pct]`, `[data-ro-lakes]`, `[data-ro-area]` (`src/components/explorer/Explorer.astro:133–152`) | Every 150 ms during play (`src/lib/viz/explorer/controller.ts:1115`, `READOUT_MS`); every `input` event while scrubbing | Continuous functional data |
| `[data-ex-level-out]` (`Explorer.astro:212`) | 30 writes for 30 scrub inputs | Continuous |
| `[data-ex-minp-out]`, `[data-ex-topn-out]` (`Explorer.astro:231, 250`) | One write per slider `input` (10 for 10) | Continuous (drag) |
| `[data-ex-hover]` | Pointer rate | Tooltip-rate data |
| Units toggle m/ft (`explorer-client.ts:293–308`) | One write | Same quantity, different unit: animating digits would show a change that didn't happen |
| Hero `[data-hero-readout]` | About 5 writes/s while playing | Per-frame-derived |

The only discrete change is selecting a lake (bar, table button, keyboard). All four `<dd>`s jump once, e.g. 1,595.5 m → 3,697.8 m and 14 → 1 lakes. That is the *only* place F28d (NumberFlow) may animate, if Control runs F28d at all. The F28a recommendation is not to.

## Target

No source change. Add a guard so that motion on the continuous paths fails CI. If F28d goes ahead, it must keep this test green. It may add a separate test for the lake-selection path only.

## Steps

1. Add the test below to `e2e/explorer.spec.ts` inside `test.describe('explorer: motion and pausing', …)`. Reuse the spec's existing helper that waits for the explorer to be ready (`[data-explorer][data-ready="true"]`).

## Boundaries

Tests only. No change to `explorer-client.ts`, `controller.ts`, `Explorer.astro`, hero files or anything under `src/lib/viz/**`.

## Reduced motion

N/A (instant in both modes).

## Tests (`e2e/explorer.spec.ts`, describe `explorer: motion and pausing`)

```ts
test('readouts and slider outputs update as plain text with no animation (F28)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/rising-water/');
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-explorer]')?.dataset.ready === 'true', null, { timeout: 60_000 });
  const r = await page.evaluate(async () => {
    const sel = ['[data-ro-level]', '[data-ro-pct]', '[data-ro-lakes]', '[data-ro-area]', '[data-ex-level-out]', '[data-ex-minp-out]', '[data-ex-topn-out]'];
    const before = sel.map((s) => document.querySelector(s)!.textContent);
    const level = document.querySelector<HTMLInputElement>('#ex-level')!;
    for (let i = 0; i < 10; i++) {
      level.value = String(200 + i * 40);
      level.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const topn = document.querySelector<HTMLInputElement>('#ex-topn')!;
    topn.value = String(Number(topn.value) + 10);
    topn.dispatchEvent(new Event('input', { bubbles: true }));
    const after = sel.map((s) => document.querySelector(s)!.textContent);
    const anims = sel.flatMap((s) => document.querySelector(s)!.getAnimations({ subtree: true })).length;
    const custom = sel.filter((s) => document.querySelector(s)!.querySelector('*:not(span)')).length;
    return { changed: after.filter((t, i) => t !== before[i]).length, anims, custom };
  });
  expect(r.changed).toBeGreaterThan(0); // the text updated synchronously
  expect(r.anims).toBe(0); // no CSS or WAAPI animation on any readout
  expect(r.custom).toBe(0); // no custom element (e.g. <number-flow>) inside them
});
```

If F28d is dispatched, the builder may narrow `custom` to exclude the four `<dd>`s only for the lake-selection path, but the scrub/drag assertions must stay.

## Risk

None.

## Verification

- **Mechanical**: explorer e2e (checker).
- **Done when**: the test passes on the F28c branch.
