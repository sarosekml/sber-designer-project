/**
 * /api/preview-share/:token/* — public reverse proxy in front of a
 * sandbox dev-server, addressed by share token (Phase 6.1).
 *
 * Until now Share embedded the raw `http://localhost:<random>` URL,
 * which only works for recipients on the same host. With the proxy
 * the editor's api becomes the single ingress: the recipient's
 * browser hits `<api-origin>/api/preview-share/<token>/...`, the
 * api looks up the share's recorded previewUrl, and forwards the
 * request to the dev-server. As long as the api is reachable, the
 * share is reachable.
 *
 * Public — the token is the access control. Tracked in audit but
 * without a `requireUser` header. Because it is public, forwarding is
 * governed by ./preview-proxy-policy (0136 R03): the upstream origin is
 * pinned, only GET/HEAD are accepted, and client credentials never leave
 * the editor.
 *
 * Limitations (acceptable for MVP):
 * - HTTP only (no WebSocket upgrade) — Storybook's HMR doesn't
 *   reach the recipient. Read-only walking of the prototype works
 *   without HMR.
 * - Streaming responses are buffered through fetch (no chunked
 *   transfer pass-through). Storybook assets are small enough
 *   that this isn't visible.
 */
import { Hono } from 'hono';

import { audit } from '../audit';
import { injectPreviewBridge, rewriteRootUrls } from './preview';
import {
  buildForwardHeaders,
  buildResponseHeaders,
  buildUpstreamUrl,
  isAllowedProxyMethod,
} from './preview-proxy-policy';
import { getShare, verifySharePassword } from '../share-store';

export const previewShareRouter = new Hono().all('/:token/*', async (c) => {
  const token = c.req.param('token');
  const snapshot = getShare(token);
  if (!snapshot) {
    return c.json({ error: 'not_found_or_expired' }, 404);
  }
  if (!snapshot.previewUrl) {
    return c.json(
      {
        error: 'no_preview',
        detail:
          'This share has no live previewUrl. Re-create the share while the sandbox is running.',
      },
      503,
    );
  }

  // Phase 6.3 — same password gate as GET /api/share/:token. Header
  // takes precedence; ?p= query param is a fallback for iframes /
  // <img> requests where the embedder can't set headers.
  const supplied = c.req.header('x-share-password') ?? c.req.query('p');
  const verdict = verifySharePassword(token, supplied);
  if (verdict === 'forbidden') {
    return c.json({ error: 'invalid_password' }, 401);
  }

  // A share is a read-only walk through a prototype. Anything that could
  // change state upstream is refused here rather than filtered downstream.
  if (!isAllowedProxyMethod(c.req.method, true)) {
    return c.json(
      { error: 'method_not_allowed', detail: 'Shared previews are read-only (GET/HEAD).' },
      405,
    );
  }

  // Path after `/api/preview-share/<token>/` is the request to forward.
  const incomingPath =
    c.req.path.replace(`/api/preview-share/${encodeURIComponent(token)}`, '') || '/';
  const decision = buildUpstreamUrl({
    upstreamBase: snapshot.previewUrl,
    incomingPath,
    requestUrl: c.req.url,
    readOnly: true,
  });
  if (!decision.ok) {
    audit({
      kind: 'error',
      user: 'share',
      errorMessage: `preview-share refused ${decision.reason} path=${incomingPath.slice(0, 120)}`,
    });
    return c.json(
      { error: 'forbidden_path', detail: 'Shared previews only serve paths of their own sandbox.' },
      400,
    );
  }
  const forwardedUrl = decision.url;

  const init: RequestInit = {
    method: c.req.method,
    headers: buildForwardHeaders(c.req.raw.headers),
    redirect: 'manual',
  };

  let upstream: Response;
  try {
    upstream = await fetch(forwardedUrl, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit({
      kind: 'error',
      user: 'share',
      errorMessage: `preview-share fetch ${forwardedUrl.toString().slice(0, 200)}: ${message}`,
    });
    return c.json(
      {
        error: 'preview_unreachable',
        detail:
          "Sandbox dev-server didn't respond. The session may have stopped — re-create the share.",
      },
      502,
    );
  }

  // The recipient's browser is on the editor's origin, so the response just
  // needs to look same-origin — and must not be able to set cookies there.
  const respHeaders = buildResponseHeaders(upstream.headers, { publicShare: true });

  if (c.req.method === 'HEAD' || [204, 205, 304].includes(upstream.status)) {
    return new Response(null, { status: upstream.status, headers: respHeaders });
  }

  const proxyPrefix = `/api/preview-share/${encodeURIComponent(token)}`;
  const contentType = respHeaders.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    respHeaders.set('content-type', contentType);
    return new Response(injectPreviewBridge(rewriteRootUrls(html, proxyPrefix)), {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  if (
    contentType.includes('javascript') ||
    contentType.includes('text/css') ||
    contentType.includes('application/json')
  ) {
    const text = await upstream.text();
    respHeaders.set('content-type', contentType);
    return new Response(rewriteRootUrls(text, proxyPrefix), {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
});
