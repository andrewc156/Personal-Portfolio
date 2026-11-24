// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Every absolute URL comes from SITE_URL (spec §7). Local builds without it
// fall back to the preview server so canonical/sitemap URLs stay well-formed.
const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
