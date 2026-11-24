import { defineConfig, devices } from '@playwright/test';

// The checker runs e2e against `astro preview` on port 4321, one run at a time.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4321 --ignore-lock',
    url: 'http://localhost:4321/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
