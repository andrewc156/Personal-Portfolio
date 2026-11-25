// CI1 checker: Lighthouse mobile on / only, writes under docs/checks.
const { chromium } = require('/Users/andrewchincea/personalPortfolio/node_modules/playwright-core');
module.exports = { ci: {
  collect: { staticDistDir: '/Users/andrewchincea/personalPortfolio/dist', chromePath: chromium.executablePath(), numberOfRuns: 3,
    url: ['http://localhost/'], settings: { chromeFlags: '--headless=new --no-sandbox' } },
  assert: { assertions: {
    'categories:accessibility': ['error', { minScore: 0.95 }], 'categories:best-practices': ['error', { minScore: 0.95 }],
    'categories:seo': ['error', { minScore: 0.95 }], 'categories:performance': ['error', { minScore: 0.9 }],
    'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }] } },
  upload: { target: 'filesystem', outputDir: '/Users/andrewchincea/personalPortfolio/docs/checks/CI1/attempt-1/lhci' } } };
