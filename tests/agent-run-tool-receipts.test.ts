import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

test('write_file records an agent run receipt after a successful workspace write', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-write-receipt-'));
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Receipt Project',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });
  const writeFileTool = await findBuiltInTool('write_file');

  await expect(
    writeFileTool.handler(
      {
        path: 'src/screens/NewScreen.tsx',
        contents: 'export function NewScreen() { return <main>Ready</main>; }\n',
      },
      toolContext(workspace, run.runId),
    ),
  ).resolves.toMatchObject({ ok: true, path: 'src/screens/NewScreen.tsx' });

  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    version: 1,
    runId: run.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/NewScreen.tsx'],
    metadata: {
      beforeExists: false,
      afterBytes: 59,
    },
  });
});

test('apply_patch records an agent run receipt for changed files after AST edits', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-patch-receipt-'));
  const screenPath = 'src/screens/Dashboard.tsx';
  const source = [
    'export function Dashboard() {',
    '  return <main><h1>Old title</h1></main>;',
    '}',
    '',
  ].join('\n');
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(join(workspace, screenPath), source, 'utf8');
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Receipt Project',
    workspacePath: workspace,
    activeScreen: activeScreen(screenPath),
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-dashboard',
    },
  });
  const applyPatchTool = await findBuiltInTool('apply_patch');

  await expect(
    applyPatchTool.handler(
      {
        ops: [
          {
            kind: 'set-children-text',
            file: screenPath,
            loc: locOf(source, '<h1'),
            text: 'New title',
          },
        ],
      },
      scopedToolContext(workspace, run.runId, screenPath),
    ),
  ).resolves.toMatchObject({ ok: true, changedFiles: [screenPath] });

  await expect(readFile(join(workspace, screenPath), 'utf8')).resolves.toContain('New title');
  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    version: 1,
    runId: run.runId,
    tool: 'apply_patch',
    status: 'ok',
    changedFiles: [screenPath],
    metadata: {
      opCount: 1,
    },
  });
});

test('get_indexed_icon records non-mutating evidence when Lucide fallback is used', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-icon-receipt-'));
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'design-index', 'icon-candidates.jsonl'),
    [
      JSON.stringify({
        id: 'icon-candidate-project-icon-prop-riskalert',
        name: 'RiskAlert',
        source: 'project-icon-prop',
        validFor: ['project-icon-prop'],
        componentName: 'Icon',
        propName: 'iconName',
        confidence: 'high',
        filePath: 'src/components/Icon/Icon.const.ts',
        tags: ['risk', 'alert'],
      }),
      JSON.stringify({
        id: 'icon-candidate-lucide-fallback-search',
        name: 'Search',
        source: 'lucide-fallback',
        validFor: ['lucide-import'],
        importName: 'Search',
        importSource: 'lucide-react',
        confidence: 'fallback',
        tags: ['search'],
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Receipt Project',
    workspacePath: workspace,
    activeScreen: activeScreen('src/screens/Dashboard.tsx'),
    assistantTaskIntent: null,
  });
  const getIconTool = await findBuiltInTool('get_indexed_icon');

  await expect(
    getIconTool.handler({ idOrName: 'Search' }, toolContext(workspace, run.runId)),
  ).resolves.toMatchObject({
    source: 'lucide-fallback',
    warning: true,
  });

  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    tool: 'get_indexed_icon',
    status: 'ok',
    changedFiles: [],
    metadata: {
      iconFallback: {
        provider: 'lucide',
        requested: 'Search',
        resolved: 'Search',
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
    projectName: 'Receipt Project',
    activeScreen: null,
    assistantTaskIntent: null,
    workspacePath,
    canvasUrl: null,
    runId,
    agentCraftPostCheckEnabled: false,
  } as unknown as ToolContext;
}

function scopedToolContext(workspacePath: string, runId: string, screenPath: string): ToolContext {
  return {
    ...toolContext(workspacePath, runId),
    activeScreen: activeScreen(screenPath),
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-dashboard',
    },
  } as unknown as ToolContext;
}

function activeScreen(screenPath: string) {
  return {
    id: 'screen-dashboard',
    name: 'Dashboard',
    kind: 'story',
    storyId: 'screens-dashboard--default',
    filePath: 'src/stories/Dashboard.stories.tsx',
    implementationFilePath: screenPath,
    folder: 'Screens',
  };
}

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}

async function readReceipts(workspace: string, runId: string): Promise<Record<string, unknown>[]> {
  const receiptsRoot = join(workspace, '.sber-designer', 'runs', runId, 'receipts');
  const files = await readdir(receiptsRoot);
  return Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map(async (file) => JSON.parse(await readFile(join(receiptsRoot, file), 'utf8'))),
  );
}
