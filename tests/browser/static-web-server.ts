#!/usr/bin/env bun
/**
 * Serves `apps/web/dist` for the browser smoke (0136 R13) and proxies `/api`
 * and `/health` to the stack's api.
 *
 * This mirrors the deployed topology, where nginx serves the built app and
 * proxies the api on the same origin (deploy/nginx/sber-designer.conf). A
 * production build resolves its API base to `window.location.origin`, so
 * same-origin is what the bundle under test actually expects.
 *
 * Any unknown path falls back to index.html, so the app's pathname router
 * handles /projects and /edit/<id> on a hard reload.
 */
import { file } from 'bun';
import { join, normalize } from 'node:path';

const port = Number(process.env.SD_WEB_PORT ?? 3403);
const root = process.env.SD_WEB_ROOT ?? 'apps/web/dist';
const apiUrl = (process.env.SD_WEB_API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/u, '');

function isApiPath(pathname: string): boolean {
  return pathname === '/health' || pathname === '/api' || pathname.startsWith('/api/');
}

Bun.serve({
  port,
  hostname: '127.0.0.1',
  idleTimeout: 255,
  async fetch(request) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      const target = new URL(apiUrl);
      target.pathname = url.pathname;
      target.search = url.search;
      const headers = new Headers(request.headers);
      headers.delete('host');
      // Local auth mode identifies the caller by header; the browser cannot
      // set one on a navigation, so the proxy supplies the smoke identity.
      if (!headers.has('x-sber-designer-user')) headers.set('x-sber-designer-user', 'smoke');
      return fetch(target, {
        method: request.method,
        headers,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: await request.arrayBuffer() }),
        redirect: 'manual',
      });
    }

    const relative = normalize(url.pathname)
      .replace(/^(\.\.[/\\])+/u, '')
      .replace(/^\/+/u, '');
    const candidate = relative ? join(root, relative) : join(root, 'index.html');
    const asset = file(candidate);
    if (await asset.exists()) return new Response(asset);

    const index = file(join(root, 'index.html'));
    if (await index.exists()) {
      return new Response(index, { headers: { 'content-type': 'text/html' } });
    }
    return new Response('dist/ not built — run `bun run build` first', { status: 503 });
  },
});

process.stderr.write(`[smoke-web] serving ${root} on http://127.0.0.1:${port} → api ${apiUrl}\n`);
