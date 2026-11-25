// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Every absolute URL (canonical, og:url/og:image, sitemap, robots.txt) comes from `site`:
// 1. SITE_URL, when it is set for the *build* (spec §7);
// 2. otherwise, on Cloudflare's build machines, the production origin (DECISIONS #88).
//    Workers Builds sets WORKERS_CI=1 and Pages sets CF_PAGES=1. A runtime
//    "Variables & Secrets" SITE_URL never reaches `astro build`, which is how the
//    production build advertised localhost (F23 QA-01);
// 3. otherwise (local and e2e builds) the preview server origin, so the e2e suite can
//    check absolute URLs against the origin it is served from.
// scripts/write-headers.mjs fails a Cloudflare build that still emits localhost URLs.
const PRODUCTION_ORIGIN = 'https://andrewchincea.com';
const onCloudflareBuild = Boolean(process.env.WORKERS_CI || process.env.CF_PAGES);
const site =
  process.env.SITE_URL?.trim().replace(/\/+$/, '') ||
  (onCloudflareBuild ? PRODUCTION_ORIGIN : 'http://localhost:4321');

// Cloudflare serves from the domain root (base '/'). GitHub Pages served this
// project repo under a sub-path, so BASE_PATH=/Personal-Portfolio/ is still supported.
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
