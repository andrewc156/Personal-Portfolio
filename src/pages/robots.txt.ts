/**
 * robots.txt (spec §5). Generated at build time so the sitemap URL is absolute and
 * comes from SITE_URL (via `site` in astro.config.mjs), like every other absolute URL.
 */
import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(withBase('/sitemap-index.xml'), site ?? 'http://localhost:4321').href;
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
