// Checker-only wrapper: same as playwright.config.ts but starts preview with
// --ignore-lock so Astro 7 doesn't auto-background it under an agent (which makes
// Playwright's webServer "exit early").
import path from 'node:path';
import base from '../../../playwright.config';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
export default {
  ...base,
  testDir: path.join(root, 'e2e'),
  outputDir: path.join(root, 'docs/checks/tools/.pw-results'),
  reporter: [['list']],
  webServer: { ...base.webServer, cwd: root, command: 'npm run preview -- --port 4321 --ignore-lock' },
};
