import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

const risingControls = [
  '[data-settings-close]',
  '#hero-seed',
  '[data-hero-new]',
  '#hero-scale',
  '#hero-roughness',
  '[data-hero-play]',
  '#hero-speed',
  '#hero-level',
  '#hero-pacing',
  '#hero-loop',
  '#hero-show-barcode',
  '#hero-min-persistence',
  '#hero-max-bars',
  '#hero-view',
  '#hero-palette',
  '#hero-color-by',
  '#hero-shoreline',
  'button[type="reset"]',
];

const collatzControls = [
  '[data-settings-close]',
  '#hero-seed',
  '[data-hero-new]',
  '[data-hero-play]',
  '#hero-speed',
  '#hero-collatz-steps',
  '#hero-palette',
  'button[type="reset"]',
];

for (const { opener, mode, controls } of [
  { opener: 'Art settings', mode: 'rising', controls: risingControls },
  { opener: 'Animation settings', mode: 'collatz', controls: collatzControls },
]) {
  test(`modal Settings tab order wraps in both directions from ${opener}`, async ({ page }) => {
    await page.goto(`/?mode=${mode}`);
    await expect(page.locator('#hero-mode')).toBeEnabled();
    const button = page.getByRole('button', { name: opener, exact: true });
    const panel = page.getByRole('dialog', { name: 'Art settings' });
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press('Enter');
    const title = panel.getByRole('heading', { name: 'Art settings' });
    await expect(title).toBeFocused();

    // The first keyboard move can start in either direction from the title.
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'Reset' })).toBeFocused();
    await title.focus();

    // Check each stop so a loop that skips buttons or enters hidden controls fails.
    for (const selector of [...controls, controls[0]]) {
      await page.keyboard.press('Tab');
      await expect(panel.locator(selector)).toBeFocused();
    }
    for (const selector of [...controls].reverse()) {
      await page.keyboard.press('Shift+Tab');
      await expect(panel.locator(selector)).toBeFocused();
    }

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });
}
