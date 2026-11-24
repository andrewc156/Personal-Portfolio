import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  outputDir: '/private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/1f67abd1-ed51-4a07-9073-e87a4f7de7b0/scratchpad/f7-anchor-results',
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview -- --port 4321 --ignore-lock', cwd: '../../../..', url: 'http://localhost:4321/', reuseExistingServer: false, timeout: 120000 },
});
