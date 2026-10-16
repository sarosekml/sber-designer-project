import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';

import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

test('write_file runs craft post-check by default and writes findings into run receipts and handoff', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-craft-on-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Craft Project',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });
  const writeFileTool = await findBuiltInTool('write_file');

  const result = (await writeFileTool.handler(
    {
      path: 'src/screens/RiskDashboard.tsx',
      contents: [
        'function DownloadIcon() { return <svg aria-hidden="true" />; }',
        'export function RiskDashboard() {',
        '  return <main style={{ color: "#ff0000" }}><p>$2.4M revenue</p><button><DownloadIcon /></button></main>;',
        '}',
        '',
      ].join('\n'),
    },
    toolContext(workspace, run.runId),
  )) as { craft?: { status: string; blocking: number; shouldFix: number } };
  expect(result.craft).toMatchObject({
    status: 'blocked',
    blocking: 2,
    shouldFix: 0,
  });
  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done.',
  });

  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts.map((receipt) => receipt.tool).sort()).toEqual([
    'validate_screen_craft',
    'write_file',
  ]);
  const craftReceipt = receipts.find((receipt) => receipt.tool === 'validate_screen_craft');
  expect(craftReceipt).toMatchObject({
    status: 'ok',
    changedFiles: ['src/screens/RiskDashboard.tsx'],
    metadata: {
      status: 'blocked',
      blocking: 2,
    },
  });
  expect(JSON.stringify(craftReceipt?.metadata)).toContain('craft.fake-metric');

  const handoff = await readFile(
    join(workspace, '.sber-designer', 'runs', run.runId, 'handoff.md'),
    'utf8',
  );
  expect(handoff).toContain('## Craft Findings');
  expect(handoff).toContain('craft.fake-metric');
});

test('write_file skips craft post-check when the agent kit setting is disabled', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-craft-off-'));
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Craft Project',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });
  const writeFileTool = await findBuiltInTool('write_file');

  await writeFileTool.handler(
    {
      path: 'src/screens/RiskDashboard.tsx',
      contents: 'export function RiskDashboard() { return <main><p>$2.4M revenue</p></main>; }\n',
    },
    {
      ...toolContext(workspace, run.runId),
      agentCraftPostCheckEnabled: false,
    },
  );

  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts.map((receipt) => receipt.tool)).toEqual(['write_file']);
});

test('write_file records screen readiness profile and category results in craft receipts', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-readiness-receipt-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(workspace, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:src/styles/tokens.css:surface-default',
            name: 'surface-default',
            value: '#ffffff',
            source: 'css',
            filePath: 'src/styles/tokens.css',
            kind: 'color',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Craft Project',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });
  const writeFileTool = await findBuiltInTool('write_file');

  const result = (await writeFileTool.handler(
    {
      path: 'src/screens/RiskDashboard.tsx',
      contents: [
        '// Mock data.',
        'export function RiskDashboard() {',
        '  return <main style={{ color: "#ff0000" }}><h1>Risk queue</h1></main>;',
        '}',
        '',
      ].join('\n'),
    },
    {
      ...toolContext(workspace, run.runId),
      screenReadiness: {
        enabled: true,
        profile: 'strict',
        categories: {},
      },
    },
  )) as { craft?: { status: string; blocking: number; shouldFix: number } };

  expect(result.craft).toMatchObject({
    status: 'blocked',
    blocking: 1,
    shouldFix: 0,
  });

  const receipts = await readReceipts(workspace, run.runId);
  const craftReceipt = receipts.find((receipt) => receipt.tool === 'validate_screen_craft');

  expect(craftReceipt?.metadata).toMatchObject({
    status: 'blocked',
    profile: {
      enabled: true,
      profile: 'strict',
    },
    categoryResults: {
      designSystemFit: {
        status: 'blocked',
        findings: {
          blocking: 1,
        },
      },
      renderHealth: {
        status: 'skipped',
      },
    },
  });
});

async function findBuiltInTool(name: string) {
  const tools = await loadAgentToolsForContext(toolContext('/tmp/sd-agent-tool-builtins', null));
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing built-in tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string, runId: string | null): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Craft Project',
    activeScreen: null,
    assistantTaskIntent: null,
    workspacePath,
    canvasUrl: null,
    runId,
  };
}

async function readReceipts(workspace: string, runId: string): Promise<Record<string, any>[]> {
  const receiptsRoot = join(workspace, '.sber-designer', 'runs', runId, 'receipts');
  const files = await readdir(receiptsRoot);
  return Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map(async (file) => JSON.parse(await readFile(join(receiptsRoot, file), 'utf8'))),
  );
}
