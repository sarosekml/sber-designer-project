import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { getProductMcpManager, ProductMcpManager, ProductMcpManagerError } from '../mcp/manager';

const RuntimeEnabledSchema = z.object({ enabled: z.boolean() }).strict();
const ToolEnabledSchema = z.object({ enabled: z.boolean() }).strict();

export function createMcpRouter(manager: ProductMcpManager = getProductMcpManager()): Hono {
  return new Hono()
    .get('/status', async (c) => {
      try {
        return c.json(await manager.getSummary());
      } catch (err) {
        return routeError(c, err, 'mcp_status_failed');
      }
    })
    .post('/reload', async (c) => {
      try {
        await manager.reload();
        return c.json({ ok: true, ...(await manager.startEnabledServers({ reason: 'reload' })) });
      } catch (err) {
        return routeError(c, err, 'mcp_reload_failed');
      }
    })
    .post('/:key/connect', async (c) => {
      try {
        return c.json(await manager.connectServer(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_connect_failed');
      }
    })
    .post('/:key/start', async (c) => {
      try {
        return c.json(await manager.connectServer(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_connect_failed');
      }
    })
    .post('/:key/disconnect', async (c) => {
      try {
        return c.json(await manager.disconnectServer(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_disconnect_failed');
      }
    })
    .post('/:key/stop', async (c) => {
      try {
        return c.json(await manager.disconnectServer(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_disconnect_failed');
      }
    })
    .post('/:key/restart', async (c) => {
      try {
        return c.json(await manager.restartServer(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_connect_failed');
      }
    })
    .patch('/:key/enabled', async (c) => {
      const raw = await c.req.json().catch(() => null);
      const parsed = RuntimeEnabledSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
      }
      try {
        return c.json(
          await manager.setServerRuntimeEnabled(c.req.param('key'), parsed.data.enabled),
        );
      } catch (err) {
        return routeError(c, err, 'mcp_override_save_failed');
      }
    })
    .get('/:key/tools', async (c) => {
      try {
        return c.json(await manager.listTools(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_server_not_found');
      }
    })
    .patch('/:key/tools/:toolName/enabled', async (c) => {
      const raw = await c.req.json().catch(() => null);
      const parsed = ToolEnabledSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
      }
      try {
        return c.json(
          await manager.setToolRuntimeEnabled(
            c.req.param('key'),
            c.req.param('toolName'),
            parsed.data.enabled,
          ),
        );
      } catch (err) {
        return routeError(c, err, 'mcp_override_save_failed');
      }
    })
    .delete('/:key/tools/overrides', async (c) => {
      try {
        return c.json(await manager.resetToolRuntimeOverrides(c.req.param('key')));
      } catch (err) {
        return routeError(c, err, 'mcp_override_save_failed');
      }
    });
}

export const mcpRouter = createMcpRouter();

function routeError(c: Context, err: unknown, fallbackCode: string) {
  const code = err instanceof ProductMcpManagerError ? err.code : fallbackCode;
  const detail = err instanceof Error ? err.message : String(err);
  return c.json({ error: code, detail }, statusForMcpError(code));
}

function statusForMcpError(code: string): 400 | 404 | 409 | 500 {
  if (code === 'mcp_server_not_found') return 404;
  if (code === 'mcp_tool_not_found') return 404;
  if (code === 'mcp_server_disabled_in_config') return 409;
  if (code === 'mcp_tool_disabled_in_config') return 409;
  if (code === 'mcp_tool_selection_limit_reached') return 409;
  if (code === 'mcp_tool_selection_minimum_reached') return 409;
  if (code === 'invalid_input') return 400;
  return 500;
}
