# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> layout and accessibility >> axe: 0 serious/critical (light)
- Location: e2e/shell.spec.ts:356:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "/ light with settings open: color-contrast (serious) #settings-title, fieldset:nth-child(1) > legend, .slider-row__top > label, output, fieldset:nth-child(2) > legend, label[for=\"hero-palette\"], #hero-palette, .btn",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "Andrew Chincea" [ref=e5] [cursor=pointer]:
        - /url: /
      - navigation "Main" [ref=e6]:
        - list [ref=e7]:
          - listitem [ref=e8]:
            - link "Mission" [ref=e9] [cursor=pointer]:
              - /url: /#mission
          - listitem [ref=e10]:
            - link "Research" [ref=e11] [cursor=pointer]:
              - /url: /#research
          - listitem [ref=e12]:
            - link "Work" [ref=e13] [cursor=pointer]:
              - /url: /#work
          - listitem [ref=e14]:
            - link "Open science" [ref=e15] [cursor=pointer]:
              - /url: /#open-science
          - listitem [ref=e16]:
            - link "Rising water" [ref=e17] [cursor=pointer]:
              - /url: /rising-water/
          - listitem [ref=e18]:
            - link "CV" [ref=e19] [cursor=pointer]:
              - /url: /cv/
      - generic [ref=e20]:
        - button "Dark theme" [ref=e21] [cursor=pointer]
        - button "Art settings" [expanded] [ref=e24] [cursor=pointer]
  - main [ref=e28]:
    - region "Andrew Chincea" [ref=e29]:
      - generic [ref=e31]:
        - heading "Andrew Chincea" [level=1] [ref=e32]
        - paragraph [ref=e33]: What can the shape of a landscape tell us about the water that moves through it?
        - list "Keywords" [ref=e34]:
          - listitem [ref=e35]: water quality
          - listitem [ref=e36]: topological data analysis
          - listitem [ref=e37]: statistics
          - listitem [ref=e38]: number theory
    - region "Mission" [ref=e46]:
      - heading "Mission" [level=2] [ref=e48]
    - region "Recent work" [ref=e49]:
      - heading "Recent work" [level=2] [ref=e51]
    - region "Research" [ref=e52]:
      - heading "Research" [level=2] [ref=e54]
    - region "Open science" [ref=e55]:
      - heading "Open science" [level=2] [ref=e57]
  - contentinfo [ref=e58]:
    - paragraph [ref=e60]: © 2026 Andrew Chincea · Built with help from Claude Code
  - complementary "Art settings" [ref=e61]:
    - generic [ref=e62]:
      - heading "Art settings" [active] [level=2] [ref=e63]
      - button "Close art settings" [ref=e64] [cursor=pointer]
    - form "Hero art settings" [ref=e68]:
      - group "Terrain" [ref=e69]:
        - generic [ref=e72]:
          - generic [ref=e73]:
            - generic [ref=e74]: Scale
            - status [aria-hidden] [ref=e75]: "1.5"
          - slider "Scale" [ref=e76] [cursor=pointer]: "1.5"
      - group "Color" [ref=e77]:
        - generic [ref=e80]:
          - generic [ref=e81]: Palette
          - combobox "Palette" [ref=e82] [cursor=pointer]:
            - option "Delta" [selected]
            - option "Canyon"
            - option "Glacier"
            - option "Estuary"
            - option "Mono"
      - button "Reset" [ref=e84] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | 
  4   | /** F1 site shell: theme, header/nav, skip link, settings panel, 404, requests, layout. */
  5   | 
  6   | const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
  7   | const WIDTHS = [375, 768, 1280];
  8   | const THEMES = ['light', 'dark'] as const;
  9   | 
  10  | async function bgColor(page: Page): Promise<string> {
  11  |   return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  12  | }
  13  | 
  14  | async function expectNoSeriousAxe(page: Page, label: string): Promise<void> {
  15  |   const results = await new AxeBuilder({ page }).analyze();
  16  |   const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  17  |   expect(
  18  |     bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target).join(', ')}`),
> 19  |   ).toEqual([]);
      |     ^ Error: expect(received).toEqual(expected) // deep equality
  20  | }
  21  | 
  22  | test.describe('theme', () => {
  23  |   test('follows the OS preference by default', async ({ browser }) => {
  24  |     for (const colorScheme of THEMES) {
  25  |       const ctx = await browser.newContext({ colorScheme });
  26  |       const page = await ctx.newPage();
  27  |       await page.goto('/');
  28  |       expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
  29  |       const pressed = await page.locator('[data-theme-toggle]').getAttribute('aria-pressed');
  30  |       expect(pressed).toBe(String(colorScheme === 'dark'));
  31  |       await ctx.close();
  32  |     }
  33  |   });
  34  | 
  35  |   test('light and dark themes use different backgrounds', async ({ browser }) => {
  36  |     const colors: string[] = [];
  37  |     for (const colorScheme of THEMES) {
  38  |       const ctx = await browser.newContext({ colorScheme });
  39  |       const page = await ctx.newPage();
  40  |       await page.goto('/');
  41  |       colors.push(await bgColor(page));
  42  |       await ctx.close();
  43  |     }
  44  |     expect(colors[0]).not.toBe(colors[1]);
  45  |   });
  46  | 
  47  |   test('toggle switches theme and persists across reloads and pages', async ({ browser }) => {
  48  |     const ctx = await browser.newContext({ colorScheme: 'light' });
  49  |     const page = await ctx.newPage();
  50  |     await page.goto('/');
  51  |     const lightBg = await bgColor(page);
  52  |     const toggle = page.locator('[data-theme-toggle]');
  53  |     await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  54  |     await toggle.click();
  55  |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  56  |     await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  57  |     expect(await bgColor(page)).not.toBe(lightBg);
  58  |     expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  59  | 
  60  |     await page.reload();
  61  |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  62  |     await page.goto('/this-page-does-not-exist/');
  63  |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  64  | 
  65  |     await page.locator('[data-theme-toggle]').click();
  66  |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  67  |     await page.reload();
  68  |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  69  |     await ctx.close();
  70  |   });
  71  | 
  72  |   test('no flash: stored theme is applied before the body is parsed', async ({ browser }) => {
  73  |     for (const [os, stored] of [
  74  |       ['light', 'dark'],
  75  |       ['dark', 'light'],
  76  |     ] as const) {
  77  |       const ctx = await browser.newContext({ colorScheme: os });
  78  |       await ctx.addInitScript((theme) => {
  79  |         try {
  80  |           localStorage.setItem('theme', theme);
  81  |         } catch {
  82  |           /* ignore */
  83  |         }
  84  |         const w = window as unknown as { __themeAtBody?: string | null };
  85  |         const obs = new MutationObserver(() => {
  86  |           if (document.body && w.__themeAtBody === undefined) {
  87  |             w.__themeAtBody = document.documentElement.getAttribute('data-theme');
  88  |             obs.disconnect();
  89  |           }
  90  |         });
  91  |         obs.observe(document, { childList: true, subtree: true });
  92  |       }, stored);
  93  |       const page = await ctx.newPage();
  94  |       await page.goto('/');
  95  |       const atBody = await page.evaluate(
  96  |         () => (window as unknown as { __themeAtBody?: string | null }).__themeAtBody,
  97  |       );
  98  |       expect(atBody).toBe(stored);
  99  |       await ctx.close();
  100 |     }
  101 |   });
  102 | 
  103 |   test('theme bootstrap is an inline script in <head> before any stylesheet', async ({ page }) => {
  104 |     await page.goto('/');
  105 |     const order = await page.evaluate(() => {
  106 |       const els = Array.from(
  107 |         document.head.querySelectorAll('script, link[rel="stylesheet"], style'),
  108 |       );
  109 |       const first = els[0];
  110 |       return first ? `${first.tagName}:${first.hasAttribute('src') ? 'src' : 'inline'}` : '';
  111 |     });
  112 |     expect(order).toBe('SCRIPT:inline');
  113 |   });
  114 | });
  115 | 
  116 | test.describe('header and navigation', () => {
  117 |   test('has wordmark, nav items and gear on home', async ({ page }) => {
  118 |     await page.goto('/');
  119 |     await expect(page.locator('header .wordmark')).toHaveText('Andrew Chincea');
```