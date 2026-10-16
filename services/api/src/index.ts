/**
 * sber-designer api — Bun + Hono.
 *
 * Edge service between apps/web and the rest of the backend. Hosts the
 * resolved sber-designer.json, proxies LLM calls through llm-gateway,
 * proxies sandbox controller calls (Phase 1.8), and bridges proj-mcp to
 * the editor (events + state, ADR-0010).
 *
 * See ADR-0009.
 */
import { Hono } from 'hono';
import { websocket } from 'hono/bun';

import { adminRouter, authMode, authRouter, initializeAuth, requireUser } from './auth';
import {
  createApiAccessGuard,
  createApiCors,
  createCookieOriginCheck,
} from './auth/access-control';
import { invalidateCatalog } from './catalog-cache';
import { agentRuntimesRouter } from './routes/agent-runtimes';
import { agentRunsRouter } from './routes/agent-runs';
import { agentKitRouter } from './routes/agent-kit';
import { assetsRouter } from './routes/assets';
import { catalogRouter } from './routes/catalog';
import { chatRouter } from './routes/chat';
import { chatStreamRouter } from './routes/chat-stream';
import { configRouter } from './routes/config';
import { designContextRouter } from './routes/design-context';
import { designRouter } from './routes/design';
import { designIndexRouter } from './routes/design-index';
import { eventsRouter } from './routes/events';
import { filesRouter } from './routes/files';
import { htmlDesignSystemRouter } from './routes/html-design-system';
import { flowRouter } from './routes/flow';
import { fsRouter } from './routes/fs';
import { gitRouter } from './routes/git';
import { hostToolsRouter } from './routes/host-tools';
import { mcpRouter } from './routes/mcp';
import { patchRouter } from './routes/patch';
import { previewRouter } from './routes/preview';
import { previewShareRouter } from './routes/preview-share';
import { projectRouter } from './routes/project';
import { projectTemplatesRouter } from './routes/project-templates';
import { projectsRouter } from './routes/projects';
import { sandboxRouter } from './routes/sandbox';
import { scaffoldRouter } from './routes/scaffold';
import { screenFoldersRouter } from './routes/screen-folders';
import { screenInfoRouter } from './routes/screen-info';
import { screenTemplatesRouter } from './routes/screen-templates';
import { shareRouter } from './routes/share';
import { stateRouter } from './routes/state';
import { tasksRouter } from './routes/tasks';
import { versionRouter } from './routes/version';
import { subscribeState } from './state-store';
import { getProductMcpManager } from './mcp/manager';
import { startAgentRunReaper } from './agent/run-recorder';
import { createWorkspaceAccessGuard } from './workspace-access';

await initializeAuth();

const app = new Hono();

// CORS must run first so valid preflight requests terminate before auth.
app.use('*', createApiCors(authMode()));
// Password mode has one auditable public allowlist; every other /api route,
// including future routes, config, preview and WebSocket upgrade, is gated.
app.use('/api/*', createApiAccessGuard(requireUser, authMode()));
// Remote requests are bound to one canonical workspace below the caller's
// managed subtree before any route reads state or touches the filesystem.
app.use('/api/*', createWorkspaceAccessGuard());
// SameSite=Lax is the first CSRF layer. Mutating cookie-authenticated calls
// additionally need an allowed Origin (service tokens and OIDC are exempt).
app.use('/api/*', createCookieOriginCheck());

// Invalidate the catalog cache whenever the active canvasUrl changes —
// the controller hands out a fresh dev-server port per session, so a
// previewUrl change means a different project (or a fresh restart of
// the same one).
subscribeState((next, prev) => {
  if (next.canvasUrl !== prev.canvasUrl && prev.canvasUrl) {
    invalidateCatalog(prev.canvasUrl);
  }
});

// Public — no auth.
app.get('/health', (c) => c.json({ ok: true }));
app.route('/api/version', versionRouter);
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/config', configRouter);

app.route('/api/chat/stream', chatStreamRouter);
app.route('/api/chat', chatRouter);
app.route('/api/events', eventsRouter);
app.route('/api/state', stateRouter);
app.route('/api/tasks', tasksRouter);
app.route('/api/agent-kit', agentKitRouter);
app.route('/api/agent-runtimes', agentRuntimesRouter);
app.route('/api/agent-runs', agentRunsRouter);
app.route('/api/assets', assetsRouter);
app.route('/api/catalog', catalogRouter);
app.route('/api/patch', patchRouter);
app.route('/api/design', designRouter);
app.route('/api/preview', previewRouter);
app.route('/api/sandbox', sandboxRouter);
app.route('/api/files', filesRouter);
app.route('/api/project/html-design-system', htmlDesignSystemRouter);
app.route('/api/flow', flowRouter);
app.route('/api/fs', fsRouter);
app.route('/api/git', gitRouter);
app.route('/api/host', hostToolsRouter);
app.route('/api/mcp', mcpRouter);
app.route('/api/project/design-context', designContextRouter);
app.route('/api/project/design-index', designIndexRouter);
app.route('/api/project/screen-templates', screenTemplatesRouter);
app.route('/api/project/templates', projectTemplatesRouter);
app.route('/api/project', projectRouter);
app.route('/api/projects', projectsRouter);
app.route('/api/scaffold', scaffoldRouter);
app.route('/api/screen-folders', screenFoldersRouter);
app.route('/api/screens', screenInfoRouter);
app.route('/api/share', shareRouter);
app.route('/api/preview-share', previewShareRouter);

const port = Number(process.env.PORT ?? 3000);
// 0136 R01 — Bun binds 0.0.0.0 when `hostname` is absent. The deployed
// topology puts nginx in front on the same host (deploy/nginx proxies to
// 127.0.0.1:3000), so loopback is both the correct and the safe default;
// SBER_DESIGNER_HOST is the explicit opt-out.
const hostname = process.env.SBER_DESIGNER_HOST?.trim() || '127.0.0.1';

export default {
  port,
  hostname,
  // Agent turns can take longer than Bun's 10s default while the model
  // streams tool calls and the sandbox applies file changes. Keep the
  // SSE connection alive instead of surfacing a false "network error".
  idleTimeout: 255,
  fetch: app.fetch,
  // WebSocket support requires the Bun runtime adapter — see Hono docs.
  websocket,
};

process.stderr.write(`[api] listening on http://${hostname}:${port}\n`);

void getProductMcpManager()
  .startEnabledServers({ reason: 'startup' })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[api] product MCP autoconnect failed: ${message}\n`);
  });

startAgentRunReaper({
  onError: (err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[api] agent run reaper failed: ${message}\n`);
  },
});
