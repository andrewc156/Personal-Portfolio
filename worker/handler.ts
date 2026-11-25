/**
 * Worker fetch handler for andrewchincea.com (F24, DECISIONS #88).
 *
 * wrangler.jsonc sets `assets.run_worker_first: true`, so every request reaches this
 * code first:
 * 1. `http://andrewchincea.com/…` and `http(s)://www.andrewchincea.com/…` get a 301 to
 *    `https://andrewchincea.com/…`, path and query preserved (QA-12). Other hosts
 *    (localhost, *.workers.dev, preview URLs) are never redirected.
 * 2. Everything else is passed to the static-asset binding unchanged (method, headers,
 *    If-None-Match/If-Modified-Since, Range), so HEAD, 304s, trailing-slash 307s and
 *    the branded 404 (`not_found_handling: "404-page"`) keep the asset server's status
 *    and body.
 * 3. Because Cloudflare does not apply `_headers` to responses that pass through
 *    Worker code, the rules from dist/_headers are applied here (set, not appended, so
 *    the asset server's default Cache-Control is replaced, never joined).
 */
import { headersForPath, type HeaderRule } from './headers';

export const APEX_HOST = 'andrewchincea.com';
export const WWW_HOST = `www.${APEX_HOST}`;

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetsBinding;
}

/** The canonical URL for a request on one of our hosts, or null if none is needed. */
export function canonicalRedirect(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const isWww = host === WWW_HOST;
  const isApex = host === APEX_HOST;
  if (!isWww && !isApex) return null;
  if (isApex && url.protocol === 'https:') return null;
  return `https://${APEX_HOST}${url.pathname}${url.search}`;
}

function withHeaders(response: Response, rules: HeaderRule[], pathname: string, skip: string[]) {
  const { set, unset } = headersForPath(rules, pathname);
  // Cloudflare's documented pattern for editing an upstream response: the copy keeps the
  // status, statusText, body stream and encoding, and its headers are mutable.
  const out = new Response(response.body, response);
  for (const name of unset) out.headers.delete(name);
  for (const [name, value] of set) if (!skip.includes(name)) out.headers.set(name, value);
  return out;
}

export function createHandler(rules: HeaderRule[]) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const location = canonicalRedirect(url);
      if (location) {
        const redirect = new Response(null, { status: 301, headers: { Location: location } });
        // Security headers too, but no per-path Cache-Control: a redirect is not the asset.
        return withHeaders(redirect, rules, url.pathname, ['cache-control']);
      }
      const response = await env.ASSETS.fetch(request);
      return withHeaders(response, rules, url.pathname, []);
    },
  };
}
