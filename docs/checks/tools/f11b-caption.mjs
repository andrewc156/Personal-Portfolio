import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ reducedMotion:'reduce',viewport:{width:375,height:812} });
  await page.goto(`${base}/?seed=42`);
  await page.waitForFunction(() => document.querySelector('[data-hero]')?.__hero);
  const caption = page.locator('[data-hero-caption]');
  console.log('Default visible caption:',await caption.innerText());
  await page.getByRole('button',{name:'Art settings',exact:true}).click();
  const panel=page.locator('#settings-panel');
  await panel.getByLabel('View',{exact:true}).selectOption('islands');
  const copy = panel.locator('[data-hero-islands-copy]');
  await copy.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  console.log('Visible setting copy:',await copy.innerText());
  await page.screenshot({path:'docs/checks/F11b/attempt-1/approved-copy-settings-375.png'});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  console.log('Panel open:',await panel.isVisible());
  console.log('Canvas label:',await page.locator('[data-hero-strip]').getAttribute('aria-label'));
  console.log('Islands-mode caption visible:',await caption.isVisible());
  console.log('Islands-mode caption:',await caption.innerText());
} finally {
  await browser.close();
}
