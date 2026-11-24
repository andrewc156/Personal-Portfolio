# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: anchor-mutation.spec.ts >> anchor loop
- Location: docs/checks/tools/f2a2/anchor-mutation.spec.ts:5:1

# Error details

```
Error: expect(locator).toBeInViewport() failed

Locator:  locator('#research')
Expected: in viewport
Received: viewport ratio 0
Timeout:  3000ms

Call log:
  - Expect "toBeInViewport" locator('#research') with timeout 3000ms
  - waiting for locator('#research')
    10 × locator resolved to <section id="research" class="section" data-astro-cid-4msv5bci="" aria-labelledby="research-title">…</section>
       - unexpected value "viewport ratio 0"

```

```yaml
- region "Research":
  - heading "Research" [level=2]
  - list
```

# Test source

```ts
  1  | // Checker mutation test: the attempt-2 anchor loop (copied verbatim) must FAIL
  2  | // when nav clicks only change the hash without scrolling (MUTATE=1) and PASS otherwise.
  3  | import { test, expect } from '@playwright/test';
  4  | const SECTION_ANCHORS = ['mission', 'work', 'research', 'open-science'];
  5  | test('anchor loop', async ({ page }) => {
  6  |   if (process.env.MUTATE === '1') {
  7  |     await page.addInitScript(() => {
  8  |       document.addEventListener('click', (e) => {
  9  |         const a = (e.target as Element).closest('a[href^="/#"]');
  10 |         if (a) { e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); }
  11 |       }, true);
  12 |     });
  13 |   }
  14 |   await page.setViewportSize({ width: 1280, height: 800 });
  15 |   await page.goto('/');
  16 |   type SettleWindow = Window & { __settleY?: number; __settleT?: number };
  17 |   const scrollSettled = async () => {
  18 |     await page.evaluate(() => { (window as SettleWindow).__settleY = undefined; });
  19 |     await page.waitForFunction(() => {
  20 |       const w = window as SettleWindow; const now = performance.now();
  21 |       if (w.__settleY !== window.scrollY) { w.__settleY = window.scrollY; w.__settleT = now; return false; }
  22 |       return now - (w.__settleT ?? now) >= 150;
  23 |     }, undefined, { polling: 50 });
  24 |   };
  25 |   const log: string[] = [];
  26 |   for (const id of SECTION_ANCHORS) {
  27 |     await scrollSettled();
  28 |     const link = page.locator(`nav[aria-label="Main"] a[href="/#${id}"]`);
  29 |     await link.click();
  30 |     await expect(page).toHaveURL(new RegExp(`#${id}$`));
  31 |     const target = page.locator(`#${id}`);
> 32 |     await expect(target).toBeInViewport({ timeout: 3000 });
     |                          ^ Error: expect(locator).toBeInViewport() failed
  33 |     await scrollSettled();
  34 |     await expect(target).toBeInViewport();
  35 |     const r = await target.evaluate((el) => ({ top: Math.round(el.getBoundingClientRect().top), y: Math.round(scrollY) }));
  36 |     log.push(`${id}: top=${r.top} scrollY=${r.y}`);
  37 |   }
  38 |   console.log(log.join('\n'));
  39 | });
  40 | 
```