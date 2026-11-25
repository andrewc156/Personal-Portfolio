// CI1 checker: run the repo's e2e specs against a preview of the scratch pre-fix build (port 4321).
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '../../../e2e',
  outputDir: '/private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/acaf7aa2-48fe-4f69-befb-0d96137cc7af/scratchpad/prefix-results',
  workers: 1,
  reporter: [['line']],
  use: { baseURL: 'http://localhost:4321', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx astro preview --port 4321 --ignore-lock',
    cwd: '/private/tmp/claude-501/-Users-andrewchincea-personalPortfolio/acaf7aa2-48fe-4f69-befb-0d96137cc7af/scratchpad/prefix',
    url: 'http://localhost:4321/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
