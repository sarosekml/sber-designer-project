import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { resetConfigCache } from '../services/api/src/config-store';
import { mcpRouter } from '../services/api/src/routes/mcp';

const SIMPLE_PIXSO_MCP_ROOT = '/Users/dev/Work Dev/simple-pixso-mcp';

function config(mcpServers: Record<string, unknown>) {
  return {
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: {
      mock: {
        type: 'mock',
        name: 'Mock',
        models: { echo: { name: 'echo' } },
      },
    },
    mcpServers,
  };
}

test('GET /status returns frontend-safe MCP summaries', async () => {
  const previousPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const previousRoots = process.env.SBER_DESIGNER_MCP_ALLOWED_ROOTS;
  const dir = await mkdtemp(join(tmpdir(), 'sd-mcp-route-'));
  const path = join(dir, 'sber-designer.json');
  await writeFile(
    path,
    JSON.stringify(
      config({
        'talk-to-pixso': {
          type: 'stdio',
          command: 'bun',
          args: ['run', 'dist/server.js'],
          cwd: SIMPLE_PIXSO_MCP_ROOT,
          env: { PIXSO_TOKEN: 'secret-token' },
        },
        'pixso-desktop': {
          type: 'streamable-http',
          url: 'http://127.0.0.1:18412/mcp',
          headers: { Authorization: 'Bearer desktop-secret' },
        },
      }),
      null,
      2,
    ),
    'utf8',
  );

  try {
    process.env.SBER_DESIGNER_CONFIG_PATH = path;
    process.env.SBER_DESIGNER_MCP_ALLOWED_ROOTS = SIMPLE_PIXSO_MCP_ROOT;
    resetConfigCache();

    const response = await mcpRouter.request('http://localhost/status');
    const body = (await response.json()) as {
      servers: Array<{
        key: string;
        namespace: string;
        enabled: boolean;
        configEnabled: boolean;
        runtimeEnabled: boolean;
        toolCount: number;
        status: { transport: string };
        config: { env?: Record<string, string>; headers?: Record<string, string> };
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.servers.map((server) => server.key)).toEqual(['talk-to-pixso', 'pixso-desktop']);
    expect(body.servers[0]?.namespace).toBe('talk_to_pixso');
    expect(body.servers[0]?.status.transport).toBe('not_connected');
    expect(body.servers[0]?.enabled).toBe(true);
    expect(body.servers[0]?.configEnabled).toBe(true);
    expect(body.servers[0]?.runtimeEnabled).toBe(true);
    expect(body.servers[0]?.toolCount).toBe(0);
    expect('trusted' in body.servers[0]!).toBe(false);
    expect(body.servers[0]?.config.env?.PIXSO_TOKEN).toBe('__configured__');
    expect(body.servers[1]?.config.headers?.Authorization).toBe('__configured__');
    expect(JSON.stringify(body)).not.toContain('secret-token');
    expect(JSON.stringify(body)).not.toContain('desktop-secret');
  } finally {
    restoreEnv('SBER_DESIGNER_CONFIG_PATH', previousPath);
    restoreEnv('SBER_DESIGNER_MCP_ALLOWED_ROOTS', previousRoots);
    resetConfigCache();
  }
});

test('POST /reload refreshes MCP status from config file', async () => {
  const previousPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const dir = await mkdtemp(join(tmpdir(), 'sd-mcp-reload-'));
  const path = join(dir, 'sber-designer.json');
  await writeFile(path, JSON.stringify(config({}), null, 2), 'utf8');

  try {
    process.env.SBER_DESIGNER_CONFIG_PATH = path;
    resetConfigCache();

    const before = await mcpRouter.request('http://localhost/status');
    expect(((await before.json()) as { servers: unknown[] }).servers).toHaveLength(0);

    await writeFile(
      path,
      JSON.stringify(
        config({
          'pixso-desktop': {
            type: 'streamable-http',
            url: 'http://127.0.0.1:18412/mcp',
          },
        }),
        null,
        2,
      ),
      'utf8',
    );

    const response = await mcpRouter.request('http://localhost/reload', { method: 'POST' });
    const body = (await response.json()) as { ok: boolean; servers: Array<{ key: string }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.servers.map((server) => server.key)).toEqual(['pixso-desktop']);
  } finally {
    restoreEnv('SBER_DESIGNER_CONFIG_PATH', previousPath);
    resetConfigCache();
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
