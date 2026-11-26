# 02 — Make the Settings drawer and sheet enter and exit with interruptible transitions

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: HIGH (P1)
- **Category**: Interruptibility (also Physicality & origin)
- **Owner**: site-builder
- **Look or feel**: FEEL. The drawer and sheet look the same when open; only their motion changes.
- **Depends on**: plan 01 (tokens `--ease-drawer`, `--dur-drawer-in`, `--dur-drawer-out`)
- **Estimated scope**: 1 file (`src/components/site/SettingsPanel.astro`, `<style>` only) plus 1 test file (`e2e/shell.spec.ts`)
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

The panel enters with a one-shot keyframe and leaves with an instant `display: none`:

```css
/* src/components/site/SettingsPanel.astro:45–63 — current (excerpt) */
  .settings {
    position: fixed;
    z-index: 50;
    inset: var(--shell-header-h, var(--header-h)) 0 0 auto;
    width: min(var(--panel-w), 100vw);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    color: var(--color-text);
    border-left: 1px solid var(--color-border);
    box-shadow: var(--shadow-panel);
    animation: settings-in-right var(--dur-med) var(--ease);
  }

  .settings[hidden] {
    display: none;
  }
```

```css
/* src/components/site/SettingsPanel.astro:101–128 — current */
  /* Mobile: bottom sheet */
  @media (max-width: 40rem) {
    .settings {
      inset: auto 0 0 0;
      width: 100%;
      max-height: 65vh;
      max-height: 65dvh;
      border-left: 0;
      border-top: 1px solid var(--color-border);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      animation-name: settings-in-up;
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
  }

  @keyframes settings-in-right {
    from {
      transform: translateX(1.5rem);
      opacity: 0;
    }
  }

  @keyframes settings-in-up {
    from {
      transform: translateY(1.5rem);
      opacity: 0;
    }
  }
```

`settings.ts:109` toggles `panel.hidden`.

Measured on the production build (F28a evidence `probe1.json`, `drawer-open-1280-*.png`, `sheet-open-375-*.png`):

- Close has no animation: `display:none` lands on the same frame.
- Reopening mid-open **restarts from opacity 0**: the panel was at 0.80 opacity 100 ms in, then closed and reopened, and came back at 0. Keyframes can't retarget.
- The phone sheet moves only 24 px, so it reads as a fade. For ~100 ms the page's text and art show *through* the sheet (double exposure).
- The drawer's 24 px slide plus fade lets the art show through it at 50–100 ms.

A bottom sheet should come from the bottom edge and a drawer from the right edge, as opaque surfaces. Exit should be a little faster than enter. Both must retarget when interrupted.

## Target

Replace the keyframes with transitions on `transform` (compositor-only). `@starting-style` gives the enter. `transition-behavior: allow-discrete` on `display` keeps the panel rendered during the exit. Opacity stays 1 (no fade, so no double exposure).

- Wide drawer: from `translateX(calc(100% + 2rem))`. The extra 2rem hides the 2rem panel shadow.
- Sheet: from `translateY(calc(100% + 2rem))`.
- Enter: `transform 260ms cubic-bezier(0.32, 0.72, 0, 1)` (`--dur-drawer-in`, `--ease-drawer`).
- Exit: `transform 200ms cubic-bezier(0.32, 0.72, 0, 1)` (`--dur-drawer-out`, `--ease-drawer`). Exit is faster than enter.
- While closing, `pointer-events: none`, so a tap on the leaving panel does nothing.

