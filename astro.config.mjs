// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Every absolute URL comes from SITE_URL (spec §7). Local builds without it
// fall back to the preview server so canonical/sitemap URLs stay well-formed.
const site = process.env.SITE_URL || 'http://localhost:4321';

// Cloudflare Pages serves from the domain root (base '/'). GitHub Pages serves
// this project repo under a sub-path, so its workflow sets BASE_PATH=/Personal-Portfolio/.
// Normalised to a leading and trailing slash.
const rawBase = process.env.BASE_PATH || '/';
const base = `/${rawBase.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
