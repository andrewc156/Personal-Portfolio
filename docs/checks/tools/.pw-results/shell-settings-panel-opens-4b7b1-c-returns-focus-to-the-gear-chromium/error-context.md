# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> settings panel >> opens, closes on Esc, returns focus to the gear
- Location: e2e/shell.spec.ts:202:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('button', { name: 'Art settings' })
Expected: "true"
Error: strict mode violation: getByRole('button', { name: 'Art settings' }) resolved to 2 elements:
    1) <button type="button" class="icon-btn" aria-expanded="true" title="Art settings" data-settings-toggle="" aria-label="Art settings" data-astro-cid-jr7posx5="" aria-controls="settings-panel">…</button> aka getByRole('button', { name: 'Art settings', description: 'Art settings' })
    2) <button type="button" class="icon-btn" data-settings-close="" data-astro-cid-psic4rm5="" aria-label="Close art settings">…</button> aka getByRole('button', { name: 'Close art settings' })

Call log:
  - Expect "toHaveAttribute" getByRole('button', { name: 'Art settings' }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Art settings' })

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
  112 |     expect(order).toBe('SCRIPT:inline');
  113 |   });
  114 | });
  115 | 
  116 | test.describe('header and navigation', () => {
  117 |   test('has wordmark, nav items and gear on home', async ({ page }) => {
  118 |     await page.goto('/');
  119 |     await expect(page.locator('header .wordmark')).toHaveText('Andrew Chincea');
  120 |     const nav = page.getByRole('navigation', { name: 'Main' });
  121 |     await expect(nav.getByRole('link')).toHaveText([
  122 |       'Mission',
  123 |       'Research',
  124 |       'Work',
  125 |       'Open science',
  126 |       'Rising water',
  127 |       'CV',
  128 |     ]);
  129 |     await expect(nav.getByRole('link', { name: 'Rising water' })).toHaveAttribute(
  130 |       'href',
  131 |       '/rising-water/',
  132 |     );
  133 |     await expect(nav.getByRole('link', { name: 'CV' })).toHaveAttribute('href', '/cv/');
  134 |     await expect(page.getByRole('button', { name: 'Art settings' })).toBeVisible();
  135 |   });
  136 | 
  137 |   test('section anchors exist in §4.3 order and nav scrolls to them', async ({ page }) => {
  138 |     await page.setViewportSize({ width: 1280, height: 800 });
  139 |     await page.goto('/');
  140 |     const ids = await page.evaluate(() =>
  141 |       Array.from(document.querySelectorAll('main section[id]')).map((s) => s.id),
  142 |     );
  143 |     // Teaching and Contact render only with content, so check order of what is present.
  144 |     const order = ['mission', 'work', 'research', 'open-science', 'teaching', 'contact'];
  145 |     for (const id of SECTION_ANCHORS) expect(ids).toContain(id);
  146 |     const positions = ids.filter((id) => order.includes(id)).map((id) => order.indexOf(id));
  147 |     expect(positions).toEqual([...positions].sort((a, b) => a - b));
  148 |     await expect(page.locator('main h1')).toHaveCount(1);
  149 | 
  150 |     for (const id of SECTION_ANCHORS) {
  151 |       const link = page.locator(`nav[aria-label="Main"] a[href="/#${id}"]`);
  152 |       await link.click();
  153 |       await expect(page).toHaveURL(new RegExp(`#${id}$`));
  154 |       await expect(page.locator(`#${id}`)).toBeInViewport();
  155 |     }
  156 |   });
  157 | 
  158 |   test('nav stays usable on mobile', async ({ page }) => {
  159 |     await page.setViewportSize({ width: 375, height: 740 });
  160 |     await page.goto('/');
  161 |     const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  162 |     await expect(links).toHaveCount(6);
  163 |     for (let i = 0; i < 6; i++) await expect(links.nth(i)).toBeInViewport();
  164 |   });
  165 | 
  166 |   test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
  167 |     await page.goto('/');
  168 |     await page.keyboard.press('Tab');
  169 |     const skip = page.getByRole('link', { name: 'Skip to content' });
  170 |     await expect(skip).toBeFocused();
  171 |     await expect(skip).toBeInViewport();
  172 |     await page.keyboard.press('Enter');
  173 |     await expect(page).toHaveURL(/#main$/);
  174 |     await expect(page.locator('main#main')).toBeFocused();
  175 |   });
  176 | 
  177 |   test('focus is visible on interactive elements', async ({ page }) => {
  178 |     await page.goto('/');
  179 |     await page.keyboard.press('Tab'); // skip link
  180 |     for (let i = 0; i < 4; i++) {
  181 |       await page.keyboard.press('Tab');
  182 |       const outline = await page.evaluate(() => {
  183 |         const el = document.activeElement as HTMLElement | null;
  184 |         if (!el) return '';
  185 |         const cs = getComputedStyle(el);
  186 |         return `${cs.outlineStyle} ${cs.outlineWidth}`;
  187 |       });
  188 |       expect(outline).not.toMatch(/^none|0px/);
  189 |     }
  190 |   });
  191 | 
  192 |   test('footer line shows © year, name and credit; Source hidden while unset', async ({ page }) => {
  193 |     await page.goto('/');
  194 |     const footer = page.locator('footer');
  195 |     await expect(footer).toContainText(`© ${new Date().getFullYear()} Andrew Chincea`);
  196 |     await expect(footer).toContainText('Built with help from Claude Code');
  197 |     await expect(footer.getByRole('link', { name: 'Source' })).toHaveCount(0);
  198 |   });
  199 | });
  200 | 
  201 | test.describe('settings panel', () => {
  202 |   test('opens, closes on Esc, returns focus to the gear', async ({ page }) => {
  203 |     await page.setViewportSize({ width: 1280, height: 800 });
  204 |     await page.goto('/');
  205 |     const gear = page.getByRole('button', { name: 'Art settings' });
  206 |     const panel = page.locator('#settings-panel');
  207 |     await expect(gear).toHaveAttribute('aria-expanded', 'false');
  208 |     await expect(gear).toHaveAttribute('aria-controls', 'settings-panel');
  209 |     await expect(panel).toBeHidden();
  210 | 
  211 |     await gear.click();
> 212 |     await expect(gear).toHaveAttribute('aria-expanded', 'true');
      |                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  213 |     await expect(panel).toBeVisible();
  214 |     await expect(panel.getByRole('group').first()).toBeVisible();
  215 | 
  216 |     await page.keyboard.press('Escape');
  217 |     await expect(panel).toBeHidden();
  218 |     await expect(gear).toHaveAttribute('aria-expanded', 'false');
  219 |     await expect(gear).toBeFocused();
  220 | 
  221 |     // Esc from a control inside the panel also closes and returns focus.
  222 |     await gear.click();
  223 |     await panel.locator('input[type="range"]').first().focus();
  224 |     await page.keyboard.press('Escape');
  225 |     await expect(panel).toBeHidden();
  226 |     await expect(gear).toBeFocused();
  227 | 
  228 |     // Close button
  229 |     await gear.click();
  230 |     await panel.getByRole('button', { name: 'Close art settings' }).click();
  231 |     await expect(panel).toBeHidden();
  232 |     await expect(gear).toBeFocused();
  233 |   });
  234 | 
  235 |   test('slider readout updates live in monospace', async ({ page }) => {
  236 |     await page.goto('/');
  237 |     await page.getByRole('button', { name: 'Art settings' }).click();
  238 |     const slider = page.locator('#settings-panel input[type="range"]').first();
  239 |     const id = await slider.getAttribute('id');
  240 |     const out = page.locator(`#settings-panel output[for="${id}"]`);
  241 |     const before = await out.textContent();
  242 |     await slider.focus();
  243 |     await page.keyboard.press('ArrowRight');
  244 |     await expect(out).not.toHaveText(before ?? '');
  245 |     const font = await out.evaluate((el) => getComputedStyle(el).fontFamily);
  246 |     expect(font).toContain('IBM Plex Mono');
  247 |   });
  248 | 
  249 |   test('open/closed state is remembered', async ({ page }) => {
  250 |     await page.goto('/');
  251 |     const gear = page.getByRole('button', { name: 'Art settings' });
  252 |     await gear.click();
  253 |     await page.reload();
  254 |     await expect(page.locator('#settings-panel')).toBeVisible();
  255 |     await expect(page.getByRole('button', { name: 'Art settings' })).toHaveAttribute(
  256 |       'aria-expanded',
  257 |       'true',
  258 |     );
  259 |     await page.keyboard.press('Escape');
  260 |     await page.reload();
  261 |     await expect(page.locator('#settings-panel')).toBeHidden();
  262 |   });
  263 | 
  264 |   test('right drawer on desktop, bottom sheet on mobile', async ({ page }) => {
  265 |     await page.setViewportSize({ width: 1280, height: 800 });
  266 |     await page.goto('/');
  267 |     await page.getByRole('button', { name: 'Art settings' }).click();
  268 |     const panel = page.locator('#settings-panel');
  269 |     const clientWidth = () => page.evaluate(() => document.documentElement.clientWidth);
  270 |     let box = await panel.boundingBox();
  271 |     expect(box).not.toBeNull();
  272 |     if (box) {
  273 |       expect(Math.abs(box.x + box.width - (await clientWidth()))).toBeLessThanOrEqual(1);
  274 |       expect(box.width).toBeLessThan(500);
  275 |       expect(box.height).toBeGreaterThan(700);
  276 |     }
  277 | 
  278 |     await page.setViewportSize({ width: 375, height: 740 });
  279 |     box = await panel.boundingBox();
  280 |     expect(box).not.toBeNull();
  281 |     if (box) {
  282 |       expect(Math.abs(box.width - (await clientWidth()))).toBeLessThanOrEqual(1);
  283 |       expect(Math.round(box.y + box.height)).toBe(740);
  284 |       expect(box.height).toBeLessThan(740);
  285 |     }
  286 |   });
  287 | 
  288 |   test('gear is absent on pages without settings', async ({ page }) => {
  289 |     await page.goto('/this-page-does-not-exist/');
  290 |     await expect(page.getByRole('button', { name: 'Art settings' })).toHaveCount(0);
  291 |     await expect(page.locator('#settings-panel')).toHaveCount(0);
  292 |   });
  293 | });
  294 | 
  295 | test.describe('404', () => {
  296 |   test('unknown route shows the friendly 404 page', async ({ page }) => {
  297 |     const res = await page.goto('/this-page-does-not-exist/');
  298 |     expect(res?.status()).toBe(404);
  299 |     await expect(page.locator('h1')).toBeVisible();
  300 |     await expect(page.getByRole('main').getByRole('link', { name: /home/i })).toHaveAttribute(
  301 |       'href',
  302 |       '/',
  303 |     );
  304 |     await expect(page.locator('main svg[role="img"]')).toBeVisible();
  305 |     await expect(page.locator('main canvas')).toHaveCount(0);
  306 |   });
  307 | });
  308 | 
  309 | test.describe('requests and fonts', () => {
  310 |   test('zero third-party requests; fonts are self-hosted', async ({ page, baseURL }) => {
  311 |     const origin = new URL(baseURL ?? 'http://localhost:4321').origin;
  312 |     const foreign: string[] = [];
```