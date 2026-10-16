/**
 * Forwarding policy shared by the authenticated `/api/preview` proxy and the
 * public `/api/preview-share/:token` proxy (0136 R03).
 *
 * Both used to build the upstream URL as `new URL(incomingPath, previewUrl)`.
 * A path is not a safe first argument there: `//destination.invalid/fixture`
 * is protocol-relative, so it replaces the origin entirely. The review
 * reproduced it against a live share — the proxy called
 * `http://destination.invalid/fixture`, forwarded the POST body, and carried
 * the incoming `Cookie` and `Authorization` headers to that address. That is
 * an SSRF primitive plus credential forwarding.
 *
 * The rules here are:
 *
 *   - the upstream origin is pinned to the recorded preview URL; only the
 *     path and query travel, and a request that would move the origin is
 *     refused rather than rewritten;
 *   - a read-only share may use GET/HEAD only;
 *   - client credentials never leave the editor: Cookie, Authorization, the
 *     service token and the share password are dropped, as are the share
 *     proxy's own query parameters.
 */

export const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** Never forwarded upstream: these authenticate the caller to *us*. */
export const CREDENTIAL_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-sber-designer-service-token',
  'x-sber-designer-user',
  'x-sber-designer-sandbox-token',
  'x-share-password',
]);

/** Query parameters the share surface consumes itself. */
export const SERVICE_QUERY_PARAMS = ['p', 'share_password'] as const;

export const READ_ONLY_METHODS = new Set(['GET', 'HEAD']);

export interface UpstreamRequestInput {
  /** Recorded sandbox origin, e.g. `http://localhost:54321`. */
  upstreamBase: string;
  /** Path after the proxy prefix, as it arrived. */
  incomingPath: string;
  /** Raw request URL, used to lift the query string. */
  requestUrl: string;
  /** Read-only surfaces refuse anything but GET/HEAD. */
  readOnly?: boolean;
}

export type UpstreamRefusal =
  | { ok: false; reason: 'bad_upstream' }
  | { ok: false; reason: 'origin_escape' }
  | { ok: false; reason: 'method_not_allowed' };

export type UpstreamDecision = { ok: true; url: URL } | UpstreamRefusal;

export function buildUpstreamUrl(input: UpstreamRequestInput): UpstreamDecision {
  let base: URL;
  try {
    base = new URL(input.upstreamBase);
  } catch {
    return { ok: false, reason: 'bad_upstream' };
  }

  const target = new URL(base.toString());
  target.pathname = normalizeForwardPath(input.incomingPath);
  target.search = forwardedSearch(input.requestUrl);
  target.hash = '';

  // Belt and braces: whatever the input did, the origin must not have moved.
  if (target.origin !== base.origin || target.host !== base.host) {
    return { ok: false, reason: 'origin_escape' };
  }
  return { ok: true, url: target };
}

/**
 * Collapse anything that could read as an authority into a plain path.
 * `//host/x`, `/\host/x` and `/%2f%2fhost/x` all become a path under the
 * pinned origin.
 */
export function normalizeForwardPath(incomingPath: string): string {
  const withoutBackslashes = incomingPath.replace(/\\/gu, '/');
  const single = `/${withoutBackslashes.replace(/^\/+/u, '')}`;
  // A percent-encoded leading slash pair is the encoded form of the same
  // protocol-relative trick; decode just that prefix and collapse again.
  const decodedPrefix = single.replace(/^\/(?:%2f)+/iu, '/');
  return decodedPrefix;
}

function forwardedSearch(requestUrl: string): string {
  const queryStart = requestUrl.indexOf('?');
  if (queryStart === -1) return '';
  const params = new URLSearchParams(requestUrl.slice(queryStart + 1));
  for (const name of SERVICE_QUERY_PARAMS) params.delete(name);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function isAllowedProxyMethod(method: string, readOnly: boolean): boolean {
  return readOnly ? READ_ONLY_METHODS.has(method.toUpperCase()) : true;
}

/** Request headers that may travel to the sandbox dev-server. */
export function buildForwardHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  // Snapshot the names: deleting while iterating a live Headers iterator can
  // skip entries, which is exactly how a credential header would survive.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const name of [...headers.keys()]) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || CREDENTIAL_HEADERS.has(lower)) headers.delete(name);
  }
  headers.delete('host');
  return headers;
}

/**
 * Response headers that may travel back. The preview is rendered on the
 * editor's own origin, so upstream must not be able to set cookies there or
 * have its payload sniffed into a different type.
 */
export function buildResponseHeaders(source: Headers, options: { publicShare: boolean }): Headers {
  const headers = new Headers(source);
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const name of [...headers.keys()]) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) headers.delete(name);
  }
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('set-cookie');
  headers.delete('clear-site-data');
  if (options.publicShare) {
    // An opaque document origin prevents preview scripts from reading the
    // editor's cookies, storage or authenticated API. Module assets remain
    // loadable through anonymous CORS on this token-scoped surface.
    headers.set(
      'content-security-policy',
      'sandbox allow-scripts allow-forms allow-modals allow-popups',
    );
    headers.set('access-control-allow-origin', '*');
    headers.delete('access-control-allow-credentials');
    headers.set('x-content-type-options', 'nosniff');
  }
  return headers;
}
