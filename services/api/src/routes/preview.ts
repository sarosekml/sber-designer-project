/**
 * /api/preview/* — editor-only reverse proxy for the active sandbox preview.
 *
 * The editor runs on :5173 and Storybook usually runs on a random port,
 * so direct iframe DOM access is cross-origin. This proxy injects a tiny
 * postMessage bridge into HTML responses. DomOverlay can then hit-test the
 * real iframe DOM without relying on `iframe.contentDocument`.
 *
 * 0136 R12 — this file is the route shell. The pieces it composes:
 *   ./preview-proxy-policy   what may be forwarded, and to where
 *   ./preview-bridge         bridge injection + root-URL rewriting
 *   ./preview-bridge-script  the injected browser script itself
 *
 * `injectPreviewBridge` and `rewriteRootUrls` are re-exported here so the
 * existing import path keeps working for preview-share and for tests.
 */
import { Hono } from 'hono';

import { getState } from '../state-store';
import { injectPreviewBridge, rewriteRootUrls } from './preview-bridge';
import {
  buildForwardHeaders,
  buildResponseHeaders,
  buildUpstreamUrl,
} from './preview-proxy-policy';

export { injectPreviewBridge, rewriteRootUrls } from './preview-bridge';

export const previewRouter = new Hono().all('/*', async (c) => {
  const previewUrl = getState().canvasUrl;
  if (!previewUrl) {
    return c.json({ error: 'no_preview', detail: 'No active sandbox previewUrl.' }, 503);
  }
  if (isSelfReferentialPreviewUrl(previewUrl)) {
    // canvasUrl points back at this proxy → forwarding would loop to our own
    // origin and 404 every request (task 9999 LIVE-2). Fail loud, not silent.
    return c.json(
      {
        error: 'preview_self_reference',
        detail:
          'Active canvasUrl points at the preview proxy itself, not a sandbox origin. Reconnect the project so the canvas resolves to the running Storybook.',
      },
      503,
    );
  }

  const incomingPath = c.req.path.replace('/api/preview', '') || '/';
  // 0136 R03 — same origin pinning as the public share proxy. The
  // authenticated surface is writable, so methods are not restricted, but the
  // upstream origin still cannot be moved by the request path.
  const decision = buildUpstreamUrl({
    upstreamBase: previewUrl,
    incomingPath,
    requestUrl: c.req.url,
  });
  if (!decision.ok) {
    return c.json(
      { error: 'forbidden_path', detail: 'Preview only serves paths of the active sandbox.' },
      400,
    );
  }
  const forwardedUrl = decision.url;

  const init: RequestInit = {
    method: c.req.method,
    headers: buildForwardHeaders(c.req.raw.headers),
    redirect: 'manual',
  };
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    init.body = await c.req.raw.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(forwardedUrl, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'preview_unreachable', detail: message }, 502);
  }

  const respHeaders = buildResponseHeaders(upstream.headers, { publicShare: false });

  const contentType = respHeaders.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    respHeaders.set('content-type', contentType);
    return new Response(injectPreviewBridge(rewriteRootUrls(html)), {
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
    return new Response(rewriteRootUrls(text), {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
});

/**
 * A canvasUrl that itself targets `/api/preview` makes this proxy forward to its
 * own origin (the API), 404-ing every request (task 9999 LIVE-2). The proxy
 * target must be a sandbox origin (e.g. `http://localhost:<port>`), never the
 * proxied iframe URL the editor displays.
 */
export function isSelfReferentialPreviewUrl(previewUrl: string): boolean {
  try {
    const path = new URL(previewUrl).pathname.replace(/\/+$/u, '');
    return path === '/api/preview' || path.startsWith('/api/preview/');
  } catch {
    return false;
  }
}
