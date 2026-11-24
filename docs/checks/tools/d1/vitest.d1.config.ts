import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: process.env.VBASE || '/',
  test: { root: '/Users/andrewchincea/personalPortfolio', include: ['docs/checks/tools/d1/*.test.ts'], environment: 'node' },
});