```css
/* src/components/site/SettingsPanel.astro — target */
  .settings {
    position: fixed;
    z-index: 50;
    /* Starts below the header (pinned while open, see Header.astro) so the
       gear and theme toggle stay visible and clickable. */
    inset: var(--shell-header-h, var(--header-h)) 0 0 auto;
    width: min(var(--panel-w), 100vw);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    color: var(--color-text);
    border-left: 1px solid var(--color-border);
    box-shadow: var(--shadow-panel);
    /* F28: enter/exit are transitions so they retarget when interrupted.
       Values used when opening (the destination state's transition applies). */
    transform: none;
    transition:
      transform var(--dur-drawer-in) var(--ease-drawer),
      display var(--dur-drawer-in) allow-discrete;
  }

  @starting-style {
    .settings {
      transform: translateX(calc(100% + 2rem));
    }
  }

  .settings[hidden] {
    display: none;
    transform: translateX(calc(100% + 2rem));
    pointer-events: none;
    /* Values used when closing: a little faster than the enter. */
    transition:
      transform var(--dur-drawer-out) var(--ease-drawer),
      display var(--dur-drawer-out) allow-discrete;
  }

  /* … .settings__head, __title, __body unchanged … */

  /* Mobile: bottom sheet */
  @media (max-width: 40rem) {
    .settings {
      inset: auto 0 0 0;
      width: 100%;
      max-height: 65vh;
      max-height: 65dvh;
      border-left: 0;
      border-top: 1px solid var(--color-border);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    @starting-style {
      .settings {
        transform: translateY(calc(100% + 2rem));
      }
    }

    .settings[hidden] {
      transform: translateY(calc(100% + 2rem));
    }
  }

  /* Reduced motion: no movement at all. The panel appears and disappears in place
     (durations are already 0 through tokens.css and the global reset). */
  @media (prefers-reduced-motion: reduce) {
    .settings,
    .settings[hidden] {
      transform: none;
    }

    @starting-style {
      .settings {
        transform: none;
      }
    }
  }
```

Delete both `@keyframes` blocks (`settings-in-right`, `settings-in-up`), the `animation:` line and the `animation-name:` line.

## Repo conventions to follow

- Motion tokens come from `src/styles/tokens.css` (plan 01). Don't hand-type curves.
- Component styles stay in the component's scoped `<style>`. Exemplar: the current `SettingsPanel.astro` block itself.
- Behaviour lives in `settings.ts`. **No JS change is needed**: `panel.hidden` stays the single source of truth. Focus, `inert`, `aria-modal`, Esc and backdrop close (F25, settled) stay exactly as they are.

## Steps

1. In `.settings`, replace `animation: settings-in-right var(--dur-med) var(--ease);` with the `transform: none;` and `transition:` lines above.
2. Add the top-level `@starting-style { .settings { transform: translateX(calc(100% + 2rem)); } }` right after the `.settings` rule.
3. Extend `.settings[hidden]` to the target (keep `display: none`; add `transform`, `pointer-events`, `transition`).
4. In the `@media (max-width: 40rem)` block, delete `animation-name: settings-in-up;`. Add the nested `@starting-style` and `.settings[hidden]` rules shown.
5. Delete the two `@keyframes` blocks.
6. Add the reduced-motion block at the **end** of the `<style>`. It must come after the media block so it wins at equal specificity.
7. Build. Open `dist/_astro/*.css` and confirm the `@starting-style` and `[hidden]` rules kept Astro's scope attribute (e.g. `.settings[data-astro-cid-…]`). If Astro dropped or unscoped the `@starting-style` rule, STOP and report.
8. Add the tests below.

## Boundaries

