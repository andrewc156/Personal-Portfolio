/**
 * Worker entry (wrangler.jsonc `main`). Wrangler bundles this file at deploy time,
 * after `npm run build`, and its `rules` entry imports dist/_headers as a text module,
 * so the Worker applies exactly the headers scripts/write-headers.mjs produced
 * (CSP with this build's hashes included). dist/_headers itself is never served:
 * Cloudflare parses it as configuration, not as an asset.
 */
import headersText from '../dist/_headers';
import { createHandler } from './handler';
import { loadHeaderRules } from './headers';

// Throws at startup (so `wrangler deploy` fails) rather than serve without a CSP.
export default createHandler(loadHeaderRules(headersText));
