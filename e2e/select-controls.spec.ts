import { expect, test, type Locator } from '@playwright/test';

async function expectAlignedControls(select: Locator, button: Locator, height: number) {
  const [field, action] = await Promise.all([select.boundingBox(), button.boundingBox()]);
  expect(field).not.toBeNull();
  expect(action).not.toBeNull();
  const selectRect = field!;
  const buttonRect = action!;

  expect(Math.abs(selectRect.height - height)).toBeLessThanOrEqual(1);
  expect(Math.abs(selectRect.height - buttonRect.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(selectRect.y - buttonRect.y)).toBeLessThanOrEqual(1);
  const selectBottom = selectRect.y + selectRect.height;
  const buttonBottom = buttonRect.y + buttonRect.height;
  expect(Math.abs(selectBottom - buttonBottom)).toBeLessThanOrEqual(1);
}

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test('Animation and Settings controls align in the hero toolbar', async ({ page }) => {
      await page.goto('/');
      const animation = page.getByRole('combobox', { name: 'Animation', exact: true });
      const settings = page.getByRole('button', { name: 'Animation settings', exact: true });
      await expect(animation).toBeEnabled();
      await expect(settings).toBeEnabled();
      await expectAlignedControls(animation, settings, 44);
      const heroGear = settings.locator('svg');
      const headerGear = page
        .getByRole('button', { name: 'Art settings', exact: true })
        .locator('svg');
      for (const gear of [heroGear, headerGear]) {
        await expect(gear).toHaveCSS('width', '20px');
        await expect(gear).toHaveCSS('height', '20px');
      }

      await settings.click();
      const palette = page.getByRole('combobox', { name: 'Palette', exact: true });
      await expect(palette).toBeVisible();
      await expect(palette).toHaveCSS('height', '36px');
    });

    test('Speed and Pacing align with Play in the explorer', async ({ page }) => {
      await page.goto('/rising-water/');
      const controls = page.getByRole('form', { name: 'Explorer controls' });
      const play = controls.getByRole('button', { name: 'Play', exact: true });
      await expect(play).toBeEnabled();
      for (const name of ['Speed', 'Pacing']) {
        const select = controls.getByRole('combobox', { name, exact: true });
        await expect(select).toBeEnabled();
        await expectAlignedControls(select, play, 36);
      }
    });
  });
}
