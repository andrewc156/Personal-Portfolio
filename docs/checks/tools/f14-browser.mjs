import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] || 'http://localhost:4321';
const artifact = 'docs/checks/F14/attempt-1';
const cspOnly = process.argv.includes('--csp');
const modes = [
  ['rising','Rising water'], ['dye','Dye spill'], ['pond','Fractal pond'],
  ['rivers','Random rivers'], ['collatz','Collatz delta'],
];
const browser = await chromium.launch();
async function loaded(page, mode) {
  await page.waitForFunction(
    (target) => {
      const h = document.querySelector('[data-hero]');
      return h?.dataset.mode === target && (target === 'rising' ? h.__hero : h.__heroMode);
    }, mode,
  );
}
async function openPage(context, url) {
  const page = await context.newPage();
  const errors = [];
  const foreign = new Set();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== base) foreign.add(url.origin);
  });
  await page.addInitScript(() => {
    window.cspErrors = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.cspErrors.push(e.violatedDirective);
    });
  });
  await page.goto(base + url);
  const select = page.getByLabel('Animation', { exact: true });
  const primary = page.getByRole('button', { name:'Animation settings', exact:true });
  const gear = page.getByRole('button', { name:'Art settings', exact:true });
  const panel = page.locator('#settings-panel');
  await expect(select).toBeEnabled();
  await expect(primary).toBeEnabled();
  return { page, errors, foreign, select, primary, gear, panel };
}
async function checkSettings(ui, open) {
  const { primary, gear, panel } = ui;
  await expect(primary).toHaveAttribute('aria-controls', 'settings-panel');
  await expect(gear).toHaveAttribute('aria-controls', 'settings-panel');
  for (const control of [primary, gear]) {
    await expect(control).toHaveAttribute('aria-expanded', String(open));
  }
  await expect(panel).toBeVisible({ visible: open });
}
async function noErrors(ui) {
  assert.deepEqual(ui.errors, []);
  assert.deepEqual([...ui.foreign], []);
  assert.deepEqual(await ui.page.evaluate(() => window.cspErrors), []);
}

try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }, reducedMotion: 'reduce',
  });
  const ui = await openPage(context, '/?mode=dye&seed=42');
  const { page, select, panel, primary, gear } = ui;
  await loaded(page, 'dye');
  await expect(select).toHaveValue('dye');
  assert.deepEqual(await select.locator('option').evaluateAll((options) =>
    options.map((option) => [option.value, option.textContent.trim()])), modes);
  assert.equal(await panel.getByLabel('Animation', { exact:true }).count(), 0);
  for (const [id] of modes) {
    await select.selectOption(id);
    await loaded(page, id);
    await expect(select).toHaveValue(id);
  }
  await checkSettings(ui, false);
  await primary.focus();
  await page.keyboard.press('Enter');
  await checkSettings(ui, true);
  await expect(panel.getByRole('heading')).toBeFocused();
  await panel.getByRole('button', { name: 'Reset', exact: true }).click();
  await loaded(page, 'rising');
  await expect(select).toHaveValue('rising');
  await page.keyboard.press('Escape');
  await checkSettings(ui, false);
  await expect(primary).toBeFocused();
  await gear.focus();
  await page.keyboard.press('Space');
  await checkSettings(ui, true);
  await panel.getByRole('button', { name: 'Close art settings' }).click();
  await checkSettings(ui, false);
  await expect(gear).toBeFocused();
  await primary.click();
  await page.reload();
  await expect(select).toBeEnabled();
  await checkSettings(ui, true);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(select).toBeEnabled();
  await checkSettings(ui, false);
  await noErrors(ui);
  console.log('Five modes, direct load, Reset, both triggers, keyboard focus, localStorage, CSP and network checks pass.');
  await context.close();
  if (!cspOnly) {
    const noJS = await browser.newContext({ javaScriptEnabled:false, viewport:{ width:320, height:740 }});
    const staticPage = await noJS.newPage();
    await staticPage.goto(base + '/');
    await expect(staticPage.getByLabel('Animation', { exact:true })).toBeDisabled();
    await expect(staticPage.getByRole('button', { name:'Animation settings' })).toBeDisabled();
    await expect(staticPage.locator('.hero__fallback')).toBeVisible();
    await expect(staticPage.locator('#settings-panel')).toBeHidden();
    console.log('No-JS fallback visible with native controls disabled.');
    await noJS.close();
    for (const [width, height] of [[320,740],[375,812],[768,1024],[1280,800]]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport:{ width, height }, colorScheme:theme, reducedMotion:'reduce' });
        const ui = await openPage(context, '/?seed=42');
        const { page, select, primary } = ui;
        await loaded(page, 'rising');
        await page.evaluate(() => document.fonts.ready);
        const bounds = await page.locator('.hero__toolbar').evaluate((bar) => {
          const bounds = (el) => {
            const {x,y,width,height,right,bottom} = el.getBoundingClientRect();
            return {x,y,width,height,right,bottom};
          };
          return {
            toolbar:bounds(bar), label:bounds(bar.querySelector('label')),
            select:bounds(bar.querySelector('select')), button:bounds(bar.querySelector('button')),
            art:bounds(document.querySelector('[data-hero]')),
            scrollWidth:document.documentElement.scrollWidth,
          };
        });
        const b = bounds;
        assert(b.scrollWidth <= width);
        assert(b.toolbar.bottom <= b.art.y);
        assert(b.label.right <= b.select.x && b.select.right <= b.button.x && b.button.right <= width);
        for (const node of [b.label,b.select,b.button]) {
          assert(node.y >= b.toolbar.y && node.bottom <= b.toolbar.bottom);
        }
        assert(Math.abs(b.select.y - b.button.y) < 1);
        assert(Math.min(b.select.height,b.button.height) >= 44);
        const data = await page.locator('[data-hero-map]').evaluate((canvas) => {
          const sample = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          const colors = new Set();
          for (let i=0;i<sample.length;i+=64) colors.add(sample[i]+'-'+sample[i+1]+'-'+sample[i+2]);
          return colors.size;
        });
        assert(data > 3, 'canvas must contain visible content');
        await page.screenshot({ path:`${artifact}/home-${width}-${theme}-closed.png` });
        await primary.click();
        await checkSettings(ui,true);
        await expect(page.locator('#settings-title')).toBeFocused();
        const panelPaint = await ui.panel.evaluate(async (el) => {
          await Promise.allSettled(el.getAnimations().map((animation) => animation.finished));
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rect = el.getBoundingClientRect();
          return {opacity:getComputedStyle(el).opacity,x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom};
        });
        assert.equal(panelPaint.opacity, '1');
        assert(panelPaint.x >= -1 && panelPaint.y >= -1);
        assert(panelPaint.right <= width + 1 && panelPaint.bottom <= height + 1);
        await page.screenshot({ path:`${artifact}/home-${width}-${theme}-open.png` });
        const axe = await new AxeBuilder({ page }).analyze();
        const serious = axe.violations.filter((finding) => ['serious','critical'].includes(finding.impact));
        assert.deepEqual(serious.map(({ id }) => id), [], JSON.stringify(serious));
        await noErrors(ui);
        console.log(JSON.stringify({ width,theme,touchTargets:[b.select.height,b.button.height],canvasColors:data,axe:axe.violations.map(({ id }) => id) }));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
