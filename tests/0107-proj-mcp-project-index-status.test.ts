import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { ALL_TOOLS, callTool, makeContext } from '../packages/proj-mcp/src';

test('proj-mcp exposes project index status and component counts to CLI runtimes', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-proj-mcp-index-status-'));
  const indexDir = join(workspace, '.sber-designer', 'design-index');
  await mkdir(indexDir, { recursive: true });
  await writeFile(
    join(indexDir, 'manifest.json'),
    JSON.stringify({
      version: 3,
      projectName: 'status-fixture',
      generatedAt: 123,
      fingerprint: 'fixture',
      counts: { components: 7 },
      sources: {
        storybookCatalog: false,
        staticScan: true,
        designMd: false,
        componentNotes: false,
        legacyComponentSelectionMap: false,
        lucideFallback: false,
        assetPacks: false,
        iconSources: false,
        externalIconSources: false,
        usageScan: false,
        screenTemplates: false,
      },
      artifacts: {},
    }),
    'utf8',
  );

  const result = await callTool(
    ALL_TOOLS,
    'get_project_index_status',
    {},
    makeContext({ workspaceRoot: workspace }),
  );

  expect(result.isError).toBe(false);
  const payload = JSON.parse(result.content[0]?.text ?? '{}');
  expect(payload.projectName).toBe('status-fixture');
  expect(payload.counts.components).toBe(7);
  expect(payload.status).toBe('warning');
});
