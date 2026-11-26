# 07 — `body` minimum height in small-viewport units

- **Status**: TODO
- **Commit**: 1b8f6aa
- **Severity**: LOW (P3)
- **Category**: Touch / viewport (mobile-native §3)
- **Owner**: site-builder
- **Look or feel**: FEEL. On iOS, short pages stop being taller than the screen. Desktop is unchanged (`svh == vh` there).
- **Estimated scope**: 1 file, 1 line; 1 test
- **Accept/Reject (Control)**: ACCEPTED (DECISIONS #90)

## Problem

```css
/* src/styles/global.css:26–30 — current */
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
```

`body` is a flex column that pushes the footer to the bottom. On iOS Safari `100vh` is the *large* viewport (toolbars collapsed). With the toolbar showing at load, a short page (404, About) is taller than what's visible, so it scrolls a little and the footer starts below the fold. This doesn't reproduce in emulation: `innerHeight` equals the computed `min-height` in both Chromium and WebKit (F28a `probe2.json` `*-meta`). It needs a real iPhone.

## Target

```css
/* src/styles/global.css — target */
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
```

Keep the `100vh` line as the fallback for browsers without `svh`. Use `svh`, not `dvh`: `dvh` resizes while the toolbar collapses, which shifts the footer mid-scroll.

## Repo conventions to follow

The same fallback pair is already used for the sheet at `src/components/site/SettingsPanel.astro:106–107` (`max-height: 65vh; max-height: 65dvh;`).

## Steps

1. Add `min-height: 100svh;` after `min-height: 100vh;` in the `body` rule.
2. Add the test.

## Boundaries

Only this line. Don't touch the header, footer or `main`.

## Reduced motion

N/A.

## Tests (`e2e/shell.spec.ts`, describe `layout and accessibility`)

```ts
test('body min-height uses small-viewport units (F28)', async ({ page }) => {
  await page.goto('/'); // site CSS (note: `astro preview` serves its own page for a bare /404)
  const ok = await page.evaluate(() =>
    Array.from(document.styleSheets).some((s) => {
      try {
        return Array.from(s.cssRules).some((r) => r instanceof CSSStyleRule && r.selectorText === 'body' && r.cssText.includes('100svh'));
      } catch { return false; }
    }),
  );
  expect(ok).toBe(true);
});
```

`e2e/cls.spec.ts` (Control's) must stay within budget. This change can't move anything on desktop.

## Risk

None on desktop. On iOS the footer of short pages sits at the bottom of the *visible* screen at load.

## Verification

- **Mechanical**: `npm run check`, `npm run lint`; shell and CLS e2e.
- **Feel check (real iPhone, Safari)**: open an unknown route (e.g. `/this-page-does-not-exist/`, the friendly 404) and `/about/` with the toolbar showing. The page shouldn't scroll if its content is short, and the footer sits at the bottom of the visible area.
- **Done when**: the test passes and the CLS spec is unchanged.
