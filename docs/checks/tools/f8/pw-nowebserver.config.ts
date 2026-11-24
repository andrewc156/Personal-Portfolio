import { defineConfig, devices } from '@playwright/test';
// F8 checker: run e2e/headers.spec.ts against wrangler, no webServer.
export default defineConfig({
  testDir: '../../../../e2e',
  testMatch: /headers\.spec\.ts/,
  outputDir: '../.pw-results',
  workers: 1,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
