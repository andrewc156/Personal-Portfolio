# 10 — Dim the page behind the modal Settings sheet — NEEDS ANDREW

- **Status**: TODO, blocked on Andrew (it adds a visible dim layer)
- **Commit**: 1b8f6aa
- **Severity**: MEDIUM (P2)
- **Category**: Missed opportunity (state change with no visual explanation)
- **Owner**: site-builder
- **Look or feel**: **LOOK**. A translucent scrim appears over the page while the narrow (≤40rem) modal sheet is open. It uses the existing, currently unused `--color-scrim` token (`tokens.css:24` light `rgb(28 27 25 / 0.28)`; `:96` and `:120` dark `rgb(0 0 0 / 0.5)`). The wide drawer gets nothing (it's non-modal by design, F25).
- **Depends on**: plan 01 (tokens), plan 02 (same file; apply after it)
- **Estimated scope**: 1 file (`src/components/site/SettingsPanel.astro` `<style>`), about 20 lines; 1 test
- **Accept/Reject (Control, after Andrew)**: ____

## Problem

Since F25 the narrow sheet is a real modal: `role="dialog"`, `aria-modal="true"`, every sibling `inert`, and a tap outside closes it (`settings.ts:31–61, 202–211`). Visually, though, nothing tells the user the page behind is unavailable. The page stays fully bright (F28a `sheet-open-375-light.png`, `touch-*.png`). In dark mode the sheet's top edge barely separates from the page, since `--color-surface` #1a1d20 sits on `--color-bg` #111315 (`sheet-open-375-dark.png`). A tap on what looks like a live page silently closes the sheet instead of doing what the user aimed at.

`--color-scrim` exists in both themes but nothing uses it (`grep -rn "color-scrim" src` → `tokens.css` only).

## Target

A fixed pseudo-element on `body`, shown only while `<html>` has `data-settings-modal` (which `settings.ts` sets for the narrow sheet only), fading with opacity only:

```css
/* src/components/site/SettingsPanel.astro — target: add at the end of <style>, before the
   reduced-motion block from plan 02 */
  /* F28: dim the page behind the modal sheet. Pointer events pass through to <body>, so
     the existing backdrop-click handler in settings.ts keeps working unchanged. */
  :global(body)::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 49; /* just under the panel (50) */
    background: var(--color-scrim);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-drawer-out) var(--ease-out);
  }

  :global(:root[data-settings-modal]) :global(body)::after {
    opacity: 1;
    transition-duration: var(--dur-drawer-in);
  }
```

- Enter: opacity 0 → 1 over 260 ms `cubic-bezier(0.23, 1, 0.32, 1)`. Exit: 200 ms, same curve.
- It's a transition, so it is interruptible like the sheet in plan 02.

## Repo conventions to follow

- `:global(:root[data-settings-open]) .site-header` in `Header.astro:93` is the exemplar for keying styles off the `<html>` state attributes from a scoped `<style>`.
- Tokens only: `--color-scrim`, `--dur-drawer-in`, `--dur-drawer-out`, `--ease-out`.

## Steps

1. Add the two rules above to `SettingsPanel.astro`'s `<style>`.
2. Build. Confirm the output CSS contains `body:after` (or `body::after`) unscoped, and the `[data-settings-modal]` selector.
3. Add the test.

## Boundaries

- Do NOT change `settings.ts`. The backdrop click, inert, focus and Esc behaviour (F25) stay exactly as they are.
- Do NOT add a scrim to the wide drawer.
- Do NOT add a new colour; use `--color-scrim` as is.
- Do NOT use `backdrop-filter` (cost, and a look change beyond the brief).

## Reduced motion

The scrim still appears and disappears, instantly (durations are 0 through the tokens and the global reset). No movement is involved.

## Tests (`e2e/shell.spec.ts`, describe `settings panel`)

```ts
test('modal sheet dims the page; the wide drawer does not (F28)', async ({ page }) => {
  const scrim = () => page.evaluate(() => getComputedStyle(document.body, '::after').opacity);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  await expect(gear).toBeEnabled();
  expect(await scrim()).toBe('0');
  await gear.click();
  await animationsSettled(page, 'body');
  expect(await scrim()).toBe('1');
  // Backdrop tap still closes it (F25) and the scrim goes away.
  await page.mouse.click(187, 40);
  await expect(page.locator('#settings-panel')).toBeHidden();
  await expect.poll(scrim).toBe('0');

  await page.setViewportSize({ width: 1280, height: 800 });
  await gear.click();
  await animationsSettled(page, '#settings-panel');
  expect(await scrim()).toBe('0');
});
```

Also run the existing F25 test `narrow sheet keeps focus inside, background inert, focus returns` unchanged.

## Risk

- The scrim covers the header in sheet mode. That's intended: the header is inert there.
- If a page ever puts another `body::after` to use, they collide. There is none today (`grep -rn "body::after\|body:after" src` is empty).
- Contrast: the sheet itself is unchanged, and axe runs on the open sheet in both themes in the existing tests.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; shell e2e (checker).
- **Feel check** at 375 with touch, light and dark:
  - Open the sheet: the page dims as the sheet rises, and the sheet's edge now reads clearly in dark mode.
  - Tap the dimmed page: the sheet closes and the dim fades out.
  - Spam the gear: the dim retargets, never flashes.
  - At 768/1280: no dim with the drawer.
- **Done when**: the test passes and Andrew has approved the look (DECISIONS #90).
