import { defineConfig, devices } from '@playwright/test';

// The checker runs e2e against `astro preview` on port 4321, one run at a time.
// With HEADERS_BASE_URL (headers spec under wrangler) or PW_BASE_URL (a builder's
// dev server on 44NN), the tests target that server and no preview is started.
const external = process.env.HEADERS_BASE_URL || process.env.PW_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'webkit',
      testMatch: '**/select-controls.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: 'npm run preview -- --port 4321 --ignore-lock',
        url: 'http://localhost:4321/',
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
