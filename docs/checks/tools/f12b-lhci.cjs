const { chromium } = require('playwright-core');

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      chromePath: chromium.executablePath(),
      numberOfRuns: 4,
      url: ['http://localhost/rising-water/'],
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
  },
};
