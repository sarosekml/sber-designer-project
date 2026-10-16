import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { parseConfig } from '../packages/llm-gateway/src/config';
import { normalizeMcpServers } from '../services/api/src/mcp/config';
import { applyMcpServerOverrides, saveMcpServerOverride } from '../services/api/src/mcp/overrides';
import { loadProjectForWorkspace } from '../services/api/src/project-store';

function configWith(mcpServers: Record<string, unknown>) {
  return parseConfig({
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: {
      mock: {
        type: 'mock',
        name: 'Mock',
        models: { echo: { name: 'echo' } },
      },
    },
    mcpServers,
  });
}

function projectWithOverride(
  key: string,
  override: { enabled: boolean; configHash: string; updatedAt: number },
): SberDesignerProject {
  return {
    version: 1,
    name: 'MCP override project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    mcpSettings: {
      serverOverrides: {
        [key]: override,
      },
    },
  };
}

test('applies runtime override only when config hash still matches', () => {
  const [server] = normalizeMcpServers(
    configWith({
      pixso: {
        type: 'streamable-http',
        url: 'http://127.0.0.1:3667/mcp',
      },
    }),
  );

  const disabled = applyMcpServerOverrides(
    [server!],
    projectWithOverride('pixso', { enabled: false, configHash: server!.configHash, updatedAt: 1 }),
  );
  expect(disabled[0]).toMatchObject({
    configEnabled: true,
    runtimeEnabled: false,
    enabled: false,
  });

  const stale = applyMcpServerOverrides(
    [server!],
    projectWithOverride('pixso', {
      enabled: false,
      configHash: `sha256:${'0'.repeat(64)}`,
      updatedAt: 1,
    }),
  );
  expect(stale[0]).toMatchObject({
    configEnabled: true,
    runtimeEnabled: true,
    enabled: true,
  });
});

test('persists runtime override through the project file store', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-mcp-overrides-'));
  const [server] = normalizeMcpServers(
    configWith({
      'pixso-desktop': {
        type: 'streamable-http',
        url: 'http://127.0.0.1:3667/mcp',
      },
    }),
  );

  await loadProjectForWorkspace(workspace, 'MCP Project');
  const saved = await saveMcpServerOverride(server!, false);
  expect(saved.mcpSettings?.serverOverrides?.['pixso-desktop']).toMatchObject({
    enabled: false,
    configHash: server!.configHash,
  });

  const loaded = await loadProjectForWorkspace(workspace, 'MCP Project');
  expect(loaded.mcpSettings?.serverOverrides?.['pixso-desktop']?.enabled).toBe(false);
});
