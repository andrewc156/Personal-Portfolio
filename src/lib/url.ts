/**
 * Base-path support (DECISIONS #57–58). Cloudflare Pages serves the site from the domain
 * root (base '/'); GitHub Pages serves it under a sub-path such as '/Personal-Portfolio/'.
 * astro.config.mjs sets `base` from BASE_PATH, and Vite exposes it as
 * `import.meta.env.BASE_URL` both at build time and in client bundles.
 *
 * Content and code keep root-relative paths ('/garden/?tag=x', '/#mission'); every place
 * that renders or fetches one passes it through `withBase`.
 */

/** Normalise a base to a leading and trailing slash: '' | '/' → '/', 'a' → '/a/'. */
export function normalizeBase(base: string | undefined): string {
  const trimmed = (base ?? '').replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/** The site's base path, always with a leading and trailing slash. */
export const BASE: string = normalizeBase(import.meta.env.BASE_URL);

/**
 * Prefix a root-relative path with `base` (default: the configured base).
 * - '/garden/?tag=x' → '/Personal-Portfolio/garden/?tag=x'; '/#mission' → '/Personal-Portfolio/#mission'.
 * - Anything that is not root-relative is returned unchanged: absolute URLs ('https://…',
 *   'mailto:…'), protocol-relative ('//host/…'), relative paths, '#fragment', '?query', ''.
 * - Idempotent: a path that already starts with the base is returned unchanged.
 * With base '/', every input is returned unchanged.
 */
export function withBase(path: string, base: string = BASE): string {
  const b = normalizeBase(base);
  if (b === '/' || !path.startsWith('/') || path.startsWith('//')) return path;
  const bare = b.slice(0, -1); // '/Personal-Portfolio'
  if (
    path === bare ||
    path.startsWith(b) ||
    path.startsWith(`${bare}?`) ||
    path.startsWith(`${bare}#`)
  ) {
    return path;
  }
  return b + path.slice(1);
}

/**
 * Inverse of `withBase` for pathnames (e.g. `Astro.url.pathname`): '/Personal-Portfolio/cv/'
 * → '/cv/'. Paths outside the base are returned unchanged.
 */
export function stripBase(pathname: string, base: string = BASE): string {
  const b = normalizeBase(base);
  if (b === '/') return pathname;
  if (pathname === b.slice(0, -1)) return '/';
  return pathname.startsWith(b) ? `/${pathname.slice(b.length)}` : pathname;
}
