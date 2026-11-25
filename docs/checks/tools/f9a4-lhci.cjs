// F9 attempt 4: Lighthouse mobile, 4 runs per route (first discarded as warm-up). Checker-owned.
// Routes from F9A4_ROUTES (comma-separated). Results stay in .lighthouseci (parsed by f9a4_lh_summary.py).
const { chromium } = require('playwright-core');
const path = require('node:path');
const routes = (process.env.F9A4_ROUTES || '/').split(',');
module.exports = { ci: {
  collect: { staticDistDir: path.resolve('dist'), chromePath: chromium.executablePath(), numberOfRuns: 4,
    url: routes.map((r) => `http://localhost${r}`), settings: { chromeFlags: '--headless=new --no-sandbox' } },
}};
