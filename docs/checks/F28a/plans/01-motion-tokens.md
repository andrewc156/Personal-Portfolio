# 01 — Add two motion tokens: a strong ease-out and a drawer curve

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: LOW (P3), a prerequisite for plans 02, 04 and 10
- **Category**: Cohesion & tokens
- **Owner**: site-builder
- **Look or feel**: FEEL (no visual change by itself)
- **Estimated scope**: 1 file, +6 lines
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

`src/styles/tokens.css:75–78` has one curve and two durations:

```css
/* src/styles/tokens.css:75 — current */
  /* Motion */
  --dur-fast: 120ms;
  --dur-med: 220ms;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
```

`--ease` is a mild ease-out and works for the colour hovers that use it. It is too soft for the Settings drawer/sheet (plan 02) and for press feedback (plan 04). Those plans need the rubric's exact curves, and they belong in tokens, not hand-typed in each component.

The reduced-motion block at `tokens.css:129–134` already zeroes `--dur-fast` and `--dur-med`.

## Target

```css
/* src/styles/tokens.css — target (inside the same :root block, after --ease) */
  /* Motion */
  --dur-fast: 120ms;
  --dur-med: 220ms;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  /* F28: strong ease-out for UI responses (press feedback, fades). */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  /* F28: iOS-like drawer/sheet curve. */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-press: 160ms;
  --dur-drawer-in: 260ms;
  --dur-drawer-out: 200ms;
```

and in the existing reduced-motion block:

```css
/* src/styles/tokens.css:129 — target */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast: 0ms;
    --dur-med: 0ms;
    --dur-press: 0ms;
    --dur-drawer-in: 0ms;
    --dur-drawer-out: 0ms;
  }
}
```

Don't add an ease-in-out token: nothing on the site moves on screen. Don't change `--ease`.

## Repo conventions to follow

- Tokens live only in `src/styles/tokens.css`, in the first `:root` block under the `/* Motion */` comment.
- Exemplar of use: `src/styles/global.css:180–182` (`background-color var(--dur-fast) var(--ease)`).

## Steps

1. Add the five lines after `--ease` as shown.
2. Add the three `0ms` lines to the reduced-motion block.

## Boundaries

- Do NOT edit any other file in this plan.
- Do NOT rename or retune `--ease`, `--dur-fast` or `--dur-med`.
- If `tokens.css` no longer matches the excerpt, STOP and report.

## Reduced motion

The durations become `0ms` (plus the global reset in `global.css:242–251`).

## Test

None of its own. Plans 02 and 04 test the tokens' use. Optionally add to `e2e/shell.spec.ts` (`layout and accessibility` describe):

```ts
test('motion tokens exist (F28)', async ({ page }) => {
  await page.goto('/');
  const v = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ['--ease-out', '--ease-drawer', '--dur-press', '--dur-drawer-in', '--dur-drawer-out'].map((n) => s.getPropertyValue(n).trim());
  });
  expect(v).toEqual(['cubic-bezier(0.23, 1, 0.32, 1)', 'cubic-bezier(0.32, 0.72, 0, 1)', '160ms', '260ms', '200ms']);
});
```

## Risk

None.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`.
- **Feel check**: none (no use yet).
- **Done when**: the tokens resolve as listed and reduce to `0ms` under emulated reduced motion.
