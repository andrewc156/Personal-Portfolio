# 03 — Gate every `:hover` style behind `(hover: hover) and (pointer: fine)`

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: HIGH (P1)
- **Category**: Accessibility / touch (mobile-native §1)
- **Owner**: site-builder
- **Look or feel**: FEEL. Mouse users see exactly what they see today; touch users stop getting stuck hover fills.
- **Estimated scope**: 7 files, about 10 small rule moves; 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

On touch screens a tap applies `:hover` and leaves it there until the next tap somewhere else. None of the site's hover rules is gated. On the production build, after tapping **New terrain** the button keeps `background: rgb(220,232,240)` and an accent border, and after tapping the gear it keeps its sunken fill. Reproduced in Chromium and WebKit touch emulation (F28a `probe2.json` `*-btn-tap-sticky`; `touch-webkit.png`, `touch-chromium.png`).

Every ungated rule (current code, verbatim):

```css
/* src/styles/global.css:85 */
a:hover {
  color: var(--color-accent-hover);
  text-decoration-thickness: 2px;
}
/* src/styles/global.css:185 */
.btn:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}
/* src/styles/global.css:224 */
.icon-btn:hover:not(:disabled) {
  background: var(--color-surface-sunken);
  border-color: var(--color-border);
}
```

```css
/* src/components/site/Header.astro:119 */
  .wordmark:hover {
    color: var(--color-accent);
  }
/* src/components/site/Header.astro:147 — NOTE: shared with aria-current */
  .site-nav a:hover,
  .site-nav a[aria-current='page'] {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 0.3em;
  }
```

```css
/* src/components/content/content.css:35 */
.link-btn:hover {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
```

```css
/* src/components/content/WorkRow.astro:92 */
  a.work-row__inner:hover {
    background: var(--color-surface-sunken);
    color: var(--color-text);
  }

  a.work-row__inner:hover .work-row__title {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }
```

```css
/* src/components/content/ResearchCard.astro:59 */
  .research-card__title a:hover {
    color: var(--color-accent);
    text-decoration-color: currentColor;
  }
```

```css
/* src/pages/garden/index.astro:228 */
  .chip:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-text);
  }
```

There are no `:hover` rules in `src/components/hero/**` or `src/components/explorer/**`. Their buttons use the global `.btn`, so this plan fixes them too.

## Target

Wrap each hover rule, unchanged inside, in:

```css
@media (hover: hover) and (pointer: fine) {
  /* the existing :hover rule, verbatim */
}
```

The one structural change is in `Header.astro:147`. Split the shared selector so the current-page state stays visible on touch:

```css
/* src/components/site/Header.astro — target */
  .site-nav a[aria-current='page'] {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 0.3em;
  }

  @media (hover: hover) and (pointer: fine) {
    .site-nav a:hover {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.3em;
    }
  }
```

Leave every `transition` declaration where it is. Transitions stay on the base rule; only the `:hover` state moves into the query.

## Repo conventions to follow

- Scoped component styles stay in their component `<style>`; global ones in `global.css` / `content.css`.
- Keep each media block directly after the base rule it belongs to, so the file still reads top to bottom.
- Media queries over device sniffing (mobile-native Hard Rule 2). No JS.

## Steps

1. `src/styles/global.css`: wrap `a:hover` (line 85), `.btn:hover` (185) and `.icon-btn:hover:not(:disabled)` (224), each in its own `@media (hover: hover) and (pointer: fine) { … }`.
2. `src/components/site/Header.astro`: wrap `.wordmark:hover` (119). Split and wrap the nav rule (147) as shown above.
3. `src/components/content/content.css`: wrap `.link-btn:hover` (35).
4. `src/components/content/WorkRow.astro`: wrap both hover rules (92, 97) in one media block.
5. `src/components/content/ResearchCard.astro`: wrap the rule at 59.
6. `src/pages/garden/index.astro`: wrap `.chip:hover` (228).
7. `grep -rn ":hover" src` must now show every hit inside a `(hover: hover) and (pointer: fine)` block.
8. Add the test below.

## Boundaries

- Do NOT change any colour, thickness or declaration inside the rules.
- Do NOT touch `src/components/hero/**`, `src/components/explorer/**` or `src/lib/**`.
- Do NOT add `:active` styles here (that's plan 04).
- If a rule doesn't match the excerpt, STOP and report.

## Reduced motion

Not affected.

## Tests (`e2e/shell.spec.ts`, describe `layout and accessibility`)

```ts
test('every :hover rule is gated by (hover: hover) and (pointer: fine) (F28)', async ({ page }) => {
  for (const path of ['/', '/garden/', '/research/', '/rising-water/']) {
    await page.goto(path);
    const ungated = await page.evaluate(() => {
      const bad: string[] = [];
      const walk = (rules: CSSRuleList, gated: boolean) => {
        for (const r of Array.from(rules)) {
          if (r instanceof CSSMediaRule) {
            const c = r.conditionText.replace(/\s+/g, ' ');
            walk(r.cssRules, gated || (c.includes('hover: hover') && c.includes('pointer: fine')));
          } else if (r instanceof CSSStyleRule) {
            if (r.selectorText.includes(':hover') && !gated) bad.push(r.selectorText);
            if (r.cssRules?.length) walk(r.cssRules, gated);
          } else if ('cssRules' in r) {
            walk((r as CSSGroupingRule).cssRules, gated);
          }
        }
      };
      for (const s of Array.from(document.styleSheets)) {
        try { walk(s.cssRules, false); } catch { /* cross-origin: none expected */ }
      }
      return bad;
    });
    expect(ungated, path).toEqual([]);
  }
});

test('a tapped button keeps no hover fill on touch (F28)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  const btn = page.locator('.hero__btn[data-hero-new]');
  await expect(btn).toBeEnabled();
  await btn.scrollIntoViewIfNeeded();
  const before = await btn.evaluate((b) => getComputedStyle(b).backgroundColor);
  await btn.tap();
  await page.waitForTimeout(300);
  expect(await btn.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(before);
  await ctx.close();
});
```

## Risk

Low. Hybrid devices (touch laptops, iPad with trackpad) report `hover: hover` + `pointer: fine` while a mouse or trackpad is primary, so they keep hover. A touch-first tablet loses a hover it never really had.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`. The checker runs the shell and site e2e.
- **Feel check**:
  - Desktop with a mouse: every hover (links, buttons, chips, work rows, research titles, nav, wordmark) looks exactly as before.
  - Phone (real iPhone if possible): tap New terrain, Play, the gear, a Garden chip, then back. Nothing keeps a hover fill or accent border.
  - The current-page nav link stays underlined in accent on the phone.
- **Done when**: both tests pass and `grep -rn ":hover" src` shows only gated rules.