- Do NOT edit `settings.ts`, `Header.astro`, or any file of the hero or explorer.
- Do NOT add opacity to the enter or exit; the whole point is an opaque surface.
- Do NOT change sizes, colours, borders, radius, shadow or the breakpoint.
- Do NOT add a backdrop here (that's plan 10, which needs Andrew).
- If the code doesn't match the excerpts, STOP and report.

## Reduced motion

No transform in any state, and 0 ms durations. The panel shows and hides in place on the next frame. No fade is needed.

## Tests (`e2e/shell.spec.ts`, inside `test.describe('settings panel', …)`)

```ts
async function sampleInterrupt(page: Page, axis: 'x' | 'y') {
  return page.evaluate(async (axis) => {
    const p = document.getElementById('settings-panel')!;
    const g = document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!;
    const off = () => {
      const m = new DOMMatrix(getComputedStyle(p).transform);
      return axis === 'x' ? m.m41 : m.m42;
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    g.click();
    await frame();
    const kinds = p.getAnimations().map((a) => a.constructor.name);
    await wait(100);
    const midOpen = off();
    g.click(); // close mid-open
    await frame();
    const afterClose = off();
    const shownWhileClosing = getComputedStyle(p).display !== 'none';
    await wait(60);
    const midClose = off();
    g.click(); // reopen mid-close
    await frame();
    const afterReopen = off();
    const size = axis === 'x' ? p.offsetWidth : p.offsetHeight;
    return { kinds, midOpen, afterClose, shownWhileClosing, midClose, afterReopen, size };
  }, axis);
}

for (const [w, h, axis] of [
  [1280, 800, 'x'],
  [375, 812, 'y'],
] as const) {
  test(`enter/exit are interruptible transitions, no jumps (${w}px, F28)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
    const r = await sampleInterrupt(page, axis);
    expect(r.kinds).not.toContain('CSSAnimation');
    expect(r.kinds).toContain('CSSTransition');
    expect(r.shownWhileClosing).toBe(true);
    // An interruption continues from where the panel was (one frame of travel at most).
    expect(Math.abs(r.afterClose - r.midOpen)).toBeLessThan(r.size * 0.15);
    expect(Math.abs(r.afterReopen - r.midClose)).toBeLessThan(r.size * 0.15);
    await animationsSettled(page, '#settings-panel');
  });
}

test('reduced motion: the panel never moves (F28)', async ({ browser }) => {
  for (const [w, h] of [[1280, 800], [375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Art settings', exact: true })).toBeEnabled();
    const t = await page.evaluate(async () => {
      const p = document.getElementById('settings-panel')!;
      document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!.click();
      const out: string[] = [];
      for (let i = 0; i < 3; i++) {
        out.push(getComputedStyle(p).transform);
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    });
    expect(t.every((v) => v === 'none')).toBe(true);
    await ctx.close();
  }
});
```

The existing tests in this describe (F25 modal sheet, focus return, Esc, remembered state, header tools at 768/1280) must still pass unchanged. They already wait with `animationsSettled`, which covers transitions. If a test asserts `toBeHidden()` straight after a close, Playwright's retry absorbs the 200 ms exit; don't weaken any assertion.

## Risk

- **Browser support:** `@starting-style` and `transition-behavior: allow-discrete` need Chrome 117+, Safari 17.5+ and Firefox 129+, which is inside "last two versions". Older browsers show and hide the panel instantly (graceful).
- **Exit timing:** during the 200 ms exit the panel is still rendered. `pointer-events: none` stops stray taps. Focus has already returned to the opener (F25 behaviour is unchanged).
- **Header pin:** at ≥40.0625rem, the header unpins as soon as `data-settings-open` is removed. On a scrolled page the header leaves while the drawer slides out. Check it in the feel check; if it reads badly, report it rather than changing `Header.astro` in this plan.
- **Stored state:** a remembered open drawer slides in on page load, as it fades in today. Behaviour is unchanged.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`. The checker runs `npm run build` and `npx playwright test e2e/shell.spec.ts e2e/hero.spec.ts`.
- **Feel check** (at 1280 and at 375 with touch):
  - The drawer slides fully in from the right edge and the sheet rises from the bottom edge. Neither is ever see-through.
  - Spam the gear: the panel reverses from wherever it is and never pops to the start.
  - Close is visibly a little quicker than open.
  - In DevTools ▸ Animations at 10 % speed, there is one transform transition per open/close and no opacity.
  - Turn on `prefers-reduced-motion` (Rendering panel): the panel appears and disappears in place, with no slide.
  - On a real iPhone: the sheet rises smoothly, with no flash of the page through it.
- **Done when**: both new tests and all existing shell and hero tests pass, and no `@keyframes settings-in-*` remains (`grep -rn "settings-in-" src` is empty).
