/**
 * HTTP transport for proj-mcp (Phase 1.9).
 *
 * Phase 0 shipped only stdio. That's perfect for a Claude Code instance
 * running on the same machine as the editor — but it doesn't work when
 * the agent lives on a different host (CI, remote dev, a teammate's
 * laptop). HTTP closes that gap with a small REST surface in front of
 * the same toolset:
 *
 *   GET  /mcp/health       — liveness, no auth.
 *   GET  /mcp/tools        — list of tools (zod-derived JSON Schema).
 *   POST /mcp/call         — { name, arguments } → CallToolResponse.
 *
 * NOTE: this is **not** the MCP-spec Streamable HTTP transport — that
 * arrives in Phase 4 once we re-test against the latest @modelcontextprotocol
 * SDK release. The simple REST shape here is enough for CI integration
 * tests and curl-based debugging today; Claude Code stays on stdio.
 *
 * Auth: bearer-token in `Authorization: Bearer <token>`. Token comes
 * from `--token <…>` or `SBER_DESIGNER_MCP_TOKEN`. Without a token the
 * server refuses to start (no anonymous HTTP MCP).
 */
import { Hono } from 'hono';

import type { ProjMcpContext } from './context';
import { callTool, listTools } from './tool-runner';
import { ALL_TOOLS, type ToolDefinition } from './tools';

export interface CreateHttpServerOptions {
  context: ProjMcpContext;
  /** Bearer token required on every authenticated request. */
  token: string;
  tools?: ToolDefinition[];
}

export function createHttpServer({
  context,
  token,
  tools = ALL_TOOLS,
}: CreateHttpServerOptions): Hono {
  if (!token) {
    throw new Error('proj-mcp HTTP transport requires a non-empty bearer token.');
  }

  const app = new Hono();

  // Public — liveness only, no token leakage.
  app.get('/mcp/health', (c) =>
    c.json({ ok: true, projectId: context.projectId, version: context.version }),
  );

  // Bearer-token guard for everything else.
  app.use('/mcp/*', async (c, next) => {
    if (c.req.path === '/mcp/health') return next();
    const auth = c.req.header('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return c.json({ error: 'unauthenticated', detail: 'Bearer token required.' }, 401);
    }
    if (auth.slice('Bearer '.length).trim() !== token) {
      return c.json({ error: 'invalid_token' }, 401);
    }
    return next();
  });

  app.get('/mcp/tools', (c) => c.json(listTools(tools)));

  app.post('/mcp/call', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const name = raw && typeof raw.name === 'string' ? raw.name : null;
    const args = raw && 'arguments' in raw ? raw.arguments : undefined;
    if (!name) {
      return c.json({ error: 'invalid_input', detail: 'Body must include `name`.' }, 400);
    }
    const result = await callTool(tools, name, args, context);
    return c.json(result, result.isError ? 422 : 200);
  });

  return app;
}
