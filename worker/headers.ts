/**
 * Parses Cloudflare's `_headers` format and resolves the headers for a path, with the
 * same semantics Cloudflare applies to static assets
 * (https://developers.cloudflare.com/workers/static-assets/headers/):
 * - a rule is an unindented URL pattern followed by indented `Name: value` lines;
 * - `*` is a splat that matches anything (including `/`);
 * - every matching rule applies, in file order; a header set by two matching rules
 *   is joined with ", "; `! Name` removes a header set by an earlier rule or by the
 *   asset server.
 *
 * Only path patterns are supported (`/…`); absolute-URL patterns and `:placeholder`
 * segments throw, so a template change the Worker can't honour fails the deploy
 * instead of silently dropping headers.
 */

export interface HeaderRule {
  pattern: string;
  regex: RegExp;
  set: [name: string, value: string][];
  unset: string[];
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let current: HeaderRule | undefined;
  text.split(/\r?\n/).forEach((line, i) => {
    const where = `_headers line ${i + 1}`;
    if (!line.trim() || line.trim().startsWith('#')) return;
    if (!/^\s/.test(line)) {
      const pattern = line.trim();
      if (!pattern.startsWith('/')) throw new Error(`${where}: only path patterns are supported`);
      if (/\/:[A-Za-z]/.test(pattern)) throw new Error(`${where}: placeholders are unsupported`);
      current = { pattern, regex: patternToRegex(pattern), set: [], unset: [] };
      rules.push(current);
      return;
    }
    if (!current) throw new Error(`${where}: header line before any URL pattern`);
    const body = line.trim();
    if (body.startsWith('!')) {
      current.unset.push(body.slice(1).trim().toLowerCase());
      return;
    }
    const colon = body.indexOf(':');
    if (colon < 1) throw new Error(`${where}: expected "Name: value"`);
    current.set.push([body.slice(0, colon).trim().toLowerCase(), body.slice(colon + 1).trim()]);
  });
  return rules;
}

export interface ResolvedHeaders {
  /** Header name (lower case) → final value. */
  set: Map<string, string>;
  /** Headers to delete from the upstream response (`! Name`). */
  unset: Set<string>;
}

export function headersForPath(rules: HeaderRule[], pathname: string): ResolvedHeaders {
  const set = new Map<string, string>();
  const unset = new Set<string>();
  for (const rule of rules) {
    if (!rule.regex.test(pathname)) continue;
    for (const name of rule.unset) {
      set.delete(name);
      unset.add(name);
    }
    for (const [name, value] of rule.set) {
      const prev = set.get(name);
      set.set(name, prev === undefined ? value : `${prev}, ${value}`);
      unset.delete(name);
    }
  }
  return { set, unset };
}

/**
 * Parses a generated dist/_headers and checks it is safe to serve with: no template
 * marker left behind and a Content-Security-Policy on `/*`. Throws otherwise.
 */
export function loadHeaderRules(text: string): HeaderRule[] {
  if (/__INLINE_[A-Z_]+__/.test(text)) {
    throw new Error('_headers still has template markers; run `npm run build` first');
  }
  const rules = parseHeadersFile(text);
  const csp = rules.some(
    (r) => r.pattern === '/*' && r.set.some(([name]) => name === 'content-security-policy'),
  );
  if (!csp) throw new Error('_headers has no Content-Security-Policy on /*');
  return rules;
}
