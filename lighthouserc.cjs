// Lighthouse CI against the static build. Uses Playwright's Chromium unless
// CHROME_PATH is set. Budgets come from spec §7.
const { chromium } = require('playwright-core');

const chromePath = process.env.CHROME_PATH || chromium.executablePath();

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      chromePath,
      numberOfRuns: 1,
      url: (process.env.LHCI_URLS || '/,/404.html')
        .split(',')
        .map((p) => `http://localhost${p}`),
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:performance': ['warn', { minScore: 0.9 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
