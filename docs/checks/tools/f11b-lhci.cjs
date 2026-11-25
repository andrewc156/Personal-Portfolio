const { chromium } = require('playwright-core');
const path = require('node:path');
module.exports = { ci: {
  collect: { staticDistDir: path.resolve('dist'), chromePath: chromium.executablePath(),
    numberOfRuns: 4, url: ['http://localhost/'],
    settings: { chromeFlags: '--headless=new --no-sandbox' }},
  upload: { target: 'filesystem', outputDir: path.resolve('docs/checks/F11b/attempt-1/lh') },
}};
