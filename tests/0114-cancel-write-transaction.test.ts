import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ChatRequest, ChatResponse, LlmGateway } from '@sber-designer/llm-gateway';

import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { runAgentStream, type AgentStreamEvent } from '../services/api/src/agent/stream';
import { createToolMutationCoordinator } from '../services/api/src/agent/tool-mutation-transaction';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

test('0114 cancel rolls back only the current write after an earlier write committed', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-cancel-write-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Cancel Transaction Project',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });
  const context = toolContext(workspace, run.runId);
  const tools = await loadAgentToolsForContext(context);
  const writeFile = tools.find((tool) => tool.name === 'write_file');
  if (!writeFile) throw new Error('missing built-in tool write_file');

  const controller = new AbortController();
  const mutationCoordinator = createToolMutationCoordinator(controller.signal);
  const events = runAgentStream({
    gateway: fakeGateway([
      toolCallResponse('write-committed', 'src/screens/Committed.tsx', 'Committed'),
      toolCallResponse('write-cancelled', 'src/screens/RolledBack.tsx', 'Rolled back'),
      {
        text: 'Done.',
        provider: 'mock',
        model: 'mock-model',
        finishReason: 'stop',
      },
    ]),
    messages: [{ role: 'user', content: 'Create two screens.' }],
    tools: [writeFile],
    toolContext: context,
    mutationCoordinator,
    signal: controller.signal,
    requestPermission: async () => ({ decision: 'allow' }),
    maxIterations: 3,
  });

  const firstResult = await nextToolResult(events);
  expect(firstResult.toolCallId).toBe('write-committed');
  await expect(readFile(join(workspace, 'src/screens/Committed.tsx'), 'utf8')).resolves.toContain(
    'Committed',
  );
  expect(await readReceipts(workspace, run.runId)).toHaveLength(0);

  const secondResult = await nextToolResult(events);
  expect(secondResult.toolCallId).toBe('write-cancelled');
  await expect(readFile(join(workspace, 'src/screens/RolledBack.tsx'), 'utf8')).resolves.toContain(
    'Rolled back',
  );

  controller.abort(new Error('Stopped by test.'));
  await expect(events.next()).rejects.toThrow('Stopped by test.');

  await expect(readFile(join(workspace, 'src/screens/Committed.tsx'), 'utf8')).resolves.toContain(
    'Committed',
  );
  expect(
    await readFile(join(workspace, 'src/screens/RolledBack.tsx'), 'utf8').catch(() => null),
  ).toBe(null);

  const receipts = await readReceipts(workspace, run.runId);
  expect(receipts).toHaveLength(2);
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'write_file',
      status: 'ok',
      changedFiles: ['src/screens/Committed.tsx'],
    }),
  );
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'write_file',
      status: 'skipped',
      changedFiles: [],
      metadata: expect.objectContaining({
        rolledBack: true,
        rollbackReason: 'cancelled',
        attemptedFiles: ['src/screens/RolledBack.tsx'],
      }),
    }),
  );
});

test('0114 cancel restores the before snapshot for an uncommitted apply_patch', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-cancel-patch-'));
  const screenPath = 'src/screens/Dashboard.tsx';
  const source = [
    'export function Dashboard() {',
    '  return <main><h1>Before</h1></main>;',
    '}',
    '',
  ].join('\n');
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(join(workspace, screenPath), source, 'utf8');
  const activeScreen = {
    id: 'screen-dashboard',
    name: 'Dashboard',
    kind: 'story' as const,
    storyId: 'screens-dashboard--default',
    filePath: 'src/stories/Dashboard.stories.tsx',
    implementationFilePath: screenPath,
    folder: 'Screens',
  };
  const assistantTaskIntent = {
    kind: 'edit-current-screen' as const,
    targetScreenId: activeScreen.id,
  };
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Cancel Transaction Project',
    workspacePath: workspace,
    activeScreen,
    assistantTaskIntent,
  });
  const context = {
    ...toolContext(workspace, run.runId),
    activeScreen,
    assistantTaskIntent,
  } satisfies ToolContext;
  const tools = await loadAgentToolsForContext(context);
  const applyPatch = tools.find((tool) => tool.name === 'apply_patch');
  if (!applyPatch) throw new Error('missing built-in tool apply_patch');

  const controller = new AbortController();
  const mutationCoordinator = createToolMutationCoordinator(controller.signal);
  const events = runAgentStream({
    gateway: fakeGateway([
      {
        text: '',
        provider: 'mock',
        model: 'mock-model',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'patch-cancelled',
            name: 'apply_patch',
            arguments: JSON.stringify({
              ops: [
                {
                  kind: 'set-children-text',
                  file: screenPath,
                  loc: locOf(source, '<h1'),
                  text: 'After',
                },
              ],
            }),
          },
        ],
      },
    ]),
    messages: [{ role: 'user', content: 'Change the title.' }],
    tools: [applyPatch],
    toolContext: context,
    mutationCoordinator,
    signal: controller.signal,
    maxIterations: 2,
  });

  const result = await nextToolResult(events);
  expect(result.toolCallId).toBe('patch-cancelled');
  await expect(readFile(join(workspace, screenPath), 'utf8')).resolves.toContain('After');

  controller.abort(new Error('Stopped during patch delivery.'));
  await expect(events.next()).rejects.toThrow('Stopped during patch delivery.');
  await expect(readFile(join(workspace, screenPath), 'utf8')).resolves.toBe(source);

  expect(await readReceipts(workspace, run.runId)).toContainEqual(
    expect.objectContaining({
      tool: 'apply_patch',
      status: 'skipped',
      changedFiles: [],
      metadata: expect.objectContaining({
        rolledBack: true,
        attemptedFiles: [screenPath],
      }),
    }),
  );
});

function toolCallResponse(id: string, path: string, label: string): ChatResponse {
  return {
    text: '',
    provider: 'mock',
    model: 'mock-model',
    finishReason: 'tool_calls',
    toolCalls: [
      {
        id,
        name: 'write_file',
        arguments: JSON.stringify({
          path,
          contents: `export function Screen() { return <main>${label}</main>; }\n`,
        }),
      },
    ],
  };
}

async function nextToolResult(
  events: AsyncGenerator<AgentStreamEvent>,
): Promise<Extract<AgentStreamEvent, { type: 'tool-result' }>> {
  for (;;) {
    const next = await events.next();
    if (next.done) throw new Error('stream ended before tool-result');
    if (next.value.type === 'tool-result') return next.value;
  }
}

function fakeGateway(responses: ChatResponse[]): LlmGateway {
  let index = 0;
  return {
    active: { provider: 'mock', model: 'mock-model' },
    listVisibleModels: () => [],
    async chat(_req: ChatRequest): Promise<ChatResponse> {
      return responses[index++] ?? responses.at(-1)!;
    },
    async *chatStream(_req: ChatRequest) {
      const response = responses[index++] ?? responses.at(-1)!;
      for (const call of response.toolCalls ?? []) {
        yield { type: 'tool-call' as const, call };
      }
      yield { type: 'done' as const, final: response };
    },
  };
}

function toolContext(workspacePath: string, runId: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Cancel Transaction Project',
    activeScreen: null,
    assistantTaskIntent: null,
    workspacePath,
    canvasUrl: null,
    runId,
    agentCraftPostCheckEnabled: false,
  } as unknown as ToolContext;
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
  const files = await readdir(receiptsRoot).catch((): string[] => []);
  return Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map(async (file) => JSON.parse(await readFile(join(receiptsRoot, file), 'utf8'))),
  );
}
