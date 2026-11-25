const { chromium } = require('playwright-core');
module.exports = { ci: {
  collect: {
    staticDistDir: './dist', chromePath: chromium.executablePath(),
    numberOfRuns: 4, url: ['http://localhost/','http://localhost/?mode=rivers&seed=42'],
    settings: { chromeFlags: '--headless=new --no-sandbox' },
  },
  upload: { target: 'filesystem', outputDir: './docs/checks/F14/attempt-1/lh' },
}};
