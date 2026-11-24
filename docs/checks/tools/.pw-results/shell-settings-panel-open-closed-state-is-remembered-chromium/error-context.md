# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shell.spec.ts >> settings panel >> open/closed state is remembered
- Location: e2e/shell.spec.ts:249:3

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
- generic [active] [ref=f1e1]:
  - link "Skip to content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=f1e3]:
    - generic [ref=f1e4]:
      - link "Andrew Chincea" [ref=f1e5] [cursor=pointer]:
        - /url: /
      - navigation "Main" [ref=f1e6]:
        - list [ref=f1e7]:
          - listitem [ref=f1e8]:
            - link "Mission" [ref=f1e9] [cursor=pointer]:
              - /url: /#mission
          - listitem [ref=f1e10]:
            - link "Research" [ref=f1e11] [cursor=pointer]:
              - /url: /#research
          - listitem [ref=f1e12]:
            - link "Work" [ref=f1e13] [cursor=pointer]:
              - /url: /#work
          - listitem [ref=f1e14]:
            - link "Open science" [ref=f1e15] [cursor=pointer]:
              - /url: /#open-science
          - listitem [ref=f1e16]:
            - link "Rising water" [ref=f1e17] [cursor=pointer]:
              - /url: /rising-water/
          - listitem [ref=f1e18]:
            - link "CV" [ref=f1e19] [cursor=pointer]:
              - /url: /cv/
      - generic [ref=f1e20]:
        - button "Dark theme" [ref=f1e21] [cursor=pointer]
        - button "Art settings" [expanded] [ref=f1e24] [cursor=pointer]
  - main [ref=f1e28]:
    - region "Andrew Chincea" [ref=f1e29]:
      - generic [ref=f1e31]:
        - heading "Andrew Chincea" [level=1] [ref=f1e32]
        - paragraph [ref=f1e33]: What can the shape of a landscape tell us about the water that moves through it?
        - list "Keywords" [ref=f1e34]:
          - listitem [ref=f1e35]: water quality
          - listitem [ref=f1e36]: topological data analysis
          - listitem [ref=f1e37]: statistics
          - listitem [ref=f1e38]: number theory
    - region "Mission" [ref=f1e46]:
      - heading "Mission" [level=2] [ref=f1e48]
    - region "Recent work" [ref=f1e49]:
      - heading "Recent work" [level=2] [ref=f1e51]
    - region "Research" [ref=f1e52]:
      - heading "Research" [level=2] [ref=f1e54]
    - region "Open science" [ref=f1e55]:
      - heading "Open science" [level=2] [ref=f1e57]
  - contentinfo [ref=f1e58]:
    - paragraph [ref=f1e60]: © 2026 Andrew Chincea · Built with help from Claude Code
  - complementary "Art settings" [ref=f1e61]:
    - generic [ref=f1e62]:
      - heading "Art settings" [level=2] [ref=f1e63]
      - button "Close art settings" [ref=f1e64] [cursor=pointer]
    - form "Hero art settings" [ref=f1e68]:
      - group "Terrain" [ref=f1e69]:
        - generic [ref=f1e72]:
          - generic [ref=f1e73]:
            - generic [ref=f1e74]: Scale
            - status [aria-hidden] [ref=f1e75]: "1.5"
          - slider "Scale" [ref=f1e76] [cursor=pointer]: "1.5"
      - group "Color" [ref=f1e77]:
        - generic [ref=f1e80]:
          - generic [ref=f1e81]: Palette
          - combobox "Palette" [ref=f1e82] [cursor=pointer]:
            - option "Delta" [selected]
            - option "Canyon"
            - option "Glacier"
            - option "Estuary"
            - option "Mono"
      - button "Reset" [ref=f1e84] [cursor=pointer]
```

# Test source

```ts
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
  212 |     await expect(gear).toHaveAttribute('aria-expanded', 'true');
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
> 255 |     await expect(page.getByRole('button', { name: 'Art settings' })).toHaveAttribute(
      |                                                                      ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  313 |     const fonts: string[] = [];
  314 |     page.on('request', (req) => {
  315 |       const url = req.url();
  316 |       if (url.startsWith('data:') || url.startsWith('blob:')) return;
  317 |       if (new URL(url).origin !== origin) foreign.push(url);
  318 |       if (req.resourceType() === 'font') fonts.push(url);
  319 |     });
  320 |     for (const path of ['/', '/404.html', '/this-page-does-not-exist/']) {
  321 |       await page.goto(path);
  322 |       await page.waitForLoadState('networkidle');
  323 |     }
  324 |     expect(foreign).toEqual([]);
  325 |     expect(fonts.length).toBeGreaterThan(0);
  326 |     const families = await page.evaluate(async () => {
  327 |       await document.fonts.ready;
  328 |       return Array.from(document.fonts)
  329 |         .filter((f) => f.status === 'loaded')
  330 |         .map((f) => f.family.replace(/['"]/g, ''));
  331 |     });
  332 |     expect(families).toContain('IBM Plex Sans');
  333 |   });
  334 | });
  335 | 
  336 | test.describe('layout and accessibility', () => {
  337 |   for (const colorScheme of THEMES) {
  338 |     for (const width of WIDTHS) {
  339 |       test(`no horizontal overflow at ${width}px (${colorScheme})`, async ({ browser }) => {
  340 |         const ctx = await browser.newContext({
  341 |           colorScheme,
  342 |           viewport: { width, height: 900 },
  343 |         });
  344 |         const page = await ctx.newPage();
  345 |         for (const path of ['/', '/this-page-does-not-exist/']) {
  346 |           await page.goto(path);
  347 |           const overflow = await page.evaluate(
  348 |             () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  349 |           );
  350 |           expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
  351 |         }
  352 |         await ctx.close();
  353 |       });
  354 |     }
  355 | 
```