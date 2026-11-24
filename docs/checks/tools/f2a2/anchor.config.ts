import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'anchor-mutation.spec.ts', workers: 1, reporter: 'list',
  outputDir: '/Users/andrewchincea/personalPortfolio/docs/checks/tools/f2a2/.pw',
  use: { baseURL: 'http://localhost:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
