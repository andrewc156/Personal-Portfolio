// Same as the shell test, but waits for scrollY to settle before each click.
import { chromium, devices } from 'playwright';
import { expect } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices['Desktop Chrome'] })).newPage();
await p.setViewportSize({ width: 1280, height: 800 });
await p.goto('http://localhost:4321/');
const settle = () => p.waitForFunction(() => new Promise(r => { const a = scrollY; requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY === a))); }));
for (const id of ['mission','work','research','open-science']) {
  await settle();
  await p.locator(`nav[aria-label="Main"] a[href="/#${id}"]`).click();
  await expect(p).toHaveURL(new RegExp(`#${id}$`));
  try { await expect(p.locator(`#${id}`)).toBeInViewport({ timeout: 3000 }); console.log(id, 'in viewport'); } catch { console.log(id, 'NOT in viewport'); }
}
await b.close();
