import { expect, test, type Locator } from '@playwright/test';

async function waitForOpen(panel: Locator): Promise<void> {
  await expect(panel.locator('#settings-title')).toBeFocused();
  await panel.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished));
  });
}

async function holdNextExit(panel: Locator): Promise<void> {
  await panel.evaluate((el) => {
    // Pause in the close event's task so the exit cannot finish before the next input.
    el.addEventListener(
      'settings:toggle',
      () => {
        for (const animation of el.getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect?.getTiming().duration) / 2;
        }
      },
      { once: true },
    );
  });
}

async function expectMidExit(panel: Locator): Promise<void> {
  expect(
    await panel.evaluate((el) => ({
      hidden: (el as HTMLElement).hidden,
      display: getComputedStyle(el).display,
      sliding: el
        .getAnimations()
        .some(
          (animation) =>
            animation instanceof CSSTransition &&
            animation.transitionProperty === 'transform' &&
            animation.playState === 'paused',
        ),
    })),
  ).toEqual({ hidden: true, display: 'flex', sliding: true });
}

async function resumeExit(panel: Locator): Promise<void> {
  await panel.evaluate((el) => {
    for (const animation of el.getAnimations()) animation.play();
  });
  await expect(panel).toHaveCSS('display', 'none');
}

for (const { width, height } of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test(`closing Settings keeps Tab outside the visible exit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?mode=rising');
    const gear = page.getByRole('button', { name: 'Art settings', exact: true });
    const panel = page.locator('#settings-panel');
    const mode = page.locator('#hero-mode');
    await expect(gear).toBeEnabled();
    await expect(mode).toBeEnabled();
    await expect(panel).toHaveJSProperty('inert', true);

    // The sheet makes the gear inert while open, so only the drawer closes via the gear.
    const methods = width === 1280 ? ['Escape', 'close', 'gear'] : ['Escape', 'close'];
    for (const method of methods) {
      await gear.click();
      await waitForOpen(panel);
      await expect(panel).toHaveJSProperty('inert', false);
      await holdNextExit(panel);
      if (method === 'Escape') await page.keyboard.press('Escape');
      else if (method === 'gear') await gear.click();
      else await panel.getByRole('button', { name: 'Close art settings' }).click();
      await expect(gear).toBeFocused();

      await expectMidExit(panel);
      await page.keyboard.press('Tab');
      await expect(mode).toBeFocused();
      await expectMidExit(panel);
      await expect(panel).toHaveJSProperty('inert', true);

      await panel.locator('#hero-seed').evaluate((input: HTMLInputElement) => input.focus());
      await expect(mode).toBeFocused();
      await resumeExit(panel);
    }
  });
}

test('the scrolled header stays pinned until the wide drawer finishes closing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  const panel = page.locator('#settings-panel');
  const header = page.locator('.site-header');
  await gear.click();
  await waitForOpen(panel);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await expect(header).toBeInViewport();
  await holdNextExit(panel);

  await page.keyboard.press('Escape');
  await expectMidExit(panel);
  await expect(gear).toHaveAttribute('aria-expanded', 'false');
  await expect(header).toHaveCSS('position', 'sticky');
  await expect(header).toBeInViewport();

  await resumeExit(panel);
  await expect(header).toHaveCSS('position', 'static');
  await expect(header).not.toBeInViewport();
});

test('reopening the drawer retains the pin and a theme change ends a later exit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  const panel = page.locator('#settings-panel');
  const header = page.locator('.site-header');
  await gear.click();
  await waitForOpen(panel);
  await holdNextExit(panel);

  await page.keyboard.press('Escape');
  await expectMidExit(panel);
  await gear.click();
  await waitForOpen(panel);
  await expect(header).toHaveCSS('position', 'sticky');

  await holdNextExit(panel);
  await page.keyboard.press('Escape');
  await expectMidExit(panel);
  await page.locator('[data-theme-toggle]').click();
  await expect(panel).toHaveCSS('display', 'none');
  await expect(header).toHaveCSS('position', 'static');
});

test('reduced motion releases the header immediately on close', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Art settings', exact: true });
  await gear.click();
  await expect(page.locator('.site-header')).toHaveCSS('position', 'sticky');
  const closed = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-settings-toggle]')!;
    const panel = document.querySelector('#settings-panel')!;
    const header = document.querySelector('.site-header')!;
    trigger.click();
    return {
      display: getComputedStyle(panel).display,
      position: getComputedStyle(header).position,
    };
  });
  expect(closed).toEqual({ display: 'none', position: 'static' });
});
